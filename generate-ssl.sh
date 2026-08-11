#!/bin/bash
# 生成供本地和内网 Docker 测试使用的自签名 SSL 证书
# 请勿在正式外网生产环境使用自签名证书，生产环境请使用 Let's Encrypt 等机构颁发的合法证书！

mkdir -p ssl

echo "正在生成自签名 SSL 证书..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=localhost"

echo "✅ 证书生成完成！您现在可以安全地运行 docker-compose up -d 了。"
