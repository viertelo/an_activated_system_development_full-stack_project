using System;

namespace backend.Models
{
    /// <summary>
    /// 已激活的客户端设备记录
    /// </summary>
    public class Device
    {
        public int Id { get; set; }
        
        /// <summary>
        /// 客户端上报的硬件唯一标识符（例如主板、CPU信息的哈希）
        /// </summary>
        public string HardwareId { get; set; } = string.Empty;
        
        public int LicenseId { get; set; }
        public License? License { get; set; }
        
        /// <summary>
        /// 设备首次激活时间
        /// </summary>
        public DateTime ActivatedAt { get; set; } = DateTime.UtcNow;
    }
}
