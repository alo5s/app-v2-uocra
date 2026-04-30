from pydantic_settings import BaseSettings
from pydantic import ConfigDict
 


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=".env",
        extra="ignore"
    )

    APP_NAME: str = "UOCRA API"
    DEBUG: bool = True
    
    DATABASE_URL: str = "sqlite:///./uocra.db"
    
    SECRET_KEY: str = "clave_secreta_default"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"
    
    CLOUDFLARED_CHECK_INTERVAL: int = 30
    BASE_URL: str = ""
    ALLOWED_ORIGINS: str = ""
    
    MAX_FILE_SIZE: int = 16 * 1024 * 1024
    UPLOAD_FOLDER: str = "static/uploads"
    PHOTOS_FOLDER: str = "static/photos"


def get_settings():
    return Settings()


settings = get_settings()
