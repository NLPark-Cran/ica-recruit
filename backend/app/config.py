"""应用配置：全部走环境变量 / .env，密钥不入库不入 Git。"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    site_url: str = "http://localhost:8020"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://ica:ica@127.0.0.1:5432/ica"
    redis_url: str = "redis://127.0.0.1:6379/11"

    jwt_secret: str = "change-me"
    jwt_expire_days: int = 30
    fernet_key: str = ""  # 用于加密存储 oauth token / byok key

    session_cookie: str = "ica_session"

    # 观猹 OAuth2（机密客户端 + S256 PKCE）
    watcha_client_id: str = ""
    watcha_client_secret: str = ""
    watcha_authorize_url: str = "https://watcha.cn/oauth/authorize"
    watcha_token_url: str = "https://watcha.cn/oauth/api/token"
    watcha_userinfo_url: str = "https://watcha.cn/oauth/api/userinfo"
    watcha_scope: str = "read"

    # 平台管理员的观猹 user_id 白名单（逗号分隔）；社团内角色在后台按社团管理
    admin_watcha_ids: str = ""

    # TokenDance（站点兜底 Key + 归因）
    tokendance_api_key: str = ""
    tokendance_base_url: str = "https://tokendance.space/gateway"
    tokendance_app_url: str = "https://ica.hub.tt2.li"
    tokendance_auth_url: str = "https://tokendance.space/auth"
    tokendance_exchange_url: str = "https://tokendance.space/portal/api/v1/auth/keys"

    ai_chat_model: str = "deepseek-v4.1-flash"
    ai_image_model: str = "seedream-5.0-pro"
    ai_quota_chat_daily: int = 20
    ai_quota_image_daily: int = 2
    ai_quota_staff_multiplier: int = 10

    def admin_ids(self) -> set[int]:
        return {int(x) for x in self.admin_watcha_ids.split(",") if x.strip().isdigit()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
