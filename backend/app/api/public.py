from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import secrets
import io
import urllib
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.config import settings
from app.models.user import QRToken
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

router = APIRouter(tags=["public"])

@router.get("/bienvenido/pdf")
def generar_bienvenido_pdf(db: Session = Depends(get_db)):
    base_url = settings.BASE_URL
    qr_url = f"{base_url}/subir-cv" if base_url else "http://192.168.0.104:5174/subir-cv"
    
    buffer = io.BytesIO()
    page_width, page_height = A4
    c = canvas.Canvas(buffer, pagesize=A4)
    
    # Header azul
    margin_top = 5
    header_h = 95
    padding_top = 30
    center_x = page_width / 2
    
    c.setFillColor(HexColor('#1e3c72'))
    c.rect(0, page_height - (header_h + margin_top), page_width, header_h + margin_top, fill=True, stroke=False)
    
    # Texto header
    top_y = page_height - margin_top - padding_top
    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 26)
    c.drawCentredString(center_x, top_y, 'UOCRA')
    c.setFont('Helvetica', 9)
    c.drawCentredString(center_x, top_y - 11, 'Unión Obrera de la Construcción de la República Argentina')
    c.setFont('Helvetica', 11)
    c.drawCentredString(center_x, top_y - 30, 'Secretario General Z.N.S.C ')
    c.drawCentredString(center_x, top_y - 44, 'Ricardo Treuquil')
    
    # Bienvenido
    c.setFillColor(black)
    base_y = page_height - (header_h + margin_top)
    c.setFont('Helvetica-Bold', 18)
    c.drawCentredString(center_x, base_y - 35, 'Bienvenido')
    c.setFont('Helvetica', 12)
    c.drawCentredString(center_x, base_y - 55, 'Carga tu curriculum vitae y forma parte de')
    c.drawCentredString(center_x, base_y - 70, 'nuestra base de datos de trabajadores')
    
    # Card QR
    card_h = 270
    card_y = base_y - 360
    c.setFillColor(HexColor('#f5f7fa'))
    c.roundRect(50, card_y, page_width - 100, card_h, 16, fill=True, stroke=False)
    c.setFillColor(black)
    c.setFont('Helvetica-Bold', 14)
    c.drawCentredString(center_x, card_y + card_h - 40, 'Escanea el código QR para subir tu CV')
    
    # QR Code
    qr_api_url = f'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={urllib.parse.quote(qr_url)}'
    try:
        with urllib.request.urlopen(qr_api_url, timeout=10) as response:
            qr_data = response.read()
        qr_image = ImageReader(io.BytesIO(qr_data))
        qr_size = 170
        qr_x = center_x - qr_size / 2
        qr_y = card_y + 40
        c.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size, preserveAspectRatio=True)
    except:
        c.setFillColor(white)
        c.roundRect(center_x - 85, card_y + 40, 170, 170, 12, fill=True, stroke=True)
        c.setFillColor(black)
        c.setFont('Helvetica', 10)
        c.drawCentredString(center_x, card_y + 120, 'QR Code')
    
    # Instrucciones
    c.setFont('Helvetica-Bold', 14)
    c.setFillColor(HexColor('#1e3c72'))
    c.drawCentredString(center_x, card_y - 20, '¿Cómo funciona?')
    instrucciones = [
        '1. Escanea el código QR con tu celular',
        '2. Completa tus datos personales',
        '3. Sube una foto tipo carnet (opcional)',
        '4. Un administrador revisará tu información'
    ]
    c.setFont('Helvetica', 11)
    c.setFillColor(black)
    y_pos = card_y - 50
    for ins in instrucciones:
        c.drawCentredString(center_x, y_pos, ins)
        y_pos -= 22
    
    # Footer
    c.setFont('Helvetica', 8)
    c.setFillColor(HexColor('#999999'))
    c.drawCentredString(center_x, 40, 'Generado automáticamente por UOCRA')
    
    c.save()
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type='application/pdf',
        headers={'Content-Disposition': 'attachment; filename=uocra_bienvenida.pdf'}
    )

@router.post("/cvs/generar-token")
def generar_qr_token(db: Session = Depends(get_db)):
    token_str = secrets.token_urlsafe(16)
    
    qr_token = QRToken(
        token=token_str,
        usado=False,
        ip_address="public"
    )
    db.add(qr_token)
    db.commit()
    db.refresh(qr_token)
    
    return {"token": token_str, "success": True}

@router.get("/cvs/validar-token")
def validar_qr_token(token: str = None, db: Session = Depends(get_db)):
    if not token:
        return {"valido": False, "mensaje": "Token requerido"}
    
    qr_token = db.query(QRToken).filter(QRToken.token == token).first()
    
    if not qr_token:
        return {"valido": False, "mensaje": "Token inválido"}
    
    if qr_token.usado:
        return {"valido": False, "mensaje": "Este QR ya fue usado"}
    
    ten_minutes_ago = datetime.now() - timedelta(minutes=10)
    if qr_token.created_at < ten_minutes_ago:
        return {"valido": False, "mensaje": "Este QR ha expirado. Escanee un nuevo QR para reenviar"}
    
    return {"valido": True, "mensaje": "Token válido", "created_at": str(qr_token.created_at)}

@router.post("/cvs/usar-token")
def usar_qr_token(token: str = None, cv_id: int = None, db: Session = Depends(get_db)):
    qr_token = db.query(QRToken).filter(QRToken.token == token).first()
    
    if not qr_token:
        return {"success": False, "mensaje": "Token inválido"}
    
    if qr_token.usado:
        return {"success": False, "mensaje": "Este QR ya fue usado"}
    
    ten_minutes_ago = datetime.now() - timedelta(minutes=10)
    if qr_token.created_at < ten_minutes_ago:
        return {"success": False, "mensaje": "Este QR ha expirado. Escanee un nuevo QR para reenviar"}
    
    qr_token.usado = True
    qr_token.usado_at = datetime.now()
    qr_token.cv_id = cv_id
    db.commit()
    
    return {"success": True, "mensaje": "Token marcado como usado"}
