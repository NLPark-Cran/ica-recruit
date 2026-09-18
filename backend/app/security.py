"""安全工具：JWT 会话、Fernet 加密、PKCE、核销码生成。"""

import base64
import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from cryptography.fernet import Fernet

from app.config import get_settings

settings = get_settings()


# ---------- JWT 会话 ----------


def create_session_token(user_id: uuid.UUID) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(UTC) + timedelta(days=settings.jwt_expire_days),
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_session_token(token: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        return None


# ---------- Fernet 加密（OAuth token / BYOK key）----------


def _fernet() -> Fernet:
    key = settings.fernet_key
    if not key:
        # 开发兜底：由 jwt_secret 派生，生产必须显式配置 FERNET_KEY
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.jwt_secret.encode()).digest())
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_text(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_text(token_enc: str) -> str:
    return _fernet().decrypt(token_enc.encode()).decode()


# ---------- PKCE ----------


def new_pkce() -> tuple[str, str]:
    """返回 (verifier, S256 challenge)。"""
    verifier = secrets.token_urlsafe(48)[:96]
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


# ---------- 核销码 ----------

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 去掉易混淆字符


def new_redemption_code(round_no: int) -> str:
    body = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
    return f"ICA{round_no}-{body}"
