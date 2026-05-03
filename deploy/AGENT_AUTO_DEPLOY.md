# PicHome 自动部署文档（Hermes Agent / OpenClaw）

本文档用于让通用 Agent 在 Linux 服务器上安全地自动部署 PicHome（Docker Compose 方式）。

## 1. 目标与原则

- 目标：在不丢失 `prisma/database.sqlite` 与 `uploads/` 数据的前提下完成更新。
- 原则：先备份、再构建、后健康检查；失败可快速回滚。

## 2. 适用前提

- 服务器已安装 Docker 与 Docker Compose。
- 项目已克隆到固定目录（例如 `/srv/pichome`）。
- 首次部署时已准备好 `.env.production`。
- `docker-compose.yml` 中已挂载持久化目录：
  - `./prisma:/app/prisma`
  - `./uploads:/app/uploads`

## 3. Agent 可执行的标准部署流程

在项目根目录执行：

```bash
set -eu

echo "[deploy] enter project"
cd /srv/pichome

echo "[deploy] fetch latest code"
git fetch --all --prune
git reset --hard origin/master

echo "[deploy] ensure env file exists"
test -f .env.production

echo "[deploy] backup persistent data"
mkdir -p backups
if [ -f prisma/database.sqlite ]; then
  cp prisma/database.sqlite "backups/database.sqlite.$(date +%Y%m%d_%H%M%S)"
fi
if [ -d uploads ]; then
  tar -czf "backups/uploads.$(date +%Y%m%d_%H%M%S).tgz" uploads
fi

echo "[deploy] rebuild and restart"
docker compose up -d --build

echo "[deploy] wait app boot"
sleep 5

echo "[deploy] health check"
curl -fsS "http://127.0.0.1:${APP_PORT:-3000}/api/health"

echo "[deploy] done"
```

## 4. 首次部署额外步骤

首次部署前请先创建环境变量文件：

```bash
cp .env.example .env.production
```

然后至少配置以下项：

- `BASEURL`
- `JWT_SECRET`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `DATABASE_URL=file:./prisma/database.sqlite`

## 5. 回滚流程

当更新后异常，可按以下方式快速回滚：

```bash
set -eu
cd /srv/pichome

git log --oneline -n 5
# 选择一个已知可用提交，例如 <GOOD_COMMIT>

git reset --hard <GOOD_COMMIT>
docker compose up -d --build
curl -fsS "http://127.0.0.1:${APP_PORT:-3000}/api/health"
```

## 6. 让 Agent 更稳定的提示词模板

可直接给 Hermes Agent / OpenClaw：

```text
你是部署执行器。请严格按以下顺序执行，并在每步输出结果：
1) 进入 /srv/pichome
2) git fetch --all --prune && git reset --hard origin/master
3) 确认 .env.production 存在
4) 备份 prisma/database.sqlite 与 uploads/
5) docker compose up -d --build
6) 检查 /api/health 返回 200
7) 输出最终状态：成功/失败；失败时附上最近 100 行容器日志

禁止删除 prisma/ 与 uploads/ 目录。
```

## 7. 常见故障排查

- 注册页看不到 Turnstile：
  - 确认 `.env.production` 有 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - 确认执行过 `docker compose up -d --build`（前端变量在 build 时注入）
  - 确认 Turnstile 后台允许当前域名
- Prisma 报 `table does not exist`：
  - 检查 `DATABASE_URL` 是否为 `file:./prisma/database.sqlite`
  - 查看容器日志中是否执行了 `prisma migrate deploy`
- 启动成功但页面 502：
  - 检查容器端口映射与反向代理目标端口是否一致

