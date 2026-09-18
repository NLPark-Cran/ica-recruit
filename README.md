# ICA 招新综合平台

杭州电子科技大学国际交流协会（ICA）2026 百团大战招新平台：**观猹登录 → 进群礼抽奖 → 报名表单 → 报名礼抽奖 → 现场核销**，外加社团活动展示与 AI 赋能（TokenDance / TokenPay）。

线上地址：<https://ica.hub.tt2.li>

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

- **前端**：Vite 7 · React 19 · TypeScript strict · Tailwind CSS 4 · react-router v7 · motion · qrcode
- **后端**：Python 3.13 · FastAPI · SQLAlchemy 2 (async) · asyncpg · Redis · PyJWT · Fernet
- **登录**：观猹 OAuth2（Authorization Code + S256 PKCE），JWT HttpOnly Cookie 会话
- **AI**：TokenDance 网关（deepseek-v4.1-flash 对话 / seedream-5.0-pro 生图），支持 TokenPay BYOK 用户自带 Key，全部调用带 `X-App-URL` 归因

## 目录结构

```
backend/            FastAPI 后端
  app/
    api/            路由层（auth/byok/applications/lottery/redeem/activities/admin/ai）
    services/       业务层（lottery 抽奖事务 / tokendance 网关客户端）
    models.py       SQLAlchemy 模型    schemas.py  Pydantic 出入参
    config.py       pydantic-settings  deps.py     鉴权依赖
    security.py     JWT / Fernet / PKCE / 核销码
    seed.py         建表 + 种子奖池
  tests/            pytest（库存并发/核销唯一/学号去重/幂等）
frontend/           Vite + React 前端（src/{pages,components,features,lib,hooks}）
assets/             AI 生成素材（scripts/gen_assets.py 可重新生成）
deploy/             systemd unit / nginx 配置（唯一事实源）/ .env.example
scripts/            素材生成、压测等运维脚本
docs/               项目文档
```

## 本地开发

```bash
# 后端
cd backend && uv sync
cp ../deploy/.env.example .env   # 填写配置，开发时 DEBUG=true
uv run python -m app.seed        # 建表 + 种子数据
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

## 核心业务规则

- **两轮抽奖独立奖池**：第 1 轮（进群礼）登录即可抽；第 2 轮（报名礼）需先提交报名表
- 每人每轮限抽一次，重复请求幂等返回首次结果
- 库存/每日配额在事务内行锁校验，并发不超卖（见 `tests/test_core.py::test_concurrent_draws_never_oversell`）
- 实物奖品中奖生成唯一核销码（如 `ICA1-XXXXXXXX`），工作人员在 `/redeem` 核销，同码不可重复核销
- 虚拟奖品（TokenDance 青春卡）从兑换码池原子分配，中奖页直接展示兑换码，无需现场核销；兑换码由管理员在后台导入（库存自动累加）
- 报名表学号全局唯一去重，本人重复提交视为修改
- 工作人员/管理员角色由 `.env` 的 `STAFF_WATCHA_IDS` / `ADMIN_WATCHA_IDS`（观猹 user_id 白名单）决定，登录时自动生效；管理员也可在后台手动调整

## AI 功能与额度

| 功能 | 入口 | 模型 |
|---|---|---|
| AI 国际交流顾问「小际」 | /ai | deepseek-v4.1-flash（SSE 流式） |
| AI 招新海报 | /ai | seedream-5.0-pro |
| AI 数据助手（staff/admin） | /admin | 自然语言 → 只读 SQL 白名单校验 → 解读 |
| AI 活动文案起草（admin） | /admin | 关键词 → 活动草稿 |

未连接 Token 钱包的用户使用站点兜底 Key，受每日配额限制（聊天 20 次/海报 2 次，staff/admin ×10）；
连接 TokenPay（TokenDance OAuth 授权）后使用用户自己的 Key，不计站点配额。

## 环境变量

见 `deploy/.env.example`。密钥（`.env`）不入库，已在 `.gitignore` 排除。
