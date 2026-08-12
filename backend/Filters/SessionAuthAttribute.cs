using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Linq;
using backend.Data;
using System;

using Microsoft.EntityFrameworkCore;

namespace backend.Filters
{
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
