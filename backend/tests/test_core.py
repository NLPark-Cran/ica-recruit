"""核心业务测试：社团入驻、报名去重、抽奖幂等/库存/并发、核销唯一、多社团隔离。"""

import asyncio

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Application, Draw, Prize, PrizeCode
from app.services.lottery import draw
from tests.conftest import (
    SLUG,
    cookie_for,
    draws_of,
    make_club,
    make_pool,
    make_prize,
    make_user,
)

APP_PAYLOAD = {
    "name": "张三",
    "student_id": "20231234567",
    "college": "计算机学院",
    "grade": "2023级",
    "phone": "13800000000",
    "wechat": "zhangsan123",
    "departments": ["宣传部"],
    "allow_adjust": True,
    "intro": "hello",
}


async def test_club_create_and_isolation(client):
    owner = await make_user(1001)
    r = await client.post(
        "/api/clubs",
        json={"slug": "newclub", "name": "新社团", "departments": ["组织部"]},
        cookies=cookie_for(owner),
    )
    assert r.status_code == 201, r.text
    assert r.json()["my_role"] == "admin"
    # slug 冲突
    r = await client.post(
        "/api/clubs",
        json={"slug": "newclub", "name": "重复"},
        cookies=cookie_for(owner),
    )
    assert r.status_code == 409
    # 公开列表可见
    r = await client.get("/api/clubs")
    assert any(c["slug"] == "newclub" for c in r.json()["items"])


async def test_application_submit_and_dedup(client):
    owner = await make_user(1002)
    await make_club(owner)
    u1, u2 = await make_user(1101), await make_user(1102)
    r = await client.post(f"/api/clubs/{SLUG}/applications", json=APP_PAYLOAD, cookies=cookie_for(u1))
    assert r.status_code == 201, r.text
    # 他人同学号（同社团）→ 409
    r = await client.post(f"/api/clubs/{SLUG}/applications", json=APP_PAYLOAD, cookies=cookie_for(u2))
    assert r.status_code == 409
    # 本人重复提交 → 更新
    r = await client.post(f"/api/clubs/{SLUG}/applications", json=APP_PAYLOAD, cookies=cookie_for(u1))
    assert r.status_code == 201
    async with SessionLocal() as db:
        n = await db.scalar(select(func.count(Application.id)))
    assert n == 1
    # 未知部门被拒
    r = await client.post(
        f"/api/clubs/{SLUG}/applications",
        json={**APP_PAYLOAD, "student_id": "11112222", "departments": ["不存在的部"]},
        cookies=cookie_for(u2),
    )
    assert r.status_code == 400


async def test_same_student_id_allowed_across_clubs(client):
    """不同社团之间学号可以重复。"""
    owner = await make_user(1003)
    await make_club(owner, SLUG)
    await make_club(owner, "other")
    u = await make_user(1201)
    for slug in (SLUG, "other"):
        r = await client.post(f"/api/clubs/{slug}/applications", json=APP_PAYLOAD, cookies=cookie_for(u))
        assert r.status_code == 201, r.text


async def test_round2_requires_application(client):
    owner = await make_user(1004)
    club = await make_club(owner)
    await make_pool(club, 2)
    u = await make_user(1301)
    r = await client.post(f"/api/clubs/{SLUG}/lottery/draw/2", cookies=cookie_for(u))
    assert r.status_code == 400
    assert "报名" in r.json()["detail"]


async def test_draw_idempotent(client):
    owner = await make_user(1005)
    club = await make_club(owner)
    await make_pool(club, 1)
    await make_prize(club, total_stock=5, weight=100)
    u = await make_user(1401)
    r1 = await client.post(f"/api/clubs/{SLUG}/lottery/draw/1", cookies=cookie_for(u))
    r2 = await client.post(f"/api/clubs/{SLUG}/lottery/draw/1", cookies=cookie_for(u))
    assert r1.status_code == r2.status_code == 200
    assert r1.json()["win"] is True
    assert r1.json()["code"] == r2.json()["code"]
    assert len(await draws_of(u)) == 1


async def test_stock_exhaustion(client):
    owner = await make_user(1006)
    club = await make_club(owner)
    await make_pool(club, 1, lose_weight=0)
    await make_prize(club, total_stock=1, weight=100)
    u1, u2 = await make_user(1501), await make_user(1502)
    r1 = await client.post(f"/api/clubs/{SLUG}/lottery/draw/1", cookies=cookie_for(u1))
    r2 = await client.post(f"/api/clubs/{SLUG}/lottery/draw/1", cookies=cookie_for(u2))
    assert r1.json()["win"] is True
    assert r2.json()["win"] is False


