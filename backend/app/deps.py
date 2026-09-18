"""FastAPI 依赖：当前用户、社团解析、角色守卫。"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select

from app.config import get_settings
from app.db import DB
from app.models import Club, ClubMember, ClubRole, User
from app.security import decode_session_token

settings = get_settings()


async def get_current_user(request: Request, db: DB) -> User:
    user = await _maybe_user(request, db)
    if not user:
        raise HTTPException(401, "未登录")
    return user


async def _maybe_user(request: Request, db) -> User | None:
    token = request.cookies.get(settings.session_cookie)
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    user_id = decode_session_token(token) if token else None
    if not user_id:
        return None
    return (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()


async def get_optional_user(request: Request, db: DB) -> User | None:
    return await _maybe_user(request, db)


CurrentUser = Annotated[User, Depends(get_current_user)]
MaybeUser = Annotated[User | None, Depends(get_optional_user)]


async def get_club(slug: str, db: DB) -> Club:
    club = (await db.execute(select(Club).where(Club.slug == slug, Club.active.is_(True)))).scalar_one_or_none()
    if not club:
        raise HTTPException(404, "社团不存在")
    return club


ClubDep = Annotated[Club, Depends(get_club)]


async def _membership(db, club: Club, user: User) -> ClubMember | None:
    return (
        await db.execute(select(ClubMember).where(ClubMember.club_id == club.id, ClubMember.user_id == user.id))
    ).scalar_one_or_none()


async def require_club_staff(club: ClubDep, user: CurrentUser, db: DB) -> ClubMember:
    if user.is_platform_admin:
        return ClubMember(club_id=club.id, user_id=user.id, role=ClubRole.admin.value)
    m = await _membership(db, club, user)
    if not m or m.role not in (ClubRole.staff.value, ClubRole.admin.value):
        raise HTTPException(403, "需要该社团工作人员权限")
    return m


async def require_club_admin(club: ClubDep, user: CurrentUser, db: DB) -> ClubMember:
    if user.is_platform_admin:
        return ClubMember(club_id=club.id, user_id=user.id, role=ClubRole.admin.value)
    m = await _membership(db, club, user)
    if not m or m.role != ClubRole.admin.value:
        raise HTTPException(403, "需要该社团管理员权限")
    return m


ClubStaff = Annotated[ClubMember, Depends(require_club_staff)]
ClubAdmin = Annotated[ClubMember, Depends(require_club_admin)]


async def my_club_roles(db, user: User) -> dict[str, str]:
    """返回 {club_slug: role}，供前端判断入口可见性。"""
    rows = (
        await db.execute(
            select(Club.slug, ClubMember.role)
            .join(Club, Club.id == ClubMember.club_id)
            .where(ClubMember.user_id == user.id)
        )
    ).all()
    roles = {slug: role for slug, role in rows}
    if user.is_platform_admin:
        for (slug,) in (await db.execute(select(Club.slug))).all():
            roles.setdefault(slug, ClubRole.admin.value)
    return roles
