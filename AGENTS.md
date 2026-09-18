# AGENTS.md — 给 AI 维护者

## 项目

杭电 ICA 招新平台。FastAPI + PostgreSQL(库 ica) + Redis(db 11) 后端，Vite + React 19 + Tailwind 4 前端。无容器，systemd + nginx 裸机部署在 ica.hub.tt2.li。

## 硬规则

- **不要动数据库之外的基础设施**：本机跑着很多其他项目的服务，nginx 站点只改 `deploy/nginx-ica.conf` 并同步到 `/etc/nginx/sites-available/ica.hub.tt2.li`；Redis 只用 db 11；Postgres 只用 `ica` 库。
- 密钥只放 `backend/.env`（已 gitignore），禁止提交。
- 后端改完必须：`uv run ruff check app tests && uv run pytest -q` 全绿。
- 前端改完必须：`pnpm lint && pnpm build` 通过。
- 提交信息用 Conventional Commits。

## 关键设计（改动前必读）

- 抽奖核心在 `backend/app/services/lottery.py`：行锁 `with_for_update` 读奖品 → 权重摇号 → 库存 `issued+1` → 虚拟奖品用 `FOR UPDATE SKIP LOCKED` 分配兑换码。重复抽奖靠 `draws (user_id, round)` 唯一约束 + Redis 锁幂等。
- 核销在 `app/api/redeem.py`：`SELECT ... FOR UPDATE` 行锁，`redeemed_at` 非空即拒绝。
- 会话：JWT HttpOnly Cookie（`ica_session`），30 天；角色来自 `.env` 白名单，登录时刷新。
- AI 额度：`usage_counters` 表 PG upsert 原子计数；BYOK 用户 Key Fernet 加密存 `oauth_accounts(provider='tokendance')`。
- 数据助手的 SQL 必须过 `_validate_sql`（只读 SELECT + 禁词 + LIMIT），不要放开。
- 前端构建 `assetsDir='static'`，不要改回 `assets`（与 AI 素材目录 `/assets/` 冲突）。
- 观猹 client_id 含 `+` 等特殊字符，URL 传参必须 URL 编码。

## 部署操作

- 重启后端：`systemctl restart ica-backend`，日志 `journalctl -u ica-backend -f`
- 前端发布：`cd frontend && pnpm build`（nginx 直出 dist，无需重启）
- 素材重生成：`cd backend && uv run --with pillow python ../scripts/gen_assets.py`
- 种子数据：`uv run python -m app.seed`（幂等，不会覆盖已有数据）
