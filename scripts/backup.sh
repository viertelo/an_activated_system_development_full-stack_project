#!/bin/bash
# ---------------------------------------------------------
# 激活系统数据库自动备份脚本 (PostgreSQL in Docker)
# ---------------------------------------------------------

# 配置部分
CONTAINER_NAME="activation_db"
DB_USER="activate_admin"
DB_NAME="activation_db"

# 备份文件存放路径 (确保该目录存在，或在此创建)
BACKUP_DIR="/root/activation_backups"
mkdir -p "$BACKUP_DIR"

# 备份文件名 (按日期时间命名)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/activation_backup_$TIMESTAMP.dump"

echo "[$(date)] 开始备份数据库: $DB_NAME ..."

# 执行 Docker 内的 pg_dump 命令导出数据 (格式为 custom)
docker exec -t $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME -F c > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "[$(date)] 备份成功! 文件保存至: $BACKUP_FILE"
else
    echo "[$(date)] 备份失败!"
    exit 1
fi

# 清理旧备份 (默认保留最近 7 天的备份文件)
DAYS_TO_KEEP=7
echo "[$(date)] 正在清理 $DAYS_TO_KEEP 天前的旧备份..."
find "$BACKUP_DIR" -type f -name "activation_backup_*.dump" -mtime +$DAYS_TO_KEEP -exec rm {} \;

echo "[$(date)] 备份与清理流程结束。"
