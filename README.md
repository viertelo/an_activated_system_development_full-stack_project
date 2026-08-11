# 🛡️ 商业级激活授权管理系统 (Activation System Pro)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![.NET](https://img.shields.io/badge/.NET-10.0-purple.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)

欢迎来到 **商业级激活授权管理系统**！本系统专为需要高安全性、防破解的商业软件设计。采用最严密的加密策略与现代化的全栈架构，保护您的软件权益。

---

## ✨ 核心特性 (Key Features)

- **🔐 零暴露级密码学安全 (离线 RSA 防篡改)**：数据库仅存储激活码的 SHA256 哈希值。客户端离线校验采用 2048 位 `RSA + SHA256` 数字签名机制，从根本上防止客户端破解者伪造或篡改授权到期时间。
- **📱 严苛的身份认证机制**：支持注册后的强制 **邮箱验证**，并将重要高危操作收敛于认证之后，全面支持 **2FA (基于 Google Authenticator 的二次验证码)** 登录，将内部账户被盗风险降至最低。
- **🔄 找回不暴露机制 (双链路安全找回)**：支持通过邮箱找回“激活码”和“管理员密码”。当找回激活码时，系统会直接吊销旧码并发放新码，彻底堵死已泄露激活码的二次滥用。
- **🚀 极致轻量化的架构**：前端采用纯静态构建 (Next.js Static Export)，后端采用极小体积的 .NET Alpine 镜像，资源占用极低。
- **🐳 容器化黑盒防扫描**：通过 Docker Compose 部署，数据库与后端 API 的端口被完全封锁在虚拟内网中。唯一对外的窗口由 Nginx (80/443) 严格把守。
- **🔒 强制全链路 HTTPS**：防止中间人攻击 (MITM) 及流量嗅探。
- **👑 商业模式拓展**：内置订阅制支持，可发售“永久版”、“按月/年订阅版”以及“限时试用版”激活码。
- **📊 数据大盘与批量发卡 (Analytics Dashboard)**：内置图形化管理员看板 (`/admin`)，实时双轨呈现 **今日新增激活量** 与 **异常拦截攻击量**。支持一秒生成千张授权码，并一键导出为 CSV 报表，完美对接发卡网/经销商。
- **🛡️ 动态风控与拦截留痕**：借助 `AspNetCore.RateLimiting`，为激活接口布下天罗地网（单 IP 限频），一旦触发恶意爆破扫号，立即切断请求并自动在数据库 `AuditLogs` 审计日志中留下黑客入侵的证据。

---

## 📂 项目结构 (Repository Structure)

所有的开发与部署设计文档已被集中归档，方便您的查阅：

```text
├── backend/                # 🛠️ C# .NET 10 WebAPI 后端源码 (鉴权、RSA、数据库、邮件发送)
├── frontend/               # 💻 Next.js / React 前端源码 (注册、图表大盘、登录、2FA等)
├── docs/                   # 📚 核心文档库 (开发指南、架构解析、部署说明等)
│   ├── License_商业激活系统_完整开发部署文档.md
│   ├── architecture_and_workflow.md
│   ├── local_network_deployment_guide.md
│   └── ... 
├── docker-compose.yml      # 🐳 一键部署编排文件 (生产环境 HTTPS)
├── docker-compose.lan.yml  # 🏠 局域网无外网部署编排 (测试环境 HTTP)
├── .env.example            # ⚙️ 生产环境配置参考文件
├── .env.lan.example        # ⚙️ 局域网环境配置参考文件
└── README.md               # 📖 项目首页说明 (当前文件)
```

---

## 🚀 快速上手 (Quick Start)

### 1. 查阅文档
强烈建议您在进行任何操作前，先前往 [`docs/`](./docs) 目录查阅文档。
👉 首推必读：**[核心架构、工作流与使用指南 (Architecture & Workflow)](./docs/architecture_and_workflow.md)**

### 2. 部署到服务器 (生产环境)
准备一台安装好 Docker 的 Linux 服务器，只需几步即可启动完整的业务链：
1. 克隆本项目代码。
2. 复制并配置 `.env` 环境变量文件：`cp .env.example .env` (根据您的环境调整数据库密码和 SMTP 配置)。
   > **💡 提示**: 首次启动时，系统将通过 `.env` 中的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 自动为您创建超级管理员账号，并发放默认 RSA 密钥对。
3. **生成自签名 SSL 证书 (必须)**：如果您在没有商业证书的环境测试生产代码，请运行我们为您准备的一键脚本生成临时证书，否则 Nginx 将会崩溃：
   - Linux / macOS: `bash generate-ssl.sh`
   - Windows: `.\generate-ssl.ps1`
   - **生产环境下，请将正规机构颁发的 `cert.pem` 和 `key.pem` 放入根目录的 `ssl` 文件夹中。**
4. 执行启动命令：
   ```bash
   docker-compose up -d --build
   ```

### 3. 局域网无外网环境专用部署 (LAN-Only Deployment)
如果您是在公司内部局域网测试，不方便配置域名和 HTTPS，我们也为您准备了一套纯 HTTP、无强制加密的**局域网免配置部署方案**：
1. 复制环境文件：`cp .env.lan.example .env.lan`
2. 使用专用配置启动：
   ```bash
   docker-compose -f docker-compose.lan.yml --env-file .env.lan up -d --build
   ```
这套配置专门覆盖了原有的强制 HTTPS 安全策略，使用独立的数据库映射卷（`pgdata_lan`），保证了和外网生产环境（`docker-compose.yml`）互不冲突。

👉 部署详情请严格参考：**[局域网环境完整部署与安全指南](./docs/local_network_deployment_guide.md)**

---

## 🛡️ 安全合规建议 (Security Advice)
本系统提供了服务端极其坚固的防御能力。但为了实现完整的商业闭环，**在客户端 (C/S 桌面软件) 的接入上**，强烈建议您加入 **VMP 加壳、SSL Pinning 证书绑定、代码混淆** 等反逆向措施，形成完整的攻防链路。详细的离线 RSA 客户端接入方案请见 `docs/local_network_deployment_guide.md` 的相关小节。

---

🎉 祝您商业化大卖！