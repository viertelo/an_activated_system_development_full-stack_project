using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services
{
    public class AdminService
    {
        private readonly AppDbContext _context;

        public AdminService(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// 生成一个新的或多个 License
        /// 仅返回明文一次，数据库内部只保存 Hash 值
        /// </summary>
        public async Task<List<string>> GenerateLicensesAsync(Guid userId, int maxDevices, int count, string licenseType, DateTime? expirationDate, string operatorName, bool allowDeviceTransfer, int maxActivations)
        {
            var plainKeys = new List<string>();
            var newLicenses = new List<License>();

            for (int i = 0; i < count; i++)
            {
                var plainKey = Guid.NewGuid().ToString().ToUpper();
                var hashedKey = HashKey(plainKey);

                newLicenses.Add(new License
                {
                    LicenseKeyHash = hashedKey,
                    MaxDevices = maxDevices,
                    UserId = userId,
                    IsActive = true,
                    LicenseType = licenseType,
                    ExpirationDate = expirationDate,
                    AllowDeviceTransfer = allowDeviceTransfer,
                    MaxActivations = maxActivations
                });
                plainKeys.Add(plainKey);
            }

            _context.Licenses.AddRange(newLicenses);
            
            // 记录安全审计日志
            _context.AuditLogs.Add(new AuditLog
            {
                Action = "GenerateLicense",
                Operator = operatorName,
                Target = $"UserId:{userId}",
                IsSuccess = true,
                Details = $"Generated {count} Licenses of type {licenseType}. MaxDevices: {maxDevices}"
            });

            await _context.SaveChangesAsync();
            return plainKeys;
        }

        /// <summary>
        /// 吊销一个 License
        /// </summary>
        public async Task<bool> RevokeLicenseAsync(int licenseId, string operatorName)
        {
            var license = await _context.Licenses.FindAsync(licenseId);
            if (license == null) return false;

            license.IsActive = false;

            // 记录安全审计日志
            _context.AuditLogs.Add(new AuditLog
            {
                Action = "RevokeLicense",
                Operator = operatorName,
                Target = $"LicenseId:{licenseId}",
                IsSuccess = true
            });

            await _context.SaveChangesAsync();
            return true;
        }

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
