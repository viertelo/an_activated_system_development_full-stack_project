# 第一阶段：构建前端静态页面
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Next.js 配置为输出纯静态 HTML (已在 next.config.ts 中配置 output: 'export')
RUN npm run build

# 第二阶段：使用 Nginx 提供极其轻量的服务 (无 root 特权版本，安全性极高)
FROM nginxinc/nginx-unprivileged:alpine

# 临时切换到 root 用户以获取删除和写入权限
USER root

# 删除默认的 Nginx html 文件
RUN rm -rf /usr/share/nginx/html/*
# 从第一阶段拷贝构建出来的纯静态网页 (Next.js 静态导出的默认文件夹是 out)
COPY --chown=nginx:nginx --from=builder /app/out /usr/share/nginx/html
# 替换默认的 nginx 配置，支持 /api/ 的反向代理
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

# 切换回安全的无特权用户
USER nginx

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
