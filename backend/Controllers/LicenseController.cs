using System.Threading.Tasks;
using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LicenseController : ControllerBase
    {
        private readonly LicenseService _licenseService;
        private readonly AdminService _adminService;
        private readonly EmailService _emailService;
        private readonly AuthService _authService;
        private readonly backend.Data.AppDbContext _context;

        public LicenseController(
            LicenseService licenseService, 
            AdminService adminService,
            EmailService emailService,
            AuthService authService,
            backend.Data.AppDbContext context)
        {
            _licenseService = licenseService;
            _adminService = adminService;
            _emailService = emailService;
            _authService = authService;
            _context = context;
        }

        public class ForgotLicenseDto
        {
            public string Email { get; set; } = string.Empty;
        }

        /// <summary>
        /// 触发找回激活码（重置换新）流程
        /// </summary>
        [HttpPost("forgot")]
        public async System.Threading.Tasks.Task<IActionResult> ForgotLicense([FromBody] ForgotLicenseDto dto)
        {
            var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(_context.Users, u => u.Email == dto.Email);
            if (user == null)
            {
                // 安全原则：即使邮箱不存在，也不要明确提示，防止枚举攻击
                return Ok(new { Message = "如果您的邮箱存在，重置链接已发送到您的邮箱。" });
            }

            var token = _authService.GenerateEmailVerificationToken();
            user.EmailVerificationToken = token;
            user.EmailTokenExpiry = System.DateTime.UtcNow.AddHours(1); // 1小时内有效
            await _context.SaveChangesAsync();

            var resetLink = $"http://{Request.Host}/api/license/reset?token={token}";
            var htmlBody = $"<h3>激活码重置请求</h3><p>系统收到您找回激活码的请求。</p><p>为保证绝对安全，系统无法提供原激活码。请点击下方链接，系统将为您<strong>吊销旧激活码并颁发一个全新的激活码</strong>：</p><p><a href='{resetLink}'>点击重置并生成新激活码</a></p><p>如果这不是您的操作，请忽略此邮件。</p>";
            
            await _emailService.SendEmailAsync(user.Email, "您的激活码重置确认", htmlBody);

            return Ok(new { Message = "如果您的邮箱存在，重置链接已发送到您的邮箱。" });
        }

        /// <summary>
        /// 执行重置（验证 token，吊销旧码，发新码到邮箱）
        /// </summary>
        [HttpGet("reset")]
        public async System.Threading.Tasks.Task<IActionResult> ResetLicense([FromQuery] string token)
        {
            var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(_context.Users, u => u.EmailVerificationToken == token);
            if (user == null || user.EmailTokenExpiry < System.DateTime.UtcNow)
            {
                return BadRequest("重置链接无效或已过期。");
            }

            // 吊销该用户所有激活状态的旧激活码
            var activeLicenses = _context.Licenses.Where(l => l.UserId == user.Id && l.IsActive);
            foreach(var lic in activeLicenses)
            {
                lic.IsActive = false;
            }

            // 清除 Token
            user.EmailVerificationToken = null;
            user.EmailTokenExpiry = null;
            await _context.SaveChangesAsync();

            // 生成新的明文激活码 (默认 MaxDevices 继承旧版逻辑，这里简化为 1)
            var plainKey = await _adminService.GenerateLicenseAsync(user.Id, 1, "SystemReset");

            // 将新激活码发到用户邮箱
            var htmlBody = $"<h3>重置成功</h3><p>您旧的激活码已全部作废。以下是您的全新激活码，请妥善保管：</p><h2 style='color:blue;'>{plainKey}</h2>";
            await _emailService.SendEmailAsync(user.Email, "您的全新激活码", htmlBody);

            return Ok("激活码已重置换新！新的明文激活码已发送到您的邮箱，请查收。");
        }

        /// <summary>
        /// 激活端点
        /// 安全原则：此接口极易被爆破，应在外部负载均衡器（如 Nginx、WAF）或中间件（Rate Limiting）上设置极其严格的限流。
        /// 且必须强制要求客户端通过 HTTPS 连接。
        /// </summary>
        [HttpPost("activate")]
        public async Task<IActionResult> Activate([FromBody] ActivationRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || 
                string.IsNullOrWhiteSpace(request.LicenseKey) || 
                string.IsNullOrWhiteSpace(request.HardwareId))
            {
                return BadRequest("参数不完整。");
            }

            // 实际商用时，这里还应该通过 request.Email 去验证用户身份及归属权
            // 本处简化为直接通过 LicenseKey 进行验证激活
            var success = await _licenseService.ActivateDeviceAsync(request.LicenseKey, request.HardwareId);

            if (success)
            {
                // 成功激活
                // 安全说明：对于 C/S 客户端，可以返回一个经过私钥签名 (RSA/ECDSA) 的授权 Token 给客户端本地验证，以防中间人攻击伪造返回值。
                return Ok(new { Message = "激活成功。" });
            }
            else
            {
                // 激活失败
                // 绝对安全策略：模糊化错误信息，不让黑客知道是“激活码错误”还是“设备数量达标”。
                return Unauthorized(new { Message = "授权失败，请检查凭据或稍后重试。" });
            }
        }
    }

    public class ActivationRequest
    {
        public string Email { get; set; } = string.Empty;
        public string LicenseKey { get; set; } = string.Empty;
        public string HardwareId { get; set; } = string.Empty;
    }
}
