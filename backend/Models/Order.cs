using System;

namespace backend.Models
{
    /// <summary>
    /// 商业订单实体模型
    /// 用于对接支付系统（自动发货），将客户付款记录与后续的 License 生成绑定。
    /// </summary>
    public class Order
    {
        public int Id { get; set; }
        public string OrderNumber { get; set; } = string.Empty; // 外部支付提供商的订单号
        public string CustomerEmail { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Paid, Completed
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
