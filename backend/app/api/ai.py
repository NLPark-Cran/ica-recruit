"""AI 赋能：聊天顾问（SSE 流式）、海报生成、数据助手（staff/admin）、活动文案草稿。

额度策略：用户已连接 TokenPay（BYOK）→ 用用户自己的 Key，不限站点配额；
未连接 → 站点兜底 Key + 每日配额（staff/admin 配额 ×10）。
"""

import json
import re
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import get_settings
from app.db import DB
from app.deps import AdminUser, CurrentUser, StaffUser
from app.models import OAuthAccount, Role, UsageCounter
from app.schemas import ActivityDraftIn, ChatIn, DataAssistantIn, PosterIn
from app.security import decrypt_text
from app.services import tokendance

settings = get_settings()
router = APIRouter(prefix="/ai", tags=["ai"])


async def _user_key(db, user) -> str | None:
    acct = (
        await db.execute(
            select(OAuthAccount).where(OAuthAccount.user_id == user.id, OAuthAccount.provider == "tokendance")
        )
    ).scalar_one_or_none()
    return decrypt_text(acct.payload_enc) if acct else None


async def _check_quota(db, user, kind: str) -> str:
    """返回本次调用使用的 API Key；超站点配额时 429。"""
    key = await _user_key(db, user)
    if key:
        return key
    if not settings.tokendance_api_key:
        raise HTTPException(503, "站点 AI 额度未配置，请连接你的 Token 钱包")
    limit = settings.ai_quota_chat_daily if kind == "chat" else settings.ai_quota_image_daily
    if user.role in (Role.staff.value, Role.admin.value):
        limit *= settings.ai_quota_staff_multiplier
    day = datetime.now(UTC).date()
    stmt = (
        pg_insert(UsageCounter)
        .values(user_id=user.id, day=day, kind=kind, count=1)
        .on_conflict_do_update(
            constraint="uq_usage_user_day_kind",
            set_={"count": UsageCounter.count + 1},
        )
        .returning(UsageCounter.count)
    )
    count = await db.scalar(stmt)
    await db.commit()
    if (count or 1) > limit:
        raise HTTPException(429, f"站点免费额度已用完（每日 {limit} 次），可连接 Token 钱包使用自己的额度")
    return settings.tokendance_api_key


def _error_response(e: tokendance.TokenDanceError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"code": "AI_ERROR", "message": e.message, "recovery_action": e.recovery_action},
    )


# ---------- AI 国际交流顾问 ----------

CHAT_SYSTEM = (
    "你是杭州电子科技大学国际交流协会（ICA）的 AI 顾问「小际」。"
    "你热情、靠谱、略带幽默，回答与海外交换、留学申请、语言考试（雅思/托福）、"
    "签证、跨文化交流、协会活动相关的问题；对不确定的具体政策要建议同学咨询协会或学校国际处。"
    "回答使用简体中文，适度使用短段落与列表，单次回答不超过 300 字。"
)


@router.post("/chat")
async def chat(db: DB, user: CurrentUser, body: ChatIn):
    key = await _check_quota(db, user, "chat")
    messages = [{"role": "system", "content": CHAT_SYSTEM}] + [
        {"role": m.role, "content": m.content} for m in body.messages[-20:]
    ]

    async def stream():
        try:
            async for delta in tokendance.chat_stream(key, messages):
                yield f"data: {json.dumps({'delta': delta}, ensure_ascii=False)}\n\n"
        except tokendance.TokenDanceError as e:
            payload = {"error": e.message, "recovery_action": e.recovery_action}
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


# ---------- AI 招新海报 ----------


@router.post("/poster")
async def poster(db: DB, user: CurrentUser, body: PosterIn):
    key = await _check_quota(db, user, "image")
    prompt = (
        "为杭州电子科技大学国际交流协会（ICA）生成一张竖版招新海报，"
        "风格年轻、国际化、色彩明亮，适合大学生社团宣传。"
        f"海报主题文案：{body.prompt}。"
        "画面需包含中英文混合排版，留出标题区域，不要出现乱码文字。"
    )
    try:
        url = await tokendance.generate_image(key, prompt, size="2K")
    except tokendance.TokenDanceError as e:
        return _error_response(e)
    return {"url": url}


# ---------- AI 数据助手（staff/admin，只读 SQL 白名单）----------

