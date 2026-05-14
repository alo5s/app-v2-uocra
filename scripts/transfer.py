#!/usr/bin/env python3
"""
UOCRA - Script de Transferencia de Archivos
Sirve para compartir el proyecto entre PCs de forma simple.
"""

import os
import sys
import zipfile
import shutil
import socket
import threading
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
import argparse


PROJECT_ROOT = Path(__file__).parent.parent.absolute()
EXCLUDE_DIRS = {
    'backend/__pycache__',
    'backend/venv',
    'backend/*.pyc',
    'frontend/node_modules',
    'frontend/dist',
    'frontend/.vite',
    '.git',
    '.cloudflared',
    '__pycache__',
    '*.pyc',
    '*.pyo',
    '*.log',
    '.DS_Store',
    'Thumbs.db',
}


def get_local_ip():
    """Obtiene la IP local de la máquina."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def should_exclude(path):
    """Verifica si un path debe ser excluido."""
    path_str = str(path)
    for exclude in EXCLUDE_DIRS:
        if exclude.startswith('*'):
            if path_str.endswith(exclude[1:]):
                return True
        elif exclude in path_str:
            return True
    return False


def create_zip_archive(output_path=None):
    """Crea un archivo ZIP con el proyecto."""
    if output_path is None:
        output_path = PROJECT_ROOT / f"uocra-app-backup.zip"

    print(f"📦 Creando archivo ZIP en: {output_path}")
    print(f"   Proyecto: {PROJECT_ROOT}")

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(PROJECT_ROOT):
            # Filtrar directorios a excluir
            dirs[:] = [d for d in dirs if not should_exclude(Path(root) / d)]

            for file in files:
                file_path = Path(root) / file
                if should_exclude(file_path):
                    continue

                arcname = file_path.relative_to(PROJECT_ROOT)
                zipf.write(file_path, arcname)
                print(f"   ✓ {arcname}")

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\n✅ Archivo creado: {output_path} ({size_mb:.2f} MB)")
    return output_path


class TransferHandler(SimpleHTTPRequestHandler):
    """Manejador personalizado para el servidor de transferencia."""

    def log_message(self, format, *args):
        """Override para logs más limpios."""
        print(f"   [{self.address_string()}] {format % args}")

    def do_GET(self):
        """Sirve archivos y muestra página de descarga."""
        if self.path == '/' or self.path == '/index.html':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()

            html = f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UOCRA - Descarga de Archivos</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #1e3c72;
            color: white;
            border-radius: 10px;
        }}
        h1 {{ text-align: center; }}
        .download-btn {{
            display: block;
            width: 100%;
            padding: 20px;
            background: #2ecc71;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-size: 18px;
            text-align: center;
            margin: 20px 0;
        }}
        .download-btn:hover {{
            background: #27ae60;
        }}
        .info {{
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
        }}
    </style>
</head>
<body>
    <h1>📥 UOCRA - Descarga de Archivos</h1>

    <div class="info">
        <strong>📁 Proyecto:</strong> uocra-app<br>
        <strong>💻 Servido desde:</strong> {socket.gethostname()}<br>
        <strong>🌐 IP del servidor:</strong> {get_local_ip()}
    </div>

    <a href="/uocra-app.zip" class="download-btn">⬇️ DESCARGAR PROYECTO COMPLETO (.zip)</a>

    <div class="info">
        <strong>📝 Instrucciones:</strong><br>
        1. Haz clic en el botón de arriba para descargar<br>
        2. Descomprime el archivo ZIP<br>
        3. Sigue las instrucciones del README.md
    </div>
</body>
</html>
            """
            self.wfile.write(html.encode())
        else:
            # Servir archivos existentes
            super().do_GET()

    def do_POST(self):
        """Maneja subida de archivos."""
        content_length = int(self.headers['Content-Length'])

        if self.path == '/upload':
            try:
                content = self.rfile.read(content_length)

                # Parsear el contenido multipart
                boundary = self.headers['Content-Type'].split('boundary=')[1].encode()
                parts = content.split(b'--' + boundary)

                for part in parts:
                    if b'filename=' in part:
                        filename_start = part.find(b'filename="') + 10
                        filename_end = part.find(b'"', filename_start)
                        filename = part[filename_start:filename_end].decode()

                        data_start = part.find(b'\r\n\r\n') + 4
                        data_end = part.rfind(b'\r\n--')
                        file_data = part[data_start:data_end]

                        save_path = PROJECT_ROOT / filename
                        with open(save_path, 'wb') as f:
                            f.write(file_data)

                        print(f"   📤 Archivo recibido: {filename}")

                self.send_response(200)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'Archivo subido correctamente')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(f'Error: {str(e)}'.encode())


