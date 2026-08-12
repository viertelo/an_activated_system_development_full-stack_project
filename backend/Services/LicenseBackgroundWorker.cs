using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace backend.Services
{
    public class LicenseBackgroundWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<LicenseBackgroundWorker> _logger;

        public LicenseBackgroundWorker(IServiceProvider serviceProvider, ILogger<LicenseBackgroundWorker> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("License Background Worker starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessExpirationsAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred during background task execution.");
                }

                // Check every hour
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }

            _logger.LogInformation("License Background Worker stopping.");
        }

        private async Task ProcessExpirationsAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var now = DateTime.UtcNow;
            
            // Find licenses that have expired but are still active
            var expiredLicenses = await context.Licenses
                .Where(l => l.IsActive && l.ExpirationDate.HasValue && l.ExpirationDate.Value < now)
                .ToListAsync(stoppingToken);

            if (expiredLicenses.Any())
            {
                _logger.LogInformation($"Found {expiredLicenses.Count} expired licenses. Processing...");

                foreach (var license in expiredLicenses)
                {
                    license.IsActive = false;
                    
                    context.AuditLogs.Add(new AuditLog
                    {
                        Action = "LicenseExpiration",
                        Operator = "SystemWorker",
                        Target = $"LicenseId:{license.Id}",
                        IsSuccess = true,
                        Details = $"License expired on {license.ExpirationDate}"
                    });
                }

                await context.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("Successfully updated expired licenses.");
            }
        }
    }
}
