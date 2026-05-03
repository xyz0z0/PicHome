# PicHome

[English](./README.en.md)

## 快速开始

1. 复制环境变量模板：

```bash
cp .env.example .env.production
cp .env.example .env.development
```

2. 修改关键配置（至少这些）：
- `BASEURL`
- `DATABASE_URL`
- `JWT_SECRET`（生产必须改成强随机值）
- `TURNSTILE_SECRET_KEY`
- `SELF_USE_MODE`

3. 初始化数据库：

```bash
pnpm prisma:migrate
```

4. 启动开发环境：

```bash
pnpm dev
```

## 第一次运行（新建数据库）

如果是全新环境（本地还没有 `database.sqlite`），按下面执行即可自动创建数据库和表：

```bash
pnpm install
pnpm prisma:migrate
pnpm dev
```

说明：
- `pnpm prisma:migrate`（即 `prisma migrate dev`）会自动创建 SQLite 文件并应用迁移
- 生产环境建议使用 `pnpm prisma migrate deploy`，只应用已存在的迁移

## 上线前检查清单

- 使用真实强密钥，不要保留默认 `JWT_SECRET`
- `.env*` 不入库，仅保留 `.env.example`
- `BASEURL` 指向真实 HTTPS 域名
- 反向代理上传限制与应用一致（当前 5MB）
- 备份 `prisma/database.sqlite` 与 `uploads` 目录
- 用管理员账号验证：
  - 图片上传/删除
  - 图片可见/不可见切换
  - 管理员可见性操作审计日志
  - 管理员删除图片审计日志

## 健康检查

- 接口：`GET /api/health`
- 返回 `200` 表示服务与数据库连通
- 返回 `503` 表示服务存活但数据库检查失败

## 部署模板

- PM2 示例：`deploy/pm2.config.cjs`
- Nginx 示例：`deploy/nginx.pichome.conf.example`

## Docker 部署（推荐）

1. 准备环境变量文件：

```bash
cp .env.example .env.production
```

2. 修改 `.env.production` 里的关键项：

- `BASEURL`（线上域名）
- `JWT_SECRET`（强随机字符串）
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

3. 启动容器：

```bash
docker compose up -d --build
```

4. 查看日志：

```bash
docker compose logs -f pichome
```

说明：

- 容器启动会自动执行 `prisma migrate deploy`
- 持久化目录：
  - `./prisma`（SQLite 数据库与迁移）
  - `./uploads`（图片文件）
- 默认映射端口 `3000`，可通过 `APP_PORT` 覆盖

## MCP 接入（供 LLM/Agent 自主调用）

新增了一个基于 stdio 的 MCP Server：`mcp/server.mjs`

1. 先创建 API Key（登录后调用 `POST /api/apikeys`）
2. 配置环境变量：

```bash
PICHOME_BASE_URL=http://localhost:3000
PICHOME_API_KEY=pk_xxx
PICHOME_REQUEST_TIMEOUT_MS=30000
PICHOME_UPLOAD_MAX_BYTES=5242880
```

3. 启动 MCP：

```bash
pnpm mcp:start
```

当前 MCP tools：
- `pichome_list_images`
- `pichome_upload_image_from_url`
- `pichome_upload_image_base64`
- `pichome_upload_image_file_path`
- `pichome_delete_image`

## 开源协议

本项目采用 [MIT License](./LICENSE)。

