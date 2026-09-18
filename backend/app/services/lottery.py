"""抽奖核心逻辑：按社团隔离，并发安全（行锁），每人每社团每轮一次，虚拟奖品兑换码原子分配。"""

import random
import uuid
from datetime import UTC, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import redis
from app.models import Application, Club, Draw, PoolConfig, Prize, PrizeCode, User
from app.schemas import DrawResult
from app.security import new_redemption_code

CST = timezone(timedelta(hours=8))  # 东八区自然日


def _now() -> datetime:
    return datetime.now(UTC)


def _day_start() -> datetime:
    """东八区今日 0 点对应的 UTC 时间。"""
    return datetime.now(CST).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(UTC)


async def _issued_today(db: AsyncSession, prize_id) -> int:
    q = select(func.count(Draw.id)).where(
        Draw.prize_id == prize_id,
        Draw.created_at >= _day_start(),
    )
    return int((await db.execute(q)).scalar_one())


async def draw(db: AsyncSession, club: Club, user: User, round_no: int) -> DrawResult:
    """执行一轮抽奖。幂等：同一人同一社团同一轮重复请求返回首次结果。"""
    if round_no not in (1, 2):
        raise HTTPException(400, "无效的抽奖轮次")

    # 第二轮必须先完成该社团报名
    if round_no == 2:
        applied = await db.scalar(
            select(Application.id).where(Application.club_id == club.id, Application.user_id == user.id)
        )
        if not applied:
            raise HTTPException(400, "请先完成报名再抽取报名礼")

    # 已抽过 → 直接返回原结果（幂等）
    existing = (
        await db.execute(select(Draw).where(Draw.club_id == club.id, Draw.user_id == user.id, Draw.round == round_no))
    ).scalar_one_or_none()
    if existing:
        return await _result_of(db, existing)

    cfg = (
        await db.execute(select(PoolConfig).where(PoolConfig.club_id == club.id, PoolConfig.round == round_no))
    ).scalar_one_or_none()
    if not cfg or not cfg.enabled:
        raise HTTPException(400, "本轮抽奖未开放")

    # Redis 幂等锁，防止双击/重试导致的并发重复抽奖
    lock_key = f"drawlock:{club.id}:{user.id}:{round_no}"
    if not await redis.set(lock_key, "1", nx=True, ex=10):
        raise HTTPException(429, "请求处理中，请勿重复提交")

    try:
        # 行锁读取本社团本轮可用奖品
        prizes = (
            (
                await db.execute(
                    select(Prize)
                    .where(Prize.club_id == club.id, Prize.round == round_no, Prize.active.is_(True))
                    .order_by(Prize.sort)
                    .with_for_update()
                )
            )
            .scalars()
            .all()
        )
        candidates: list[Prize] = []
        for p in prizes:
            if p.issued >= p.total_stock:
                continue
            if p.daily_quota and await _issued_today(db, p.id) >= p.daily_quota:
                continue
            if p.is_virtual:
                has_code = await db.scalar(
                    select(PrizeCode.id).where(PrizeCode.prize_id == p.id, PrizeCode.draw_id.is_(None)).limit(1)
                )
                if not has_code:
                    continue
            if p.weight > 0:
                candidates.append(p)

        total = sum(p.weight for p in candidates) + cfg.lose_weight
        roll = random.uniform(0, total)
        chosen: Prize | None = None
        acc = 0.0
        for p in candidates:
            acc += p.weight
            if roll < acc:
                chosen = p
                break

        draw_row = Draw(id=uuid.uuid4(), club_id=club.id, user_id=user.id, round=round_no)
        if chosen:
            chosen.issued += 1
            draw_row.prize_id = chosen.id
            draw_row.prize_name = chosen.name
            if chosen.is_virtual:
                code_row = (
                    await db.execute(
                        select(PrizeCode)
                        .where(PrizeCode.prize_id == chosen.id, PrizeCode.draw_id.is_(None))
                        .order_by(PrizeCode.created_at)
                        .limit(1)
                        .with_for_update(skip_locked=True)
                    )
                ).scalar_one_or_none()
                if code_row:
                    code_row.draw_id = draw_row.id
                    code_row.assigned_at = _now()
                    draw_row.virtual_code = code_row.code
                else:  # 兑换码刚好被抢完（极端兜底）
                    chosen.issued -= 1
                    draw_row.prize_id = None
                    draw_row.prize_name = ""
            else:
                draw_row.code = new_redemption_code(round_no)
        db.add(draw_row)
        await db.commit()
        await db.refresh(draw_row)
        return await _result_of(db, draw_row)
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        raise
    finally:
        await redis.delete(lock_key)


async def _result_of(db: AsyncSession, d: Draw) -> DrawResult:
    prize = await db.get(Prize, d.prize_id) if d.prize_id else None
    return DrawResult(
        round=d.round,
        win=d.prize_id is not None,
        prize_name=d.prize_name,
        prize_tier=prize.tier if prize else "",
        prize_image=prize.image_url if prize else "",
        is_virtual=bool(prize and prize.is_virtual),
        code=d.code,
        virtual_code=d.virtual_code,
        redeemed_at=d.redeemed_at,
    )


async def round_status(db: AsyncSession, club: Club, user: User, round_no: int) -> dict:
    cfg = (
        await db.execute(select(PoolConfig).where(PoolConfig.club_id == club.id, PoolConfig.round == round_no))
    ).scalar_one_or_none()
    applied = (
        await db.scalar(select(Application.id).where(Application.club_id == club.id, Application.user_id == user.id))
    ) is not None
    d = (
        await db.execute(select(Draw).where(Draw.club_id == club.id, Draw.user_id == user.id, Draw.round == round_no))
    ).scalar_one_or_none()
    eligible = (round_no == 1) or applied
    return {
        "round": round_no,
        "enabled": bool(cfg and cfg.enabled),
        "title": cfg.title if cfg else "",
        "eligible": eligible,
        "drawn": d is not None,
        "result": (await _result_of(db, d)) if d else None,
    }