_ALLOWED_TABLES = {"applications", "draws", "users", "prizes", "activities"}
_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|copy|execute|call|set)\b",
    re.IGNORECASE,
)

_SQL_SYSTEM = (
    "你是 PostgreSQL 数据分析助手。数据库表结构：\n"
    "- users(id uuid, watcha_user_id bigint, nickname text, role text, created_at timestamptz)\n"
    "- applications(id uuid, user_id uuid, name text, student_id text, college text, grade text, "
    "phone text, wechat text, departments jsonb, allow_adjust bool, intro text, created_at timestamptz)\n"
    "- draws(id uuid, user_id uuid, round int, prize_id uuid, prize_name text, code text, "
    "virtual_code text, redeemed_at timestamptz, created_at timestamptz)\n"
    "- prizes(id uuid, round int, name text, tier text, total_stock int, issued int, "
    "weight int, daily_quota int, is_virtual bool, active bool)\n"
    "- activities(id uuid, title text, summary text, location text, starts_at timestamptz, published bool)\n"
    "规则：只输出一条只读 SELECT 语句，不得包含其他任何文字；"
    "不要查询 phone/wechat/student_id 等敏感列除非问题明确要求；必须带 LIMIT 且不超过 100；"
    "不要输出 markdown 代码块。"
)


def _validate_sql(sql: str) -> str:
    sql = sql.strip().strip("`")
    sql = re.sub(r"^sql\s*", "", sql, flags=re.IGNORECASE).strip()
    if ";" in sql.rstrip(";"):
        raise HTTPException(400, "只允许单条查询")
    sql = sql.rstrip(";")
    if not re.match(r"^(select|with)\b", sql, re.IGNORECASE):
        raise HTTPException(400, "只允许 SELECT 查询")
    if _FORBIDDEN.search(sql):
        raise HTTPException(400, "查询包含不允许的关键字")
    if "--" in sql or "/*" in sql:
        raise HTTPException(400, "查询包含注释")
    if "limit" not in sql.lower():
        sql += " LIMIT 100"
    return sql


@router.post("/data-assistant")
async def data_assistant(db: DB, staff: StaffUser, body: DataAssistantIn):
    key = await _check_quota(db, staff, "chat")
    try:
        sql = await tokendance.chat_once(
            key,
            [
                {"role": "system", "content": _SQL_SYSTEM},
                {"role": "user", "content": body.question},
            ],
        )
        sql = _validate_sql(sql)
    except tokendance.TokenDanceError as e:
        return _error_response(e)

    try:
        result = await db.execute(text(sql))
        rows = [dict(r) for r in result.mappings().all()][:100]
    except Exception as e:
        raise HTTPException(400, f"SQL 执行失败: {e}") from e

    summary_prompt = (
        f"用户问题：{body.question}\n"
        f"执行的 SQL：{sql}\n"
        f"查询结果（JSON）：{json.dumps(rows, ensure_ascii=False, default=str)[:6000]}\n"
        "请用简体中文简洁地解读数据（不超过 200 字），直接回答用户问题，可包含关键数字。"
    )
    try:
        summary = await tokendance.chat_once(key, [{"role": "user", "content": summary_prompt}])
    except tokendance.TokenDanceError:
        summary = ""
    return {"sql": sql, "rows": rows, "summary": summary}


# ---------- 活动文案草稿（admin） ----------


@router.post("/activity-draft")
async def activity_draft(db: DB, admin: AdminUser, body: ActivityDraftIn):
    key = await _check_quota(db, admin, "chat")
    prompt = (
        "你是杭州电子科技大学国际交流协会（ICA）的宣传干事。根据以下关键词，"
        "产出一个活动草稿，严格输出 JSON："
        '{"title": "活动标题", "summary": "一句话简介(50字内)", "detail": "活动详情(200字内, 可用换行)"}。'
        "不要输出任何其他文字。关键词：" + body.keywords
    )
    try:
        raw = await tokendance.chat_once(key, [{"role": "user", "content": prompt}])
    except tokendance.TokenDanceError as e:
        return _error_response(e)
    try:
        data = json.loads(re.search(r"\{.*\}", raw, re.DOTALL).group())  # type: ignore[union-attr]
    except Exception:
        data = {"title": "", "summary": "", "detail": raw}
    return {"draft": data}