async def test_concurrent_draws_never_oversell():
    """10 人并发抢 3 件奖品：中奖数必须恰好为 3。"""
    owner = await make_user(1007)
    club = await make_club(owner)
    await make_pool(club, 1, lose_weight=0)
    prize = await make_prize(club, total_stock=3, weight=100)
    users = [await make_user(2000 + i) for i in range(10)]

    async def one(u):
        async with SessionLocal() as db:
            return await draw(db, club, u, 1)

    results = await asyncio.gather(*[one(u) for u in users])
    wins = [r for r in results if r.win]
    assert len(wins) == 3
    async with SessionLocal() as db:
        p = await db.get(Prize, prize.id)
        assert p.issued == 3
        codes = list((await db.execute(select(Draw.code).where(Draw.prize_id == prize.id))).scalars().all())
        assert len(set(codes)) == 3


async def test_virtual_prize_assigns_unique_code(client):
    owner = await make_user(1008)
    club = await make_club(owner)
    await make_pool(club, 1, lose_weight=0)
    prize = await make_prize(club, name="虚拟卡", total_stock=2, weight=100, is_virtual=True)
    async with SessionLocal() as db:
        db.add_all([PrizeCode(prize_id=prize.id, code=f"TD-CARD-{i}") for i in range(2)])
        await db.commit()
    users = [await make_user(3001 + i) for i in range(3)]
    codes = []
    for u in users:
        r = await client.post(f"/api/clubs/{SLUG}/lottery/draw/1", cookies=cookie_for(u))
        codes.append(r.json())
    assert codes[0]["virtual_code"] == "TD-CARD-0"
    assert codes[1]["virtual_code"] == "TD-CARD-1"
    assert codes[2]["win"] is False  # 兑换码池耗尽


async def test_redeem_once_only(client):
    owner = await make_user(1009)
    club = await make_club(owner)
    await make_pool(club, 1, lose_weight=0)
    await make_prize(club, total_stock=1, weight=100)
    u = await make_user(4001)
    r = await client.post(f"/api/clubs/{SLUG}/lottery/draw/1", cookies=cookie_for(u))
    code = r.json()["code"]

    # 非成员无权核销
    r = await client.post(f"/api/clubs/{SLUG}/redeem", json={"code": code}, cookies=cookie_for(u))
    assert r.status_code == 403
    # 社团管理员核销成功（owner 是 admin）
    r = await client.post(f"/api/clubs/{SLUG}/redeem", json={"code": code}, cookies=cookie_for(owner))
    assert r.json()["ok"] is True
    # 重复核销被拒
    r = await client.post(f"/api/clubs/{SLUG}/redeem", json={"code": code}, cookies=cookie_for(owner))
    assert r.json()["ok"] is False
    assert "重复" in r.json()["message"]
    # 不存在的码
    r = await client.post(f"/api/clubs/{SLUG}/redeem", json={"code": "ICA1-NOTEXIST"}, cookies=cookie_for(owner))
    assert r.json()["ok"] is False


async def test_redeem_cross_club_blocked(client):
    """A 社团的码不能被 B 社团工作人员核销。"""
    owner = await make_user(1010)
    club_a = await make_club(owner, SLUG)
    await make_club(owner, "clubb")
    await make_pool(club_a, 1, lose_weight=0)
    await make_prize(club_a, total_stock=1, weight=100)
    u = await make_user(4101)
    r = await client.post(f"/api/clubs/{SLUG}/lottery/draw/1", cookies=cookie_for(u))
    code = r.json()["code"]
    r = await client.post("/api/clubs/clubb/redeem", json={"code": code}, cookies=cookie_for(owner))
    assert r.json()["ok"] is False


async def test_status_flow(client):
    owner = await make_user(1011)
    club = await make_club(owner)
    await make_pool(club, 1)
    await make_pool(club, 2)
    u = await make_user(5001)
    r = await client.get(f"/api/clubs/{SLUG}/lottery/status", cookies=cookie_for(u))
    s = r.json()
    assert s["applied"] is False
    assert s["rounds"][0]["eligible"] is True
    assert s["rounds"][1]["eligible"] is False
    await client.post(f"/api/clubs/{SLUG}/applications", json=APP_PAYLOAD, cookies=cookie_for(u))
    r = await client.get(f"/api/clubs/{SLUG}/lottery/status", cookies=cookie_for(u))
    s = r.json()
    assert s["applied"] is True
    assert s["rounds"][1]["eligible"] is True
