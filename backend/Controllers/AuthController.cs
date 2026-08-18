using backend.Data;
using backend.Models;
using backend.Services;
using backend.Filters;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [SessionAuth]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AuthService _authService;
        private readonly EmailService _emailService;

        public AuthController(AppDbContext context, AuthService authService, EmailService emailService)
        {
            _context = context;
            _authService = authService;
            _emailService = emailService;
        }

        public class RegisterDto
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            var regSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "RegistrationEnabled");
            if (regSetting != null && regSetting.Value == "false")
            {
                return BadRequest(new { Message = "当前系统已关闭用户注册功能" });
            }

            if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
            {
                return BadRequest(new { Message = "该邮箱已被注册" });
            }

            var token = _authService.GenerateEmailVerificationToken();
            var user = new User
            {
                Email = dto.Email,
                PasswordHash = HashPassword(dto.Password), // 商业级应加盐(Salt)，此处仅演示
                IsEmailVerified = false,
                EmailVerificationToken = token,
                EmailTokenExpiry = DateTime.UtcNow.AddHours(24) // 验证链接 24 小时有效
            };

            _context.Users.Add(user);
            
            _context.AuditLogs.Add(new AuditLog
            {
                Action = "UserRegister",
                Operator = dto.Email,
                Target = $"UserId:{user.Id}",
                IsSuccess = true
            });

            await _context.SaveChangesAsync();

            var scheme = Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? Request.Scheme;
            var verifyLink = $"{scheme}://{Request.Host}/api/auth/verify-email?token={token}";
            var htmlBody = $"<h3>欢迎注册激活系统</h3><p>请点击下方链接确认您的邮箱以开通账户：</p><p><a href='{verifyLink}'>验证我的邮箱</a></p>";
            try
            {
                await _emailService.SendEmailAsync(user.Email, "请验证您的注册邮箱", htmlBody);
            }
            catch (Exception)
            {
                return StatusCode(500, new { Message = "邮件发送失败，请稍后重试。" });
            }

            return Ok(new { Message = "注册成功，请前往邮箱点击验证链接开通账户。" });
        }

        [HttpGet("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromQuery] string token)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.EmailVerificationToken == token);
            if (user == null || user.EmailTokenExpiry < DateTime.UtcNow)
            {
                return BadRequest("验证链接无效或已过期。");
            }

            user.IsEmailVerified = true;
            user.EmailVerificationToken = null;
            user.EmailTokenExpiry = null;
            await _context.SaveChangesAsync();

            return Ok("邮箱验证成功！您现在可以正常登录并使用高级功能。");
        }

        public class LoginDto
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
            public string? TwoFactorCode { get; set; } // 用户填写的 6 位 2FA 验证码
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            // First, find the user by email regardless of password to check lockout
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null)
            {
                return Unauthorized(new { Message = "邮箱或密码错误。" });
            }

            if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTime.UtcNow)
            {
                var remainingMinutes = (int)(user.LockoutEnd.Value - DateTime.UtcNow).TotalMinutes + 1;
                return Unauthorized(new { Message = $"密码错误次数过多，账号已锁定，请 {remainingMinutes} 分钟后再试。" });
            }

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown IP";

            var hashedPw = HashPassword(dto.Password);
            if (user.PasswordHash != hashedPw)
            {
                user.FailedLoginAttempts++;
                if (user.FailedLoginAttempts >= 3)
                {
                    user.LockoutEnd = DateTime.UtcNow.AddMinutes(15);
                }
                
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "UserLogin",
                    Operator = dto.Email,
                    Target = "System",
                    IsSuccess = false,
                    Details = $"[IP: {ip}] 密码错误 (连续错误 {user.FailedLoginAttempts} 次)"
                });
                await _context.SaveChangesAsync();
                
                if (user.FailedLoginAttempts >= 3)
                    return Unauthorized(new { Message = "密码错误次数过多，账号已锁定 15 分钟。" });
                
                return Unauthorized(new { Message = "邮箱或密码错误。" });
            }

            // Authentication succeeded, reset lockout
            user.FailedLoginAttempts = 0;
            user.LockoutEnd = null;

            if (!user.IsEmailVerified)
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "UserLogin",
                    Operator = dto.Email,
                    Target = $"UserId:{user.Id}",
                    IsSuccess = false,
                    Details = $"[IP: {ip}] 邮箱未验证"
                });
                await _context.SaveChangesAsync();
                return Unauthorized(new { Message = "必须确认邮箱后才能开通账户并登录。" });
            }

            if (!user.IsTwoFactorEnabled && !string.IsNullOrEmpty(dto.TwoFactorCode))
            {
                return Unauthorized(new { Message = "您的账号未开启二次验证，无需填写动态验证码，请留空后重试。" });
            }

            // 如果用户开启了 2FA，必须校验二步验证码
            if (user.IsTwoFactorEnabled)
            {
                if (string.IsNullOrEmpty(dto.TwoFactorCode) || 
                    !_authService.ValidateTwoFactorCode(user.TwoFactorSecret!, dto.TwoFactorCode))
                {
                    _context.AuditLogs.Add(new AuditLog
                    {
                        Action = "UserLogin",
                        Operator = dto.Email,
                        Target = $"UserId:{user.Id}",
                        IsSuccess = false,
                        Details = $"[IP: {ip}] 二步验证码(2FA)无效或未提供"
                    });
                    await _context.SaveChangesAsync();
                    return Unauthorized(new { Message = "二步验证码(2FA)无效或未提供。" });
                }
            }

            // 登录成功，颁发 SessionToken (升级为高强度加密随机数)
            user.CurrentSessionToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));

            _context.AuditLogs.Add(new AuditLog
            {
                Action = "UserLogin",
                Operator = dto.Email,
                Target = $"UserId:{user.Id}",
                IsSuccess = true,
                Details = $"[IP: {ip}] 登录成功"
            });

            await _context.SaveChangesAsync();

            return Ok(new { 
                Message = "登录成功", 
                UserId = user.Id, 
                Role = user.Role,
                SessionToken = user.CurrentSessionToken
            });
        }

        public class Enable2FaDto
        {
            public Guid UserId { get; set; }
        }

        [HttpPost("2fa/setup")]
        public async Task<IActionResult> Setup2FA([FromBody] Enable2FaDto dto)
        {
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound();

            // 安全限制：必须是已验证邮箱的用户，才有资格开启 2FA 二次验证
            if (!user.IsEmailVerified)
            {
                return BadRequest(new { Message = "必须先完成邮件验证，才能添加二次验证码(2FA)功能。" });
            }

            var (secret, setupUri) = _authService.GenerateTwoFactorSecret(user.Email);
            user.TwoFactorSecret = secret;
            // 不立即启用，需等待验证
            // user.IsTwoFactorEnabled = true; 
            await _context.SaveChangesAsync();

            return Ok(new { 
                Message = "2FA 密钥已生成。请将其导入至 Google Authenticator 等应用中。",
                Secret = secret,
                QrCodeUri = setupUri 
            });
        }

        public class Verify2FaDto
        {
            public Guid UserId { get; set; }
            public string Code { get; set; } = string.Empty;
        }

        [HttpPost("2fa/verify")]
        public async Task<IActionResult> Verify2FA([FromBody] Verify2FaDto dto)
        {
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound();

            if (string.IsNullOrEmpty(user.TwoFactorSecret))
            {
                return BadRequest(new { Message = "尚未生成 2FA 密钥，请先重新配置。" });
            }

            if (!_authService.ValidateTwoFactorCode(user.TwoFactorSecret, dto.Code))
            {
                return BadRequest(new { Message = "2FA 验证码无效，请重试。" });
            }

            user.IsTwoFactorEnabled = true;
            await _context.SaveChangesAsync();

            _context.AuditLogs.Add(new AuditLog
            {
                Action = "Enable2FA",
                Operator = user.Email,
                Target = $"UserId:{user.Id}",
                IsSuccess = true,
                Details = "成功开启二次验证 (2FA)"
            });
            await _context.SaveChangesAsync();

            return Ok(new { Message = "2FA 配置成功，已为您开启二次验证保护。" });
        }

        [HttpPost("2fa/disable")]
        public async Task<IActionResult> Disable2FA([FromBody] Enable2FaDto dto)
        {
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound();

            user.IsTwoFactorEnabled = false;
            user.TwoFactorSecret = null;
            await _context.SaveChangesAsync();

            _context.AuditLogs.Add(new AuditLog
            {
                Action = "Disable2FA",
                Operator = user.Email,
                Target = $"UserId:{user.Id}",
                IsSuccess = true,
                Details = "关闭了二次验证 (2FA)"
            });
            await _context.SaveChangesAsync();

            return Ok(new { Message = "已成功关闭 2FA 二次验证。" });
        }

        [HttpGet("2fa/status/{userId}")]
        public async Task<IActionResult> Get2FAStatus(Guid userId)
        {
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound();

            return Ok(new
            {
                IsTwoFactorEnabled = user.IsTwoFactorEnabled
            });
        }

        public class ForgotPasswordDto
        {
            public string Email { get; set; } = string.Empty;
        }

        public class ResetPasswordDto
        {
            public string Token { get; set; } = string.Empty;
            public string NewPassword { get; set; } = string.Empty;
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null)
            {
                // 安全原则：即使用户不存在也返回成功，防止邮箱探测攻击
                return Ok(new { Message = "如果您的邮箱已注册，密码重置链接已发送到该邮箱。" });
            }

            var token = _authService.GenerateEmailVerificationToken(); // 复用 Token 生成逻辑
            user.PasswordResetToken = token;
            user.PasswordResetTokenExpiry = DateTime.UtcNow.AddHours(1);
            
            _context.AuditLogs.Add(new AuditLog
            {
                Action = "ForgotPassword",
                Operator = dto.Email,
                Target = $"UserId:{user.Id}",
                IsSuccess = true,
                Details = "请求找回密码"
            });

            await _context.SaveChangesAsync();

            var scheme = Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? Request.Scheme;
            var resetLink = $"{scheme}://{Request.Host}/reset-password?token={token}";
            var htmlBody = $"<h3>账户密码重置</h3><p>系统收到了您的密码重置请求。</p><p>请点击下方链接重置您的密码（链接在1小时内有效）：</p><p><a href='{resetLink}'>点击重置密码</a></p><p>如果这不是您的操作，请忽略此邮件，您的账户是安全的。</p>";
            
            try
            {
                await _emailService.SendEmailAsync(user.Email, "您的密码重置链接", htmlBody);
            }
            catch (Exception)
            {
                return StatusCode(500, new { Message = "邮件发送失败，请稍后重试。" });
            }

            return Ok(new { Message = "如果您的邮箱已注册，密码重置链接已发送到该邮箱。" });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == dto.Token);
            
            if (user == null || user.PasswordResetTokenExpiry < DateTime.UtcNow)
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "ResetPassword",
                    Operator = "Unknown",
                    Target = "Token Validation",
                    IsSuccess = false,
                    Details = "无效或过期的密码重置链接"
                });
                await _context.SaveChangesAsync();
                return BadRequest(new { Message = "重置链接无效或已过期。" });
            }

            user.PasswordHash = HashPassword(dto.NewPassword);
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpiry = null;

            _context.AuditLogs.Add(new AuditLog
            {
                Action = "ResetPassword",
                Operator = user.Email,
                Target = $"UserId:{user.Id}",
                IsSuccess = true,
                Details = "成功重置密码"
            });

            await _context.SaveChangesAsync();

            return Ok(new { Message = "密码已成功重置，您现在可以使用新密码登录。" });
        }

        public class Forgot2FADto
        {
            public string Email { get; set; } = string.Empty;
        }

        public class Reset2FADto
        {
            public string Token { get; set; } = string.Empty;
        }

        [HttpPost("2fa/forgot")]
        public async Task<IActionResult> Forgot2FA([FromBody] Forgot2FADto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null || !user.IsTwoFactorEnabled)
            {
                // 安全原则：即便不符合条件，也返回成功信息防止探测
                return Ok(new { Message = "如果您的邮箱已注册且已开启二次验证，重置链接已发送到该邮箱。" });
            }

            var token = _authService.GenerateEmailVerificationToken();
            user.TwoFactorResetToken = token;
            user.TwoFactorResetTokenExpiry = DateTime.UtcNow.AddHours(1);
            
            _context.AuditLogs.Add(new AuditLog
            {
                Action = "Forgot2FA",
                Operator = dto.Email,
                Target = $"UserId:{user.Id}",
                IsSuccess = true,
                Details = "请求重置二次验证"
            });

            await _context.SaveChangesAsync();

            var scheme = Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? Request.Scheme;
            var resetLink = $"{scheme}://{Request.Host}/reset-2fa?token={token}";
            var htmlBody = $"<h3>关闭二次验证申请</h3><p>系统收到了您关闭二次验证(2FA)的请求。</p><p>请点击下方链接强制关闭您的 2FA（链接在1小时内有效）：</p><p><a href='{resetLink}'>点击关闭二次验证</a></p><p>如果这不是您的操作，请忽略此邮件，您的账户是安全的。</p>";
            
            try
            {
                await _emailService.SendEmailAsync(user.Email, "您的 2FA 重置链接", htmlBody);
            }
            catch (Exception)
            {
                return StatusCode(500, new { Message = "邮件发送失败，请稍后重试。" });
            }

            return Ok(new { Message = "如果您的邮箱已注册且已开启二次验证，重置链接已发送到该邮箱。" });
        }

        [HttpPost("2fa/reset")]
        public async Task<IActionResult> Reset2FA([FromBody] Reset2FADto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.TwoFactorResetToken == dto.Token);
            
            if (user == null || user.TwoFactorResetTokenExpiry < DateTime.UtcNow)
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "Reset2FA",
                    Operator = "Unknown",
                    Target = "Token Validation",
                    IsSuccess = false,
                    Details = "无效或过期的 2FA 重置链接"
                });
                await _context.SaveChangesAsync();
                return BadRequest(new { Message = "重置链接无效或已过期。" });
            }

            user.IsTwoFactorEnabled = false;
            user.TwoFactorSecret = null;
            user.TwoFactorResetToken = null;
            user.TwoFactorResetTokenExpiry = null;

            _context.AuditLogs.Add(new AuditLog
            {
                Action = "Reset2FA",
                Operator = user.Email,
                Target = $"UserId:{user.Id}",
                IsSuccess = true,
                Details = "成功通过邮箱关闭二次验证"
            });

            await _context.SaveChangesAsync();

            return Ok(new { Message = "二次验证已成功关闭，您现在可以使用账号密码直接登录。" });
        }

        // 简易哈希函数 (与前端传来的明文做 Hash 匹配)
        private string HashPassword(string password)
        {
            using var sha256 = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(password);
            var hash = sha256.ComputeHash(bytes);
            return Convert.ToBase64String(hash);
        }


    }
}
