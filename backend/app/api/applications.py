"""报名表单（社团作用域）：提交（社团内学号去重）、查询自己的报名。"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.db import DB
from app.deps import ClubDep, CurrentUser
from app.models import Application
from app.schemas import ApplicationIn, ApplicationOut

router = APIRouter(prefix="/clubs/{slug}/applications", tags=["applications"])


def _out(a: Application) -> ApplicationOut:
    return ApplicationOut(
        id=str(a.id),
        name=a.name,
        student_id=a.student_id,
        college=a.college,
        grade=a.grade,
        phone=a.phone,
        wechat=a.wechat,
        departments=a.departments,
        allow_adjust=a.allow_adjust,
        intro=a.intro,
        created_at=a.created_at,
    )


@router.get("/mine")
async def my_application(db: DB, club: ClubDep, user: CurrentUser):
    a = (
        await db.execute(select(Application).where(Application.club_id == club.id, Application.user_id == user.id))
    ).scalar_one_or_none()
    return {"application": _out(a) if a else None}


@router.post("", status_code=201)
async def submit(db: DB, club: ClubDep, user: CurrentUser, body: ApplicationIn):
    # 部门必须是该社团配置的部门
    bad = [d for d in body.departments if d not in (club.departments or [])]
    if club.departments and bad:
        raise HTTPException(400, f"未知部门: {bad}")

    # 学号被同社团他人占用 → 409
    dup = (
        await db.execute(
            select(Application).where(Application.club_id == club.id, Application.student_id == body.student_id)
        )
    ).scalar_one_or_none()
    if dup and dup.user_id != user.id:
        raise HTTPException(409, "该学号已提交过报名，如有疑问请联系现场工作人员")

    a = (
        await db.execute(select(Application).where(Application.club_id == club.id, Application.user_id == user.id))
    ).scalar_one_or_none()
    if a:  # 本人重复提交 → 更新
        for field in (
            "name",
            "college",
            "grade",
            "phone",
            "wechat",
            "departments",
            "allow_adjust",
            "intro",
        ):
            setattr(a, field, getattr(body, field))
        a.student_id = body.student_id
    else:
        a = Application(club_id=club.id, user_id=user.id, **body.model_dump())
        db.add(a)
    await db.commit()
    await db.refresh(a)
    return {"application": _out(a), "card_url": club.card_url}
