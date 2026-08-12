namespace backend.Models
{
    using System.ComponentModel.DataAnnotations;

    /// <summary>
    /// 系统用户实体（商业客户）
    /// </summary>
    public class User
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(255)]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Role { get; set; } = "User"; // 默认为普通用户，最高权限为 "Admin"

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // === 邮箱验证支持 ===
        public bool IsEmailVerified { get; set; } = false;
        
        [MaxLength(255)]
        public string? EmailVerificationToken { get; set; }
        public DateTime? EmailTokenExpiry { get; set; }

        // === 密码找回支持 ===
        [MaxLength(255)]
        public string? PasswordResetToken { get; set; }
        public DateTime? PasswordResetTokenExpiry { get; set; }

        // === 2FA (两步验证) 支持 ===
        public bool IsTwoFactorEnabled { get; set; } = false;
        
        [MaxLength(255)]
        public string? TwoFactorSecret { get; set; }

        [MaxLength(255)]
        public string? TwoFactorResetToken { get; set; }
        public DateTime? TwoFactorResetTokenExpiry { get; set; }

        // === 会话安全与防爆破互踢 ===
        [MaxLength(255)]
        public string? CurrentSessionToken { get; set; } // 存储当前的单点登录Token，若与请求Token不一致则视为被踢出
        public int FailedLoginAttempts { get; set; } = 0; // 密码连续错误次数
        public DateTime? LockoutEnd { get; set; } // 密码错误触发锁定后的解锁时间

        // === 通行密钥 (WebAuthn / Passkeys) ===
        public ICollection<FidoStoredCredential> FidoStoredCredentials { get; set; } = new List<FidoStoredCredential>();
    }
}
