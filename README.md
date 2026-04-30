# UOCRA - Sistema de Gestión de CVs

## Descripción
Panel de administración para gestión de CVs de trabajadores de la construcción (UOCRA). Permite administrar trabajadores, empresas y documentos con portal público via QR.

## Stack
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy, SQLite
- **Frontend:** React 18, Vite, TailwindCSS, Zustand
- **Tunnel:** Cloudflare Tunnel (acceso público)

## Requisitos
- Python 3.11+
- Node.js 18+
- tesseract-ocr instalado en el sistema
- cloudflared instalado (opcional, para acceso público)

## Instalación

### 1. Clonar el repo
```bash
git clone https://github.com/alo5s/uocra-app.git
cd uocra-app
```

### 2. Configurar backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env
# Editá .env con tus credenciales
```

### 3. Configurar frontend
```bash
cd ../frontend
npm install
```

### 4. Arrancar
```bash
cd ..
./scripts/start.sh
```

## Uso
El script `start.sh` detecta automáticamente si `cloudflared` está instalado y elige el modo:
- **TUNNEL:** acceso público via `https://xxx.trycloudflare.com`
- **WiFi:** acceso local via IP de la red

## Estructura

```
uocra-app/
├── backend/              # FastAPI
│   ├── app/
│   │   ├── api/         # Endpoints REST
│   │   ├── core/        # Config, DB, Security
│   │   ├── models/      # Modelos SQLAlchemy
│   │   └── utils/       # Utilidades
│   └── requirements.txt
├── frontend/             # React + Vite
│   ├── src/
│   │   ├── api/        # Client axios
│   │   ├── components/ # Componentes
│   │   ├── pages/      # Vistas
│   │   ├── store/      # Zustand stores
│   │   └── types/      # TypeScript types
│   └── package.json
├── scripts/              # Scripts de inicio
│   └── start.sh
└── README.md
```

## Funcionalidades

- ✅ Login/Logout con JWT
- ✅ Dashboard con estadísticas
- ✅ Gestión de CVs (CRUD)
- ✅ Aprobar/Rechazar CVs pendientes
- ✅ Gestión de Empresas
- ✅ Gestión de Usuarios (Admin)
- ✅ Notas/Documentos
- ✅ Historial de actividad
- ✅ Notificaciones
- ✅ Portal público para subir CVs (QR)

## Tecnologías

- **Backend:** FastAPI, SQLAlchemy, Pydantic, JWT
- **Frontend:** React 18, Vite, TailwindCSS, Zustand, Axios
- **Database:** SQLite (fácil migrar a PostgreSQL)

## Credenciales por defecto

- **Usuario:** admin
- **Contraseña:** admin123

⚠️ **IMPORTANTE:** Cambiar estas credenciales en `backend/.env` antes de producción.

## Licencia

UOCRA - Unión Obrera de la Construcción de la República Argentina
