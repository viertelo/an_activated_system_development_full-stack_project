using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Linq;
using backend.Data;
using System;

using Microsoft.EntityFrameworkCore;

namespace backend.Filters
{
    /// <summary>
    /// 自定义鉴权拦截器
    /// 安全原则：此拦截器强制要求请求头中必须携带 X-Session-Token 和 X-User-Id。
    /// 主要用于保护超级管理员后台的 API 以及供测试专用的特权接口（如清零激活次数、解绑设备）。
    /// 它通过比对数据库中 user.CurrentSessionToken 实现“单点登录/多地互踢”功能，
    /// 从而防止恶意用户或外网爬虫直接调用危险的商业规则篡改接口。
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class SessionAuthAttribute : ActionFilterAttribute
    {
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            var dbContext = context.HttpContext.RequestServices.GetService(typeof(AppDbContext)) as AppDbContext;
            
            // Allow bypassing if it's the login endpoint
            var path = context.HttpContext.Request.Path.Value?.ToLower() ?? "";
            if (path.Contains("/api/auth/login") || path.Contains("/api/auth/register") || path.Contains("/api/passkey/") || path.Contains("/api/auth/forgot-password") || path.Contains("/api/auth/reset-password") || path.Contains("/api/auth/verify-email"))
            {
                base.OnActionExecuting(context);
                return;
            }

            if (!context.HttpContext.Request.Headers.TryGetValue("X-Session-Token", out var sessionTokenValues))
            {
                context.Result = new UnauthorizedObjectResult(new { Message = "会话凭证缺失，请重新登录。" });
                return;
            }

            var sessionToken = sessionTokenValues.FirstOrDefault();
            
            // Try get User ID if passed in header (Optional, but good for validation)
            if (!context.HttpContext.Request.Headers.TryGetValue("X-User-Id", out var userIdValues) || !Guid.TryParse(userIdValues.FirstOrDefault(), out var userId))
            {
                context.Result = new UnauthorizedObjectResult(new { Message = "用户标识缺失，请重新登录。" });
                return;
            }

            var user = dbContext?.Users.AsNoTracking().FirstOrDefault(u => u.Id == userId);
            if (user == null || user.CurrentSessionToken != sessionToken)
            {
                context.Result = new UnauthorizedObjectResult(new { Message = "您的账号已在别处登录，您已被强制下线。" });
                return;
            }

            base.OnActionExecuting(context);
        }
    }
}
