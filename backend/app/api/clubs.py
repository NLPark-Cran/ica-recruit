"""社团：公开列表/详情、自助入驻创建、设置与成员管理。"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.db import DB
from app.deps import ClubAdmin, ClubDep, CurrentUser, MaybeUser, my_club_roles
from app.models import Club, ClubMember, ClubRole, PoolConfig, User
from app.schemas import ClubIn, ClubOut, MemberIn, MemberOut

router = APIRouter(prefix="/clubs", tags=["clubs"])

DEFAULT_POOLS = ((1, "进群礼", 100), (2, "报名礼", 2))


def _out(c: Club, my_role: str | None = None) -> ClubOut:
    return ClubOut(
        id=str(c.id),
        slug=c.slug,
        name=c.name,
        intro=c.intro,
        logo_url=c.logo_url,
        departments=c.departments,
        card_url=c.card_url,
        contact=c.contact,
        active=c.active,
        created_at=c.created_at,
        my_role=my_role,
    )


@router.get("")
async def list_clubs(db: DB):
    rows = (await db.execute(select(Club).where(Club.active.is_(True)).order_by(Club.created_at))).scalars().all()
    return {"items": [_out(c) for c in rows]}


@router.post("", status_code=201)
async def create_club(db: DB, user: CurrentUser, body: ClubIn):
    """任何登录用户都可入驻创建社团，创建者自动成为管理员。"""
    exists = await db.scalar(select(Club.id).where(Club.slug == body.slug))
    if exists:
        raise HTTPException(409, "该标识已被使用，换一个试试")
    club = Club(**body.model_dump(), owner_id=user.id)
    db.add(club)
    await db.flush()
    db.add(ClubMember(club_id=club.id, user_id=user.id, role=ClubRole.admin.value))
    for r, title, lose in DEFAULT_POOLS:
        db.add(PoolConfig(club_id=club.id, round=r, title=title, lose_weight=lose))
    await db.commit()
    await db.refresh(club)
    return _out(club, ClubRole.admin.value)


@router.get("/{slug}")
async def club_detail(db: DB, club: ClubDep, user: MaybeUser):
    my_role = None
    if user:
        roles = await my_club_roles(db, user)
        my_role = roles.get(club.slug)
    return _out(club, my_role)


@router.put("/{slug}")
async def update_club(db: DB, club: ClubDep, admin: ClubAdmin, body: ClubIn):
    if body.slug != club.slug:
        exists = await db.scalar(select(Club.id).where(Club.slug == body.slug))
        if exists:
            raise HTTPException(409, "该标识已被使用")
    for k, v in body.model_dump().items():
        setattr(club, k, v)
    await db.commit()
    await db.refresh(club)
    return _out(club, ClubRole.admin.value)


# ---------- 成员管理 ----------


@router.get("/{slug}/members")
async def list_members(db: DB, club: ClubDep, admin: ClubAdmin):
    rows = (
        await db.execute(
            select(ClubMember, User).join(User, User.id == ClubMember.user_id).where(ClubMember.club_id == club.id)
        )
    ).all()
    return {
        "items": [
            MemberOut(
                watcha_user_id=u.watcha_user_id,
                nickname=u.nickname,
                avatar_url=u.avatar_url,
                role=m.role,
                created_at=m.created_at,
            )
            for m, u in rows
        ]
    }


@router.post("/{slug}/members", status_code=201)
async def add_member(db: DB, club: ClubDep, admin: ClubAdmin, body: MemberIn):
    target = (await db.execute(select(User).where(User.watcha_user_id == body.watcha_user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(404, "用户不存在（请对方先用观猹登录一次本平台）")
    m = (
        await db.execute(select(ClubMember).where(ClubMember.club_id == club.id, ClubMember.user_id == target.id))
    ).scalar_one_or_none()
    if m:
        m.role = body.role
    else:
        db.add(ClubMember(club_id=club.id, user_id=target.id, role=body.role))
    await db.commit()
    return {"ok": True}


@router.delete("/{slug}/members/{watcha_user_id}")
async def remove_member(db: DB, club: ClubDep, admin: ClubAdmin, watcha_user_id: int):
    target = (await db.execute(select(User).where(User.watcha_user_id == watcha_user_id))).scalar_one_or_none()
    if target:
        m = (
            await db.execute(select(ClubMember).where(ClubMember.club_id == club.id, ClubMember.user_id == target.id))
        ).scalar_one_or_none()
        if m:
            if m.role == ClubRole.admin.value:
                admins = await db.scalar(
                    select(func.count(ClubMember.id)).where(
                        ClubMember.club_id == club.id, ClubMember.role == ClubRole.admin.value
                    )
                )
                if (admins or 0) <= 1:
                    raise HTTPException(400, "至少保留一名管理员")
            await db.delete(m)
            await db.commit()
    return {"ok": True}
