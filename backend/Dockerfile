# 第一阶段：构建应用
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY ["backend.csproj", "./"]
RUN dotnet restore "backend.csproj"
COPY . .
WORKDIR "/src/"
RUN dotnet build "backend.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "backend.csproj" -c Release -o /app/publish /p:UseAppHost=false

# 第二阶段：运行应用 (使用极其轻量的 Alpine 运行时镜像)
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS final
WORKDIR /app
COPY --from=publish /app/publish .

# 暴露端口，供同一内部网络下的 Nginx 反向代理调用
EXPOSE 5000

# 覆盖默认端口配置，绑定到所有内部IP
ENV ASPNETCORE_URLS=http://+:5000

# 创建 Keys 目录
RUN mkdir -p /app/Keys && chmod 700 /app/Keys

# 运行为 root 用户，解决宿主机挂载目录无写入权限的问题
USER root
# USER $APP_UID

ENTRYPOINT ["dotnet", "backend.dll"]
