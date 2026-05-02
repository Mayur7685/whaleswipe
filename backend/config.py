from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    TELEGRAM_BOT_TOKEN: str = "dummy_token"
    FERNET_KEY: str = "dummy_key"
    BIRDEYE_API_KEY: str = "dummy_key"
    OPENROUTER_API_KEY: str = "dummy_key"
    ADMIN_SECRET: str = "change-me-in-production"
    DATABASE_URL: str = "sqlite:///whaleswipe.db"

    class Config:
        env_file = ".env"

settings = Settings()
