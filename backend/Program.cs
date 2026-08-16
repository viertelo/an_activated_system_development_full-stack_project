using backend.Data;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Fido2NetLib;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // 如果 Nginx 和后端在同一服务器或 Docker 容器内，清除 KnownNetworks，允许所有代理传递 X-Forwarded-For
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Add services to the container.
builder.Services.AddControllers();

// 添加 Session 以支持 FIDO2 Challenge 暂存
builder.Services.AddMemoryCache();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(5);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.None; // 对于跨域前后端分离必备
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always; // 跨域时配合 None 必须设为 Secure
});

// 配置 WebAuthn (Fido2) 服务
builder.Services.AddFido2(options =>
{
    options.ServerDomain = builder.Configuration["fido2:serverDomain"] ?? "localhost";
    options.ServerName = "激活系统通行密钥服务";
    options.Origins = new HashSet<string> { builder.Configuration["fido2:origin"] ?? "http://localhost:3000" };
});

// 添加 CORS (Cross-Origin Resource Sharing) 配置
var allowedFrontendOrigin = builder.Configuration["FRONTEND_URL"] ?? "http://localhost:3000";
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins(allowedFrontendOrigin) // 允许前端开发或自定义端口
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

// 添加全局限流策略 (Rate Limiting)
builder.Services.AddRateLimiter(options =>
{
    // 默认全局策略
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? httpContext.Request.Headers.Host.ToString(),
            factory: partition => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 30, // 全局：每分钟允许 30 次请求
                QueueLimit = 0,
                Window = TimeSpan.FromMinutes(1)
            }));
            
    // 激活专用高限流策略：防爆破攻击
    options.AddPolicy("ActivationPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? httpContext.Request.Headers.Host.ToString(),
            factory: partition => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 5, // 激活：每分钟仅允许 5 次请求
                QueueLimit = 0,
                Window = TimeSpan.FromMinutes(1)
            }));
            
    options.OnRejected = async (context, token) =>
    {
        var ip = context.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown IP";
        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        db.AuditLogs.Add(new backend.Models.AuditLog
        {
            Action = "RateLimitBlocked",
            Operator = ip,
            Target = context.HttpContext.Request.Path.Value ?? "Unknown",
            IsSuccess = false,
            Details = "风控：触发IP高频请求限制",
            Timestamp = System.DateTime.UtcNow
        });
        await db.SaveChangesAsync(token);
        
        context.HttpContext.Response.StatusCode = 429;
        await context.HttpContext.Response.WriteAsync("请求过于频繁，已被风控拦截，请稍后重试。", cancellationToken: token);
    };
});

// 配置 Entity Framework Core 及 PostgreSQL（此处为连接字符串占位，供本地部署时填充）
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Database=LicenseDb;Username=postgres;Password=YourPassword";
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// 注册业务逻辑服务
builder.Services.AddScoped<LicenseService>();
builder.Services.AddScoped<AdminService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddSingleton<RsaKeyService>();

// 注册后台定时任务
builder.Services.AddHostedService<LicenseBackgroundWorker>();

var app = builder.Build();

app.UseForwardedHeaders();

// 提前实例化 RsaKeyService，以便在系统启动时立即生成或加载 RSA 密钥文件
app.Services.GetRequiredService<RsaKeyService>();

// 自动在应用启动时创建数据库表结构 (适用于开发环境及首次 Docker 部署)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    // 自动根据环境变量创建初始管理员
    var adminEmail = builder.Configuration["ADMIN_EMAIL"];
    var adminPassword = builder.Configuration["ADMIN_PASSWORD"];

    if (!string.IsNullOrEmpty(adminEmail) && !string.IsNullOrEmpty(adminPassword))
    {
        if (!db.Users.Any(u => u.Email == adminEmail))
        {
            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var bytes = System.Text.Encoding.UTF8.GetBytes(adminPassword);
            var hash = sha256.ComputeHash(bytes);
            var passwordHash = Convert.ToBase64String(hash);

            var adminUser = new backend.Models.User
            {
                Email = adminEmail,
                PasswordHash = passwordHash,
                Role = "Admin",
                IsEmailVerified = true // 管理员默认已验证邮箱
            };
            db.Users.Add(adminUser);
            db.SaveChanges();
            Console.WriteLine($"[Setup] Admin user created: {adminEmail}");
        }
    }
}

// Configure the HTTP request pipeline.

// 启用跨域和限流中间件
app.UseCors("AllowFrontend");

// 全局异常处理，确保所有未捕获异常都返回 JSON
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        
        var exceptionHandlerPathFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature>();
        var errorMessage = exceptionHandlerPathFeature?.Error?.Message ?? "服务器内部异常，请稍后重试。";
        
        await context.Response.WriteAsJsonAsync(new { Message = "系统内部错误: " + errorMessage });
    });
});

app.UseRateLimiter();

app.UseSession(); // 启用 Session 必须在 UseCors 之后，UseAuthorization 之前

app.UseAuthorization();

app.MapControllers();

app.Run();
