using System;
using OtpNet;
using backend.Models;

namespace backend.Services
{
    public class AuthService
    {
        /// <summary>
        /// 生成用于绑定验证器（如 Google Authenticator）的 2FA 密钥和 URI (二维码内容)
        /// </summary>
        public (string Secret, string SetupUri) GenerateTwoFactorSecret(string userEmail)
        {
            var key = KeyGeneration.GenerateRandomKey(20);
            var secret = Base32Encoding.ToString(key);

            // 生成二维码 URI (可被大部分 Authenticator 识别)
            // 格式: otpauth://totp/Issuer:user@email.com?secret=SECRET&issuer=Issuer
            var uri = $"otpauth://totp/ActivationSystem:{userEmail}?secret={secret}&issuer=ActivationSystem";

            return (secret, uri);
        }

        /// <summary>
        /// 校验用户输入的 6 位 2FA 动态密码是否正确
        /// </summary>
        public bool ValidateTwoFactorCode(string secret, string code)
        {
            if (string.IsNullOrEmpty(secret) || string.IsNullOrEmpty(code)) return false;

            var totp = new Totp(Base32Encoding.ToBytes(secret));
            
            // 允许时间漂移 (Tolerance) 左右各 1 个周期 (通常30秒一个周期)
            return totp.VerifyTotp(code, out long timeStepMatched, new VerificationWindow(1, 1));
        }

        /// <summary>
        /// 生成邮箱验证随机 Token (URL 安全)
        /// </summary>
        public string GenerateEmailVerificationToken()
        {
            return Convert.ToBase64String(Guid.NewGuid().ToByteArray())
                .Replace("+", "-")
                .Replace("/", "_")
                .TrimEnd('=');
        }
    }
}
