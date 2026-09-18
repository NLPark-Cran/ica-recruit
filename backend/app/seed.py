"""初始化：建表 + 种子数据（ICA 社团、两轮奖池，按策划书配置）。

用法：uv run python -m app.seed
幂等：已存在的社团/奖品不会覆盖。
"""

import asyncio

from sqlalchemy import select

from app.db import SessionLocal, engine
from app.models import Activity, Base, Club, PoolConfig, Prize, User

ICA_INTRO = (
    "这里是杭电国际交流协会 ICA……和一群有趣的人，一起去看更大的世界。"
    "我们接待海外来杭访学团、交换生与留学生，会员拥有报名活动志愿者的第一手机会；"
    "同时也会带来留学申请的一线分享——前两天 LSE 招生官刚来做完分享。"
)

ICA_DEPARTMENTS = ["组织部", "宣传部", "外联部", "办公室"]

# 按策划书附件三：第一轮 160 份（中奖率约 53%）、第二轮 69 份（接近必中）
ROUND1_PRIZES = [
    {
        "name": "糖果小礼包",
        "tier": "参与奖",
        "total_stock": 120,
        "weight": 130,
        "image_url": "/assets/prize-candy.webp",
    },
    {
        "name": "定制明信片",
        "tier": "三等奖",
        "total_stock": 25,
        "weight": 20,
        "image_url": "/assets/prize-postcard.webp",
    },
    {"name": "ICA 徽章", "tier": "二等奖", "total_stock": 12, "weight": 8, "image_url": "/assets/prize-badge.webp"},
    {"name": "环球零食包", "tier": "一等奖", "total_stock": 3, "weight": 2, "image_url": "/assets/prize-snack.webp"},
]
ROUND2_PRIZES = [
    {
        "name": "定制钥匙扣",
        "tier": "三等奖",
        "total_stock": 40,
        "weight": 45,
        "image_url": "/assets/prize-keychain.webp",
    },
    {"name": "帆布包", "tier": "二等奖", "total_stock": 20, "weight": 25, "image_url": "/assets/prize-tote.webp"},
    {
        "name": "国际文具套装",
        "tier": "二等奖",
        "total_stock": 6,
        "weight": 6,
        "image_url": "/assets/prize-stationery.webp",
    },
    {
        "name": "TokenDance 青春卡（20元 Token 额度）",
        "tier": "一等奖",
        "total_stock": 3,
        "weight": 3,
        "image_url": "/assets/prize-tdcard.webp",
    },
    # 实体纪念卡：卡背刮开可见兑换码，现场核销发放
]

ICA_ACTIVITIES = [
    {
        "title": "海外访学团接待",
        "summary": "接待海外来杭访学团、交换生与留学生，做跨文化交流的第一现场。",
        "cover_url": "/assets/act-visit.webp",
        "sort": 0,
    },
    {
        "title": "留学申请分享会",
        "summary": "LSE 招生官分享刚过——更多海外院校与申请干货在路上。",
        "cover_url": "/assets/act-share.webp",
        "sort": 1,
    },
    {
        "title": "活动志愿者计划",
        "summary": "协会各类活动志愿者的第一手报名机会，先人一步参与其中。",
        "cover_url": "/assets/act-volunteer.webp",
        "sort": 2,
    },
]


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        club = (await db.execute(select(Club).where(Club.slug == "ica"))).scalar_one_or_none()
        if not club:
            # owner 需要一个用户：用占位系统账号，首次观猹登录的管理员可接管
            owner = User(watcha_user_id=0, nickname="ICA 官方")
            db.add(owner)
            await db.flush()
            club = Club(
                slug="ica",
                name="杭电国际交流协会 ICA",
                intro=ICA_INTRO,
                departments=ICA_DEPARTMENTS,
                card_url="https://school.watcha.cn/card",
                contact="招新群公告",
                owner_id=owner.id,
            )
            db.add(club)
            await db.flush()
            for r, title, lose in ((1, "进群礼", 160), (2, "报名礼", 2)):
                db.add(PoolConfig(club_id=club.id, round=r, title=title, lose_weight=lose))
            for i, p in enumerate(ROUND1_PRIZES):
                db.add(Prize(club_id=club.id, round=1, sort=i, **p))
            for i, p in enumerate(ROUND2_PRIZES):
                db.add(Prize(club_id=club.id, round=2, sort=i, **p))
            for a in ICA_ACTIVITIES:
                db.add(Activity(club_id=club.id, published=True, **a))
            await db.commit()
            print("seeded club: ica")
        else:
            print("club ica exists, skip")
    print("seed done")


if __name__ == "__main__":
    asyncio.run(main())
