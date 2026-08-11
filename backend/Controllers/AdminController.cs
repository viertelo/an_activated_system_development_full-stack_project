using System.Threading.Tasks;
using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize(Roles = "Admin")] // 警告：生产环境必须解除此注释并接入认证中间件！
    public class AdminController : ControllerBase
    {
        private readonly AdminService _adminService;

        public AdminController(AdminService adminService)
        {
            _adminService = adminService;
        }

        [HttpPost("generate-license")]
        public async Task<IActionResult> GenerateLicense([FromBody] GenerateLicenseRequest request)
        {
            // 假设从 JWT Token 获取操作者名称，目前暂用写死的值
            var operatorName = "AdminUser_Placeholder";
            var newKey = await _adminService.GenerateLicenseAsync(request.UserId, request.MaxDevices, operatorName);
            
            // 仅在此处返回明文激活码供后台显示或邮件发送。之后再也无法从数据库读取明文。
            return Ok(new { LicenseKey = newKey, Message = "成功生成并已将哈希安全入库。" });
        }

        [HttpPost("revoke-license/{id}")]
        public async Task<IActionResult> RevokeLicense(int id)
        {
            var operatorName = "AdminUser_Placeholder";
            var success = await _adminService.RevokeLicenseAsync(id, operatorName);

            if (success) return Ok(new { Message = "吊销成功，相关审计日志已记录。" });
            return NotFound(new { Message = "未找到该 License。" });
        }
    }

    public class GenerateLicenseRequest
    {
        public System.Guid UserId { get; set; }
        public int MaxDevices { get; set; } = 1;
    }
}
