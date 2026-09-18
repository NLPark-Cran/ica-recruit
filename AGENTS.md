# AGENTS.md — 给 AI 维护者

## 项目

多租户社团招新平台「社团招新GO」。FastAPI + PostgreSQL(库 ica) + Redis(db 11) 后端，Vite + React 19 + Tailwind 4 前端（观猹开学季可爱卡通风）。无容器，systemd + nginx 裸机部署在 ica.hub.tt2.li。

## 硬规则

- **不要动共享基础设施**：本机跑着很多其他项目，nginx 站点只改 `deploy/nginx-ica.conf` 并同步到 `/etc/nginx/sites-available/ica.hub.tt2.li`；Redis 只用 db 11；Postgres 只用 `ica` 库（测试用 `ica_test`）。
- 密钥只放 `backend/.env`（已 gitignore），禁止提交。
- Git 提交身份固定为 `NLPark-Cran <crina@tt2.li>`（仓库级 git config 已设置，不要改）；提交信息用 Conventional Commits。
- 后端改完必须：`uv run ruff check app tests && uv run pytest -q` 全绿。
- 前端改完必须：`pnpm lint && pnpm build` 通过。

## 关键设计（改动前必读）

- **多租户**：users 全局（观猹登录），其余业务表全部带 `club_id`；社团内角色在 `club_members`，平台管理员由 `.env` `ADMIN_WATCHA_IDS` 决定。任何登录用户可自助创建社团（`POST /api/clubs`）。
- 抽奖核心在 `backend/app/services/lottery.py`：行锁 `with_for_update` 读奖品 → 权重摇号 → 库存 `issued+1` → 虚拟奖品用 `FOR UPDATE SKIP LOCKED` 分配兑换码。幂等靠 `draws (club_id, user_id, round)` 唯一约束 + Redis 锁。
- 核销在 `app/api/redeem.py`：`SELECT ... FOR UPDATE` 行锁 + `club_id` 过滤（跨社团码不可核销），`redeemed_at` 非空即拒绝。
- 会话：JWT HttpOnly Cookie（`ica_session`），30 天。
- AI 额度：`usage_counters` 表 PG upsert 原子计数；BYOK 用户 Key Fernet 加密存 `oauth_accounts(provider='tokendance')`；社团职员配额 ×10。
- 数据助手 SQL 必须过 `_validate_sql`（只读 SELECT + 禁词 + 强制 club_id 过滤 + LIMIT），不要放开。
- 前端构建 `assetsDir='static'`，不要改回 `assets`（与 AI 素材目录 `/assets/` 冲突）。
- 观猹 client_id 含 `+` 等特殊字符，URL 传参必须 URL 编码。
- TokenDance 青春卡是**实体纪念卡**（卡背刮开有兑换码），按实物奖品配置、现场核销，不要改成虚拟兑换码池。

## 部署操作

- 重启后端：`systemctl restart ica-backend`，日志 `journalctl -u ica-backend -f`
- 前端发布：`cd frontend && pnpm build`（nginx 直出 dist，无需重启）
- 素材重生成：`cd backend && uv run --with pillow python ../scripts/gen_assets.py`（加 `--force` 强制全部重新生成）
- 种子数据：`uv run python -m app.seed`（幂等，不会覆盖已有数据）
