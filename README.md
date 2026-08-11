# 🛡️ 商业级激活授权管理系统 (Activation System Pro)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![.NET](https://img.shields.io/badge/.NET-10.0-purple.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)

欢迎来到 **商业级激活授权管理系统**！本系统专为需要高安全性、防破解的商业软件设计。采用最严密的加密策略与现代化的全栈架构，保护您的软件权益。

---

## ✨ 核心特性 (Key Features)

- **🔐 零暴露级密码学安全**：数据库仅存储激活码的 SHA256 哈希值。即使数据库被拖库，黑客也无法得到真正的激活码。
- **📱 严苛的身份认证机制**：支持注册后的强制 **邮箱验证**，并全面支持 **2FA (基于 Google Authenticator 的二次验证码)** 登录，将内部账户被盗风险降至最低。
- **🔄 找回不暴露机制**：当用户遗忘激活码申请找回时，系统会直接吊销旧码并发放新码，彻底堵死已泄露激活码的二次滥用。
- **🚀 极致轻量化的架构**：前端采用纯静态构建 (Next.js Static Export)，后端采用极小体积的 .NET Alpine 镜像，资源占用极低。
- **🐳 容器化黑盒防扫描**：通过 Docker Compose 部署，数据库与后端 API 的端口被完全封锁在虚拟内网中。唯一对外的窗口由 Nginx (80/443) 严格把守。
- **🔒 强制全链路 HTTPS**：防止中间人攻击 (MITM) 及流量嗅探。

---

## 📂 项目结构 (Repository Structure)

所有的开发与部署设计文档已被集中归档，方便您的查阅：

```text
├── backend/                # 🛠️ C# .NET 10 WebAPI 后端源码 (鉴权、数据库、邮件发送)
├── frontend/               # 💻 Next.js / React 前端源码 (注册、登录、2FA等交互页面)
├── docs/                   # 📚 核心文档库 (开发指南、架构解析、部署说明等)
│   ├── License_商业激活系统_完整开发部署文档.md
│   ├── architecture_and_workflow.md
│   ├── local_network_deployment_guide.md
│   └── ... 
├── docker-compose.yml      # 🐳 一键部署编排文件
└── README.md               # 📖 项目首页说明 (当前文件)
```

---

## 🚀 快速上手 (Quick Start)

### 1. 查阅文档
强烈建议您在进行任何操作前，先前往 [`docs/`](./docs) 目录查阅文档。
👉 首推必读：**[核心架构、工作流与使用指南 (Architecture & Workflow)](./docs/architecture_and_workflow.md)**

### 2. 部署到服务器
准备一台安装好 Docker 的 Linux 服务器，只需几步即可启动完整的业务链：
1. 克隆本项目代码。
2. 配置 `.env` 环境变量文件及您的 SSL 证书。
3. 执行：
   ```bash
   docker-compose up -d --build
   ```
4. 部署详情请严格参考：**[局域网环境完整部署与安全指南](./docs/local_network_deployment_guide.md)**

---

## 🛡️ 安全合规建议 (Security Advice)
本系统提供了服务端极其坚固的防御能力。但为了实现完整的商业闭环，**在客户端 (C/S 桌面软件) 的接入上**，强烈建议您加入 **VMP 加壳、SSL Pinning 证书绑定、代码混淆** 等反逆向措施，形成完整的攻防链路。详细客户端方案请见 `docs/local_network_deployment_guide.md` 的第 8 节。

---

🎉 祝您商业化大卖！