"""抽奖（社团作用域）：状态查询与执行。"""

from fastapi import APIRouter
from sqlalchemy import select

from app.db import DB
from app.deps import ClubDep, CurrentUser
from app.models import Application
from app.schemas import DrawResult, LotteryStatus, RoundStatus
from app.services import lottery as lottery_service

router = APIRouter(prefix="/clubs/{slug}/lottery", tags=["lottery"])


@router.get("/status")
async def status(db: DB, club: ClubDep, user: CurrentUser) -> LotteryStatus:
    applied = (
        await db.scalar(select(Application.id).where(Application.club_id == club.id, Application.user_id == user.id))
    ) is not None
    rounds = [await lottery_service.round_status(db, club, user, r) for r in (1, 2)]
    return LotteryStatus(applied=applied, rounds=[RoundStatus(**r) for r in rounds], card_url=club.card_url)


@router.post("/draw/{round_no}")
async def do_draw(db: DB, club: ClubDep, user: CurrentUser, round_no: int) -> DrawResult:
    return await lottery_service.draw(db, club, user, round_no)
