using System;

namespace backend.Models
{
    /// <summary>
    /// Webhook 支付回调事件记录
    /// 用于实现支付系统回调的幂等性（Idempotency），防止同一笔付款被多次处理导致超发 License。
    /// </summary>
    public class WebhookEvent
    {
        public int Id { get; set; }
        public string EventId { get; set; } = string.Empty; // 支付提供商的回调唯一事件ID
        public string EventType { get; set; } = string.Empty; // 例如 "payment_intent.succeeded"
        public string Payload { get; set; } = string.Empty; // 原始 Payload
        public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
    }
}
