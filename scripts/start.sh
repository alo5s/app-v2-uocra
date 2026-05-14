#!/bin/bash

# ─────────────────────────────────────
#  UOCRA - Start Script
#  Modo automático: Tunnel o WiFi
# ─────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

IP=$(ip addr show | grep -o 'inet [0-9.]*/' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' | cut -d/ -f1)

TUNNEL_LOG=/tmp/uocra_tunnel.log
BACKEND_LOG=/tmp/uocra_backend.log
FRONTEND_LOG=/tmp/uocra_frontend.log

TUNNEL_URL=""
MODE="wifi"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ─────────────────────────────────────
# Cleanup
# ─────────────────────────────────────

cleanup() {
  echo ""
  echo -e "${RED}🛑 Deteniendo servicios...${NC}"

  [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null && \
    echo -e "${YELLOW}Backend detenido${NC}"

  [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null && \
    echo -e "${YELLOW}Frontend detenido${NC}"

  [ -n "$CLOUDFLARED_PID" ] && kill $CLOUDFLARED_PID 2>/dev/null && \
    echo -e "${YELLOW}Tunnel detenido${NC}"

  echo ""
  exit 0
}

trap cleanup INT TERM

clear
echo ""
echo -e "${GREEN}⏳ Iniciando UOCRA...${NC}"
echo ""

# ─────────────────────────────────────
# Limpiar puertos
# ─────────────────────────────────────

fuser -k 5173/tcp 2>/dev/null || true
fuser -k 8000/tcp 2>/dev/null || true

sleep 1

# ─────────────────────────────────────
# BACKEND
# ─────────────────────────────────────

cd "$ROOT_DIR/backend" || exit 1

if [ ! -d "venv" ]; then
  echo -e "${YELLOW}⚠ No se encontró venv. Creando...${NC}"
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt -q
else
  source venv/bin/activate
fi

if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠ No se encontró .env. Copiando desde .env.example...${NC}"
  cp .env.example .env
  echo -e "${RED}📝 Editá backend/.env con tus credenciales antes de continuar${NC}"
fi

uvicorn app.main:app \
  --reload \
  --host 0.0.0.0 \
  --port 8000 \
  > "$BACKEND_LOG" 2>&1 &

BACKEND_PID=$!

cd "$ROOT_DIR" || exit 1

BACKEND_OK=false

for i in $(seq 1 30); do
  curl -s http://localhost:8000/ > /dev/null 2>&1 && \
    BACKEND_OK=true && break
  sleep 1
done

if [ "$BACKEND_OK" = false ]; then
  clear
  echo ""
  echo -e "${RED}❌ ERROR: El backend no pudo iniciar${NC}"
  echo ""
  echo "Últimas líneas del error:"
  echo "─────────────────────────"
  tail -10 "$BACKEND_LOG" | sed 's/^/  /'
  echo ""
  echo -e "${YELLOW}Ver log completo:${NC}"
  echo "cat $BACKEND_LOG"
  echo ""
  exit 1
fi

# ─────────────────────────────────────
# FRONTEND
# ─────────────────────────────────────

cd "$ROOT_DIR/frontend" || exit 1

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠ No se encontraron node_modules. Instalando...${NC}"
  npm install -q
fi

# limpiar env viejo que genera conflictos
rm -f .env.development

echo "VITE_BACKEND_URL=http://127.0.0.1:8000" > .env.development
echo "VITE_API_URL=/api" >> .env.development

npm run dev -- \
  --host 0.0.0.0 \
  --port 5173 \
  --strictPort \
  > "$FRONTEND_LOG" 2>&1 &

FRONTEND_PID=$!

cd "$ROOT_DIR" || exit 1

FRONTEND_OK=false

for i in $(seq 1 30); do
  curl -s http://localhost:5173/ > /dev/null 2>&1 && \
    FRONTEND_OK=true && break
  sleep 1
done

if [ "$FRONTEND_OK" = false ]; then
  clear
  echo ""
  echo -e "${RED}❌ ERROR: El frontend no pudo iniciar${NC}"
  echo ""
  echo "Últimas líneas del error:"
  echo "─────────────────────────"
  tail -10 "$FRONTEND_LOG" | sed 's/^/  /'
  echo ""
  echo -e "${YELLOW}Ver log completo:${NC}"
  echo "cat $FRONTEND_LOG"
  echo ""

  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

# ─────────────────────────────────────
# Cloudflare Tunnel (Dominio personalizado)
# ─────────────────────────────────────

# Copiar config de cloudflared al proyecto si no existe
if [ ! -f "$ROOT_DIR/.cloudflared/config.yml" ]; then
    mkdir -p "$ROOT_DIR/.cloudflared"
    cp ~/.cloudflared/config.yml "$ROOT_DIR/.cloudflared/config.yml" 2>/dev/null || true
    cp ~/.cloudflared/*.json "$ROOT_DIR/.cloudflared/" 2>/dev/null || true
fi

# Asegurar que el archivo de credenciales sea legible
if [ -f "/home/alos/.cloudflared/config.yml" ]; then
    CLOUDFLARED_CONFIG="--config /home/alos/.cloudflared/config.yml"
fi

if command -v cloudflared &> /dev/null; then
    rm -f "$TUNNEL_LOG"
    
    # Usar el túnel configurado con el dominio personalizado
    cloudflared tunnel run $CLOUDFLARED_CONFIG \
      > "$TUNNEL_LOG" 2>&1 &
    
    CLOUDFLARED_PID=$!
    
    # Verificar que el túnel esté corriendo
    sleep 5
    
    # Verificar si el proceso sigue activo
    if kill -0 $CLOUDFLARED_PID 2>/dev/null; then
        MODE="tunnel"
        TUNNEL_URL="https://uocra-las-heras.org"
    else
        echo -e "${RED}❌ ERROR: El túnel no pudo iniciar${NC}"
        tail -10 "$TUNNEL_LOG" 2>/dev/null | sed 's/^/  /'
    fi
fi

# ─────────────────────────────────────
# Actualizar backend/.env
# ─────────────────────────────────────

# ─────────────────────────────
# Actualizar backend/.env - TODAS las variables
# ─────────────────────────────

update_env_var() {
  local var=$1
  local value=$2
  local file="$ROOT_DIR/backend/.env"
  
  # Escapar caracteres especiales para sed
  value_escaped=$(echo "$value" | sed 's/[\/&]/\\&/g')
    
  if grep -q "^$var=" "$file" 2>/dev/null; then
    sed -i "s|^$var=.*|$var=$value_escaped|" "$file"
  else
    echo "$var=$value_escaped" >> "$file"
  fi
}

if [ "$MODE" = "tunnel" ]; then
  BASE_URL="$TUNNEL_URL"
  FRONTEND_URL="$TUNNEL_URL"
  ALLOWED_ORIGINS="http://localhost:5173,http://$IP:5173,$TUNNEL_URL"
else
  BASE_URL="http://$IP:5173"
  FRONTEND_URL="http://$IP:5173"
  ALLOWED_ORIGINS="http://localhost:5173,http://$IP:5173"
fi

update_env_var "BASE_URL" "$BASE_URL"
update_env_var "FRONTEND_URL" "$FRONTEND_URL"
update_env_var "ALLOWED_ORIGINS" "$ALLOWED_ORIGINS"

# Frontend .env.development
cat > "$ROOT_DIR/frontend/.env.development" << EOF
VITE_BACKEND_URL=http://127.0.0.1:8000
VITE_API_URL=/api
EOF

# Forzar reload backend (uvicorn --reload detecta el cambio)
touch "$ROOT_DIR/backend/app/main.py"
sleep 2

# ─────────────────────────────────────
# RESUMEN FINAL
# ─────────────────────────────────────

clear
echo ""

if [ "$MODE" = "tunnel" ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}🌐 MODO: TUNNEL PÚBLICO (Cloudflare)${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Backend local:   http://$IP:8000"
  echo "Frontend local:  http://$IP:5173"
  echo "API docs:        http://$IP:8000/docs"
  echo ""
  echo -e "${GREEN}Tunnel público:${NC} $TUNNEL_URL"
  echo -e "${GREEN}QR PDF apunta a:${NC} $TUNNEL_URL/api/public/bienvenido/pdf"
  echo -e "${GREEN}QR redirect apunta a:${NC} $TUNNEL_URL/subir-cv"
  echo ""
  echo -e "${GREEN}📱 Accesible desde cualquier dispositivo${NC}"
  echo -e "${GREEN}(no necesita misma WiFi)${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}📶 MODO: RED LOCAL WiFi${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Backend:   http://$IP:8000"
  echo "Frontend:  http://$IP:5173"
  echo "API docs:  http://$IP:8000/docs"
  echo ""
  echo -e "${YELLOW}QR PDF:${NC} http://$IP:8000/api/public/bienvenido/pdf"
  echo -e "${YELLOW}QR redirect:${NC} http://$IP:5173/subir-cv"
  echo ""
  echo -e "${YELLOW}📱 Solo misma red WiFi${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

echo ""
# Leer credenciales REALES del .env
ADMIN_USER=$(grep "^ADMIN_USERNAME=" "$ROOT_DIR/backend/.env" 2>/dev/null | cut -d= -f2)
ADMIN_PASS=$(grep "^ADMIN_PASSWORD=" "$ROOT_DIR/backend/.env" 2>/dev/null | cut -d= -f2)

echo -e "${YELLOW}🔑 Usuario:${NC} ${ADMIN_USER:-admin}"
echo -e "${YELLOW}🔑 Contraseña:${NC} ${ADMIN_PASS:-[configurada en .env]}"
echo ""
echo -e "${RED}Ctrl + C para detener todo${NC}"
echo ""

wait $BACKEND_PID $FRONTEND_PID
