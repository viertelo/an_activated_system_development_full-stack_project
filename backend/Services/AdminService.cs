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
        /// 生成一个新的 License
        /// 仅返回明文一次，数据库内部只保存 Hash 值
        /// </summary>
        public async Task<string> GenerateLicenseAsync(Guid userId, int maxDevices, string operatorName)
        {
            var plainKey = Guid.NewGuid().ToString().ToUpper();
            var hashedKey = HashKey(plainKey);

            var license = new License
            {
                LicenseKeyHash = hashedKey,
                MaxDevices = maxDevices,
                UserId = userId,
                IsActive = true
            };

            _context.Licenses.Add(license);
            
            // 记录安全审计日志
            _context.AuditLogs.Add(new AuditLog
            {
                Action = "GenerateLicense",
                Operator = operatorName,
                Target = $"UserId:{userId}",
                IsSuccess = true,
                Details = $"Generated License with MaxDevices: {maxDevices}"
            });

            await _context.SaveChangesAsync();
            return plainKey;
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
