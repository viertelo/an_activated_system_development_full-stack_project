using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WebhookController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AdminService _adminService;

        public WebhookController(AppDbContext context, AdminService adminService)
        {
            _context = context;
            _adminService = adminService;
        }

        [HttpPost("payment-success")]
        public async Task<IActionResult> HandlePaymentWebhook()
        {
            using var reader = new StreamReader(Request.Body);
            var json = await reader.ReadToEndAsync();

            try
            {
                // In production, you would verify the signature of the webhook here
                // e.g. using Stripe signature verification

                var payload = JsonSerializer.Deserialize<PaymentWebhookPayload>(json);
                if (payload == null || string.IsNullOrEmpty(payload.EventId))
                {
                    return BadRequest("Invalid payload");
                }

                // Idempotency Check
                if (await _context.WebhookEvents.AnyAsync(w => w.EventId == payload.EventId))
                {
                    // Already processed
                    return Ok("Already processed");
                }

                // Record the webhook to prevent duplicate processing
                var webhookEvent = new WebhookEvent
                {
                    EventId = payload.EventId,
                    Payload = json,
                    ProcessedAt = DateTime.UtcNow
                };
                _context.WebhookEvents.Add(webhookEvent);

                // Fetch User
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == payload.CustomerEmail);
                if (user != null)
                {
                    // Payment successful, order paid, create license automatically
                    await _adminService.GenerateLicensesAsync(
                        user.Id,
                        payload.MaxDevices,
                        1,
                        payload.LicenseType,
                        DateTime.UtcNow.AddYears(1), // Expiration default to 1 year
                        $"Order:{payload.OrderId}"
                    );

                    _context.AuditLogs.Add(new AuditLog
                    {
                        Action = "PaymentSuccess",
                        Operator = "System",
                        Target = $"UserId:{user.Id}",
                        IsSuccess = true,
                        Details = $"Automatically generated license for order {payload.OrderId}"
                    });
                }

                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (Exception ex)
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "WebhookError",
                    Operator = "System",
                    Target = "PaymentWebhook",
                    IsSuccess = false,
                    Details = ex.Message
                });
                await _context.SaveChangesAsync();
                return StatusCode(500, "Webhook processing failed");
            }
        }
    }

    public class PaymentWebhookPayload
    {
        public string EventId { get; set; } = string.Empty;
        public string OrderId { get; set; } = string.Empty;
        public string CustomerEmail { get; set; } = string.Empty;
        public int MaxDevices { get; set; } = 1;
        public string LicenseType { get; set; } = "Permanent";
    }
}
