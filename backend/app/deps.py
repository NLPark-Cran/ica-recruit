"""FastAPI 依赖：当前用户、角色守卫。"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select

from app.config import get_settings
from app.db import DB
from app.models import Role, User
from app.security import decode_session_token

settings = get_settings()


async def get_current_user(request: Request, db: DB) -> User:
    token = request.cookies.get(settings.session_cookie)
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    user_id = decode_session_token(token) if token else None
    if not user_id:
        raise HTTPException(401, "未登录")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(401, "用户不存在")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_staff(user: CurrentUser) -> User:
    if user.role not in (Role.staff.value, Role.admin.value):
        raise HTTPException(403, "需要工作人员权限")
    return user


async def require_admin(user: CurrentUser) -> User:
    if user.role != Role.admin.value:
        raise HTTPException(403, "需要管理员权限")
    return user


StaffUser = Annotated[User, Depends(require_staff)]
AdminUser = Annotated[User, Depends(require_admin)]
