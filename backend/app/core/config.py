from pydantic_settings import BaseSettings
from pydantic import ConfigDict
 


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=".env",
        extra="ignore"
    )

    APP_NAME: str = "UOCRA API"
    DEBUG: bool = True
    
    # Database - SQLite por defecto, PostgreSQL en producción
    DATABASE_URL: str = "sqlite:///./uocra.db"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    
    # Security - SIN VALORES POR DEFECTO (requiere .env)
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # Admin - SIN VALORES POR DEFECTO (requiere .env)
    ADMIN_USERNAME: str
    ADMIN_PASSWORD: str
    
    CLOUDFLARED_CHECK_INTERVAL: int = 30
    BASE_URL: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    MAX_FILE_SIZE: int = 16 * 1024 * 1024
    UPLOAD_FOLDER: str = "static/uploads"
    PHOTOS_FOLDER: str = "static/photos"
    LOGOS_FOLDER: str = "static/logos"


def get_settings():
    return Settings()


settings = get_settings()
