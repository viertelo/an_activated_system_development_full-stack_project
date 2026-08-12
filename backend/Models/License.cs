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

        public ICollection<Device>? Devices { get; set; }

        /// <summary>
        /// 是否允许设备换绑。若允许，当达到最大设备数时，新设备激活将自动解绑最旧的设备。
        /// </summary>
        public bool AllowDeviceTransfer { get; set; } = false;

        /// <summary>
        /// 历史总共允许的激活次数限制。超过该次数将无法激活（即使当前绑定设备数为0）。0 表示不限制。
        /// </summary>
        public int MaxActivations { get; set; } = 0;

        /// <summary>
        /// 当前已使用的激活次数
        /// </summary>
        public int CurrentActivationCount { get; set; } = 0;
        
        /// <summary>
        /// 状态：是否激活、是否被吊销等
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// 授权类型 (Permanent, Subscription, Trial)
        /// </summary>
        public string LicenseType { get; set; } = "Permanent";

        /// <summary>
        public DateTime? ExpirationDate { get; set; }

        /// <summary>
        /// 创建时间
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
