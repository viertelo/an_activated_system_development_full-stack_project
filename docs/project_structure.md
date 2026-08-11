# 商业激活系统项目结构文档 (Project Structure)

本系统采用纯前后端分离的架构，并全面支持 Docker 容器化一键部署。以下是整个项目文件夹的核心结构说明：

## 📁 根目录层级

```text
C:\BLWJ\an_activated_system_development_full-stack_project\
├── backend/                  # C# ASP.NET Core 10.0 后端核心源码
├── frontend/                 # Next.js / React 前端核心源码
├── deploy/                   # 部署文档与配置文件夹
│   ├── local_network_deployment_guide.md  # 局域网服务器安全部署与配置指南
│   └── remote_deployment_notes.md         # 生产环境部署备忘录
├── docker-compose.yml        # Docker 容器编排总指挥文件 (拉起全套环境)
└── License_商业激活系统_完整开发部署文档.md # 初始业务需求分析与系统架构设计书
```

---

## ⚙️ 后端结构 (`backend/`)
基于 ASP.NET Core 10.0 和 Entity Framework Core 搭建的高性能轻量级 API。

```text
backend/
├── Controllers/              # 接收外部请求的 API 接口层
│   ├── AdminController.cs    # 管理员专用：生成 License、吊销 License
│   ├── DeviceController.cs   # 设备管理：强制解绑指定硬件
│   └── LicenseController.cs  # 客户端接口：核心的激活设备与授权校验
├── Models/                   # 数据库实体定义层 (ORM)
│   ├── AuditLog.cs           # 安全审计日志表 (记录高危操作)
│   ├── Device.cs             # 硬件设备信息表
│   ├── License.cs            # 核心激活码授权表 (存储不可逆哈希)
│   ├── Order.cs              # 支付订单预留表
│   ├── User.cs               # 用户基本信息表
│   └── WebhookEvent.cs       # 支付回调防并发幂等表
├── Services/                 # 核心业务逻辑处理层 (安全封装)
│   ├── AdminService.cs       # 处理管理员高权限请求及生成哈希代码
│   └── LicenseService.cs     # 负责哈希比对、设备额度校验等鉴权算法
├── Data/
│   └── AppDbContext.cs       # PostgreSQL 数据库上下文配置与唯一索引建立
├── Dockerfile                # 后端专属容器构建脚本 (采用极轻量 Alpine 运行时)
├── Program.cs                # 应用程序总入口 (配置跨域 CORS、限流防御、依赖注入)
├── appsettings.json          # 全局配置 (包含数据库连接串占位符)
└── backend.csproj            # C# 项目工程与依赖配置文件
```

---

## 🎨 前端结构 (`frontend/`)
基于 Next.js 和 Tailwind CSS 构建的极简、轻量前端项目，完全静态导出。

```text
frontend/
├── src/
│   └── app/
│       ├── globals.css       # 全局样式文件与 Tailwind 指令配置
│       ├── layout.tsx        # React 全局根布局文件
│       └── page.tsx          # 默认入口页面 (已实现包含防探测机制的激活/登录极简 UI)
├── Dockerfile                # 前端专属容器构建脚本 (基于 Nginx 轻量镜像托管静态网页)
├── nginx.conf                # Nginx 服务器配置 (提供纯静态网页及向后端 /api 的反向代理)
├── next.config.ts            # Next.js 配置 (已开启 output: 'export' 极致静态化选项)
├── package.json              # Node.js 依赖配置
├── tailwind.config.ts        # Tailwind CSS 原子化样式表引擎配置
└── tsconfig.json             # TypeScript 强类型系统配置
```

---

## 🔒 核心设计哲学
1. **彻底解耦**：前端仅仅是一个用来呈现静态 HTML 的壳，不包含任何商业秘密；后端紧紧包裹着核心鉴权算法和数据库，杜绝越权访问。
2. **安全至上**：API 设计遵循“模糊提示”防探测撞库原则，内置 Rate Limiting 防爆破，并且密码及激活码均经过 SHA256 单向不可逆哈希处理。
3. **极简运维**：剥离了沉重的运行时。前后端和 PostgreSQL 数据库全部使用极小内存的 Alpine 容器化运行。
