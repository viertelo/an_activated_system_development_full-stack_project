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

        // === 二次安全密码 (独立于登录密码) ===
        [MaxLength(255)]
        public string? SecondaryPasswordHash { get; set; }

        // === 通行密钥 (WebAuthn / Passkeys) ===
        public ICollection<FidoStoredCredential> FidoStoredCredentials { get; set; } = new List<FidoStoredCredential>();
    }
}
