# 局域网环境完整部署与安全指南 (LAN Deployment & Security Guide)

本文档旨在为您提供详尽的商业激活系统部署指引，特别是针对**局域网（LAN）内的 PostgreSQL 服务器部署**。由于您的核心诉求是**“极低硬件性能占用”**和**“绝对安全”**，请严格按照以下规范进行配置。

---

## 1. PostgreSQL 数据库局域网部署指南

PostgreSQL 是一款性能优异且极度安全的开源关系型数据库。在局域网服务器上部署时，请遵循以下步骤以兼顾轻量化和高安全性。

### 1.1 环境要求
- **操作系统**：推荐使用轻量的 Linux 发行版（如 Debian 或 Ubuntu Server），因为它们不带图形界面，内存占用极低（512MB RAM 即可运行基础库）。如果只能使用 Windows Server，请关闭不必要的后台服务。
- **硬件消耗**：PostgreSQL 自身占用极小，非常符合您“对硬件性能要求越低越好”的需求。

### 1.2 核心配置文件修改（允许局域网访问）
默认情况下，PostgreSQL 只允许本地 (`localhost`) 连接。要让您的后端应用访问它，必须修改两个核心配置文件（通常在 `/etc/postgresql/<version>/main/` 或 Windows 的 `C:\Program Files\PostgreSQL\<version>\data\` 下）：

#### (A) 修改 `postgresql.conf`
找到 `listen_addresses` 配置项：
```ini
# 原配置
#listen_addresses = 'localhost'

# 修改为（允许监听所有网卡，或填写具体的局域网 IP 如 '192.168.1.100'）
listen_addresses = '*'
```

#### (B) 修改 `pg_hba.conf` (极为关键的安全配置)
这里决定了谁能连上数据库。**绝不允许开放给 `0.0.0.0/0` (全网)**。
在文件末尾添加一行，仅允许您局域网内的后端服务器 IP（例如后端服务器 IP 是 `192.168.1.50`）进行连接：
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
在本地开发时，为了方便测试，我们注释了身份验证（JWT）。在部署前，**必须**打开以下文件中的注释：
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
   - 将所有前端请求（如 `/` 或 `/login`）指向前端静态 HTML 所在的目录（例如 `/var/www/activation-frontend/out`）。
   - 将所有针对 `/api/` 的请求（如 `/api/License/activate`）反向代理到本地局域网后端的内网 IP (例如 `http://192.168.1.50:5000`)。

```nginx
# Nginx 配置示例片段 (参考项目前端目录下的 nginx.conf，我们已为您编写了最高安全级别的完整配置)
server {
    listen 80;
    server_name activate.yourdomain.com;
    return 301 https://$host$request_uri; # 强制 HTTPS 跳转
}

server {
    listen 443 ssl http2;
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

## 5. 高级安全凭证管理 (绝不要在文件中明文保存密码)

您提到“服务器密码能否用 `.env` 来保存，或者有更好的安全连接方法”。**这是非常专业且必要的安全考量！**

### 5.1 为什么不要写在 appsettings.json 里？
如果您把数据库密码写在 `appsettings.json` 中，任何有服务器文件读取权限的人，或者在不小心将配置文件推送到 Git 仓库时，密码就会彻底泄露。

### 5.2 最佳实践：使用项目根目录的 `.env` 文件配合 Docker (当前方案)
在我们的 Docker 容器化部署架构中，最安全且轻量的方案是**利用 Docker 自动读取系统和目录级别的环境变量**，这完全等同于 `.env` 的效果，且绝对安全。

**在 Linux 服务器上运行前：**
您必须在项目根目录（`docker-compose.yml` 所在的同一级）创建一个名为 `.env` 的隐藏文件，并在其中写入密码：
```env
# /an_activated_system_development_full-stack_project/.env

# ================================
# 前端访问端口与 CORS 配置 (自定义选项)
# ================================
# 前端 HTTP 访问端口 (默认 80)
FRONTEND_HTTP_PORT=8080
# 前端 HTTPS 访问端口 (默认 443)
FRONTEND_HTTPS_PORT=8443
# 允许跨域请求的前端地址 (用于后端 CORS 鉴权，需与您实际部署的域名一致)
FRONTEND_URL=https://activate.yourdomain.com:8443

# ================================
# PostgreSQL 数据库完整配置
# ================================
# 数据库服务器地址 (在默认容器编排中请保持为 db，如果是外接其他服务器请填写真实 IP)
DB_HOST=db
# 数据库端口 (PostgreSQL 默认为 5432)
DB_PORT=5432
# 数据库名称
DB_NAME=activation_db
# 数据库管理员账号
DB_USER=activate_admin
# 数据库超级安全密码 (请务必修改)
DB_PASSWORD=您的超强数据库密码123!

