# 社团招新 GO（clubshelp）

面向高校社团的多租户招新综合平台：**观猹登录 → 进群礼抽奖 → 报名表单 → 报名礼抽奖 → 现场核销**，外加社团活动展示与 AI 赋能（TokenDance / TokenPay）。任何社团都可以自助入驻，拥有独立的门户、奖池、报名数据与后台。

线上地址：<https://ica.hub.tt2.li> ｜ 首个入驻社团：杭电国际交流协会 ICA（`/c/ica`）

## 架构

```
浏览器 ──► nginx (443, Let's Encrypt)
             ├── /            → frontend/dist（Vite 构建产物，静态直出）
             ├── /assets/     → assets/（AI 生成素材，WebP）
             └── /api/        → FastAPI @ 127.0.0.1:8020（systemd: ica-backend）
                                    ├── PostgreSQL 17（库 ica，持久数据）
                                    └── Redis（db 11，OAuth state / 抽奖幂等锁）
```

无容器，全部裸机 systemd 部署。

## 技术栈

- **前端**：Vite 7 · React 19 · TypeScript strict · Tailwind CSS 4 · react-router v7 · motion · qrcode；观猹开学季可爱卡通风（粗描边 + 贴纸硬阴影，天蓝/草绿/柠檬黄）
- **后端**：Python 3.13 · FastAPI · SQLAlchemy 2 (async) · asyncpg · Redis · PyJWT · Fernet
- **登录**：观猹 OAuth2（Authorization Code + S256 PKCE），JWT HttpOnly Cookie 会话；全员观猹登录，社团角色按 `club_members` 表隔离
- **AI**：TokenDance 网关（deepseek-v4.1-flash 对话 / seedream-5.0-pro 生图），支持 TokenPay BYOK 用户自带 Key，全部调用带 `X-App-URL` 归因

## 多租户模型

- `users` 全局（观猹账号）；`clubs` 社团主体（slug 为 URL 标识，如 `/c/ica`）
- 报名/奖池/抽奖/活动全部按 `club_id` 隔离；同一用户可报名多个社团，同一学号可跨社团报名
- 任何登录用户可 `POST /api/clubs` 自助入驻，创建者自动成为该社团管理员；管理员可在后台按观猹 user_id 增删 staff/admin
- 平台管理员由 `.env` 的 `ADMIN_WATCHA_IDS` 决定（拥有全社团管理权）

## 核心业务规则

- **两轮抽奖独立奖池**（每社团独立配置）：第 1 轮（进群礼）登录即可抽；第 2 轮（报名礼）需先提交该社团报名表
- 每人每社团每轮限抽一次，重复请求幂等返回首次结果
- 库存/每日配额在事务内行锁校验，并发不超卖（见 `tests/test_core.py::test_concurrent_draws_never_oversell`）
- 实物奖品中奖生成唯一核销码（如 `ICA1-XXXXXXXX`），社团工作人员在 `/c/{slug}/redeem` 核销，同码不可重复、跨社团不可核销
- 虚拟奖品（兑换码类）从兑换码池原子分配，中奖页直接展示；实体纪念卡（如 TokenDance 青春卡）按实物奖品配置即可
- 报名表社团内学号唯一去重，本人重复提交视为修改

## 页面地图

| 路径 | 说明 |
|---|---|
| `/` | 平台首页：介绍 + 入驻社团列表 |
| `/c/{slug}` | 社团门户（介绍/部门/活动/招新入口） |
| `/c/{slug}/flow` | 招新任务流：抽奖 → 报名 → 再抽奖 |
| `/c/{slug}/redeem` | 核销台（本社团 staff/admin） |
| `/c/{slug}/admin` | 社团后台（仪表盘/奖池/活动/成员/设置/数据助手） |
| `/new-club` | 社团入驻 |
| `/ai` | AI 顾问 + AI 海报 + Token 钱包 |

## 本地开发

```bash
# 后端
cd backend && uv sync
cp ../deploy/.env.example .env   # 填写配置，开发时 DEBUG=true
uv run python -m app.seed        # 建表 + 种子数据（含 ica 社团）
uv run uvicorn app.main:app --port 8020 --reload

# 前端（另开终端，已内置 /api → 8020 代理）
cd frontend && pnpm install && pnpm dev
```

开发登录（仅 DEBUG=true 且本机直连）：`GET /api/auth/dev-login?watcha_id=1001`

## 部署（ica.hub.tt2.li）

```bash
sudo cp deploy/ica-backend.service /etc/systemd/system/
sudo cp deploy/nginx-ica.conf /etc/nginx/sites-available/ica.hub.tt2.li
sudo ln -sf /etc/nginx/sites-available/ica.hub.tt2.li /etc/nginx/sites-enabled/
sudo systemctl enable --now ica-backend
# 首次需先以纯 HTTP 配置签发证书：certbot certonly --nginx -d ica.hub.tt2.li
cd frontend && pnpm build         # 产物由 nginx 直出
```

更新后端：`sudo systemctl restart ica-backend`；更新前端：重新 `pnpm build`。

## AI 功能与额度

| 功能 | 入口 | 模型 |
|---|---|---|
| AI 顾问「小际」 | /ai | deepseek-v4.1-flash（SSE 流式） |
| AI 招新海报 | /ai | seedream-5.0-pro |
| AI 数据助手（社团 staff+） | /c/{slug}/admin | 自然语言 → 只读 SQL（强制 club_id 隔离）→ 解读 |
| AI 活动文案起草（社团 admin） | /c/{slug}/admin | 关键词 → 活动草稿 |

未连接 Token 钱包的用户使用站点兜底 Key，受每日配额限制（聊天 20 次/海报 2 次，社团职员与管理员 ×10）；连接 TokenPay 后使用用户自己的 Key，不计站点配额。

## 环境变量

见 `deploy/.env.example`。密钥（`.env`）不入库，已在 `.gitignore` 排除。
