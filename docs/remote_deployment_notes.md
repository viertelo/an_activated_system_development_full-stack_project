# 远程部署说明书 (Remote Deployment Notes)

此文件夹用于存放远程部署所需的相关配置文件，如 Dockerfile、docker-compose.yml 以及 Nginx 配置文件等。

## 硬件性能提示
由于项目要求对硬件性能消耗极低：
1. **前端 (Frontend)**: 推荐将 Next.js 静态导出为纯 HTML/JS/CSS，部署到 Nginx 或 CDN 上。这样不占用 Node.js 后端服务资源。
2. **后端 (Backend)**: .NET Core 原生性能好，建议在 Docker 环境下配置资源限制（如 `--cpus="0.5" --memory="512m"`）。
3. **数据库 (Database)**: 建议使用轻量级 PostgreSQL 配置，限制最大连接数。

## 安全性提示
为保证绝对安全，远程部署必须满足以下条件：
1. **HTTPS 强制**: 所有外部流量必须经过 HTTPS 加密（如通过 Nginx + Let's Encrypt）。
2. **WAF 拦截**: 配置基础的 Web 应用防火墙，拦截恶意请求。
3. **限制暴露端口**: 仅暴露 HTTP (80) 和 HTTPS (443) 端口。后端 API 和数据库、Redis 端口均保持内网隔离，不可对公网开放。
4. **环境变量保护**: JWT 密钥、数据库密码等重要凭据不得硬编码在代码或 Dockerfile 中，必须通过环境变量或 Secret 服务注入。

> 备注：后续的 CI/CD 流程及相关脚本可存放于此文件夹内。
