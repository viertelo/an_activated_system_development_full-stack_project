# 局域网环境完整部署与安全指南 (LAN Deployment & Security Guide)

本文档旨在为您提供详尽的商业激活系统部署指引，特别是针对**局域网（LAN）内部署测试**。

> [!TIP]
> **🎉 V2.0 全新极简局域网部署方案**
> 在最新版本中，我们为您提供了**一键式的局域网专属配置**。您**完全不需要**再手动配置复杂的 PostgreSQL 监听或 Nginx SSL 证书。
>
> 所有的环境隔离、数据库初始化和纯 HTTP 代理都已经封装在了 `docker-compose.lan.yml` 和 `frontend/nginx.lan.conf` 中。

---

## 1. 极速部署指南 (推荐)

如果您只是想在局域网内快速跑起项目进行测试（无需外网域名、无需 HTTPS）：

1. **准备环境文件**：
   在项目根目录，直接复制我们为您准备好的局域网专属配置模板：
   ```bash
   # Windows PowerShell
   Copy-Item .env.lan.example .env.lan
   # Linux/macOS
   cp .env.lan.example .env.lan
   ```

2. **一键启动**：
   在根目录下运行以下命令，系统将自动读取专属配置并进行纯内网安全的构建和启动：
   ```bash
   docker-compose -f docker-compose.lan.yml --env-file .env.lan up -d --build
   ```

3. **访问系统**：
   打开浏览器，访问 `http://<您的局域网IP>:8080` 即可直接使用完整的前后端系统。

> 这套配置使用了完全独立的 Docker 网络 (`activation_net_lan`) 和本地映射卷 (`data/db` 与 `data/keys`)。

> **⚠️ 注意事项 (针对 Linux/Mac 用户)**
> 首次运行前，请确保在根目录赋予 data 文件夹读取和写入权限，以防止非特权 Docker 容器报错无权限。
> ```bash
> mkdir -p data/db data/keys
> chmod -R 777 data/
> ```
