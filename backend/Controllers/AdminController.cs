using System;
using System.Linq;
using System.Threading.Tasks;
using backend.Data;
using backend.Services;
using backend.Filters;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using backend.Models;
namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [SessionAuth] // 应用单设备会话互踢与全局鉴权
    // [Authorize(Roles = "Admin")] // 警告：生产环境必须解除此注释并接入认证中间件！
    public class AdminController : ControllerBase
    {
        private readonly AdminService _adminService;
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;

        public AdminController(AdminService adminService, AppDbContext context, IMemoryCache cache)
        {
            _adminService = adminService;
            _context = context;
            _cache = cache;
        }

        [HttpGet("audit-logs")]
        public async Task<IActionResult> GetAuditLogs(
            [FromQuery] string? action, 
            [FromQuery] bool? isSuccess, 
            [FromQuery] DateTime? startDate, 
            [FromQuery] DateTime? endDate,
            [FromQuery] string? keyword,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var query = _context.AuditLogs.AsQueryable();

            if (!string.IsNullOrEmpty(action) && action != "all")
                query = query.Where(l => l.Action == action);

            if (isSuccess.HasValue)
                query = query.Where(l => l.IsSuccess == isSuccess.Value);

            if (startDate.HasValue)
                query = query.Where(l => l.Timestamp >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(l => l.Timestamp <= endDate.Value);

            if (!string.IsNullOrEmpty(keyword))
            {
                var lowerKeyword = keyword.ToLower();
                query = query.Where(l => 
                    l.Operator.ToLower().Contains(lowerKeyword) || 
                    l.Details.ToLower().Contains(lowerKeyword) ||
                    l.Target.ToLower().Contains(lowerKeyword));
            }

            var total = await query.CountAsync();
            var logs = await query.AsNoTracking()
                                  .OrderByDescending(l => l.Timestamp)
                                  .Skip((page - 1) * pageSize)
                                  .Take(pageSize)
                                  .ToListAsync();

            return Ok(new { total, data = logs });
        }

        [HttpPost("generate-license")]
        public async Task<IActionResult> GenerateLicense([FromBody] GenerateLicenseRequest request)
        {
            // 假设从 JWT Token 获取操作者名称，目前暂用写死的值
            var operatorName = "AdminUser_Placeholder";
            
            int count = request.Count > 0 ? request.Count : 1;
            string licenseType = string.IsNullOrEmpty(request.LicenseType) ? "Permanent" : request.LicenseType;
            
            var adminUserIdString = HttpContext.Request.Headers["X-User-Id"].FirstOrDefault();
            var adminUserId = string.IsNullOrEmpty(adminUserIdString) ? Guid.Empty : Guid.Parse(adminUserIdString);

            var newKeys = await _adminService.GenerateLicensesAsync(adminUserId, request.MaxDevices, count, licenseType, request.ExpirationDate, operatorName, request.AllowDeviceTransfer, request.MaxActivations);
            
            // 仅在此处返回明文激活码供后台显示或邮件发送。之后再也无法从数据库读取明文。
            return Ok(new { LicenseKeys = newKeys, Message = $"成功批量生成 {count} 张激活码并已将哈希安全入库。" });
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            const string cacheKey = "AdminStatsCache";
            
            if (_cache.TryGetValue(cacheKey, out object? cachedStats))
            {
                return Ok(cachedStats);
            }

            var today = DateTime.UtcNow.Date;
            var sevenDaysAgo = today.AddDays(-6); // Include today

            // 获取7天内的激活成功日志
            var activationLogs = await _context.AuditLogs
                .AsNoTracking()
                .Where(l => l.Timestamp >= sevenDaysAgo && l.Action == "DeviceActivate" && l.IsSuccess == true)
                .ToListAsync();

            // 获取7天内的风控拦截日志
            var blockedLogs = await _context.AuditLogs
                .AsNoTracking()
                .Where(l => l.Timestamp >= sevenDaysAgo && l.Action == "RateLimitBlocked")
                .ToListAsync();

            // 按天聚合
            var chartData = new System.Collections.Generic.List<object>();
            for (int i = 0; i < 7; i++)
            {
                var targetDate = sevenDaysAgo.AddDays(i);
                var actCount = activationLogs.Count(l => l.Timestamp.Date == targetDate);
                var blockCount = blockedLogs.Count(l => l.Timestamp.Date == targetDate);
                chartData.Add(new { Date = targetDate.ToString("MM-dd"), Activations = actCount, Blocks = blockCount });
            }

            var totalActiveLicenses = await _context.Licenses.AsNoTracking().CountAsync(l => l.IsActive && (!l.ExpirationDate.HasValue || l.ExpirationDate > DateTime.UtcNow));
            var totalDevices = await _context.Devices.AsNoTracking().CountAsync();

            var statsData = new
            {
                TotalActiveLicenses = totalActiveLicenses,
                TotalDevices = totalDevices,
                TodayActivations = activationLogs.Count(l => l.Timestamp.Date == today),
                TodayBlocks = blockedLogs.Count(l => l.Timestamp.Date == today),
                ChartData = chartData
            };

            // 设置缓存，过期时间缩短至 2 秒，实现大盘数据的准实时更新
            var cacheEntryOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromSeconds(2));

            _cache.Set(cacheKey, statsData, cacheEntryOptions);

            return Ok(statsData);
        }

        [HttpPost("revoke-license/{id}")]
        public async Task<IActionResult> RevokeLicense(int id)
        {
            var operatorName = "AdminUser_Placeholder";
            var success = await _adminService.RevokeLicenseAsync(id, operatorName);

            if (success) return Ok(new { Message = "吊销成功，相关审计日志已记录。" });
            return NotFound(new { Message = "未找到该 License。" });
        }

        [HttpGet("licenses/detail")]
        public async Task<IActionResult> GetLicenseDetails([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var query = _context.Licenses.AsQueryable();

            if (startDate.HasValue)
                query = query.Where(l => l.CreatedAt >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(l => l.CreatedAt <= endDate.Value);

            var licenses = await query
                .Include(l => l.Devices)
                .AsNoTracking()
                .OrderByDescending(l => l.CreatedAt)
                .Take(500)
                .Select(l => new {
                    l.Id,
                    l.MaxDevices,
                    l.UserId,
                    l.AllowDeviceTransfer,
                    l.MaxActivations,
                    l.CurrentActivationCount,
                    l.IsActive,
                    l.LicenseType,
                    l.ExpirationDate,
                    l.CreatedAt,
                    ActivatedDevices = l.Devices != null ? l.Devices.Select(d => d.HardwareId).ToList() : new System.Collections.Generic.List<string>()
                })
                .ToListAsync();

            return Ok(licenses);
        }

        [HttpGet("devices/detail")]
        public async Task<IActionResult> GetDeviceDetails([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var query = _context.Devices.AsQueryable();

            if (startDate.HasValue)
                query = query.Where(d => d.ActivatedAt >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(d => d.ActivatedAt <= endDate.Value);

            var devices = await query
                .Include(d => d.License)
                .Where(d => d.License == null || d.License.LicenseType != "Test")
                .AsNoTracking()
                .OrderByDescending(d => d.ActivatedAt)
                .Take(500)
                .Select(d => new {
                    d.Id,
                    d.HardwareId,
                    d.LicenseId,
                    d.ActivatedAt,
                    LicenseType = d.License != null ? d.License.LicenseType : "Unknown",
                    LicenseMaxDevices = d.License != null ? d.License.MaxDevices : 0
                })
                .ToListAsync();

            return Ok(devices);
        }

        [HttpGet("settings/registration")]
        [AllowAnonymous] // 允许非认证用户查询注册状态
        public async Task<IActionResult> GetRegistrationSetting()
        {
            var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "RegistrationEnabled");
            // 默认开启
            bool isEnabled = setting == null || setting.Value == "true";
            return Ok(new { RegistrationEnabled = isEnabled });
        }

        public class RegistrationSettingRequest
        {
            public bool RegistrationEnabled { get; set; }
        }

        [HttpPost("settings/registration")]
        public async Task<IActionResult> SetRegistrationSetting([FromBody] RegistrationSettingRequest request)
        {
            var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "RegistrationEnabled");
            if (setting == null)
            {
                setting = new SystemSetting { Key = "RegistrationEnabled", Value = request.RegistrationEnabled ? "true" : "false" };
                _context.SystemSettings.Add(setting);
            }
            else
            {
                setting.Value = request.RegistrationEnabled ? "true" : "false";
            }
            
            await _context.SaveChangesAsync();
            return Ok(new { Message = "注册设置已更新", RegistrationEnabled = request.RegistrationEnabled });
        }
        
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users
                .AsNoTracking()
                .OrderByDescending(u => u.CreatedAt)
                .Select(u => new 
                {
                    u.Id,
                    u.Email,
                    u.Role,
                    u.IsEmailVerified,
                    u.CreatedAt,
                    u.IsTwoFactorEnabled
                })
                .ToListAsync();
            
            return Ok(users);
        }

        public class UpdateRoleRequest
        {
            public string Role { get; set; } = string.Empty;
        }

        [HttpPut("users/{id}/role")]
        public async Task<IActionResult> UpdateUserRole(Guid id, [FromBody] UpdateRoleRequest request)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { Message = "未找到该用户。" });

            if (request.Role != "Admin" && request.Role != "User")
            {
                return BadRequest(new { Message = "角色无效。" });
            }

            user.Role = request.Role;
            await _context.SaveChangesAsync();

            return Ok(new { Message = "用户角色已更新。" });
        }

        [HttpDelete("users/{id}")]
        public async Task<IActionResult> DeleteUser(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { Message = "未找到该用户。" });

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "用户已删除。" });
        }

        public class ResetUserPasswordRequest
        {
            public string NewPassword { get; set; } = string.Empty;
        }

        [HttpPost("users/{id}/password")]
        public async Task<IActionResult> ResetUserPassword(Guid id, [FromBody] ResetUserPasswordRequest request)
        {
            if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < 6)
            {
                return BadRequest(new { Message = "密码长度至少需要 6 个字符。" });
            }

            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { Message = "未找到该用户。" });

            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var bytes = System.Text.Encoding.UTF8.GetBytes(request.NewPassword);
            var hash = sha256.ComputeHash(bytes);
            user.PasswordHash = Convert.ToBase64String(hash);
            
            // 踢出用户的当前会话（为了安全，重置密码后使当前设备外都失效）
            user.CurrentSessionToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
            user.FailedLoginAttempts = 0;
            user.LockoutEnd = null;

            await _context.SaveChangesAsync();

            return Ok(new { Message = "用户密码已重置成功。" });
        }
    }

    public class GenerateLicenseRequest
    {
        public int MaxDevices { get; set; } = 1;
        public int Count { get; set; } = 1;
        public string? LicenseType { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public bool AllowDeviceTransfer { get; set; } = false;
        public int MaxActivations { get; set; } = 0;
    }
}
