# License 激活系统：完整开发、部署与商业化文档汇总

> 本文档整理本次对话中围绕 License
> 商业激活系统形成的开发、部署、安全、客户端、支付、Admin、CI/CD
> 和生产上线方案。
>
> 说明：当前可见对话上下文中，部分早期章节正文已被对话摘要省略，因此本文件尽可能完整收录当前会话中可访问的内容，并将已经明确的章节结构、技术路线和最后的部署扩展文档统一整理。

------------------------------------------------------------------------

# 目录

1.  项目目标与核心需求
2.  技术栈与总体架构
3.  License 核心模型
4.  安全设计原则
5.  客户端 SDK
6.  生产级安全加固
7.  支付、自动发货与商业闭环
8.  Admin Console
9.  生产部署
10. 客户端发行、防破解与最终交付
11. 完整工程结构、Docker、CI/CD 与上线 Checklist
12. 多平台开发环境
13. 简易直播部署方案
14. 生产环境扩展部署手册
15. 商业上线最终 Checklist

------------------------------------------------------------------------

# 1. 项目目标与核心需求

目标是开发一套可商用的跨平台 License 激活系统。

用户付费以后获得类似：

`48D0-61CD-35FE-9C9B-5358-3725-D644-1A18`

这样的 License Key。

用户可以通过 License 系统：

-   激活软件
-   查询授权状态
-   管理设备
-   在授权范围内使用软件
-   找回 License
-   根据套餐限制同时激活的电脑数量

典型套餐：

-   1 台设备
-   3 台设备
-   5 台设备

系统需要支持：

-   邮箱绑定
-   License 激活
-   Device 管理
-   License 找回
-   License 过期
-   License 撤销
-   Device 数量限制
-   防暴力破解
-   Rate Limit
-   审计日志
-   Admin Console
-   支付系统
-   自动发货
-   客户端 SDK
-   Windows / macOS / Linux
-   Docker
-   PostgreSQL
-   Redis
-   CI/CD
-   备份恢复
-   监控告警
-   HTTPS
-   WAF
-   商业软件发行
-   客户端代码签名
-   自动更新

------------------------------------------------------------------------

# 2. 技术栈与总体架构

## 2.1 推荐后端

推荐：

-   C#
-   ASP.NET Core
-   Entity Framework Core
-   PostgreSQL
-   Redis

原因：

-   ASP.NET Core 性能优秀
-   C# 类型系统成熟
-   EF Core 与 PostgreSQL 配合良好
-   Windows/macOS/Linux 均可开发
-   Docker 部署方便
-   非常适合企业级 API
-   后期实现 Worker、Background Service、Admin API 都比较自然

------------------------------------------------------------------------

# 3. 前端技术栈

推荐：

-   TypeScript
-   Next.js
-   Tailwind CSS
-   shadcn/ui

JavaScript Runtime：

-   Bun 可以用于开发、依赖管理和脚本执行
-   生产环境是否使用 Bun 运行 Next.js，需要根据实际部署方式测试
-   ASP.NET Core 后端仍然独立运行

建议：

``` text
Frontend
  Next.js
  TypeScript
  Tailwind
  shadcn/ui
  Bun

Backend
  C#
  ASP.NET Core
  EF Core

Database
  PostgreSQL

Cache
  Redis
```

------------------------------------------------------------------------

# 4. 数据库

推荐 PostgreSQL。

生产环境建议使用稳定的 PostgreSQL 大版本，并在升级前进行兼容性测试。

典型数据：

``` text
Users
Licenses
LicensePlans
Devices
Activations
Orders
Payments
WebhookEvents
AuditLogs
RefreshTokens
Downloads
Releases
```

重要原则：

License 核心数据存 PostgreSQL。

Redis 主要用于：

-   Cache
-   Rate Limit
-   Session
-   Distributed Lock
-   Idempotency
-   临时数据

不要把唯一的重要 License 数据只放在 Redis。

------------------------------------------------------------------------

# 5. License 核心模型

一个 License 至少应该包含：

``` text
LicenseId
ProductId
PlanId
CustomerId
Status
CreatedAt
ExpiresAt (过期时间)
LicenseType (授权类型：如 Permanent, Subscription, Trial)
MaxDevices
```

Device：

