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
                return Unauthorized(new { Message = "邮箱或密码错误。" });

            if (!user.IsEmailVerified)
                return Unauthorized(new { Message = "必须确认邮箱后才能开通账户并登录。" });

            // 如果用户开启了 2FA，必须校验二步验证码
            if (user.IsTwoFactorEnabled)
            {
                if (string.IsNullOrEmpty(dto.TwoFactorCode) || 
                    !_authService.ValidateTwoFactorCode(user.TwoFactorSecret!, dto.TwoFactorCode))
                {
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
