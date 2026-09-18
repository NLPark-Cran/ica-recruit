"""核心业务测试：报名去重、抽奖幂等/库存/并发、核销唯一、虚拟兑换码。"""

import asyncio

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Application, Draw, Prize, PrizeCode
from app.services.lottery import draw
from tests.conftest import cookie_for, draws_of, make_pool, make_prize, make_user

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


async def test_application_submit_and_dedup(client):
    u1, u2 = await make_user(1001), await make_user(1002)
    r = await client.post("/api/applications", json=APP_PAYLOAD, cookies=cookie_for(u1))
    assert r.status_code == 201, r.text
    # 他人同学号 → 409
    r = await client.post("/api/applications", json=APP_PAYLOAD, cookies=cookie_for(u2))
    assert r.status_code == 409
    # 本人重复提交 → 更新成功
    r = await client.post("/api/applications", json=APP_PAYLOAD, cookies=cookie_for(u1))
    assert r.status_code == 201
    async with SessionLocal() as db:
        n = await db.scalar(select(func.count(Application.id)))
    assert n == 1


async def test_round2_requires_application(client):
    u = await make_user(1003)
    await make_pool(2)
    r = await client.post("/api/lottery/draw/2", cookies=cookie_for(u))
    assert r.status_code == 400
    assert "报名" in r.json()["detail"]


async def test_draw_idempotent(client):
    u = await make_user(1004)
    await make_pool(1)
    await make_prize(total_stock=5, weight=100)
    r1 = await client.post("/api/lottery/draw/1", cookies=cookie_for(u))
    r2 = await client.post("/api/lottery/draw/1", cookies=cookie_for(u))
    assert r1.status_code == r2.status_code == 200
    d1, d2 = r1.json(), r2.json()
    assert d1["win"] is True
    assert d1["code"] == d2["code"]  # 重复请求返回原结果
    rows = await draws_of(u)
    assert len(rows) == 1


async def test_stock_exhaustion(client):
    await make_pool(1, lose_weight=0)
    await make_prize(total_stock=1, weight=100)
    u1, u2 = await make_user(1005), await make_user(1006)
    r1 = await client.post("/api/lottery/draw/1", cookies=cookie_for(u1))
    r2 = await client.post("/api/lottery/draw/1", cookies=cookie_for(u2))
    assert r1.json()["win"] is True
    assert r2.json()["win"] is False  # 库存耗尽后必不中


async def test_concurrent_draws_never_oversell():
    """10 人并发抢 3 件奖品：中奖数必须恰好为 3。"""
    await make_pool(1, lose_weight=0)
    prize = await make_prize(total_stock=3, weight=100)
    users = [await make_user(2000 + i) for i in range(10)]

    async def one(u):
        async with SessionLocal() as db:
            return await draw(db, u, 1)

    results = await asyncio.gather(*[one(u) for u in users])
    wins = [r for r in results if r.win]
    assert len(wins) == 3
    async with SessionLocal() as db:
        p = await db.get(Prize, prize.id)
        assert p.issued == 3
        codes = [c for c in (await db.execute(select(Draw.code).where(Draw.prize_id == prize.id))).scalars().all()]
        assert len(set(codes)) == 3  # 核销码唯一


async def test_virtual_prize_assigns_unique_code(client):
    await make_pool(1, lose_weight=0)
    prize = await make_prize(name="TokenDance 青春卡", total_stock=2, weight=100, is_virtual=True)
    async with SessionLocal() as db:
        db.add_all([PrizeCode(prize_id=prize.id, code=f"TD-CARD-{i}") for i in range(2)])
        await db.commit()
    u1, u2, u3 = await make_user(3001), await make_user(3002), await make_user(3003)
    r1 = await client.post("/api/lottery/draw/1", cookies=cookie_for(u1))
    r2 = await client.post("/api/lottery/draw/1", cookies=cookie_for(u2))
    r3 = await client.post("/api/lottery/draw/1", cookies=cookie_for(u3))
    assert r1.json()["virtual_code"] == "TD-CARD-0"
    assert r2.json()["virtual_code"] == "TD-CARD-1"
    assert r1.json()["virtual_code"] != r2.json()["virtual_code"]
    assert r3.json()["win"] is False  # 兑换码池耗尽


async def test_redeem_once_only(client):
    staff = await make_user(9001)
    async with SessionLocal() as db:
        staff.role = "staff"
        db.add(staff)
        await db.commit()
    u = await make_user(4001)
    await make_pool(1, lose_weight=0)
    await make_prize(total_stock=1, weight=100)
    r = await client.post("/api/lottery/draw/1", cookies=cookie_for(u))
    code = r.json()["code"]

    # 普通用户无权核销
    r = await client.post("/api/redeem", json={"code": code}, cookies=cookie_for(u))
    assert r.status_code == 403
    # 工作人员核销成功
    r = await client.post("/api/redeem", json={"code": code}, cookies=cookie_for(staff))
    assert r.json()["ok"] is True
    # 重复核销被拒
    r = await client.post("/api/redeem", json={"code": code}, cookies=cookie_for(staff))
    assert r.json()["ok"] is False
    assert "重复" in r.json()["message"]
    # 不存在的码
    r = await client.post("/api/redeem", json={"code": "ICA1-NOTEXIST"}, cookies=cookie_for(staff))
    assert r.json()["ok"] is False


async def test_status_flow(client):
    u = await make_user(5001)
    await make_pool(1)
    await make_pool(2)
    r = await client.get("/api/lottery/status", cookies=cookie_for(u))
    s = r.json()
    assert s["applied"] is False
    assert s["rounds"][0]["eligible"] is True
    assert s["rounds"][1]["eligible"] is False
    await client.post("/api/applications", json=APP_PAYLOAD, cookies=cookie_for(u))
    r = await client.get("/api/lottery/status", cookies=cookie_for(u))
    s = r.json()
    assert s["applied"] is True
    assert s["rounds"][1]["eligible"] is True
