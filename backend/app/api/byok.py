"""TokenPay：TokenDance API Key 的 OAuth 式授权（BYOK，S256 PKCE）。

流程：GET /api/byok/connect → 302 到 tokendance.space/auth →
授权后回到 GET /api/byok/callback?code=...（同源 cookie 识别用户）→
服务端用 code+verifier 换 API Key，Fernet 加密入库 → 302 回前端。
"""

from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, select

from app.config import get_settings
from app.db import DB, redis
from app.deps import CurrentUser
from app.models import OAuthAccount
from app.security import decode_session_token, encrypt_text, new_pkce

settings = get_settings()
router = APIRouter(prefix="/byok", tags=["byok"])


@router.get("/connect")
async def connect(user: CurrentUser):
    verifier, challenge = new_pkce()
    await redis.setex(f"byok:{user.id}", 600, verifier)
    params = {
        "callback_url": f"{settings.site_url}/api/byok/callback",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "app_url": settings.tokendance_app_url,
        "key_name": "ICA 招新平台",
    }
    return RedirectResponse(f"{settings.tokendance_auth_url}?{urlencode(params)}")


@router.get("/callback")
async def callback(request: Request, db: DB, code: str = ""):
    if not code:
        return RedirectResponse("/ai?byok=error")
    token = request.cookies.get(settings.session_cookie)
    user_id = decode_session_token(token) if token else None
    if not user_id:
        return RedirectResponse("/login?next=/ai")
    verifier = await redis.getdel(f"byok:{user_id}")
    if not verifier:
        return RedirectResponse("/ai?byok=expired")

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            settings.tokendance_exchange_url,
            json={"code": code, "code_verifier": verifier, "code_challenge_method": "S256"},
        )
    if resp.status_code != 200 or not resp.json().get("key"):
        return RedirectResponse("/ai?byok=error")
    key = resp.json()["key"]

    acct = (
        await db.execute(
            select(OAuthAccount).where(OAuthAccount.user_id == user_id, OAuthAccount.provider == "tokendance")
        )
    ).scalar_one_or_none()
    if acct:
        acct.payload_enc = encrypt_text(key)
    else:
        db.add(OAuthAccount(user_id=user_id, provider="tokendance", payload_enc=encrypt_text(key)))
    await db.commit()
    return RedirectResponse("/ai?byok=ok")


@router.delete("")
async def disconnect(db: DB, user: CurrentUser):
    await db.execute(delete(OAuthAccount).where(OAuthAccount.user_id == user.id, OAuthAccount.provider == "tokendance"))
    await db.commit()
    return {"ok": True}
