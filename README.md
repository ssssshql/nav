# 0x3 Nav

一个基于 Koa + Vue 3 的极简导航页，支持 MySQL 数据库和 2FA 安全认证。

## 功能特性

- 极简设计风格 (Vue 3 + Tailwind CSS)
- 网站分类导航与搜索
- 2FA 双因素认证 (TOTP)
- 动态数据库配置 (支持 MySQL)
- Docker 一键部署

## 本地开发指南

推荐使用 Docker 运行数据库，本地运行前后端代码以便于调试。

### 1. 启动数据库 (MySQL)

使用 Docker Compose 仅启动 MySQL 服务：

```bash
# 在项目根目录运行
docker-compose up -d mysql
```

*   默认数据库账号: `root`
*   默认数据库密码: `rootpassword`
*   端口映射: `3306`

### 2. 启动后端

```bash
cd server
pnpm install
pnpm dev
# 服务将运行在 http://localhost:3000
```

### 3. 启动前端

```bash
cd client
pnpm install
pnpm dev
# 访问 http://localhost:5173
```

### 4. 初始化设置

1.  打开浏览器访问前端地址 (如 `http://localhost:5173`)。
2.  会自动跳转到 `/setup` 页面。
3.  **数据库配置**填写：
    *   主机地址: `localhost`
    *   端口: `3306`
    *   数据库名: `nav`
    *   用户名: `root`
    *   密码: `rootpassword`
4.  设置你的管理员账号和密码。
5.  使用 Authenticator App 扫描二维码绑定 2FA。

## Docker 生产部署

### 方式一：使用 Docker Compose（推荐）

构建并启动所有服务（包含 MySQL、后端、前端静态资源托管）：

```bash
docker-compose up -d
```

访问 `http://localhost:3000` 即可使用。

### 方式二：单独使用 Docker（仅后端 + 前端）

如果你有外部 MySQL，可以使用这种方式：

```bash
# 启动容器并持久化数据到 /projects/nav
docker run -d --name nav \
  -p 3000:3000 \
  -v /projects/nav:/app/data \
  --restart=always \
  ssssshql/nav:latest
```

访问 `http://localhost:3000` 即可使用。

**注意**：`/projects/nav` 目录会持久化数据库配置和 2FA secret，**请务必保留**，否则重启后需要重新配置。
