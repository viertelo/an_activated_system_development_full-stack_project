using System;
using System.Linq;
using System.Threading.Tasks;
using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace backend.Services
{
    public class LicenseService
    {
        private readonly AppDbContext _context;

        public LicenseService(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// 激活设备
        /// 安全原则：不要在服务中打印或向客户端直接暴露 License 状态（例如告知对方已过期、设备满了等具体细节），统一返回“失败”或特定的受限状态。
        /// </summary>
        /// <param name="plainLicenseKey">用户输入的原始激活码</param>
        /// <param name="hardwareId">设备的硬件指纹</param>
        /// <returns>是否激活成功，错误代码，错误信息，许可证对象</returns>
        public async Task<(bool IsSuccess, string ErrorCode, string ErrorMessage, License? LicenseInfo)> ActivateDeviceAsync(string plainLicenseKey, string hardwareId)
        {
            // 1. 哈希处理（严禁明文比对）
            var hashedKey = HashKey(plainLicenseKey);

            // 2. 查找许可证
            var license = await _context.Licenses
                .Include(l => l.User)
                .FirstOrDefaultAsync(l => l.LicenseKeyHash == hashedKey);

            if (license == null || !license.IsActive)
            {
                // 找不到或被吊销，拒绝
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "DeviceActivate",
                    Operator = hardwareId,
                    Target = "Unknown/Revoked License",
                    IsSuccess = false,
                    Details = "尝试使用不存在或已吊销的激活码"
                });
                await _context.SaveChangesAsync();
                return (false, "INVALID", "无效的激活码或该激活码已被吊销", null);
            }

            // 邮箱验证已移除：允许最终用户在电商购买后直接使用激活码激活，无需提供经销商的邮箱


            if (license.ExpirationDate.HasValue && license.ExpirationDate.Value < DateTime.UtcNow)
            {
                // 已过期，拒绝
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "DeviceActivate",
                    Operator = hardwareId,
                    Target = $"LicenseId:{license.Id}",
                    IsSuccess = false,
                    Details = "尝试使用已过期的激活码"
                });
                await _context.SaveChangesAsync();
                return (false, "EXPIRED", "该激活码已过期", license);
            }

            // 3. 检查设备是否已经绑定
            var existingDevice = await _context.Devices
                .FirstOrDefaultAsync(d => d.LicenseId == license.Id && d.HardwareId == hardwareId);
            
            if (existingDevice != null)
            {
                // 设备已激活过，直接允许通过
                return (true, "", "", license);
            }

            // 4. 检查总激活次数限制
            if (license.MaxActivations > 0 && license.CurrentActivationCount >= license.MaxActivations)
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "DeviceActivate",
                    Operator = hardwareId,
                    Target = $"LicenseId:{license.Id}",
                    IsSuccess = false,
                    Details = $"已达到终生最大激活次数限制 ({license.MaxActivations}次)"
                });
                await _context.SaveChangesAsync();
                return (false, "MAX_ACTIVATIONS_REACHED", $"已达到终生最大激活次数限制 ({license.MaxActivations}次)", license);
            }

            // 5. 检查当前绑定设备数量是否超限 及 换绑逻辑
            string transferMessage = "";
            var currentDeviceCount = await _context.Devices.CountAsync(d => d.LicenseId == license.Id);
            if (currentDeviceCount >= license.MaxDevices)
            {
                if (license.AllowDeviceTransfer)
                {
                    // 允许换绑：查找并解绑最早激活的一台设备
                    var oldestDevice = await _context.Devices
                        .Where(d => d.LicenseId == license.Id)
                        .OrderBy(d => d.ActivatedAt)
                        .FirstOrDefaultAsync();
                    
                    if (oldestDevice != null)
                    {
                        _context.Devices.Remove(oldestDevice);
                        _context.AuditLogs.Add(new AuditLog
                        {
                            Action = "DeviceAutoTransfer",
                            Operator = hardwareId,
                            Target = $"LicenseId:{license.Id}",
                            IsSuccess = true,
                            Details = $"自动解绑老设备 {oldestDevice.HardwareId}"
                        });
                        transferMessage = $"激活成功！由于当前已达最大设备绑定上限，系统已自动为您踢出最早激活的设备 ({oldestDevice.HardwareId})。";
                        // 移除后继续下面的绑定新设备流程
                    }
                }
                else
                {
                    // 不允许换绑，且达到了最大设备限制
                    _context.AuditLogs.Add(new AuditLog
                    {
                        Action = "DeviceActivate",
                        Operator = hardwareId,
                        Target = $"LicenseId:{license.Id}",
                        IsSuccess = false,
                        Details = "超过最大设备限制且不允许换绑"
                    });
                    await _context.SaveChangesAsync();
                    return (false, "DEVICE_LIMIT_REACHED", "绑定的设备数量已达上限", license);
                }
            }

            // 6. 绑定新设备并增加激活次数统计
            license.CurrentActivationCount++;

            // 5. 绑定新设备
            var newDevice = new Device
            {
                HardwareId = hardwareId,
                LicenseId = license.Id,
                ActivatedAt = DateTime.UtcNow
            };

            _context.Devices.Add(newDevice);

            _context.AuditLogs.Add(new AuditLog
            {
                Action = "DeviceActivate",
                Operator = hardwareId,
                Target = $"LicenseId:{license.Id}",
                IsSuccess = true,
                Details = "新设备激活成功"
            });

            await _context.SaveChangesAsync();

            if (!string.IsNullOrEmpty(transferMessage))
            {
                return (true, "TRANSFERRED", transferMessage, license);
            }

            return (true, "", "", license);
        }

        /// <summary>
        /// 解绑设备
        /// </summary>
        public async Task<bool> DeactivateDeviceAsync(string hardwareId, string operatorName)
        {
            var device = await _context.Devices.FirstOrDefaultAsync(d => d.HardwareId == hardwareId);
            if (device == null) return false;

            _context.Devices.Remove(device);
            
            // 记录安全审计日志
            _context.AuditLogs.Add(new AuditLog
            {
                Action = "DeactivateDevice",
                Operator = operatorName,
                Target = $"HardwareId:{hardwareId}",
                IsSuccess = true
            });

            await _context.SaveChangesAsync();
            return true;
        }

        /// <summary>
        /// 使用 SHA256 对激活码进行不可逆哈希
        /// </summary>
        private string HashKey(string input)
        {
            using (var sha256 = SHA256.Create())
            {
                var bytes = Encoding.UTF8.GetBytes(input);
                var hashBytes = sha256.ComputeHash(bytes);
                return Convert.ToHexString(hashBytes);
            }
        }
    }
}
