"""测试夹具：独立测试库 ica_test + Redis db 12。"""

import os
import re

# 必须在导入 app 之前设置环境
_pg = re.sub(r"/ica$", "/ica_test", os.environ.get("DATABASE_URL", ""))
if not _pg:
    from pathlib import Path

    for line in (Path(__file__).parents[1] / ".env").read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            _pg = re.sub(r"/ica$", "/ica_test", line.split("=", 1)[1])

os.environ.update(
    {
        "DATABASE_URL": _pg,
        "REDIS_URL": "redis://127.0.0.1:6379/12",
        "DEBUG": "true",
        "JWT_SECRET": "test-secret",
        "FERNET_KEY": "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "TOKENDANCE_API_KEY": "",
        "SITE_URL": "http://test",
    }
)

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import delete, select  # noqa: E402

from app.db import SessionLocal, engine, redis  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    Activity,
    Application,
    Base,
    Club,
    ClubMember,
    Draw,
    OAuthAccount,
    PoolConfig,
    Prize,
    PrizeCode,
    UsageCounter,
    User,
)
from app.security import create_session_token  # noqa: E402

SLUG = "testclub"


@pytest.fixture(scope="session", autouse=True)
async def _prepare_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def _clean():
    async with SessionLocal() as db:
        for t in (
            PrizeCode,
            Draw,
            Prize,
            PoolConfig,
            Application,
            Activity,
            ClubMember,
            Club,
            OAuthAccount,
            UsageCounter,
            User,
        ):
            await db.execute(delete(t))
        await db.commit()
    await redis.flushdb()
    yield


async def make_user(watcha_id: int = 1001) -> User:
    async with SessionLocal() as db:
        u = User(watcha_user_id=watcha_id, nickname=f"u{watcha_id}")
        db.add(u)
        await db.commit()
        await db.refresh(u)
        return u


async def make_club(owner: User, slug: str = SLUG, departments=None) -> Club:
    async with SessionLocal() as db:
        c = Club(
            slug=slug,
            name="测试社团",
            departments=departments if departments is not None else ["宣传部", "组织部"],
            owner_id=owner.id,
        )
        db.add(c)
        await db.flush()
        db.add(ClubMember(club_id=c.id, user_id=owner.id, role="admin"))
        await db.commit()
        await db.refresh(c)
        return c


def cookie_for(user: User) -> dict[str, str]:
    return {"ica_session": create_session_token(user.id)}


async def make_prize(club: Club, **kw) -> Prize:
    async with SessionLocal() as db:
        p = Prize(
            **{
                "club_id": club.id,
                "round": 1,
                "name": "测试奖品",
                "total_stock": 10,
                "weight": 100,
                **kw,
            }
        )
        db.add(p)
        await db.commit()
        await db.refresh(p)
        return p


async def make_pool(club: Club, round_no: int = 1, lose_weight: int = 0) -> None:
    async with SessionLocal() as db:
        db.add(PoolConfig(club_id=club.id, round=round_no, lose_weight=lose_weight, enabled=True))
        await db.commit()


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def draws_of(user: User) -> list[Draw]:
    async with SessionLocal() as db:
        return list((await db.execute(select(Draw).where(Draw.user_id == user.id))).scalars().all())
