"""观猹 OAuth2 登录（机密客户端 + S256 PKCE）与会话管理。"""

import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.config import get_settings
from app.db import DB, redis
from app.models import OAuthAccount, Role, User
from app.schemas import UserOut
from app.security import create_session_token, encrypt_text, new_pkce

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])

_STATE_TTL = 600


def _role_for(watcha_id: int) -> str:
    if watcha_id in settings.admin_ids():
        return Role.admin.value
    if watcha_id in settings.staff_ids():
        return Role.staff.value
    return Role.user.value


def _set_session(resp: RedirectResponse, user: User) -> None:
    resp.set_cookie(
        settings.session_cookie,
        create_session_token(user.id),
        max_age=settings.jwt_expire_days * 86400,
        httponly=True,
        secure=not settings.debug,
        samesite="lax",
        path="/",
    )


@router.get("/watcha/login")
async def watcha_login(next: str = "/flow"):
    verifier, challenge = new_pkce()
    state = secrets.token_urlsafe(24)
    await redis.setex(f"oauth:watcha:{state}", _STATE_TTL, f"{verifier}|{next}")
    params = {
        "response_type": "code",
        "client_id": settings.watcha_client_id,
        "redirect_uri": f"{settings.site_url}/api/auth/watcha/callback",
        "scope": settings.watcha_scope,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    return RedirectResponse(f"{settings.watcha_authorize_url}?{urlencode(params)}")


@router.get("/watcha/callback")
async def watcha_callback(db: DB, code: str = "", state: str = "", error: str = ""):
    if error:
        return RedirectResponse(f"/login?error={error}")
    if not code or not state:
        raise HTTPException(400, "缺少 code 或 state")
    raw = await redis.getdel(f"oauth:watcha:{state}")
    if not raw:
        raise HTTPException(400, "state 已过期或不合法，请重新登录")
    verifier, next_url = raw.split("|", 1)
    if not next_url.startswith("/"):
        next_url = "/flow"

    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": f"{settings.site_url}/api/auth/watcha/callback",
        "client_id": settings.watcha_client_id,
        "client_secret": settings.watcha_client_secret,
        "code_verifier": verifier,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        tok = await client.post(
            settings.watcha_token_url,
            data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if tok.status_code != 200:
            raise HTTPException(502, f"观猹令牌交换失败: {tok.text[:200]}")
        tokens = tok.json()
        info = await client.get(
            settings.watcha_userinfo_url,
            params={"access_token": tokens["access_token"]},
        )
    if info.status_code != 200:
        raise HTTPException(502, "观猹用户信息获取失败")
    data = info.json().get("data") or {}
    watcha_id = data.get("user_id")
    if not watcha_id:
        raise HTTPException(502, "观猹返回数据异常")

    user = (await db.execute(select(User).where(User.watcha_user_id == watcha_id))).scalar_one_or_none()
    if not user:
        user = User(
            watcha_user_id=watcha_id,
            nickname=data.get("nickname") or f"用户{watcha_id}",
            avatar_url=data.get("avatar_url") or "",
            role=_role_for(watcha_id),
        )
        db.add(user)
        await db.flush()
    else:
        user.nickname = data.get("nickname") or user.nickname
        user.avatar_url = data.get("avatar_url") or user.avatar_url
        user.role = _role_for(watcha_id)

    # 存观猹 token（加密），便于后续刷新
    acct = (
        await db.execute(select(OAuthAccount).where(OAuthAccount.user_id == user.id, OAuthAccount.provider == "watcha"))
    ).scalar_one_or_none()
    payload = encrypt_text(f"{tokens['access_token']}|{tokens.get('refresh_token', '')}")
    if acct:
        acct.payload_enc = payload
        acct.scopes = tokens.get("scope", "")
    else:
        db.add(
            OAuthAccount(
                user_id=user.id,
                provider="watcha",
                payload_enc=payload,
                scopes=tokens.get("scope", ""),
            )
        )
    await db.commit()

    resp = RedirectResponse(next_url)
    _set_session(resp, user)
    return resp


@router.get("/me")
async def me(request: Request, db: DB) -> UserOut:
    from app.deps import get_current_user  # 避免循环依赖

    user = await get_current_user(request, db)
    has_key = (
        await db.scalar(
            select(OAuthAccount.id).where(OAuthAccount.user_id == user.id, OAuthAccount.provider == "tokendance")
        )
    ) is not None
    return UserOut(
        id=str(user.id),
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        role=user.role,
        has_tokendance_key=has_key,
    )


@router.post("/logout")
async def logout():
    resp = RedirectResponse("/", status_code=303)
    resp.delete_cookie(settings.session_cookie, path="/")
    return resp


@router.get("/dev-login")
async def dev_login(db: DB, watcha_id: int = 1001, request: Request = None):  # type: ignore[assignment]
    """仅 DEBUG 且本机直连可用的开发登录。"""
    if not settings.debug or request.headers.get("X-Forwarded-For"):
        raise HTTPException(404)
    user = (await db.execute(select(User).where(User.watcha_user_id == watcha_id))).scalar_one_or_none()
    if not user:
        user = User(
            watcha_user_id=watcha_id,
            nickname=f"开发用户{watcha_id}",
            role=_role_for(watcha_id),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    resp = RedirectResponse("/flow")
    _set_session(resp, user)
    return resp
