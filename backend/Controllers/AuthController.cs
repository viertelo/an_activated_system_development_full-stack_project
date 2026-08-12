using backend.Data;
using backend.Models;
using backend.Services;
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

            // 发送确认邮件
            var verifyLink = $"http://{Request.Host}/api/auth/verify-email?token={token}";
            var htmlBody = $"<h3>欢迎注册激活系统</h3><p>请点击下方链接确认您的邮箱以开通账户：</p><p><a href='{verifyLink}'>验证我的邮箱</a></p>";
            await _emailService.SendEmailAsync(user.Email, "请验证您的注册邮箱", htmlBody);

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
            var hashedPw = HashPassword(dto.Password);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email && u.PasswordHash == hashedPw);

            if (user == null)
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "UserLogin",
                    Operator = dto.Email,
                    Target = "System",
                    IsSuccess = false,
                    Details = "邮箱或密码错误"
                });
                await _context.SaveChangesAsync();
                return Unauthorized(new { Message = "邮箱或密码错误。" });
            }

            if (!user.IsEmailVerified)
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "UserLogin",
                    Operator = dto.Email,
                    Target = $"UserId:{user.Id}",
                    IsSuccess = false,
                    Details = "邮箱未验证"
                });
                await _context.SaveChangesAsync();
                return Unauthorized(new { Message = "必须确认邮箱后才能开通账户并登录。" });
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
                        Details = "二步验证码(2FA)无效或未提供"
                    });
                    await _context.SaveChangesAsync();
                    return Unauthorized(new { Message = "二步验证码(2FA)无效或未提供。" });
                }
            }

            // 登录成功，颁发 JWT Token 的逻辑 (此前已在 Program.cs 配置，此处可在此发放真实 Token，暂用简单回执演示)
            return Ok(new { 
                Message = "登录成功", 
                UserId = user.Id, 
                Role = user.Role 
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
            user.IsTwoFactorEnabled = true;
            await _context.SaveChangesAsync();

            return Ok(new { 
                Message = "2FA 密钥已生成。请将其导入至 Google Authenticator。",
                Secret = secret,
                QrCodeUri = setupUri 
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

            var resetLink = $"http://{Request.Host}/api/auth/reset-password?token={token}";
            var htmlBody = $"<h3>账户密码重置</h3><p>系统收到了您的密码重置请求。</p><p>请点击下方链接重置您的密码（链接在1小时内有效）：</p><p><a href='{resetLink}'>点击重置密码</a></p><p>如果这不是您的操作，请忽略此邮件，您的账户是安全的。</p>";
            
            await _emailService.SendEmailAsync(user.Email, "您的密码重置链接", htmlBody);

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

        // 简易哈希函数 (与前端传来的明文做 Hash 匹配)
        private string HashPassword(string password)
        {
            using var sha256 = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(password);
            var hash = sha256.ComputeHash(bytes);
            return Convert.ToBase64String(hash);
        }

        public class SecondaryPasswordDto
        {
            public Guid UserId { get; set; }
            public string SecondaryPassword { get; set; } = string.Empty;
        }

        [HttpPost("secondary-password/setup")]
        public async Task<IActionResult> SetupSecondaryPassword([FromBody] SecondaryPasswordDto dto)
        {
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound();

            if (!user.IsEmailVerified)
            {
                return BadRequest(new { Message = "必须先完成邮件验证，才能配置二次安全密码。" });
            }

            user.SecondaryPasswordHash = HashPassword(dto.SecondaryPassword);
            await _context.SaveChangesAsync();

            _context.AuditLogs.Add(new AuditLog
            {
                Action = "SetupSecondaryPassword",
                Operator = user.Email,
                Target = $"UserId:{user.Id}",
                IsSuccess = true,
                Details = "成功设置了二次安全密码"
            });
            await _context.SaveChangesAsync();

            return Ok(new { Message = "二次安全密码配置成功。" });
        }

        [HttpPost("secondary-password/verify")]
        public async Task<IActionResult> VerifySecondaryPassword([FromBody] SecondaryPasswordDto dto)
        {
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound();

            if (string.IsNullOrEmpty(user.SecondaryPasswordHash))
            {
                return BadRequest(new { Message = "您尚未配置二次安全密码。" });
            }

            var hashedPw = HashPassword(dto.SecondaryPassword);
            if (user.SecondaryPasswordHash != hashedPw)
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "VerifySecondaryPassword",
                    Operator = user.Email,
                    Target = $"UserId:{user.Id}",
                    IsSuccess = false,
                    Details = "二次安全密码验证失败"
                });
                await _context.SaveChangesAsync();
                return Unauthorized(new { Message = "二次安全密码不正确。" });
            }

            return Ok(new { Message = "验证成功" });
        }
    }
}
