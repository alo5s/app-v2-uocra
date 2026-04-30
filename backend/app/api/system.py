from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User

router = APIRouter(prefix="", tags=["system"])


@router.get("/api/base-url")
@router.post("/api/base-url")
async def api_base_url(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if request.method == "POST":
        try:
            body = await request.json()
            url = body.get("url")
            if url:
                settings.BASE_URL = url
                return {"success": True, "base_url": url}
            return JSONResponse({"error": "URL no proporcionada"}, status_code=400)
        except:
            return JSONResponse({"error": "Error procesando solicitud"}, status_code=400)
    
    return {
        "base_url": settings.BASE_URL,
        "cloudflared_url": settings.BASE_URL,
        "qr_url": f"{settings.BASE_URL}/subir-cv" if settings.BASE_URL else None
    }


@router.get("/api/check-cloudflared")
async def check_cloudflared():
    import requests
    try:
        response = requests.get("http://localhost:8080/quickstart", timeout=3)
        if response.status_code == 200:
            data = response.json()
            cf_url = data.get("url")
            if cf_url:
                settings.BASE_URL = cf_url
                return {
                    "success": True,
                    "url": cf_url,
                    "qr_url": f"{cf_url}/subir-cv"
                }
    except:
        pass
    return {"success": False, "message": "Cloudflared no detectado"}


@router.get("/api/public-url")
def get_public_url():
    return {
        "base_url": settings.BASE_URL,
        "public_url": f"{settings.BASE_URL}/subir-cv" if settings.BASE_URL else None
    }