using System;
using System.Threading.Tasks;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using MimeKit.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace backend.Services
{
    public class EmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration config, ILogger<EmailService> logger)
        {
            _config = config;
            _logger = logger;
        }

        /// <summary>
        /// 发送带有验证链接或激活码的系统邮件
        /// </summary>
        public async Task SendEmailAsync(string toEmail, string subject, string htmlBody)
        {
            var host = _config["SMTP_HOST"];
            var portStr = _config["SMTP_PORT"];
            var user = _config["SMTP_USER"];
            var pass = _config["SMTP_PASS"];

            // 如果没有配置 SMTP 服务器，则在本地控制台打印邮件内容（开发/测试模式）
            if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(user))
            {
                _logger.LogWarning("未配置真实的 SMTP_HOST 和 SMTP_USER。当前处于开发模式，已将邮件输出到控制台：\n【收件人】{To}\n【主题】{Subject}\n【内容】{Body}", toEmail, subject, htmlBody);
                return;
            }

            if (!int.TryParse(portStr, out int port))
            {
                port = 465; // 默认 SSL 端口
            }

            var message = new MimeMessage();
            // 发件人名称与邮箱 (从环境变量读取或默认为 System)
            message.From.Add(new MailboxAddress("商业激活系统", user));
            message.To.Add(new MailboxAddress("", toEmail));
            message.Subject = subject;

            message.Body = new TextPart(TextFormat.Html) { Text = htmlBody };

            using var client = new SmtpClient();
            try
            {
                // 连接并认证
                await client.ConnectAsync(host, port, SecureSocketOptions.Auto);
                await client.AuthenticateAsync(user, pass ?? "");
                await client.SendAsync(message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "发送邮件到 {To} 失败", toEmail);
                throw new Exception("邮件发送失败，请稍后重试。");
            }
            finally
            {
                await client.DisconnectAsync(true);
            }
        }
    }
}
