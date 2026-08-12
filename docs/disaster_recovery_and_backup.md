# 🛡️ 数据安全、备份与防灾恢复机制 (Disaster Recovery & Backup)

对于 B2B2C 的商业发卡模式，数据库中的“激活码”与“设备指纹”等同于资产本身。本系统在架构设计上天然具备防灾容错能力，同时也为您提供了物理层的深度备份手段。

---

## 1. 基础防灾恢复 (Docker Volume 持久化)

本系统采用 Docker Compose 进行服务编排。在 `docker-compose.yml` 中，我们将 PostgreSQL 数据库的文件映射到了宿主机的 Docker Volume (`pgdata` 或 `pgdata_lan`)。

**防护效果：**
- **防止误删容器**：即使您错误地执行了 `docker-compose down` 销毁了所有的应用和数据库容器，或者服务器意外断电重启，数据库数据**依然会安全地保留在宿主机的物理硬盘中**。
- **快速恢复**：您只需再次执行 `docker-compose up -d`，新启动的数据库容器会自动挂载硬盘上的数据卷，系统瞬间满血复活，激活码不会有任何丢失。

---

## 2. 物理层异地灾备 (自动化定时备份)

虽然 Docker Volume 防止了容器级的灾难，但如果**服务器整机硬盘损坏、重装系统或遭遇勒索病毒**，数据仍有彻底丢失的风险。为了防御物理级别的毁灭打击，我们为您准备了自动化备份脚本。

### 2.1 自动化备份脚本 (`scripts/backup.sh`)
我们在项目根目录的 `scripts` 文件夹下为您准备了 `backup.sh`，它可以一键利用 `pg_dump` 将数据库完整导出为安全的二进制转储文件 (`.dump`)，并自动清理 7 天前的旧备份。

**配置自动备份 (Linux Crontab)：**

1. 将 `scripts/backup.sh` 上传到服务器，并赋予执行权限：
   ```bash
   chmod +x /您的项目路径/scripts/backup.sh
   ```
2. 打开定时任务编辑器：
   ```bash
   crontab -e
   ```
3. 在末尾添加以下规则，每天凌晨 3:00 自动执行备份，并将日志输出：
   ```text
   0 3 * * * /您的项目路径/scripts/backup.sh >> /var/log/activation_backup.log 2>&1
   ```
4. 备份文件将默认保存在 `/root/activation_backups` 目录下。强烈建议您结合 `rsync`、阿里云 OSS 或其他网盘的 CLI 工具，将备份目录定期同步到**异地/本地电脑**。

---

## 3. 灾难恢复指南 (数据导入)

如果最坏的情况发生（旧服务器彻底损毁），您需要在**全新的服务器**上恢复整套业务。

### 恢复步骤：

1. **部署新环境**：在新服务器克隆本项目代码，配置好 `.env`，并执行 `docker-compose up -d` 启动全新的空壳环境。
2. **上传备份文件**：将您在本地或异地保存的 `.dump` 备份文件上传到新服务器（例如传至 `/root/activation_backup_xxx.dump`）。
3. **清空初始空壳库**：
   在导入前，必须先断开并清空由代码自动生成的空壳数据结构（防止主键冲突），在服务器终端执行：
   ```bash
   # 删除空库
   docker exec -t activation_db dropdb -U activate_admin activation_db
   # 建立新库
   docker exec -t activation_db createdb -U activate_admin activation_db
   ```
4. **导入备份数据**：
   使用 `pg_restore` 恢复物理备份文件（注意替换最后的路径为您实际的备份文件路径）：
   ```bash
   docker exec -i activation_db pg_restore -U activate_admin -d activation_db -1 < /root/activation_backup_xxx.dump
   ```
5. **恢复完成**：导入成功后，您通过 Web 浏览器或 API 访问，所有管理员账号、激活码资产、设备指纹等数据将**原封不动地全部归位**，系统恢复正常营业！
