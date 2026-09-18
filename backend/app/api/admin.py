"""社团管理后台：仪表盘统计、奖池配置、兑换码导入、CSV 导出。"""

import csv
import io
import uuid
from datetime import UTC, datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select

from app.db import DB
from app.deps import ClubAdmin, ClubDep
from app.models import Application, Draw, PoolConfig, Prize, PrizeCode, User
from app.schemas import PoolConfigIn, PrizeIn, PrizeOut

router = APIRouter(prefix="/clubs/{slug}/admin", tags=["club-admin"])

CST = timezone(timedelta(hours=8))


def _prize_out(p: Prize, codes_left: int = 0) -> dict:
    d = PrizeOut(
        id=str(p.id),
        round=p.round,
        name=p.name,
        tier=p.tier,
        image_url=p.image_url,
        total_stock=p.total_stock,
        issued=p.issued,
        weight=p.weight,
        daily_quota=p.daily_quota,
        is_virtual=p.is_virtual,
        active=p.active,
        sort=p.sort,
    ).model_dump()
    d["codes_left"] = codes_left
    return d


# ---------- 仪表盘 ----------


@router.get("/stats")
async def stats(db: DB, club: ClubDep, admin: ClubAdmin):
    today_start = datetime.now(CST).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(UTC)
    cid = club.id
    apps = await db.scalar(select(func.count(Application.id)).where(Application.club_id == cid))
    visitors = await db.scalar(select(func.count(func.distinct(Draw.user_id))).where(Draw.club_id == cid))
    out: dict = {"visitors": visitors, "applications": apps, "rounds": []}
    for r in (1, 2):
        base = select(func.count(Draw.id)).where(Draw.club_id == cid, Draw.round == r)
        total = await db.scalar(base)
        wins = await db.scalar(base.where(Draw.prize_id.is_not(None)))
        redeemed = await db.scalar(base.where(Draw.redeemed_at.is_not(None)))
        today = await db.scalar(base.where(Draw.created_at >= today_start))
        out["rounds"].append(
            {
                "round": r,
                "draws": total,
                "wins": wins,
                "redeemed": redeemed,
                "today_draws": today,
                "win_rate": round((wins or 0) / total * 100, 1) if total else 0,
            }
        )
    return out


# ---------- 奖池配置 ----------


@router.get("/prizes")
async def list_prizes(db: DB, club: ClubDep, admin: ClubAdmin):
    rows = (
        (await db.execute(select(Prize).where(Prize.club_id == club.id).order_by(Prize.round, Prize.sort)))
        .scalars()
        .all()
    )
    result = []
    for p in rows:
        left = 0
        if p.is_virtual:
            left = await db.scalar(
                select(func.count(PrizeCode.id)).where(PrizeCode.prize_id == p.id, PrizeCode.draw_id.is_(None))
            )
        result.append(_prize_out(p, left or 0))
    cfgs = (await db.execute(select(PoolConfig).where(PoolConfig.club_id == club.id))).scalars().all()
    return {
        "prizes": result,
        "configs": [
            {
                "round": c.round,
                "lose_weight": c.lose_weight,
                "enabled": c.enabled,
                "title": c.title,
            }
            for c in cfgs
        ],
    }


