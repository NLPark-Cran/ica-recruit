"""初始化：建表 + 种子数据（两轮奖池，按策划书配置）。

用法：uv run python -m app.seed
"""

import asyncio

from sqlalchemy import select

from app.db import SessionLocal, engine
from app.models import Base, PoolConfig, Prize

# 按策划书附件三：第一轮 160 份（中奖率约 53%）、第二轮 69 份（接近必中）
ROUND1_PRIZES = [
    {"name": "糖果小礼包", "tier": "参与奖", "total_stock": 120, "weight": 130,
     "image_url": "/assets/prize-candy.webp"},
    {"name": "定制明信片", "tier": "三等奖", "total_stock": 25, "weight": 20,
     "image_url": "/assets/prize-postcard.webp"},
    {"name": "ICA 徽章", "tier": "二等奖", "total_stock": 12, "weight": 8,
     "image_url": "/assets/prize-badge.webp"},
    {"name": "环球零食包", "tier": "一等奖", "total_stock": 3, "weight": 2,
     "image_url": "/assets/prize-snack.webp"},
]
ROUND2_PRIZES = [
    {"name": "定制钥匙扣", "tier": "三等奖", "total_stock": 40, "weight": 45,
     "image_url": "/assets/prize-keychain.webp"},
    {"name": "帆布包", "tier": "二等奖", "total_stock": 20, "weight": 25,
     "image_url": "/assets/prize-tote.webp"},
    {"name": "国际文具套装", "tier": "二等奖", "total_stock": 6, "weight": 6,
     "image_url": "/assets/prize-stationery.webp"},
    {
        "name": "TokenDance 青春卡（20元 Token 额度）",
        "tier": "一等奖",
        "total_stock": 0,
        "weight": 3,
        "is_virtual": True,
        "image_url": "/assets/prize-tdcard.webp",
    },  # 3 张兑换码由管理员在后台「导入兑换码」，库存自动 +3
]


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        for r, title, lose in ((1, "进群礼", 160), (2, "报名礼", 2)):
            exists = await db.get(PoolConfig, r)
            if not exists:
                db.add(PoolConfig(round=r, title=title, lose_weight=lose, enabled=True))
        has_prize = await db.scalar(select(Prize.id).limit(1))
        if not has_prize:
            for i, p in enumerate(ROUND1_PRIZES):
                db.add(Prize(round=1, sort=i, **p))
            for i, p in enumerate(ROUND2_PRIZES):
                db.add(Prize(round=2, sort=i, **p))
        await db.commit()
    print("seed done")


if __name__ == "__main__":
    asyncio.run(main())