def start_server(port=8080, zip_path=None):
    """Inicia el servidor HTTP para transferencia."""
    if zip_path is None:
        zip_path = PROJECT_ROOT / "uocra-app.zip"

    # Crear ZIP si no existe
    if not zip_path.exists():
        create_zip_archive(zip_path)

    os.chdir(PROJECT_ROOT)

    server_address = ('', port)
    httpd = HTTPServer(server_address, TransferHandler)

    local_ip = get_local_ip()

    print("\n" + "="*60)
    print("🌐 SERVIDOR DE TRANSFERENCIA INICIADO")
    print("="*60)
    print(f"\n📍 Para DESCARGAR desde otra PC:")
    print(f"   http://{local_ip}:{port}")
    print(f"\n📍 Desde ESTA PC:")
    print(f"   http://localhost:{port}")
    print(f"\n📦 Archivo ZIP disponible:")
    print(f"   {zip_path}")
    print("\n⚠️  Presiona Ctrl+C para detener el servidor")
    print("="*60 + "\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Servidor detenido")
        httpd.shutdown()


def sync_to_remote(remote_host, remote_path, ssh_user=None):
    """Sincroniza el proyecto a un servidor remoto via rsync."""
    import subprocess

    if ssh_user:
        remote_dest = f"{ssh_user}@{remote_host}:{remote_path}"
    else:
        remote_dest = f"{remote_host}:{remote_path}"

    exclude_opts = []
    for exclude in EXCLUDE_DIRS:
        exclude_opts.extend(['--exclude', exclude])

    cmd = ['rsync', '-avz', '--progress'] + exclude_opts + [
        str(PROJECT_ROOT) + '/',
        remote_dest
    ]

    print(f"🔄 Sincronizando con {remote_host}...")
    print(f"   Comando: {' '.join(cmd)}")

    try:
        subprocess.run(cmd)
        print("✅ Sincronización completada")
    except FileNotFoundError:
        print("❌ rsync no está instalado")
    except Exception as e:
        print(f"❌ Error: {e}")


def main():
    parser = argparse.ArgumentParser(description='UOCRA - Transferencia de Archivos')
    parser.add_argument('--zip', action='store_true', help='Solo crear ZIP')
    parser.add_argument('--port', type=int, default=8080, help='Puerto del servidor (default: 8080)')
    parser.add_argument('--output', type=str, help='Ruta del archivo ZIP de salida')
    parser.add_argument('--sync', type=str, metavar='HOST', help='Sincronizar a servidor remoto')
    parser.add_argument('--remote-path', type=str, default='~/uocra-app', help='Ruta remota para sync')
    parser.add_argument('--ssh-user', type=str, help='Usuario SSH para sync')

    args = parser.parse_args()

    if args.zip:
        output_path = Path(args.output) if args.output else None
        create_zip_archive(output_path)
    elif args.sync:
        sync_to_remote(args.sync, args.remote_path, args.ssh_user)
    else:
        print("\n🔧 UOCRA - Herramienta de Transferencia")
        print("="*50)
        print("\n📌 Opciones disponibles:")
        print("\n   1. Crear archivo ZIP del proyecto")
        print("      python3 transfer.py --zip")
        print("\n   2. Iniciar servidor de descarga (otra PC puede bajar el ZIP)")
        print("      python3 transfer.py --port 8080")
        print("\n   3. Sincronizar con servidor remoto (requiere rsync)")
        print("      python3 transfer.py --sync 192.168.1.100 --remote-path ~/uocra-app")
        print("\n" + "="*50 + "\n")

        # Por defecto, iniciar servidor de descarga
        start_server(port=args.port)


if __name__ == '__main__':
    main()