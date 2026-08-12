# 🛡️ 商业级激活授权管理系统 (B2B2C Enterprise Activation System)

![License](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)
![.NET](https://img.shields.io/badge/.NET-10.0-512BD4.svg?style=for-the-badge&logo=dotnet)
![Next.js](https://img.shields.io/badge/Next.js-16_Turbopack-black.svg?style=for-the-badge&logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1.svg?style=for-the-badge&logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=for-the-badge&logo=docker)
![Security](https://img.shields.io/badge/Security-Passkey_%7C_RSA_2048-success.svg?style=for-the-badge)

欢迎来到 **商业级激活授权管理系统**！本系统专为采用 **B2B2C (渠道发卡/电商分发)** 模式的商业软件设计。

在 B2B2C 模式下，系统完美分离了**管理员管理**与**终端客户激活**的业务边界。采用最严密的加密策略与现代化的全栈架构，保护您的软件知识产权，让发卡、授权与设备管理坚如磐石。

---

## ✨ 核心商业特性 (Enterprise Features)

> [!TIP]
> **为发卡网/经销商量身定制**：终端用户在激活时 **无需提供邮箱、无需注册**。仅凭一串激活码与设备指纹即可完成一键绑定。最大化降低 C 端使用门槛！

- **🔄 智能换机与自动踢出 (Auto-Revoke & Device Transfer)**：支持为激活码配置“最大设备数(MaxDevices)”与“最大换机次数(MaxActivations)”。当用户在全新设备上激活时，若设备槽已满且允许换机，系统将**自动踢出最老的设备**。轻松实现限制多开的同时免去人工解绑的烦恼。
- **🔐 零暴露级密码学安全 (离线 RSA 防篡改)**：数据库仅存储激活码的 SHA256 哈希值。客户端离线校验采用 2048 位 `RSA + SHA256` 数字签名机制，从根本上防止客户端破解者伪造或篡改授权到期时间。
- **📱 硬件级无密码认证 (Passkey & WebAuthn)**：管理员后台除了支持传统账号密码外，全面支持现代化 **Passkey (通行密钥/指纹/面容)** 登录。将内部管理账户被盗风险降至物理级别的最低点。
- **🛡️ 账号防爆破与防并发 (Concurrent Login Prevention)**：支持同一超级管理员账号多地登录**自动互踢**，严格保证 Session 唯一性。内置密码试错防爆破系统，连续输入错误 3 次即锁定账号 15 分钟。
- **📊 高性能数据大盘 (Real-time Analytics)**：内置图形化管理员看板 (`/admin`)，实时双轨呈现 **今日新增激活量** 与 **异常拦截攻击量**。支持一秒生成千张授权码，并**一键导出带完整规范格式的 CSV 报表**，完美对接各大自动发卡平台。
- **🚀 极致轻量化与全栈性能优化**：前端采用 Next.js 16 (Static Export) 静态构建，无缝适配 Nginx；后端采用极小体积的 .NET Alpine 镜像，底层集成 **IMemoryCache 内存级高速缓存** 及 Entity Framework 无追踪查询优化，应对高并发抢购/大批量激活稳如泰山。
- **🐳 容器化黑盒防御**：通过 Docker Compose 部署，数据库与后端 API 的端口被完全封锁在虚拟内网中。唯一对外的窗口由 Nginx 严格把守，并强制全链路 HTTPS。

---

## 📂 项目结构 (Repository Structure)

```text
├── backend/                # 🛠️ C# .NET 10 WebAPI 后端 (鉴权、RSA签发、并发锁、设备清洗逻辑)
├── frontend/               # 💻 Next.js 16 静态前端 (图表大盘、发卡面板、Passkey 等)
├── docs/                   # 📚 核心文档库 (开发指南、架构解析、API 规范)
│   ├── architecture_and_workflow.md
│   ├── disaster_recovery_and_backup.md
│   └── local_network_deployment_guide.md
├── docker-compose.yml      # 🐳 一键生产部署编排文件 (强制 HTTPS 外网访问)
├── docker-compose.lan.yml  # 🏠 局域网无外网部署编排 (HTTP 测试环境专用)
├── .env.example            # ⚙️ 生产环境配置模板
└── README.md               # 📖 项目首页说明
```

---

## 🚀 快速上手 (Quick Start)

### 1. 查阅文档

强烈建议您在进行任何操作前，先前往 [`docs/`](./docs) 目录查阅文档。
👉 首推必读：**[核心架构、工作流与 API 对接指南 (Architecture & Workflow)](./docs/architecture_and_workflow.md)**

### 2. 部署到服务器 (生产环境)

准备一台安装好 Docker 的 Linux 服务器，只需几步即可启动完整的业务链：

1. 克隆本项目代码。
2. 复制并配置 `.env` 环境变量文件：`cp .env.example .env` (根据您的环境调整配置)。
   > **💡 提示**: 首次启动时，系统将通过 `.env` 中的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 自动为您创建超级管理员账号，并发放默认 RSA 密钥对。
3. **配置 SSL 证书 (必须)**：由于 Next.js 与 Passkey (WebAuthn) 强依赖安全上下文，生产环境必须使用 HTTPS。
   - **生产环境下，请将正规机构颁发的 `cert.pem` 和 `key.pem` 放入根目录的 `ssl` 文件夹中。**
   - 若仅用于外网测试，可运行我们为您准备的一键脚本生成自签证书（`bash generate-ssl.sh`），否则 Nginx 将会崩溃。
4. 执行启动命令：
   ```bash
   docker-compose up -d --build
   ```

### 3. 局域网无外网环境专用部署 (LAN-Only Deployment)

如果您是在公司内部纯局域网测试，无法配置域名和 HTTPS，我们也为您准备了一套纯 HTTP、无强制加密的**免配置部署方案**（注意：HTTP 下 Passkey 功能不可用）：

1. 复制环境文件：`cp .env.lan.example .env.lan`
2. 使用专用配置启动：
   ```bash
   docker-compose -f docker-compose.lan.yml --env-file .env.lan up -d --build
   ```
> 这套配置覆盖了强制 HTTPS 安全策略，使用独立的数据库映射卷（`pgdata_lan`），与生产环境数据互不干扰。

---

## 🛡️ C 端接入合规建议 (Client Integration Advice)

本系统提供了坚不可摧的服务端签发与校验能力。但为了实现完整的软件商业闭环，**在您的 C 端软件 (桌面应用/插件等) 接入时**，我们强烈建议您加入：
1. **VMP 加壳 / 代码混淆**：防止黑客反编译提取公钥或跳过验证逻辑。
2. **设备指纹混淆**：采集主板/CPU/网卡 MAC 等多维度信息并哈希化作为 `HardwareId`。
3. **RSA 签名本地强校验**：使用我们在后台生成的公钥，对服务器返回的 License 内容进行严密的离线签名验证。

> [!IMPORTANT]
> 您的软件只需发送 JSON: `{ "licenseKey": "...", "hardwareId": "..." }` 即可完成智能绑定，无需让用户输入任何个人信息。

---

🎉 祝您的商业软件大卖！