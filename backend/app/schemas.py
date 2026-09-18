"""Pydantic v2 出入参 schema。"""

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

# ---------- 用户 ----------


class UserOut(BaseModel):
    id: str
    nickname: str
    avatar_url: str
    is_platform_admin: bool
    has_tokendance_key: bool = False
    club_roles: dict[str, str] = {}  # {club_slug: role}


# ---------- 社团 ----------


class ClubIn(BaseModel):
    slug: str = Field(min_length=2, max_length=32)
    name: str = Field(min_length=1, max_length=64)
    intro: str = Field(default="")
    logo_url: str = Field(default="", max_length=512)
    departments: list[str] = Field(default_factory=list, max_length=10)
    card_url: str = Field(default="", max_length=512)
    contact: str = Field(default="", max_length=256)

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.fullmatch(r"[a-z0-9-]+", v):
            raise ValueError("标识仅限小写字母、数字与连字符")
        return v

    @field_validator("departments")
    @classmethod
    def _deps(cls, v: list[str]) -> list[str]:
        return [d.strip() for d in v if d.strip()][:10]


class ClubOut(ClubIn):
    id: str
    active: bool
    created_at: datetime
    my_role: str | None = None  # 当前用户在该社团的角色（未登录/非成员为 None）


# ---------- 报名 ----------


class ApplicationIn(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    student_id: str = Field(min_length=4, max_length=32)
    college: str = Field(default="", max_length=64)
    grade: str = Field(default="", max_length=16)
    phone: str = Field(min_length=5, max_length=32)
    wechat: str = Field(min_length=1, max_length=64)
    departments: list[str] = Field(min_length=1, max_length=10)
    allow_adjust: bool = True
    intro: str = Field(default="", max_length=1000)

    @field_validator("student_id")
    @classmethod
    def _sid(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit():
            raise ValueError("学号应为纯数字")
        return v


class ApplicationOut(ApplicationIn):
    id: str
    created_at: datetime


# ---------- 抽奖 ----------


class PrizeOut(BaseModel):
    id: str
    round: int
    name: str
    tier: str
    image_url: str
    total_stock: int
    issued: int
    weight: int
    daily_quota: int
    is_virtual: bool
    active: bool
    sort: int


class PrizeIn(BaseModel):
    round: int = Field(ge=1, le=2)
    name: str = Field(min_length=1, max_length=64)
    tier: str = Field(default="参与奖", max_length=16)
    image_url: str = Field(default="", max_length=512)
    total_stock: int = Field(ge=0, default=0)
    weight: int = Field(ge=0, default=100)
    daily_quota: int = Field(ge=0, default=0)
    is_virtual: bool = False
    active: bool = True
    sort: int = 0


class PoolConfigIn(BaseModel):
    lose_weight: int = Field(ge=0)
    enabled: bool = True
    title: str = Field(default="", max_length=64)


class DrawResult(BaseModel):
    round: int
    win: bool
    prize_name: str = ""
    prize_tier: str = ""
    prize_image: str = ""
    is_virtual: bool = False
    code: str | None = None  # 核销码（实物奖品）
    virtual_code: str | None = None  # 兑换码（虚拟奖品）
    redeemed_at: datetime | None = None


class RoundStatus(BaseModel):
    round: int
    enabled: bool
    title: str
    eligible: bool
    drawn: bool
    result: DrawResult | None = None


class LotteryStatus(BaseModel):
    applied: bool
    rounds: list[RoundStatus]
    card_url: str = ""


# ---------- 核销 ----------


class RedeemIn(BaseModel):
    code: str = Field(min_length=4, max_length=24)


class RedeemOut(BaseModel):
    ok: bool
    code: str
    round: int | None = None
    prize_name: str = ""
    winner_nickname: str = ""
    redeemed_at: datetime | None = None
    message: str = ""


# ---------- 活动 ----------


class ActivityIn(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    summary: str = Field(default="", max_length=256)
    detail: str = Field(default="")
    location: str = Field(default="", max_length=128)
    starts_at: datetime | None = None
    cover_url: str = Field(default="", max_length=512)
    published: bool = False
    sort: int = 0


class ActivityOut(ActivityIn):
    id: str
    created_at: datetime


# ---------- 成员 ----------


class MemberIn(BaseModel):
    watcha_user_id: int
    role: str = Field(pattern="^(staff|admin)$")


class MemberOut(BaseModel):
    watcha_user_id: int
    nickname: str
    avatar_url: str
    role: str
    created_at: datetime


# ---------- AI ----------


class ChatMessage(BaseModel):
    role: str
    content: str = Field(max_length=4000)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)


class PosterIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)


class DataAssistantIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class ActivityDraftIn(BaseModel):
    keywords: str = Field(min_length=1, max_length=200)