# ================================
# 系统安全配置
# ================================
# JWT 鉴权秘钥
JWT_SECRET=随机生成的超长复杂秘钥串
```

当您运行 `docker-compose up -d` 时，Docker 会自动读取这个 `.env` 文件，并在内存中把密码分别注入给 PostgreSQL 和 C# 后端容器。

*这样，密码只存在于服务器管理员建立的隐藏文件中，代码和 Git 仓库里干干净净，任何人都无法通过代码泄露获取到数据库密码。*

### 5.3 进阶方案：密钥保管库 (Key Vault)
如果您的企业规模较大，最顶级的方案是使用 HashiCorp Vault 或者云提供商的 KMS。程序启动时，凭借受信任的 IAM 角色去远端 Vault 拉取密码。对于中小型极简部署，**外部 `.env` 文件配合 Docker 环境变量注入机制已经能提供绝对安全的保障**。

---

## 6. 绝对安全规范总结 (Checklist)

- [ ] **物理与网络隔离**：数据库服务器**严禁**分配公网 IP，必须深藏在局域网内，仅允许 Nginx 和后端服务器的 IP 访问。
- [ ] **SSL 强制加密**：所有外网与服务器的通信必须通过 HTTPS。绝不允许 HTTP 的明文传输被抓包。
- [ ] **凭证隔离**：数据库密码、JWT 密钥**必须**通过环境变量配置，严禁写入代码或配置文件中。
- [ ] **权限降级**：后端程序和 Nginx 都必须使用低权限账户（如 `www-data`）运行，**绝对不要用 root 运行程序**。
- [ ] **不可逆加密**：代码中已实现 `LicenseKey` 的 SHA256 哈希存储，防止数据库被拖库后泄露激活码。
- [ ] **模糊报错提示**：API 故意设计为统一返回“授权失败”，堵死黑客遍历撞库的可能性。

---

## 7. Linux 服务器系统底层加固 (OS Hardening)

仅仅加固代码是不够的，承载一切的 Linux 服务器本身也必须无懈可击。部署项目后，请在 Linux 系统层面执行以下强制安全措施：

### 7.1 SSH 登录安全配置
黑客的第一步通常是爆破 SSH 端口。
- **禁用密码登录**：修改 `/etc/ssh/sshd_config`，将 `PasswordAuthentication` 改为 `no`，强制要求只能使用 RSA/Ed25519 密钥文件登录。
- **禁用 Root 远程登录**：将 `PermitRootLogin` 改为 `no`，使用普通用户登录后再 `sudo`。
- **修改默认端口**：将默认的 22 端口改为 10000 以上的随机端口，避开 99% 的全网自动扫描器。

### 7.2 UFW 防火墙绝对白名单
启动操作系统的底层防火墙，实行“默认全部拒绝”的白名单机制：
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp     # 仅放行 Nginx HTTP (用于重定向)
sudo ufw allow 443/tcp    # 仅放行 Nginx HTTPS
sudo ufw allow 12345/tcp  # 放行您修改后的自定义 SSH 端口
sudo ufw enable
```
*注意：绝对不要在 UFW 中放行 5000 (后端) 或 5432 (数据库) 端口。*

### 7.3 Fail2Ban 防爆破
安装 `fail2ban`。当它检测到某个 IP 在短时间内多次尝试 SSH 登录失败，或疯狂请求 API 触发了 429 / 404 错误时，会自动在底层 iptables 防火墙将其封杀。

---

## 8. 客户端软件防拦截与反破解方案 (Anti-MITM & Anti-Cracking)

这是商业软件防护的**重中之重**！如果用户通过您的应用（比如一个 C# WPF 桌面软件 或 C++ 程序）进行激活，最常见的破解手段就是“中间人拦截”和“本地暴力打补丁”。

### 8.1 防止传输中途拦截 (SSL Pinning 证书锁定)
- **黑客手段**：黑客会在自己电脑上安装 Fiddler/Charles 等抓包工具，伪造一个本地服务器拦截客户端发往官方服务器的请求，然后强行返回 `{"isSuccess": true}` 骗过客户端。
- **防御方案 (SSL Pinning)**：在您的客户端代码中，**不要仅仅相信操作系统的根证书**。必须把您自己服务器 SSL 证书的“指纹 (Thumbprint/Hash)”硬编码写死在客户端代码里。客户端发起网络请求前，强制比对服务器返回的证书指纹。一旦发现指纹不对（说明有人在做中间人劫持），立即掐断连接并退出程序。

### 8.2 报文二次加密防篡改 (Payload Encryption)
- **黑客手段**：分析 API 的明文 JSON 结构。
- **防御方案**：就算有了 HTTPS，客户端和服务器之间传输的业务数据也建议再包一层**对称加密（如 AES-256-GCM）**。把“激活码 + 机器码”加密成一串乱码再发送。即便请求被抓到，黑客也看不懂里面的格式。

### 8.3 防重放攻击 (Anti-Replay Attack)
- **防御方案**：客户端每次向 API 发送激活请求时，必须带上**当前系统时间戳 (Timestamp)** 和一个**随机字符串 (Nonce)**。服务器收到后，检查时间戳是否超过 3 分钟，并记录下这个 Nonce。如果黑客把刚才成功的拦截包原样重发一次，服务器发现 Nonce 用过了或时间过期了，直接拒绝。

### 8.4 客户端本地脱壳防逆向 (Obfuscation & VMP)
- 无论服务器多安全，如果黑客直接用 ILSpy / x64dbg 打开您的客户端程序，找到验证激活结果的那句代码 `if (IsActivated)`，把它强行改成 `if (true)`，服务器再安全也没用。
- **终极防御**：在发布您的客户端软件之前，**必须使用代码混淆工具** (如果是 C#，使用 Dotfuscator；如果是 C++/底层，使用 VMProtect 或 Themida)。通过加壳，把核心的验证逻辑全部打散变异，让黑客无法通过静态反编译找到关键跳转，极大提高破解成本。
