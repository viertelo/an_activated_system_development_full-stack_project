using backend.Data;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

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
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? httpContext.Request.Headers.Host.ToString(),
            factory: partition => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 5, // 每分钟允许 5 次请求
                QueueLimit = 0,
                Window = TimeSpan.FromMinutes(1)
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
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

var app = builder.Build();

// 自动在应用启动时创建数据库表结构 (适用于开发环境及首次 Docker 部署)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

// Configure the HTTP request pipeline.
app.UseHttpsRedirection();

// 启用跨域和限流中间件
app.UseCors("AllowFrontend");
app.UseRateLimiter();

app.UseAuthorization();

app.MapControllers();

app.Run();
