"""抽奖：状态查询与执行。"""

from fastapi import APIRouter
from sqlalchemy import select

from app.db import DB
from app.deps import CurrentUser
from app.models import Application
from app.schemas import DrawResult, LotteryStatus, RoundStatus
from app.services import lottery as lottery_service

router = APIRouter(prefix="/lottery", tags=["lottery"])


@router.get("/status")
async def status(db: DB, user: CurrentUser) -> LotteryStatus:
    applied = (await db.scalar(select(Application.id).where(Application.user_id == user.id))) is not None
    rounds = [await lottery_service.round_status(db, user, r) for r in (1, 2)]
    return LotteryStatus(applied=applied, rounds=[RoundStatus(**r) for r in rounds])


@router.post("/draw/{round_no}")
async def do_draw(db: DB, user: CurrentUser, round_no: int) -> DrawResult:
    return await lottery_service.draw(db, user, round_no)
