# PicHome

[中文](./README.md)

## Quick Start

1. Copy the environment template files:

```bash
cp .env.example .env.production
cp .env.example .env.development
```

2. Update the key settings (at least these):

- `BASEURL`
- `DATABASE_URL`
- `JWT_SECRET` (must be a strong random value in production)
- `TURNSTILE_SECRET_KEY`
- `SELF_USE_MODE`

3. Initialize the database:

```bash
pnpm prisma:migrate
```

4. Start the development server:

```bash
pnpm dev
```

## First Run (New Database)

If this is a fresh environment (no local `database.sqlite` yet), run:

```bash
pnpm install
pnpm prisma:migrate
pnpm dev
```

Notes:

- `pnpm prisma:migrate` (alias of `prisma migrate dev`) will create the SQLite file and apply migrations automatically.
- For production, prefer `pnpm prisma migrate deploy` to apply existing migrations only.

## Pre-Deployment Checklist

- Use a real strong secret instead of the default `JWT_SECRET`.
- Do not commit `.env*`; keep only `.env.example`.
- Set `BASEURL` to your real HTTPS domain.
- Keep reverse-proxy upload limit consistent with the app limit (default 5MB, configurable via `UPLOAD_MAX_BYTES`).
- Back up `prisma/database.sqlite` and the `uploads` directory.
- Verify with an admin account:
  - Image upload/delete
  - Image visibility toggle
  - Admin visibility action audit logs
  - Admin delete-image audit logs

## Health Check

- Endpoint: `GET /api/health`
- `200`: service and database are healthy
- `503`: service is running but database check failed

## Deployment Templates

- PM2 example: `deploy/pm2.config.cjs`
- Nginx example: `deploy/nginx.pichome.conf.example`

## Docker Deployment (Recommended)

1. Prepare environment file:

```bash
cp .env.example .env.production
```

2. Update key fields in `.env.production`:

- `BASEURL` (your production domain)
- `JWT_SECRET` (strong random string)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `UPLOAD_MAX_BYTES` (default `5242880`, bytes)
- `NEXT_PUBLIC_UPLOAD_MAX_BYTES` (recommended to match `UPLOAD_MAX_BYTES`)

3. Start containers:

```bash
docker compose up -d --build
```

4. Check logs:

```bash
docker compose logs -f pichome
```

Notes:

- The container runs `prisma migrate deploy` automatically on startup.
- Persistent directories:
  - `./prisma` (SQLite DB and migrations)
  - `./uploads` (image files)
- Default mapped port is `3000`; override with `APP_PORT` if needed.

## MCP Integration (for LLM/Agent Use)

A stdio-based MCP server is included at `mcp/server.mjs`.

1. Create an API key first (after login, call `POST /api/apikeys`).
2. Configure environment variables:

```bash
PICHOME_BASE_URL=http://localhost:3000
PICHOME_API_KEY=pk_xxx
PICHOME_REQUEST_TIMEOUT_MS=30000
PICHOME_UPLOAD_MAX_BYTES=5242880
```

3. Start MCP:

```bash
pnpm mcp:start
```

Available MCP tools:

- `pichome_list_images`
- `pichome_upload_image_from_url`
- `pichome_upload_image_base64`
- `pichome_upload_image_file_path`
- `pichome_delete_image`

## License

This project is licensed under the [MIT License](./LICENSE).
