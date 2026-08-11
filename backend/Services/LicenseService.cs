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
        /// <returns>是否激活成功</returns>
        public async Task<bool> ActivateDeviceAsync(string plainLicenseKey, string hardwareId)
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
                return false;
            }

            // 3. 检查设备是否已经绑定
            var existingDevice = await _context.Devices
                .FirstOrDefaultAsync(d => d.LicenseId == license.Id && d.HardwareId == hardwareId);
            
            if (existingDevice != null)
            {
                // 设备已激活过，直接允许通过
                return true;
            }

            // 4. 检查当前绑定设备数量是否超限
            var currentDeviceCount = await _context.Devices.CountAsync(d => d.LicenseId == license.Id);
            if (currentDeviceCount >= license.MaxDevices)
            {
                // 达到了最大设备限制
                // 生产建议：此处应记录一条安全 AuditLog，方便后续排查或防爆破分析
                return false;
            }

            // 5. 绑定新设备
            var newDevice = new Device
            {
                HardwareId = hardwareId,
                LicenseId = license.Id,
                ActivatedAt = DateTime.UtcNow
            };

            _context.Devices.Add(newDevice);
            await _context.SaveChangesAsync();

            return true;
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
