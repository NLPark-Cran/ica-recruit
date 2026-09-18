"""SQLAlchemy 2 数据模型（PostgreSQL，库 ica）。"""

import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Role(StrEnum):
    user = "user"
    staff = "staff"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    watcha_user_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    nickname: Mapped[str] = mapped_column(String(64), default="")
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    role: Mapped[str] = mapped_column(String(16), default=Role.user.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OAuthAccount(Base):
    """第三方账号凭据（watcha / tokendance），payload Fernet 加密。"""

    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_oauth_user_provider"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(32))
    payload_enc: Mapped[str] = mapped_column(Text, default="")
    scopes: Mapped[str] = mapped_column(String(128), default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Application(Base):
    """报名表，学号全局唯一。"""

    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(32))
    student_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    college: Mapped[str] = mapped_column(String(64), default="")
    grade: Mapped[str] = mapped_column(String(16), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    wechat: Mapped[str] = mapped_column(String(64), default="")
    departments: Mapped[list] = mapped_column(JSONB, default=list)  # 意向部门（有序）
    allow_adjust: Mapped[bool] = mapped_column(default=True)
    intro: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Prize(Base):
    """奖品：两轮独立，库存/权重/日投放可配。虚拟奖品（兑换码池）中奖即发码，无需现场核销。"""

    __tablename__ = "prizes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    round: Mapped[int] = mapped_column(Integer, index=True)  # 1=进群礼 2=报名礼
    name: Mapped[str] = mapped_column(String(64))
    tier: Mapped[str] = mapped_column(String(16), default="参与奖")
    image_url: Mapped[str] = mapped_column(String(512), default="")
    total_stock: Mapped[int] = mapped_column(Integer, default=0)
    issued: Mapped[int] = mapped_column(Integer, default=0)
    weight: Mapped[int] = mapped_column(Integer, default=100)  # 概率权重
    daily_quota: Mapped[int] = mapped_column(Integer, default=0)  # 0 = 不限制
    is_virtual: Mapped[bool] = mapped_column(default=False)  # True = 兑换码奖品
    active: Mapped[bool] = mapped_column(default=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class PoolConfig(Base):
    """每轮抽奖的配置（单行/轮）：未中奖权重等。"""

    __tablename__ = "pool_configs"

    round: Mapped[int] = mapped_column(Integer, primary_key=True)  # 1 / 2
    lose_weight: Mapped[int] = mapped_column(Integer, default=0)  # “谢谢参与”权重
    enabled: Mapped[bool] = mapped_column(default=True)
    title: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Draw(Base):
    """抽奖记录：每人每轮一次。中奖才有核销码；虚拟奖品直接附带兑换码。"""

    __tablename__ = "draws"
    __table_args__ = (UniqueConstraint("user_id", "round", name="uq_draw_user_round"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    round: Mapped[int] = mapped_column(Integer)
    prize_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("prizes.id"), nullable=True)
    prize_name: Mapped[str] = mapped_column(String(64), default="")  # 快照
    code: Mapped[str | None] = mapped_column(String(24), unique=True, nullable=True, index=True)
    virtual_code: Mapped[str | None] = mapped_column(String(128), nullable=True)  # 已分配的兑换码
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    redeemed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class PrizeCode(Base):
    """虚拟奖品兑换码池（如 TokenDance 青春卡）。"""

    __tablename__ = "prize_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prize_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("prizes.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(128))
    draw_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("draws.id"), nullable=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Activity(Base):
    """门户展示的活动（管理员上下架）。"""

    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(128))
    summary: Mapped[str] = mapped_column(String(256), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(128), default="")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cover_url: Mapped[str] = mapped_column(String(512), default="")
    published: Mapped[bool] = mapped_column(default=False, index=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UsageCounter(Base):
    """AI 功能每日配额（原子计数）。"""

    __tablename__ = "usage_counters"
    __table_args__ = (UniqueConstraint("user_id", "day", "kind", name="uq_usage_user_day_kind"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    day: Mapped[date] = mapped_column(Date)
    kind: Mapped[str] = mapped_column(String(32))  # chat / image
    count: Mapped[int] = mapped_column(Integer, default=0)
