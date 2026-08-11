namespace backend.Models
{
    /// <summary>
    /// 授权许可证实体
    /// </summary>
    public class License
    {
        public int Id { get; set; }
        
        /// <summary>
        /// 许可证哈希值。
        /// 安全原则：数据库中绝对不允许保存明文的 License Key，只保存 Hash。
        /// </summary>
        public string LicenseKeyHash { get; set; } = string.Empty; 
        
        /// <summary>
        /// 最大允许激活的设备数（套餐限制：例如 1, 3, 5 台）
        /// </summary>
        public int MaxDevices { get; set; } = 1;
        
        public Guid UserId { get; set; }
        public User? User { get; set; }
        
        /// <summary>
        /// 状态：是否激活、是否被吊销等
        /// </summary>
        public bool IsActive { get; set; } = true;
    }
}