``` text
DeviceId
LicenseId
HardwareId
ActivatedAt
LastSeenAt
```

License 状态：

``` text
Pending
Active
Expired
Revoked
Suspended
```

------------------------------------------------------------------------

# 6. License Key 安全

License Key 是用户使用的凭证，不应该作为数据库中的明文敏感信息长期保存。

推荐：

``` text
User License Key
       ↓
Normalize
       ↓
Hash
       ↓
Database
```

数据库主要保存：

``` text
LicenseId
LicenseHash
Metadata
Status
```

后台显示 License 时应进行权限控制。

如果业务必须支持"找回完整 License
Key"，需要额外设计安全的密钥恢复方案，而不是简单把明文 Key 存数据库。

更安全的方式是：

-   购买后一次性显示
-   安全邮件重新发放
-   使用可验证的恢复流程
-   对恢复操作进行审计和限速

------------------------------------------------------------------------

# 7. License 签名

如果 License Token 需要客户端验证，应采用数字签名。

推荐：

``` text
License Server
    ↓
Private Key
    ↓
Sign
    ↓
License Token
```

客户端：

``` text
License Token
    ↓
Public Key
    ↓
Verify
```

Private Key：

绝对不能放：

-   客户端
-   Git
-   Docker 镜像
-   普通配置文件
-   日志

生产环境优先：

``` text
Secret Manager
KMS
HSM
```

客户端只需要：

``` text
Public Key
```

------------------------------------------------------------------------

# 8. License 激活流程

典型：

``` text
Client
  ↓
POST /api/license/activate
  ↓
License Server
  ↓
Validate License
  ↓
Check Status
  ↓
Check Expiration
  ↓
Check Device Limit
  ↓
Register Device
  ↓
Generate Activation Token
  ↓
Return
```

例如套餐：

``` text
1 Device
```

已经激活一台以后：

``` text
New Device
   ↓
Limit Reached
```

3 台、5 台同理。

------------------------------------------------------------------------

# 9. Device 管理

建议支持：

``` text
List Devices
Deactivate Device
Rename Device
Last Seen
Platform
Version
Activation Time
```

用户可以在 Customer Portal 中主动解除某台设备。

后台 Admin 可以在授权范围内帮助处理异常设备。

所有高权限操作记录 Audit Log。

------------------------------------------------------------------------

# 10. Rate Limit 与防爆破

关键接口：

``` text
/login
/license/activate
/license/validate
/password/reset
/device/activate
```

必须限速。

可以结合：

``` text
IP
Account
License
Device
```

进行多维度限制。

不要只依赖单一 IP 限速。

------------------------------------------------------------------------

# 11. 激活错误信息

不要向攻击者泄露过多内部信息。

避免返回：

``` text
License 存在
但 Device Limit 已达到
而且 License 属于某用户
```

可以根据业务返回统一错误：

``` text
Activation failed
```

同时在服务器内部 Audit Log 记录真实原因。

------------------------------------------------------------------------

# 12. Client SDK

客户端 SDK 应负责：

``` text
Initialize
Activate
Validate
Refresh
Deactivate
GetLicenseInfo
GetDeviceInfo
```

SDK 不应该包含：

``` text
License Private Key
Database Password
Admin API Secret
Payment Secret
```

客户端只能持有：

``` text
Public Key
```

以及自己的授权信息。

------------------------------------------------------------------------

# 13. Offline License

如果产品需要离线使用，可以设计：

``` text
Online Activation
      ↓
Signed License
      ↓
Local Verification
```

客户端通过 Public Key 验证签名。

可以设计有限的 Offline Grace Period。

但是：

> 离线授权只能提高可用性，不能让客户端完全不可破解。

商业软件最终仍然需要：

-   代码签名
-   混淆
-   完整性检查
-   Server-side authorization
-   风险控制

------------------------------------------------------------------------

# 14. 生产级安全

生产环境建议：

``` text
HTTPS
WAF
Rate Limit
MFA
RBAC
Audit Log
Secret Manager
KMS/HSM
Private Database
Private Redis
Backup
Monitoring
Alerting
Dependency Scan
Container Scan
```

Admin 必须启用 MFA。

推荐：

``` text
TOTP
Passkey
Security Key
```

------------------------------------------------------------------------

# 15. Admin Console

角色建议：

