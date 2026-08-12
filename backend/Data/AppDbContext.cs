using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Data
{
    /// <summary>
    /// 核心数据库上下文
    /// 建议搭配 PostgreSQL 使用，提供最佳并发性能。
    /// </summary>
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<License> Licenses { get; set; }
        public DbSet<Device> Devices { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<WebhookEvent> WebhookEvents { get; set; }
        public DbSet<FidoStoredCredential> FidoStoredCredentials { get; set; }
        public DbSet<SystemSetting> SystemSettings { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 性能优化：为 LicenseKeyHash 创建唯一索引，因为激活查询主要依靠此字段
            modelBuilder.Entity<License>()
                .HasIndex(l => l.LicenseKeyHash)
                .IsUnique();

            // 防并发安全：Webhook事件ID唯一，保证支付回调幂等
            modelBuilder.Entity<WebhookEvent>()
                .HasIndex(w => w.EventId)
                .IsUnique();
        }
    }
}
