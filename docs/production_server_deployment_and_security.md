# 生产服务器环境手动部署与安全加固指南 (Production Server Deployment & Security Guide)

本指南针对想要脱离 Docker 体系，或者想要深入理解底层安全架构，在裸机 Linux 服务器上手动部署商业激活系统的用户。

---

## 1. 传统手动 PostgreSQL 部署

PostgreSQL 是一款性能优异且极度安全的开源关系型数据库。在服务器上手动部署时，请遵循以下步骤以兼顾轻量化和高安全性。

### 1.1 环境要求
- **操作系统**：推荐使用轻量的 Linux 发行版（如 Debian 或 Ubuntu Server），因为它们不带图形界面，内存占用极低（512MB RAM 即可运行基础库）。如果只能使用 Windows Server，请关闭不必要的后台服务。
- **硬件消耗**：PostgreSQL 自身占用极小，非常符合您“对硬件性能要求越低越好”的需求。

### 1.2 核心配置文件修改（允许应用服务器访问）
默认情况下，PostgreSQL 只允许本地 (`localhost`) 连接。要让您的后端应用访问它，必须修改两个核心配置文件（通常在 `/etc/postgresql/<version>/main/` 或 Windows 的 `C:\Program Files\PostgreSQL\<version>\data\` 下）：

#### (A) 修改 `postgresql.conf`
找到 `listen_addresses` 配置项：
```ini
# 原配置
#listen_addresses = 'localhost'

# 修改为（允许监听所有网卡，或填写具体的后端 IP 如 '192.168.1.100'）
listen_addresses = '*'
```

#### (B) 修改 `pg_hba.conf` (极为关键的安全配置)
这里决定了谁能连上数据库。**绝不允许开放给 `0.0.0.0/0` (全网)**。
在文件末尾添加一行，仅允许您的后端服务器 IP（例如后端服务器 IP 是 `192.168.1.50`）进行连接：
```text
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    all             all             192.168.1.50/32         scram-sha-256
```
> **安全警告**：`METHOD` 必须使用 `scram-sha-256`，这是目前最安全的密码加密认证方式，绝不要使用 `md5` 或 `trust`。

### 1.3 数据库角色与强密码策略
- **禁用默认超管远程登录**：不要使用 `postgres` 账号让后端直连。
- **创建专属账号**：
  在数据库中执行以下 SQL，为激活系统创建一个权限受限的专属用户：
  ```sql
  CREATE USER activate_admin WITH ENCRYPTED PASSWORD '这里填入一个极高强度的随机密码';
  CREATE DATABASE activation_db OWNER activate_admin;
  ```
- **权限隔离**：该账号只拥有 `activation_db` 的读写权限，就算发生最坏的情况（连接字符串泄露），攻击者也无法染指服务器上的其他数据库。

---

## 2. 后端应用 (ASP.NET Core) 部署注意

### 2.1 连接字符串配置
在后端项目根目录下的 `appsettings.Production.json` 中，配置刚才部署的数据库连接：
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=192.168.1.X;Database=activation_db;Username=activate_admin;Password=极高强度密码"
  }
}
```

### 2.2 解除安全代码注释
在部署前，确保身份验证正常开启：
- `backend/Controllers/AdminController.cs` 中的 `[Authorize(Roles = "Admin")]`
- `backend/Program.cs` 中相关的 Auth 中间件代码。

### 2.3 极致性能优化
为了在低配硬件上运行，请在服务器上使用独立模式（Self-Contained）或依赖框架模式（Framework-Dependent）发布，无需安装笨重的 IIS 服务器，直接使用内置的 Kestrel 服务器运行。
```bash
# 发布极简且优化的生产包
dotnet publish -c Release -r linux-x64 --self-contained false -o ./publish
```

---

## 3. 前端应用 (Next.js) 部署注意

由于您要求简约为主且极低性能消耗，当前的前端是完全按照**静态网站 (Static HTML)** 的标准开发的。

- **构建静态文件**：在前端目录下运行 `npm run build`。由于没有使用复杂的服务端渲染 (SSR)，Next.js 会生成纯静态的 HTML/CSS/JS 文件（通常在 `out` 目录下）。
- **静态托管**：将这些纯静态文件扔到任何一台装有 Nginx、Apache 甚至轻量级 Caddy 的服务器上即可。
- **性能优势**：静态文件不需要任何 Node.js 运行环境，服务器 CPU 和内存消耗几乎为 **0**。

---

## 4. 完整服务器部署流程 (反向代理与域名绑定)

为了使项目可以通过域名（如 `https://activate.yourdomain.com`）安全访问，请遵循以下完整的服务器外网暴露部署流程：

### 4.1 使用 Nginx 作为反向代理与 HTTPS 终结
不要将后端的 Kestrel (运行在 5000 端口) 直接暴露在公网，这极度危险。应该使用 Nginx 挡在最前面：
1. **安装 Nginx**。
2. **配置域名与 SSL**：使用 Let's Encrypt (`certbot`) 申请免费的 SSL 证书，确保所有通信必须走 HTTPS。
3. **配置 Nginx 代理规则**：
   - 将所有前端请求（如 `/` 或 `/login`）指向前端静态 HTML 所在的目录。
   - 将所有针对 `/api/` 的请求反向代理到本地局域网后端的内网 IP (例如 `http://192.168.1.50:5000`)。