``` text
SuperAdmin
Admin
Support
Finance
Developer
ReadOnly
```

例如 Support 可以：

``` text
查询用户
查询 License
查看设备
协助设备管理
```

但不能：

``` text
查看 Signing Private Key
修改核心安全配置
```

------------------------------------------------------------------------

# 16. Audit Log

重要操作必须记录：

``` text
Who
What
When
IP
Result
```

例如：

``` text
Action:
Revoke License

Admin:
admin@example.com

License:
LIC-xxxx

Result:
Success
```

日志不能记录：

``` text
Password
Private Key
API Secret
完整 License Key
Payment Secret
```

------------------------------------------------------------------------

# 17. 支付系统

标准流程：

``` text
Customer
  ↓
Checkout
  ↓
Payment Provider
  ↓
Payment Success
  ↓
Verified Webhook
  ↓
Order Paid
  ↓
Create License
  ↓
Email
  ↓
Customer
```

不能只根据浏览器跳转页面判断付款成功。

必须验证 Webhook。

------------------------------------------------------------------------

# 18. Webhook 安全

Webhook 至少验证：

``` text
Signature
Timestamp
Event ID
```

数据库保存：

``` text
WebhookEvents
```

建立：

``` text
Unique(EventId)
```

防止同一个事件重复处理。

------------------------------------------------------------------------

# 19. 支付幂等

Webhook 发送三次：

``` text
Webhook #1
Webhook #2
Webhook #3
```

最终只能：

``` text
1 Order
1 License
1 Email
```

不能重复创建 License。

------------------------------------------------------------------------

# 20. 自动发货

订单状态：

``` text
Pending
  ↓
Paid
  ↓
LicenseCreated
  ↓
EmailQueued
  ↓
Delivered
```

邮件失败应该：

``` text
Retry
```

而不是重新创建 License。

------------------------------------------------------------------------

# 21. Email Worker

推荐：

``` text
API
 ↓
Queue
 ↓
Email Worker
 ↓
SMTP / Email Provider
```

API 不应该同步等待邮件服务。

------------------------------------------------------------------------

# 22. Background Worker

建议独立：

``` text
License.Worker
```

负责：

``` text
Email
Payment
Cleanup
Expiration
Notification
Device
Update
```

------------------------------------------------------------------------

# 23. 自动更新

建立：

``` text
download.example.com
```

例如：

``` text
releases/
├── windows/
├── macos/
└── linux/
```

提供：

``` text
manifest.json
```

包含：

``` text
Version
Platform
Download
SHA256
Signature
```

客户端：

``` text
Download
 ↓
Hash Verify
 ↓
Signature Verify
 ↓
Install
```

------------------------------------------------------------------------

# 24. 代码签名

正式商业发行时：

Windows：

``` text
Code Signing Certificate
```

macOS：

``` text
Apple Developer
Developer ID
Notarization
```

Linux：

``` text
Package Signing
Release Signature
```

------------------------------------------------------------------------

# 25. Docker 部署

推荐：

``` text
PostgreSQL
Redis
License Server
Admin Console
Worker
Nginx
```

基础 Docker Compose：

``` yaml
services:

  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command:
      - redis-server
      - --requirepass
      - ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data

  license-server:
    image: your-registry/license-server:latest
    restart: unless-stopped
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ConnectionStrings__DefaultConnection: >-
        Host=postgres;
        Port=5432;
        Database=${POSTGRES_DB};
        Username=${POSTGRES_USER};
        Password=${POSTGRES_PASSWORD}
      ConnectionStrings__Redis: >-
        redis:6379,password=${REDIS_PASSWORD}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "8080:8080"

volumes:
  postgres_data:
  redis_data:
```

------------------------------------------------------------------------

# 26. 简易直播部署

服务器：

``` text
Debian 13 / Ubuntu 24.04
2 CPU
4 GB RAM
40 GB SSD
```

目录：

``` text
/opt/license-platform
```

安装 Docker：

``` bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
```

创建目录：

``` bash
sudo mkdir -p /opt/license-platform
sudo chown -R $USER:$USER /opt/license-platform
cd /opt/license-platform
```

启动：

``` bash
docker compose pull
docker compose up -d postgres redis
docker compose ps
docker compose up -d license-server
docker compose logs -f license-server
```

测试：

``` bash
curl http://127.0.0.1:8080/health
```

