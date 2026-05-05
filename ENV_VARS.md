# UOCRA - Variables de Entorno (.env)

Este documento describe todas las variables de entorno utilizadas en el proyecto UOCRA.

## 📋 Lista Completa de Variables

### Backend (`backend/.env`)

| Variable | Tipo | Defecto | Descripción |
|----------|------|---------|------------|
| `SECRET_KEY` | string | `uocra_secret_key_2024` | Clave secreta para JWT (generar con `openssl rand -hex 32`) |
| `ADMIN_USERNAME` | string | `admin` | Nombre de usuario administrador |
| `ADMIN_PASSWORD` | string | `admin123` | Contraseña del administrador |
| `DEBUG` | bool | `true` | Modo debug (poner `false` en producción) |
| `DATABASE_URL` | string | `sqlite:///./uocra.db` | URL de conexión a la base de datos |
| `ALLOWED_ORIGINS` | string | `http://localhost:5174,http://127.0.0.1:5174` | Orígenes CORS permitidos (separados por coma) |
| `BASE_URL` | string | (vacío) | URL base para generación de QR (se actualiza automáticamente con `start.sh`) |
| `ALGORITHM` | string | `HS256` | Algoritmo JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | int | `1440` (24h) | Tiempo de expiración del token JWT en minutos |
| `CLOUDFLARED_CHECK_INTERVAL` | int | `30` | Intervalo de verificación de Cloudflared en segundos |
| `MAX_FILE_SIZE` | int | `16777216` (16MB) | Tamaño máximo de archivos subidos |
| `UPLOAD_FOLDER` | string | `static/uploads` | Carpeta para subir archivos |
| `PHOTOS_FOLDER` | string | `static/photos` | Carpeta para fotos de trabajadores |

### Frontend (`frontend/.env.development`)

| Variable | Tipo | Defecto | Descripción |
|----------|------|---------|------------|
| `VITE_API_URL` | string | `/api` (tunnel) o `http://IP:8000/api` (WiFi) | URL del backend API (se actualiza automáticamente con `start.sh`) |
| `VITE_BACKEND_URL` | string | `http://127.0.0.1:8000` | URL del backend para Vite proxy |

## 🚀 Generación de SECRET_KEY

```bash
openssl rand -hex 32
```

## 🔧 Ejemplo de `backend/.env` Completo

```env
# Seguridad
SECRET_KEY=09f7e02c6f4a... (generado con openssl)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mi_password_seguro

# Debug
DEBUG=false

# Base de datos
DATABASE_URL=sqlite:///./uocra.db

# CORS
ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174,https://xxx.trycloudflare.com

# URLs
BASE_URL=https://xxx.trycloudflare.com

# Archivos
MAX_FILE_SIZE=16777216
UPLOAD_FOLDER=static/uploads
PHOTOS_FOLDER=static/photos
CLOUDFLARED_CHECK_INTERVAL=30
```

## 📝 Notas Importantes

1. **NUNCA subas `.env` a GitHub** - Ya está en `.gitignore`
2. **Usá `.env.example` como template** - Copiá y renombrad como `.env`
3. **`start.sh` actualiza automáticamente:**
   - `ALLOWED_ORIGINS` con la IP local y URL del tunnel
   - `BASE_URL` con la URL del tunnel (si está disponible)
   - `VITE_API_URL` en el frontend según el modo (tunnel/WiFi)
4. **Para producción:** Poner `DEBUG=false` y cambiar `ADMIN_PASSWORD`
5. **Cloudflare Tunnel:** Requiere `cloudflared` instalado. El script lo detecta automáticamente.

## 🔐 Seguridad

- Cambiar `SECRET_KEY` en producción
- Cambiar `ADMIN_PASSWORD` por una contraseña segura
- No usar valores por defecto en producción
- Mantener `DEBUG=false` en producción


```env
# Security - Generated with openssl rand -hex 32
SECRET_KEY=5f16fadde8e7913ed66fb03d80b60c1aa9664f0331c23181d8ecfaf619427302
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Admin - CHANGE THIS PASSWORD IN PRODUCTION
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Uocra2024!Seguro

# Debug - Set to false in production
DEBUG=true

# Database - SQLite for development, PostgreSQL for production
# For PostgreSQL: postgresql://user:password@localhost:5432/uocra
DATABASE_URL=sqlite:///./uocra.db

# Pool settings (only for PostgreSQL)
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10

# CORS - Allowed origins (comma-separated, no spaces)
ALLOWED_ORIGINS=http://localhost:5173,http://192.168.0.103:5173,https://lone-passengers-phil-numerous.trycloudflare.com

# URLs
BASE_URL=https://lone-passengers-phil-numerous.trycloudflare.com
FRONTEND_URL=https://lone-passengers-phil-numerous.trycloudflare.com

# Cloudflared
CLOUDFLARED_CHECK_INTERVAL=30

# File uploads
MAX_FILE_SIZE=16777216
UPLOAD_FOLDER=static/uploads
PHOTOS_FOLDER=static/photos
LOGOS_FOLDER=static/logos
```

