"""活动展示：公开列表 + 管理员上下架。"""

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.db import DB
from app.deps import AdminUser
from app.models import Activity
from app.schemas import ActivityIn, ActivityOut

router = APIRouter(prefix="/activities", tags=["activities"])


def _out(a: Activity) -> ActivityOut:
    return ActivityOut(
        id=str(a.id),
        title=a.title,
        summary=a.summary,
        detail=a.detail,
        location=a.location,
        starts_at=a.starts_at,
        cover_url=a.cover_url,
        published=a.published,
        sort=a.sort,
        created_at=a.created_at,
    )


@router.get("")
async def list_published(db: DB):
    rows = (
        (
            await db.execute(
                select(Activity).where(Activity.published.is_(True)).order_by(Activity.sort, Activity.starts_at)
            )
        )
        .scalars()
        .all()
    )
    return {"items": [_out(a) for a in rows]}


@router.get("/all")
async def list_all(db: DB, admin: AdminUser):
    rows = (await db.execute(select(Activity).order_by(Activity.sort))).scalars().all()
    return {"items": [_out(a) for a in rows]}


@router.post("", status_code=201)
async def create(db: DB, admin: AdminUser, body: ActivityIn):
    a = Activity(**body.model_dump())
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return _out(a)


@router.put("/{activity_id}")
async def update(db: DB, admin: AdminUser, activity_id: uuid.UUID, body: ActivityIn):
    a = await db.get(Activity, activity_id)
    if not a:
        raise HTTPException(404, "活动不存在")
    for k, v in body.model_dump().items():
        setattr(a, k, v)
    await db.commit()
    await db.refresh(a)
    return _out(a)


@router.delete("/{activity_id}")
async def remove(db: DB, admin: AdminUser, activity_id: uuid.UUID):
    a = await db.get(Activity, activity_id)
    if not a:
        raise HTTPException(404, "活动不存在")
    await db.delete(a)
    await db.commit()
    return {"ok": True}
