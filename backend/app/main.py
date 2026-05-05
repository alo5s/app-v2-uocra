from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.core.config import settings
from app.core.database import engine, Base
from app.core.error_handler import setup_error_handlers
from app.models.user import User
from app.api import auth, cvs, empresas, notas, dashboard, actividad, system, public

# Crear carpetas static
os.makedirs("static/uploads", exist_ok=True)
os.makedirs("static/photos", exist_ok=True)
os.makedirs("static/logos", exist_ok=True)
os.makedirs("static/temp", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    
    from app.core.database import SessionLocal
    from app.core.security import get_password_hash
    
    db = SessionLocal()
    try:
        admin_username = settings.ADMIN_USERNAME
        admin_password = settings.ADMIN_PASSWORD
        
        admin = db.query(User).filter(User.username == admin_username).first()
        if not admin:
            admin = User(
                username=admin_username,
                is_admin=True,
                is_active=True
            )
            admin.set_password(admin_password)
            db.add(admin)
            db.commit()
            print(f"Admin user created: {admin_username}")
    finally:
        db.close()
    
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="UOCRA - Panel de Administración de CVs",
    version="2.0.0",
    lifespan=lifespan
)

# Configurar manejadores de errores
setup_error_handlers(app)

# CORS: si no hay orígenes configurados, usar lista vacía (bloquear todo excepto misma origen)
cors_origins = settings.ALLOWED_ORIGINS.split(',') if settings.ALLOWED_ORIGINS else []
if not cors_origins:
    print("WARNING: CORS ALLOWED_ORIGINS no configurado. Usando solo orígenes locales.")
    cors_origins = ["http://localhost:5173", "http://localhost:5174"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(cvs.router, prefix="/api")
app.include_router(empresas.router, prefix="/api")
app.include_router(notas.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(actividad.router, prefix="/api")
app.include_router(system.router)
app.include_router(public.router, prefix="/api/public")  # Mount at /api/public

# Montar archivos estáticos
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    return {"message": "UOCRA API", "version": "2.0.0", "docs": "/docs"}
  
@app.get("/api")
def api_root():
    return {"message": "UOCRA API", "version": "2.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)