@router.post("/prizes", status_code=201)
async def create_prize(db: DB, club: ClubDep, admin: ClubAdmin, body: PrizeIn):
    p = Prize(club_id=club.id, **body.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _prize_out(p)


@router.put("/prizes/{prize_id}")
async def update_prize(db: DB, club: ClubDep, admin: ClubAdmin, prize_id: uuid.UUID, body: PrizeIn):
    p = await db.get(Prize, prize_id)
    if not p or p.club_id != club.id:
        raise HTTPException(404, "奖品不存在")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return _prize_out(p)


@router.delete("/prizes/{prize_id}")
async def delete_prize(db: DB, club: ClubDep, admin: ClubAdmin, prize_id: uuid.UUID):
    p = await db.get(Prize, prize_id)
    if not p or p.club_id != club.id:
        raise HTTPException(404, "奖品不存在")
    used = await db.scalar(select(func.count(Draw.id)).where(Draw.prize_id == p.id))
    if used:
        p.active = False  # 已被抽中过，只能下架不能删除
        await db.commit()
        return {"ok": True, "soft_deleted": True}
    await db.delete(p)
    await db.commit()
    return {"ok": True}


@router.put("/pool/{round_no}")
async def update_pool(db: DB, club: ClubDep, admin: ClubAdmin, round_no: int, body: PoolConfigIn):
    if round_no not in (1, 2):
        raise HTTPException(400, "无效轮次")
    cfg = (
        await db.execute(select(PoolConfig).where(PoolConfig.club_id == club.id, PoolConfig.round == round_no))
    ).scalar_one_or_none()
    if not cfg:
        cfg = PoolConfig(club_id=club.id, round=round_no)
        db.add(cfg)
    cfg.lose_weight = body.lose_weight
    cfg.enabled = body.enabled
    cfg.title = body.title
    await db.commit()
    return {"ok": True}


@router.post("/prizes/{prize_id}/codes")
async def import_codes(db: DB, club: ClubDep, admin: ClubAdmin, prize_id: uuid.UUID, body: dict):
    """批量导入兑换码：{"codes": "一行一个"}。"""
    p = await db.get(Prize, prize_id)
    if not p or p.club_id != club.id or not p.is_virtual:
        raise HTTPException(400, "奖品不存在或非虚拟奖品")
    codes = [c.strip() for c in (body.get("codes") or "").splitlines() if c.strip()]
    for c in codes:
        db.add(PrizeCode(prize_id=p.id, code=c))
    p.total_stock += len(codes)
    await db.commit()
    return {"ok": True, "imported": len(codes)}


# ---------- CSV 导出 ----------


def _csv(filename: str, header: list[str], rows: list[list]) -> StreamingResponse:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    w.writerows(rows)
    buf.seek(0)
    # BOM 保证 Excel 正确识别 UTF-8
    stream = io.BytesIO(b"\xef\xbb\xbf" + buf.getvalue().encode())
    return StreamingResponse(
        stream,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/applications.csv")
async def export_applications(db: DB, club: ClubDep, admin: ClubAdmin):
    rows = (
        (await db.execute(select(Application).where(Application.club_id == club.id).order_by(Application.created_at)))
        .scalars()
        .all()
    )
    return _csv(
        "applications.csv",
        ["姓名", "学号", "学院", "年级", "电话", "微信号", "意向部门", "服从调剂", "自我介绍", "报名时间"],
        [
            [
                a.name,
                a.student_id,
                a.college,
                a.grade,
                a.phone,
                a.wechat,
                "/".join(a.departments),
                "是" if a.allow_adjust else "否",
                a.intro,
                a.created_at.astimezone(CST).strftime("%Y-%m-%d %H:%M:%S"),
            ]
            for a in rows
        ],
    )


@router.get("/export/draws.csv")
async def export_draws(db: DB, club: ClubDep, admin: ClubAdmin):
    q = select(Draw, User).join(User, Draw.user_id == User.id).where(Draw.club_id == club.id).order_by(Draw.created_at)
    rows = (await db.execute(q)).all()
    return _csv(
        "draws.csv",
        ["轮次", "用户", "是否中奖", "奖品", "核销码", "兑换码", "核销时间", "抽奖时间"],
        [
            [
                d.round,
                u.nickname,
                "是" if d.prize_id else "否",
                d.prize_name,
                d.code or "",
                d.virtual_code or "",
                d.redeemed_at.astimezone(CST).strftime("%Y-%m-%d %H:%M:%S") if d.redeemed_at else "",
                d.created_at.astimezone(CST).strftime("%Y-%m-%d %H:%M:%S"),
            ]
            for d, u in rows
        ],
    )
