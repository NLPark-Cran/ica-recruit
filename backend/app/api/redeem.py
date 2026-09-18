"""现场核销（工作人员）：扫码/输码 → 原子核销，多设备安全。"""

from datetime import UTC, datetime, timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import select

from app.db import DB
from app.deps import StaffUser
from app.models import Draw, Prize, User
from app.schemas import RedeemIn, RedeemOut

CST = timezone(timedelta(hours=8))

router = APIRouter(prefix="/redeem", tags=["redeem"])


@router.post("")
async def redeem(db: DB, staff: StaffUser, body: RedeemIn) -> RedeemOut:
    code = body.code.strip().upper()
    d = (await db.execute(select(Draw).where(Draw.code == code).with_for_update())).scalar_one_or_none()
    if not d:
        return RedeemOut(ok=False, code=code, message="核销码不存在")
    if d.redeemed_at:
        operator = await db.get(User, d.redeemed_by) if d.redeemed_by else None
        return RedeemOut(
            ok=False,
            code=code,
            round=d.round,
            prize_name=d.prize_name,
            redeemed_at=d.redeemed_at,
            message=f"该码已于 {d.redeemed_at.astimezone(CST).strftime('%H:%M:%S')} 被 "
            f"{operator.nickname if operator else '他人'} 核销，请勿重复发奖",
        )
    d.redeemed_at = datetime.now(UTC)
    d.redeemed_by = staff.id
    winner = await db.get(User, d.user_id)
    prize = await db.get(Prize, d.prize_id) if d.prize_id else None
    await db.commit()
    return RedeemOut(
        ok=True,
        code=code,
        round=d.round,
        prize_name=d.prize_name,
        winner_nickname=winner.nickname if winner else "",
        redeemed_at=d.redeemed_at,
        message=f"核销成功，请发放【{prize.tier if prize else ''}·{d.prize_name}】",
    )


@router.get("/history")
async def history(db: DB, staff: StaffUser, limit: int = 50):
    q = select(Draw).where(Draw.redeemed_at.is_not(None)).order_by(Draw.redeemed_at.desc()).limit(min(limit, 200))
    rows = (await db.execute(q)).scalars().all()
    result = []
    for d in rows:
        winner = await db.get(User, d.user_id)
        result.append(
            {
                "code": d.code,
                "round": d.round,
                "prize_name": d.prize_name,
                "winner": winner.nickname if winner else "",
                "redeemed_at": d.redeemed_at.isoformat() if d.redeemed_at else None,
            }
        )
    return {"items": result}
