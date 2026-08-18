using System.Threading.Tasks;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using backend.Filters;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [SessionAuth] // 保护解绑接口，防止随意调用
    public class DeviceController : ControllerBase
    {
        private readonly LicenseService _licenseService;

        public DeviceController(LicenseService licenseService)
        {
            _licenseService = licenseService;
        }

        [HttpPost("deactivate")]
        public async Task<IActionResult> Deactivate([FromBody] DeactivateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.HardwareId))
            {
                return BadRequest("缺少设备参数。");
            }

            var operatorName = "System_Or_User_Placeholder";
            var success = await _licenseService.DeactivateDeviceAsync(request.HardwareId, operatorName);

            // 同样的防探测策略：即便不存在该设备，也不要给出明显的异常错误
            if (success)
            {
                return Ok(new { Message = "设备已成功解绑。" });
            }
            return Ok(new { Message = "操作已接收（未找到设备或已解绑）。" });
        }
    }

    public class DeactivateRequest
    {
        public string HardwareId { get; set; } = string.Empty;
    }
}