```nginx
# Nginx 配置示例片段 (参考项目前端目录下的 nginx.conf，我们已为您编写了最高安全级别的完整配置)
server {
    listen 8080;
    server_name activate.yourdomain.com;
    return 301 https://$host$request_uri; # 强制 HTTPS 跳转
}

server {
    listen 8443 ssl http2;
    server_name activate.yourdomain.com;
    
    # 强制 HTTPS 的 SSL 证书路径
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3; # 禁用弱协议
    ssl_prefer_server_ciphers on;

    # 前端静态文件
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr; # 用于后端获取用户真实IP做限流
    }
}
```

---

## 5. 高级安全凭证管理 (绝不要在文件中明文保存密码)

### 5.1 为什么不要写在 appsettings.json 里？
如果您把数据库密码写在 `appsettings.json` 中，任何有服务器文件读取权限的人，或者在不小心将配置文件推送到 Git 仓库时，密码就会彻底泄露。

### 5.2 最佳实践：使用环境变量或系统 Secret
在 Linux 服务器上运行前，您应该将密码配置在系统的环境变量中，或者通过 `.env` 注入到启动进程中。绝不让密码在代码仓中出现。

---

## 6. 绝对安全规范总结 (Checklist)

- [ ] **物理与网络隔离**：数据库服务器**严禁**分配公网 IP，必须深藏在内网中。
- [ ] **SSL 强制加密**：所有外网与服务器的通信必须通过 HTTPS。绝不允许 HTTP 的明文传输被抓包。
- [ ] **凭证隔离**：数据库密码、JWT 密钥**必须**通过环境变量配置。
- [ ] **权限降级**：后端程序和 Nginx 都必须使用低权限账户（如 `www-data`）运行，**绝对不要用 root 运行程序**。
- [ ] **模糊报错提示**：API 故意设计为统一返回“授权失败”，堵死黑客遍历撞库的可能性。

---

## 7. Linux 服务器系统底层加固 (OS Hardening)

承载一切的 Linux 服务器本身也必须无懈可击。部署项目后，请在 Linux 系统层面执行以下强制安全措施：

### 7.1 SSH 登录安全配置
黑客的第一步通常是爆破 SSH 端口。
- **禁用密码登录**：修改 `/etc/ssh/sshd_config`，将 `PasswordAuthentication` 改为 `no`，强制要求只能使用 RSA/Ed25519 密钥文件登录。
- **禁用 Root 远程登录**：将 `PermitRootLogin` 改为 `no`，使用普通用户登录后再 `sudo`。
- **修改默认端口**：将默认的 22 端口改为 10000 以上的随机端口。

### 7.2 UFW 防火墙绝对白名单
启动操作系统的底层防火墙，实行“默认全部拒绝”的白名单机制：
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp     
sudo ufw allow 443/tcp    
sudo ufw allow 12345/tcp  # 放行您修改后的自定义 SSH 端口
sudo ufw enable
```
*注意：绝对不要在 UFW 中放行后端或数据库端口。*

### 7.3 Fail2Ban 防爆破
安装 `fail2ban`。当它检测到某个 IP 在短时间内多次尝试 SSH 登录失败，或疯狂请求 API 触发了 429 / 404 错误时，会自动在底层 iptables 防火墙将其封杀。

---

## 8. 客户端软件防拦截与反破解方案 (Anti-MITM & Anti-Cracking)

这是商业软件防护的**重中之重**！如果用户通过您的应用进行激活，最常见的破解手段就是“中间人拦截”和“本地暴力打补丁”。

### 8.1 防止传输中途拦截 (SSL Pinning 证书锁定)
- **黑客手段**：黑客伪造一个本地服务器拦截客户端请求，强行返回成功报文。
- **防御方案 (SSL Pinning)**：在客户端代码中，把您自己服务器 SSL 证书的“指纹 (Thumbprint/Hash)”硬编码写死。发起请求前，强制比对服务器返回的证书指纹。一旦发现指纹不对，立即退出程序。

### 8.2 报文二次加密防篡改 (Payload Encryption)
- **防御方案**：客户端和服务器之间传输的业务数据建议再包一层**对称加密（如 AES-256-GCM）**。把“激活码 + 机器码”加密成乱码再发送。

### 8.3 防重放攻击 (Anti-Replay Attack)
- **防御方案**：客户端请求必须带上**当前系统时间戳 (Timestamp)** 和一个**随机字符串 (Nonce)**。服务器收到后，检查时间戳是否超过 3 分钟，并记录下这个 Nonce。原样重发的拦截包直接拒绝。

### 8.4 客户端本地脱壳防逆向 (Obfuscation & VMP)
- **终极防御**：在发布客户端软件之前，**必须使用代码混淆工具** (如果是 C#，使用 Dotfuscator；如果是 C++/底层，使用 VMProtect 或 Themida)。通过加壳，把核心的验证逻辑全部打散变异，让黑客无法通过静态反编译找到关键跳转，极大提高破解成本。