------------------------------------------------------------------------

# 27. Nginx

安装：

``` bash
sudo apt install -y nginx
```

配置：

``` nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

检查：

``` bash
sudo nginx -t
sudo systemctl reload nginx
```

------------------------------------------------------------------------

# 28. HTTPS

可以使用 Let's Encrypt：

``` bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com
```

生产环境也可以：

``` text
Cloudflare
 ↓
Nginx
 ↓
ASP.NET Core
```

------------------------------------------------------------------------

# 29. PostgreSQL 与 Redis

绝对不要开放：

``` text
5432
6379
```

公网只开放：

``` text
80
443
```

SSH 端口应进一步限制来源。

------------------------------------------------------------------------

# 30. 数据库备份

创建：

``` bash
mkdir -p /opt/license-platform/backups
```

备份：

``` bash
docker exec license-postgres \
pg_dump \
-U license_user \
-d license_db \
> /opt/license-platform/backups/license_$(date +%Y%m%d_%H%M%S).sql
```

恢复：

``` bash
cat backups/license_20260811_120000.sql | \
docker exec -i license-postgres \
psql -U license_user -d license_db
```

生产环境建议：

``` text
Daily Full Backup
+
WAL / PITR
+
Remote Object Storage
```

------------------------------------------------------------------------

# 31. CI/CD

推荐：

``` text
GitHub
 ↓
GitHub Actions
 ↓
Build
 ↓
Test
 ↓
Security Scan
 ↓
Docker Build
 ↓
Push GHCR
 ↓
Production Approval
 ↓
Deploy
```

Docker Registry：

``` text
ghcr.io/company/license-server
ghcr.io/company/admin-console
```

生产优先使用固定版本：

``` text
v1.0.0
v1.0.1
```

不要依赖：

``` text
latest
```

------------------------------------------------------------------------

# 32. 生产部署流程

``` text
git tag v1.0.1
        ↓
CI Build
        ↓
Tests
        ↓
Docker Image
        ↓
Registry
        ↓
Backup
        ↓
Database Migration
        ↓
Deploy
        ↓
Health Check
        ↓
Smoke Test
```

------------------------------------------------------------------------

# 33. 回滚

如果：

``` text
v1.0.1
```

出现问题：

``` text
v1.0.0
```

进行回滚。

数据库 Migration 必须考虑向后兼容。

推荐：

``` text
Expand
 ↓
Deploy
 ↓
Migrate Data
 ↓
Switch
 ↓
Contract
```

不要一次性删除旧字段。

------------------------------------------------------------------------

# 34. Monitoring

生产建议：

``` text
OpenTelemetry
Prometheus
Grafana
Loki
Tempo
```

监控：

``` text
API Availability
API Latency
HTTP 5xx
Database
Redis
CPU
Memory
Disk
```

License业务：

``` text
Activation Success
Activation Failure
Device Limit
License Expired
License Revoked
Payment Failure
Webhook Failure
```

------------------------------------------------------------------------

# 35. 最终生产架构

``` text
Internet
    │
    ▼
Cloudflare
    │
WAF / DDoS
    │
    ▼
Nginx
    │
 ┌──┼───────────────┐
 │  │               │
 ▼  ▼               ▼
API Admin       Customer
 │
 ├── PostgreSQL
 ├── Redis
 └── Worker
       ├── Payment
       ├── Email
       ├── License
       ├── Cleanup
       └── Notification

Backup
  ↓
Object Storage

OpenTelemetry
  ↓
Prometheus / Loki / Tempo
  ↓
