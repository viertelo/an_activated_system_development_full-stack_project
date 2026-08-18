using System.Threading.Tasks;
using System.Linq;
using System.IO;
using System.IO.Compression;
using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LicenseController : ControllerBase
    {
        private readonly LicenseService _licenseService;
        private readonly AdminService _adminService;
        private readonly EmailService _emailService;
        private readonly AuthService _authService;
        private readonly RsaKeyService _rsaKeyService;
        private readonly backend.Data.AppDbContext _context;

        public LicenseController(
            LicenseService licenseService, 
            AdminService adminService,
            EmailService emailService,
            AuthService authService,
            RsaKeyService rsaKeyService,
            backend.Data.AppDbContext context)
        {
            _licenseService = licenseService;
            _adminService = adminService;
            _emailService = emailService;
            _authService = authService;
            _rsaKeyService = rsaKeyService;
            _context = context;
        }



        /// <summary>
        /// 激活端点
        /// 安全原则：此接口极易被爆破，应在外部负载均衡器（如 Nginx、WAF）或中间件（Rate Limiting）上设置极其严格的限流。
        /// 且必须强制要求客户端通过 HTTPS 连接。
        /// </summary>
        [HttpPost("activate")]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("ActivationPolicy")]
        public async Task<IActionResult> Activate([FromBody] ActivationRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.LicenseKey) || 
                string.IsNullOrWhiteSpace(request.HardwareId))
            {
                return BadRequest("参数不完整。");
            }

            var result = await _licenseService.ActivateDeviceAsync(request.LicenseKey, request.HardwareId);

            // 提取公共的详情构造逻辑
            object? detailsObj = null;
            if (result.ErrorCode != "INVALID" && result.LicenseInfo != null)
            {
                var boundDevices = _context.Devices
                    .Where(d => d.LicenseId == result.LicenseInfo.Id)
                    .Select(d => new { d.HardwareId, d.ActivatedAt })
                    .ToList();
                
                var activatedCount = boundDevices.Count;
                detailsObj = new
                {
                    LicenseType = result.LicenseInfo.LicenseType,
                    MaxDevices = result.LicenseInfo.MaxDevices,
                    ActivatedCount = activatedCount,
                    RemainingCount = result.LicenseInfo.MaxDevices - activatedCount < 0 ? 0 : result.LicenseInfo.MaxDevices - activatedCount,
                    AllowDeviceTransfer = result.LicenseInfo.AllowDeviceTransfer,
                    Devices = boundDevices
                };
            }

            if (result.IsSuccess && result.LicenseInfo != null)
            {
                var activatedCount = _context.Devices.Count(d => d.LicenseId == result.LicenseInfo.Id);

                // 激活成功，生成离线 RSA 证书
                var payload = new
                {
                    HardwareId = request.HardwareId,
                    LicenseType = result.LicenseInfo.LicenseType,
                    ExpiresAt = result.LicenseInfo.ExpirationDate,
                    ActivatedAt = System.DateTime.UtcNow,
                    MaxDevices = result.LicenseInfo.MaxDevices,
                    ActivatedCount = activatedCount,
                    RemainingCount = result.LicenseInfo.MaxDevices - activatedCount < 0 ? 0 : result.LicenseInfo.MaxDevices - activatedCount
                };

                var signedToken = _rsaKeyService.SignData(payload);
                // 成功时一并返回 Details，供前端判断是否展示设备管理
                return Ok(new { Message = "激活成功。", Signature = signedToken, Details = detailsObj });
            }
            else
            {
                return Unauthorized(new 
                { 
                    Message = result.ErrorMessage, 
                    ErrorCode = result.ErrorCode,
                    Details = detailsObj
                });
            }
        }

        /// <summary>
        /// 供客户端下载验证用公钥
        /// </summary>
        [HttpGet("public-key")]
        public IActionResult GetPublicKey()
        {
            var pubKey = _rsaKeyService.GetPublicKeyPem();
            var bytes = System.Text.Encoding.UTF8.GetBytes(pubKey);
            
            using var memoryStream = new MemoryStream();
            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                var zipEntry = archive.CreateEntry("public_key.pem");
                using var entryStream = zipEntry.Open();
                entryStream.Write(bytes, 0, bytes.Length);
            }
            
            memoryStream.Position = 0;
            return File(memoryStream.ToArray(), "application/zip", "public_key.zip");
        }

        /// <summary>
        /// 供后台直接查看公钥文本
        /// </summary>
        [HttpGet("public-key/text")]
        public IActionResult GetPublicKeyText()
        {
            var pubKey = _rsaKeyService.GetPublicKeyPem();
            return Ok(new { PublicKey = pubKey });
        }
    }

    public class ActivationRequest
    {
        public string LicenseKey { get; set; } = string.Empty;
        public string HardwareId { get; set; } = string.Empty;
    }
}
