using System;

namespace backend.Models
{
    /// <summary>
    /// 安全审计日志
    /// 记录系统中所有高权限操作（如：吊销 License，解绑设备），用于防爆破追踪和管理员溯源。
    /// </summary>
    public class AuditLog
    {
        public int Id { get; set; }
        public string Action { get; set; } = string.Empty; // 例如: "RevokeLicense"
        public string Operator { get; set; } = string.Empty; // 执行该操作的人或系统
        public string Target { get; set; } = string.Empty; // 目标（例如 LicenseId）
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public bool IsSuccess { get; set; }
        public string Details { get; set; } = string.Empty; // 附加信息
    }
}
