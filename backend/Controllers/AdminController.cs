using System;
using System.Linq;
using System.Threading.Tasks;
using backend.Data;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize(Roles = "Admin")] // 警告：生产环境必须解除此注释并接入认证中间件！
    public class AdminController : ControllerBase
    {
        private readonly AdminService _adminService;
        private readonly AppDbContext _context;

        public AdminController(AdminService adminService, AppDbContext context)
        {
            _adminService = adminService;
            _context = context;
        }

        [HttpGet("audit-logs")]
        public async Task<IActionResult> GetAuditLogs([FromQuery] string? action, [FromQuery] bool? isSuccess, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var query = _context.AuditLogs.AsQueryable();

            if (!string.IsNullOrEmpty(action))
                query = query.Where(l => l.Action == action);

            if (isSuccess.HasValue)
                query = query.Where(l => l.IsSuccess == isSuccess.Value);

            if (startDate.HasValue)
                query = query.Where(l => l.Timestamp >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(l => l.Timestamp <= endDate.Value);

            // 默认返回最近100条记录，避免数据量过大
            var logs = await query.OrderByDescending(l => l.Timestamp).Take(100).ToListAsync();

            return Ok(logs);
        }

        [HttpPost("generate-license")]
        public async Task<IActionResult> GenerateLicense([FromBody] GenerateLicenseRequest request)
        {
            // 假设从 JWT Token 获取操作者名称，目前暂用写死的值
            var operatorName = "AdminUser_Placeholder";
            
            int count = request.Count > 0 ? request.Count : 1;
            string licenseType = string.IsNullOrEmpty(request.LicenseType) ? "Permanent" : request.LicenseType;
            
            var newKeys = await _adminService.GenerateLicensesAsync(request.UserId, request.MaxDevices, count, licenseType, request.ExpirationDate, operatorName);
            
            // 仅在此处返回明文激活码供后台显示或邮件发送。之后再也无法从数据库读取明文。
            return Ok(new { LicenseKeys = newKeys, Message = $"成功批量生成 {count} 张激活码并已将哈希安全入库。" });
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var today = DateTime.UtcNow.Date;
            var sevenDaysAgo = today.AddDays(-6); // Include today

            // 获取7天内的激活成功日志
            var activationLogs = await _context.AuditLogs
                .Where(l => l.Timestamp >= sevenDaysAgo && l.Action == "DeviceActivate" && l.IsSuccess == true)
                .ToListAsync();

            // 获取7天内的风控拦截日志
            var blockedLogs = await _context.AuditLogs
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

            var totalActiveLicenses = await _context.Licenses.CountAsync(l => l.IsActive && (!l.ExpirationDate.HasValue || l.ExpirationDate > DateTime.UtcNow));
            var totalDevices = await _context.Devices.CountAsync();

            return Ok(new
            {
                TotalActiveLicenses = totalActiveLicenses,
                TotalDevices = totalDevices,
                TodayActivations = activationLogs.Count(l => l.Timestamp.Date == today),
                TodayBlocks = blockedLogs.Count(l => l.Timestamp.Date == today),
                ChartData = chartData
            });
        }

        [HttpPost("revoke-license/{id}")]
        public async Task<IActionResult> RevokeLicense(int id)
        {
            var operatorName = "AdminUser_Placeholder";
            var success = await _adminService.RevokeLicenseAsync(id, operatorName);

            if (success) return Ok(new { Message = "吊销成功，相关审计日志已记录。" });
            return NotFound(new { Message = "未找到该 License。" });
        }
    }

    public class GenerateLicenseRequest
    {
        public System.Guid UserId { get; set; }
        public int MaxDevices { get; set; } = 1;
        public int Count { get; set; } = 1;
        public string? LicenseType { get; set; }
        public DateTime? ExpirationDate { get; set; }
    }
}
