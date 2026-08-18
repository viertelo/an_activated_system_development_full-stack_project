# 全栈商业激活系统开发教程 (Full-Stack Development Tutorial)

本文档旨在为您（或未来的开发者）提供一份从零开始构建本“商业级激活授权管理系统”的学习与开发指南。无论您是想复盘整个开发流程，还是想学习各模块的核心技术，本文档都将为您指明方向。

---

## 一、 项目技术栈全貌 (Technology Stack)

本系统分为三个核心部分：前端 (Frontend)、后端 (Backend) 与数据层 (Database)，并且通过 Docker 实现全容器化部署。

### 1. 前端技术栈 (Frontend)
- **核心框架**: [Next.js (React)](https://nextjs.org/)
  - **优势**: 业界最流行的 React 框架。本项目为了极简和高性能，采用了 `output: export` 模式，将其纯静态化导出，完全摆脱 Node.js 运行时依赖。
- **UI 与样式**: [Vanilla CSS (原生 CSS)](https://developer.mozilla.org/zh-CN/docs/Web/CSS)
  - **优势**: 采用现代化且极简的玻璃拟物化 (Glassmorphism) 和高级深色模式设计，没有任何第三方 CSS 库的臃肿负担。

### 2. 后端技术栈 (Backend)
- **核心框架**: [.NET 10.0 WebAPI (C#)](https://dotnet.microsoft.com/)
  - **优势**: 微软最新的企业级高性能跨平台框架，内置依赖注入 (DI) 和安全策略。为了轻量化，本项目运行在极为精简的 `Alpine Linux` 容器镜像中。
- **ORM 数据操作**: [Entity Framework Core (EF Core)](https://learn.microsoft.com/zh-cn/ef/core/)
  - **优势**: C# 最强大的代码优先 (Code-First) 数据库映射框架，无需手写复杂的 SQL 语句。

### 3. 数据层与部署 (Database & Deployment)
- **数据库**: [PostgreSQL 15](https://www.postgresql.org/)
  - **优势**: 世界上最先进的开源关系型数据库，极其稳定且支持高并发。
- **反向代理与 Web 服务器**: [Nginx](https://nginx.org/)
  - **优势**: 极高的并发处理能力，负责静态页面的托管、`/api/` 路由的转发，以及 HTTPS (443) 证书的 SSL 加密卸载。
- **容器化部署**: [Docker & Docker Compose](https://www.docker.com/)
  - **优势**: 一键拉起前后端与数据库，构建隔离的虚拟内网，保护后端不暴露在公网。

---

## 二、 核心依赖包及引用地址 (Dependencies & Packages)

在开发本系统时，我们引入了以下关键的商业级第三方 NuGet 包（可在您的 `backend.csproj` 中看到）：

1. **[Npgsql.EntityFrameworkCore.PostgreSQL](https://www.nuget.org/packages/Npgsql.EntityFrameworkCore.PostgreSQL/)**
   - **用途**: 它是 EF Core 连接 PostgreSQL 的官方桥梁。帮助我们在代码里用 C# 对象直接操作 PG 数据库。
2. **[Microsoft.EntityFrameworkCore.Design](https://www.nuget.org/packages/Microsoft.EntityFrameworkCore.Design/)**
   - **用途**: 用于在开发阶段执行数据库迁移命令 (如 `dotnet ef migrations add`)，把 C# 代码结构变成真正的 SQL 表结构。
3. **[MailKit](https://www.nuget.org/packages/MailKit/) / [MimeKit](https://www.nuget.org/packages/MimeKit/)**
   - **用途**: .NET 领域最强大、最安全的跨平台邮件发送库。本系统中用于处理**注册邮箱验证**和**找回激活码邮件发送**。
4. **[Otp.NET](https://www.nuget.org/packages/Otp.NET/)**
   - **用途**: 实现了基于时间的一次性密码 (TOTP) 算法。它是系统中 **2FA 二次验证码** (对接 Google Authenticator) 的核心算法库。

---

## 三、 从头到尾的开发工作流 (Development Workflow)

如果您想从零复刻一个同样的系统，请遵循以下开发顺序：

### 第一步：搭建数据库底座与后端框架
1. **创建项目**: 运行 `dotnet new webapi -n backend` 初始化纯净的 API 项目。
2. **连接数据库**: 在 `AppDbContext.cs` 中定义好 `User`（用户表）和 `License`（激活码表），并使用 `Npgsql` 驱动配置数据库连接。
3. **核心难点设计 (哈希存储)**: 在 `License.cs` 的设计上，坚决不在类中定义明文存储字段，必须使用 `LicenseKeyHash` 字段，从源头切断泄露风险。
4. **初始管理员种子 (Seeding)**: 在 `Program.cs` 启动阶段，通过读取环境变量 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 实现自动化初始管理员的静默注入，解决首个管理员账号需要手动改库的麻烦。

### 第二步：开发高级认证模块 (Auth & 2FA)
1. **注册与邮件验证**: 
   - 开发 `AuthController.cs` 的注册接口。用户注册后，生成唯一 `Token` 存入数据库，并调用 `MailKit` 发送包含该 Token 的确认链接给用户。
2. **2FA 动态密钥**:
   - 引入 `Otp.NET`，在 `Setup2FA` 接口中，**必须**先检测该账号是否已邮件验证（`IsEmailVerified`）。
   - 为用户生成专属的 TOTP 密钥及二维码 URI（格式为 `otpauth://totp/...`），供客户端扫描。

### 第三步：开发激活码分发与验证核心 (License System)
1. **发卡逻辑**: 管理员请求接口，服务器生成 32 位极高强度的随机字符，然后调用 `SHA256.ComputeHash()` 加密，将**哈希值**存入数据库，把**明文**通过 API 仅返回一次给客户端。
2. **验证逻辑**: 客户端带上指纹（如 CPU ID）和**明文**发起激活请求，服务器再次进行 SHA256 运算，拿算出来的结果去数据库里找。如果找到了且 `MaxDevices` 没满，则将指纹绑定并放行。
3. **安全重置逻辑 (双链路找回)**:
   - **找回激活码**：在重置接口中不仅要生成新卡，还要执行 `context.Licenses.RemoveRange(oldLicenses)` 将旧卡从底层彻底吊销，把新卡发往绑定邮箱。
   - **找回密码**：系统向管理员邮箱发送包含带有过期时间的专属 `Token` 链接，用户点击链接完成新密码的安全重置。

### 第四步：开发前端 UI 交互 (Frontend)
1. **初始化 Next.js**: 运行 `npx create-next-app@latest frontend`，选择去除多余配置的极简模式。
2. **静态导出配置**: 在 `next.config.js` 中设置 `output: 'export'`，并关闭图片优化功能（为了摆脱对 Node.js 服务器的依赖）。
3. **对接 API**: 使用原生的 `fetch` 向 `/api/auth/...` 发送请求。由于最后会交由 Nginx 统一部署，所以请求路径必须使用相对路径（不能写死 `http://localhost...`），这样可以完美避开跨域问题。

### 第五步：容器化与安全加固 (Docker & Nginx)
1. 编写后端的 `Dockerfile`，采用两阶段构建（SDK 编译 -> Alpine 运行）以获得极小体积。
2. 编写前端的 `Dockerfile`，先执行 `npm run build` 生成 HTML，然后将产物复制到 `nginx:alpine` 的发布目录下。
3. 编写 `nginx.conf`，将 80 端口无条件 301 重定向到 443 端口，配置好强力的 `TLS 1.2/1.3` 证书选项，并将 `/api/` 路由反向代理给后端的内部服务 `http://backend:5000`。
4. 编写 `docker-compose.yml` 统领全局，设定私有网络 `activation_net`，确保后端与数据库端口不对外暴露。

---

> **结语**: 通过上述 5 个大步骤，便完成了一个具备商业交付能力的、前后端分离、极度注重防破解安全与数据隔离的激活系统的开发。建议您在研究源码时，以 `backend/Controllers/` 作为切入点，能最快理清本系统的业务脉络。