Grafana
```

------------------------------------------------------------------------

# 36. 推荐最终项目文档结构

``` text
docs/
├── 01-project-overview.md
├── 02-architecture.md
├── 03-development-environment.md
├── 04-database.md
├── 05-license-engine.md
├── 06-client-sdk.md
├── 07-admin-console.md
├── 08-payment.md
├── 09-security.md
├── 10-production-deployment.md
├── 11-production-extensions.md
├── 12-backup-recovery.md
├── 13-monitoring.md
├── 14-ci-cd.md
├── 15-client-release.md
├── 16-troubleshooting.md
└── 17-commercial-launch-checklist.md
```

------------------------------------------------------------------------

# 37. 商业上线 Checklist

## Infrastructure

``` text
☐ Server
☐ Domain
☐ DNS
☐ Firewall
☐ Docker
```

## Backend

``` text
☐ ASP.NET Core
☐ PostgreSQL
☐ Redis
☐ EF Core Migration
☐ Background Worker
```

## Frontend

``` text
☐ Admin Console
☐ Customer Portal
☐ Download Center
```

## License

``` text
☐ Generate
☐ Activate
☐ Validate
☐ Revoke
☐ Expire
☐ Device Limit
☐ Offline Grace
☐ Signed Token
```

## Payment

``` text
☐ Checkout
☐ Webhook
☐ Idempotency
☐ Refund
☐ Automatic License
```

## Email

``` text
☐ SMTP / Email Provider
☐ Activation Email
☐ Password Reset
☐ Order Email
```

## Security

``` text
☐ HTTPS
☐ WAF
☐ Rate Limit
☐ MFA
☐ RBAC
☐ Audit Log
☐ Secret Management
☐ Database Private
☐ Redis Private
```

## Client

``` text
☐ Windows
☐ macOS Intel
☐ macOS ARM64
☐ Linux
☐ Code Signing
☐ Auto Update
```

## Operations

``` text
☐ Logs
☐ Metrics
☐ Traces
☐ Alerts
☐ Backup
☐ Restore
☐ Disaster Recovery
```

## Release

``` text
☐ CI
☐ CD
☐ Docker Registry
☐ Version Tag
☐ Rollback
☐ Release Notes
☐ Documentation
```

## Commercial

``` text
☐ Pricing
☐ Terms
☐ Privacy Policy
☐ Refund Policy
☐ Support
☐ Status Page
```

------------------------------------------------------------------------

# 38. 直播部署最简路径

第一次直播只需要：

``` text
Docker
 ↓
PostgreSQL
 ↓
Redis
 ↓
ASP.NET Core
 ↓
Health Check
 ↓
Nginx
 ↓
HTTPS
 ↓
License Create
 ↓
Client Activate
```

后续逐步加入：

``` text
Admin
→ Payment
→ Email
→ Backup
→ Monitoring
→ CI/CD
→ Auto Update
→ Security Audit
```

这样可以避免第一次部署时组件过多导致现场故障。

------------------------------------------------------------------------

# 39. 开发环境建议

三平台：

``` text
Windows
macOS
Linux
```

统一使用：

``` text
Git
Docker
Bun
.NET SDK
PostgreSQL
Redis
```

建议版本管理：

``` text
.NET
Node/Bun
TypeScript
```

通过版本管理工具或项目配置固定版本。

生产环境不要因为开发机自动升级而随意改变运行时版本。

------------------------------------------------------------------------

# 40. 多平台开发原则

所有开发人员使用：

``` text
Docker Compose
```

统一数据库：

``` text
PostgreSQL
Redis
```

不要：

``` text
Windows 使用本地 PostgreSQL
macOS 使用 Homebrew PostgreSQL
Linux 使用 apt PostgreSQL
```

而导致版本和配置不一致。

推荐：

``` text
Windows
   ┐
macOS ── Docker Compose ── PostgreSQL + Redis
   │
Linux
```

这样三个开发平台拥有尽可能一致的基础设施。

------------------------------------------------------------------------

# 41. 结论

这套 License 系统建议采用：

``` text
C#
ASP.NET Core
EF Core
PostgreSQL
Redis
Next.js
TypeScript
Bun
Docker
Nginx
GitHub Actions
GHCR
Cloudflare
OpenTelemetry
Prometheus
Grafana
```

核心原则：

``` text
License Server 是信任边界
Private Key 永远不进入客户端
数据库不开放公网
Redis 不保存唯一核心数据
支付以经过验证的 Webhook 为准
Webhook 必须幂等
Admin 必须 MFA
生产必须备份
备份必须测试恢复
生产部署必须可回滚
客户端必须代码签名
更新包必须验证完整性与签名
```

最终目标不是"让软件绝对无法破解"，而是建立一个完整的商业授权信任体系：

``` text
Payment
   ↓
Order
   ↓
License
   ↓
Activation
   ↓
Device
   ↓
Validation
   ↓
Software Usage
   ↓
Renewal / Expiration
   ↓
Support
```

这才是可长期维护和商业化运营的 License 平台。
