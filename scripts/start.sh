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
# Cloudflare Tunnel
# ─────────────────────────────────────

if command -v cloudflared &> /dev/null; then
  rm -f "$TUNNEL_LOG"

  cloudflared tunnel \
    --url http://127.0.0.1:5173 \
    --no-autoupdate \
    > "$TUNNEL_LOG" 2>&1 &

  CLOUDFLARED_PID=$!

  for i in $(seq 1 30); do
    TUNNEL_URL=$(grep -o \
      'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' \
      "$TUNNEL_LOG" | head -1)

    [ -n "$TUNNEL_URL" ] && break
    sleep 1
  done

  if [ -n "$TUNNEL_URL" ]; then
    MODE="tunnel"
  else
    kill $CLOUDFLARED_PID 2>/dev/null
  fi
fi

# ─────────────────────────────────────
# Actualizar backend/.env
# ─────────────────────────────────────

if [ "$MODE" = "tunnel" ]; then
  BASE_URL="$TUNNEL_URL"
  ALLOWED_ORIGINS="http://localhost:5173,http://$IP:5173,$TUNNEL_URL"
else
  BASE_URL="http://$IP:5173"
  ALLOWED_ORIGINS="http://localhost:5173,http://$IP:5173"
fi

grep -q "^BASE_URL=" "$ROOT_DIR/backend/.env" && \
  sed -i "s|^BASE_URL=.*|BASE_URL=$BASE_URL|" "$ROOT_DIR/backend/.env" || \
  echo "BASE_URL=$BASE_URL" >> "$ROOT_DIR/backend/.env"

grep -q "^ALLOWED_ORIGINS=" "$ROOT_DIR/backend/.env" && \
  sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$ALLOWED_ORIGINS|" "$ROOT_DIR/backend/.env" || \
  echo "ALLOWED_ORIGINS=$ALLOWED_ORIGINS" >> "$ROOT_DIR/backend/.env"

# forzar reload backend
touch "$ROOT_DIR/backend/app/main.py"
sleep 2

# ─────────────────────────────────────
# RESUMEN FINAL
# ─────────────────────────────────────

clear
echo ""

if [ "$MODE" = "tunnel" ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}🌐 MODO: TUNNEL PÚBLICO (Cloudflare)${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Backend local:   http://$IP:8000"
  echo "Frontend local:  http://$IP:5173"
  echo "API docs:        http://$IP:8000/docs"
  echo ""
  echo -e "${GREEN}Tunnel público:${NC} $TUNNEL_URL"
  echo -e "${GREEN}QR apunta a:${NC} $TUNNEL_URL/bienvenido"
  echo ""
  echo -e "${GREEN}📱 Accesible desde cualquier dispositivo${NC}"
  echo -e "${GREEN}(no necesita misma WiFi)${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}📶 MODO: RED LOCAL WiFi${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Backend:   http://$IP:8000"
  echo "Frontend:  http://$IP:5173"
  echo "API docs:  http://$IP:8000/docs"
  echo ""
  echo -e "${YELLOW}QR:${NC} http://$IP:5173/bienvenido"
  echo ""
  echo -e "${YELLOW}📱 Solo misma red WiFi${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

echo ""
echo -e "${YELLOW}🔑 Usuario:${NC} admin"
echo -e "${YELLOW}🔑 Contraseña:${NC} admin123"
echo ""
echo -e "${RED}Ctrl + C para detener todo${NC}"
echo ""

wait $BACKEND_PID $FRONTEND_PID
