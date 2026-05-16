import os
import re
import shutil
import string
import random
from datetime import datetime
from typing import Optional, List
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Body
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import CV, User, Historial, Notificacion, CVEmpresa, Empresa
from app.schemas.schemas import (
    CVCreate, CVUpdate, CVResponse, CVPublicCreate, MessageResponse
)
from app.utils.pdf_extractor import extraer_datos_cv, guardar_pdf_temp, limpiar_temp
from app.utils.validators import sanitize_input, validate_file_size, allowed_file, validate_pdf_content, validate_image_content

router = APIRouter(prefix="/cvs", tags=["cvs"])


def sanitize_input(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    text = re.sub(r'[<>]', '', text)
    return text.strip()


def get_upload_path() -> str:
    ahora = datetime.now()
    carpeta = os.path.join('static', 'uploads', str(ahora.year), f'{ahora.month:02d}')
    os.makedirs(carpeta, exist_ok=True)
    return carpeta


def get_temp_path() -> str:
    carpeta = os.path.join('static', 'temp')
    os.makedirs(carpeta, exist_ok=True)
    return carpeta


def get_photos_path() -> str:
    carpeta = os.path.join('static', 'photos')
    os.makedirs(carpeta, exist_ok=True)
    return carpeta


def guardar_pdf_temp(file: UploadFile) -> tuple[str, str]:
    carpeta = get_temp_path()
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    filename = f"temp_{timestamp}_{random_str}.pdf"
    filepath = os.path.join(carpeta, filename)
    
    with open(filepath, 'wb') as f:
        shutil.copyfileobj(file.file, f)
    
    return filepath, filename


def mover_pdf_a_uploads(temp_path: str, dni: str = '') -> str:
    carpeta = get_upload_path()
    ahora = datetime.now()
    
    if dni:
        nombre_limpio = sanitize_input(dni) or ''
        new_filename = f"{nombre_limpio}_{ahora.strftime('%Y%m%d_%H%M')}.pdf"
    else:
        safe = os.path.basename(temp_path).replace('.pdf', '')
        new_filename = f"{safe}_{ahora.strftime('%Y%m%d_%H%M')}.pdf"
    
    new_path = os.path.join(carpeta, new_filename)
    shutil.move(temp_path, new_path)
    return new_path


def procesar_archivo_a_pdf(file: UploadFile, temp_path: str, dni: str, timestamp: str) -> str:
    """Procesa un archivo (PDF o imagen) y lo convierte a PDF si es necesario"""
    ext = file.filename.lower().split('.')[-1] if file.filename else 'pdf'
    
    if ext in ['jpg', 'jpeg', 'png']:
        imagen_temp = temp_path.replace('.pdf', f'.{ext}')
        with open(imagen_temp, 'wb') as f:
            shutil.copyfileobj(file.file, f)
        
        pdf_path = temp_path
        convertir_imagen_a_pdf(imagen_temp, pdf_path)
        
        try:
            os.remove(imagen_temp)
        except:
            pass
        
        return pdf_path
    else:
        with open(temp_path, 'wb') as f:
            shutil.copyfileobj(file.file, f)
        return temp_path


def registrar_historial(db: Session, accion: str, tipo: str, descripcion: str, entidad_id: int = None, user_id: int = None):
    historial = Historial(
        accion=accion,
        tipo=tipo,
        descripcion=descripcion,
        entidad_id=entidad_id,
        user_id=user_id
    )
    db.add(historial)
    db.commit()


def crear_notificacion(db: Session, tipo: str, titulo: str, mensaje: str, user_id: int = None):
    from datetime import datetime
    
    notificacion = Notificacion(
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        user_id=user_id,
        fecha=datetime.now()
    )
    db.add(notificacion)
    db.commit()
    db.refresh(notificacion)


def crear_notificacion_a_todos_admin(db: Session, tipo: str, titulo: str, mensaje: str):
    admins = db.query(User).filter(User.is_admin == True, User.is_active == True).all()
    for admin in admins:
        notificacion = Notificacion(
            tipo=tipo,
            titulo=titulo,
            mensaje=mensaje,
            user_id=admin.id
        )
        db.add(notificacion)
    db.commit()


# ==================== ENDPOINTS ====================

@router.get("", response_model=dict)
def get_cvs(
    nombre: str = Query(None),
    categoria: str = Query(None),
    oficio: str = Query(None),
    genero: str = Query(None),
    afiliado: str = Query(None),
    sin_experiencia: bool = Query(None),
    empresa: int = Query(None),
    estado: str = Query("aprobado"),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(CV).filter(CV.estado == estado)
    
    if nombre:
        search = f"%{nombre}%"
        query = query.filter(
            or_(
                CV.nombre.ilike(search),
                CV.dni.ilike(search)
            )
        )
    if categoria:
        query = query.filter(CV.area == categoria)
    if oficio:
        search_oficio = f"%{oficio}%"
        query = query.filter(CV.oficios.ilike(search_oficio))
    if genero:
        query = query.filter(CV.genero == genero)
    if afiliado:
        query = query.filter(CV.afiliado == afiliado)
    if sin_experiencia:
        cv_con_empresa = db.query(CVEmpresa.cv_id).distinct().subquery()
        query = query.filter(
            CV.sin_experiencia == True,
            ~CV.id.in_(cv_con_empresa)
        )
    if empresa:
        query = query.join(CVEmpresa).filter(CVEmpresa.empresa_id == empresa)
    
    total = query.count()
    cvs = query.order_by(CV.id.desc()).offset((page - 1) * per_page).limit(per_page).all()
    
    return {
        "items": [CVResponse.model_validate(cv) for cv in cvs],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page
    }


@router.get("/{cv_id}", response_model=CVResponse)
def get_cv(
    cv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV no encontrado")
    return CVResponse.model_validate(cv)


@router.post("", response_model=CVResponse)
def create_cv(
    file: UploadFile = File(None),
    nombre: str = Form(None),
    dni: str = Form(None),
    fecha_nacimiento: str = Form(None),
    genero: str = Form(None),
    domicilio: str = Form(None),
    email: str = Form(None),
    telefono: str = Form(None),
    oficios: str = Form(None),
    area: str = Form(None),
    afiliado: str = Form("no"),
    fue_afiliado: str = Form("false"),
    apodo: str = Form(None),
    sin_experiencia: str = Form("false"),
    tiene_documentacion: str = Form("false"),
    tiene_licencia: str = Form("false"),
    linea_conducir: str = Form(None),
    modo_deteccion: str = Form("automatico"),
    foto: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear CV")
    
    final_path = None
    foto_final = None
    filename = None
    
    if file and allowed_file(file.filename):
        validate_file_size(file, settings.MAX_FILE_SIZE)
        temp_dir = get_temp_path()
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        safe_dni = sanitize_input(dni) or 'cv'
        pdf_filename = f"{safe_dni}_{timestamp}.pdf"
        temp_path = os.path.join(temp_dir, pdf_filename)
        
        temp_path = procesar_archivo_a_pdf(file, temp_path, safe_dni, timestamp)
        filename = file.filename
        final_path = mover_pdf_a_uploads(temp_path, safe_dni)
    
    foto_final = None
    if foto and foto.filename:
        photos_folder = get_photos_path()
        os.makedirs(photos_folder, exist_ok=True)
        ext = foto.filename.rsplit('.', 1)[1].lower() if '.' in foto.filename else 'jpg'
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        foto_filename = f"foto_{dni or timestamp}_{timestamp}.{ext}"
        foto_path = os.path.join(photos_folder, foto_filename)
        
        with open(foto_path, 'wb') as f:
            shutil.copyfileobj(foto.file, f)
        
        # Validar que sea una imagen real
        if not validate_image_content(foto_path):
            os.remove(foto_path)
            raise HTTPException(status_code=400, detail="El archivo de foto no es una imagen válida")
        
        foto_final = f"static/photos/{foto_filename}"
    
    fue_afiliado_bool = fue_afiliado.lower() == "true" if fue_afiliado else False
    sin_experiencia_bool = sin_experiencia.lower() == "true" if sin_experiencia else False
    tiene_documentacion_bool = tiene_documentacion.lower() == "true" if tiene_documentacion else False
    tiene_licencia_bool = tiene_licencia.lower() == "true" if tiene_licencia else False
    
    cv = CV(
        filename=sanitize_input(filename),
        path=sanitize_input(final_path),
        nombre=sanitize_input(nombre),
        dni=sanitize_input(dni),
        fecha_nacimiento=sanitize_input(fecha_nacimiento),
        genero=sanitize_input(genero),
        domicilio=sanitize_input(domicilio),
        email=sanitize_input(email),
        telefono=sanitize_input(telefono),
        oficios=sanitize_input(oficios),
        area=sanitize_input(area),
        foto=foto_final,
        afiliado=afiliado,
        fue_afiliado=fue_afiliado_bool,
        apodo=sanitize_input(apodo),
        sin_experiencia=sin_experiencia_bool,
        tiene_documentacion=tiene_documentacion_bool,
        tiene_licencia=tiene_licencia_bool,
        linea_conducir=sanitize_input(linea_conducir),
        modo_deteccion=modo_deteccion,
        estado='aprobado',
        origen='web',
        user_id=current_user.id
    )
    
    db.add(cv)
    db.commit()
    db.refresh(cv)
    
    registrar_historial(db, 'crear', 'CV', f'Creó CV: {nombre or "Sin nombre"}', cv.id, current_user.id)
    crear_notificacion(db, 'cv', 'Nuevo CV', f'Se agregó un nuevo CV: {nombre or "Sin nombre"}')
    
    return CVResponse.model_validate(cv)


@router.put("/{cv_id}", response_model=CVResponse)
def update_cv(
    cv_id: int,
    nombre: str = Form(None),
    dni: str = Form(None),
    fecha_nacimiento: str = Form(None),
    genero: str = Form(None),
    domicilio: str = Form(None),
    email: str = Form(None),
    telefono: str = Form(None),
    oficios: str = Form(None),
    area: str = Form(None),
    afiliado: str = Form(None),
    fue_afiliado: bool = Form(None),
    apodo: str = Form(None),
    sin_experiencia: bool = Form(None),
    tiene_documentacion: bool = Form(None),
    tiene_licencia: bool = Form(None),
    linea_conducir: str = Form(None),
    modo_deteccion: str = Form(None),
    estado: str = Form(None),
    foto: UploadFile = File(None),
    activo: bool = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar CV")
    
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV no encontrado")
    
    if nombre is not None:
        cv.nombre = sanitize_input(nombre)
    if dni is not None:
        cv.dni = sanitize_input(dni)
    if fecha_nacimiento is not None:
        cv.fecha_nacimiento = sanitize_input(fecha_nacimiento)
    if genero is not None:
        cv.genero = sanitize_input(genero)
    if domicilio is not None:
        cv.domicilio = sanitize_input(domicilio)
    if email is not None:
        cv.email = sanitize_input(email)
    if telefono is not None:
        cv.telefono = sanitize_input(telefono)
    if oficios is not None:
        cv.oficios = sanitize_input(oficios)
    if area is not None:
        cv.area = sanitize_input(area)
    if afiliado is not None:
        cv.afiliado = afiliado
    if fue_afiliado is not None:
        cv.fue_afiliado = fue_afiliado
    if apodo is not None:
        cv.apodo = sanitize_input(apodo)
    if sin_experiencia is not None:
        cv.sin_experiencia = sin_experiencia
    if tiene_documentacion is not None:
        cv.tiene_documentacion = tiene_documentacion
    if linea_conducir is not None:
        cv.linea_conducir = sanitize_input(linea_conducir)
    if modo_deteccion is not None:
        cv.modo_deteccion = modo_deteccion
    if estado is not None:
        cv.estado = estado
    if tiene_licencia is not None:
        cv.tiene_licencia = tiene_licencia
    if activo is not None:
        cv.activo = activo
    
    if foto and foto.filename:
        photos_folder = get_photos_path()
        os.makedirs(photos_folder, exist_ok=True)
        ext = foto.filename.rsplit('.', 1)[1].lower() if '.' in foto.filename else 'jpg'
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        foto_filename = f"foto_{cv.dni or cv.id}_{timestamp}.{ext}"
        foto_path = os.path.join(photos_folder, foto_filename)
        
        with open(foto_path, 'wb') as f:
            shutil.copyfileobj(foto.file, f)
        
        # Validar que sea una imagen real
        if not validate_image_content(foto_path):
            os.remove(foto_path)
            raise HTTPException(status_code=400, detail="El archivo de foto no es una imagen válida")
        
        # Eliminar foto anterior si existe
        if cv.foto and os.path.exists(foto_path.replace('static/photos', photos_folder)):
            try:
                old_path = os.path.join(photos_folder, os.path.basename(cv.foto))
                if os.path.exists(old_path):
                    os.remove(old_path)
            except:
                pass
        
        cv.foto = f"static/photos/{foto_filename}"
    
    db.commit()
    db.refresh(cv)
    
    action = "aprobar" if estado == "aprobado" else "editar"
    registrar_historial(db, action, 'CV', f'Editó/Aprobó CV: {cv.nombre}', cv.id, current_user.id)
    
    if estado == "aprobado":
        crear_notificacion_a_todos_admin(db, 'cv', 'CV Aprobado', f'El CV de {cv.nombre} ha sido aprobado.')
    
    return CVResponse.model_validate(cv)


@router.delete("/{cv_id}", response_model=MessageResponse)
def delete_cv(
    cv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar CV")
    
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV no encontrado")
    
    nombre_cv = cv.nombre
    base_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.join(base_dir, '..', '..')
    
    if cv.path:
        path = os.path.join(base_dir, cv.path)
        if os.path.exists(path):
            os.remove(path)
    if cv.foto:
        foto_path = os.path.join(base_dir, cv.foto)
        try:
            if os.path.exists(foto_path):
                os.remove(foto_path)
        except:
            pass
    
    db.delete(cv)
    db.commit()
    
    registrar_historial(db, 'eliminar', 'CV', f'Eliminó CV: {nombre_cv}', user_id=current_user.id)
    crear_notificacion(db, 'cv', 'CV Eliminado', f'Se eliminó el CV: {nombre_cv}')
    
    return MessageResponse(message="CV eliminado exitosamente")


@router.post("/{cv_id}/aprobar", response_model=CVResponse)
def aprobar_cv(
    cv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV no encontrado")
    
    # Si es actualización, eliminar el CV anterior
    if cv.cv_anterior_id:
        cv_anterior = db.query(CV).filter(CV.id == cv.cv_anterior_id).first()
        if cv_anterior:
            # Eliminar archivos del CV anterior
            if cv_anterior.path:
                old_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', cv_anterior.path)
                try:
                    if os.path.exists(old_path):
                        os.remove(old_path)
                except:
                    pass
            if cv_anterior.foto:
                old_foto = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', cv_anterior.foto)
                try:
                    if os.path.exists(old_foto):
                        os.remove(old_foto)
                except:
                    pass
            db.delete(cv_anterior)
    
    cv.estado = "aprobado"
    db.commit()
    db.refresh(cv)
    
    crear_notificacion_a_todos_admin(db, 'cv', 'CV Aprobado', f'El CV de {cv.nombre} ha sido aprobado.')
    registrar_historial(db, 'aprobar', 'CV', f'Aprobó CV: {cv.nombre}', cv.id, current_user.id)
    
    return CVResponse.model_validate(cv)


@router.post("/{cv_id}/rechazar", response_model=MessageResponse)
def rechazar_cv(
    cv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV no encontrado")
    
    nombre_cv = cv.nombre
    
    if cv.path and os.path.exists(cv.path):
        os.remove(cv.path)
    if cv.foto and os.path.exists(cv.foto):
        try:
            os.remove(cv.foto)
        except:
            pass
    
    db.delete(cv)
    db.commit()
    
    crear_notificacion_a_todos_admin(db, 'cv', 'CV Rechazado', f'El CV de {nombre_cv} ha sido rechazado y eliminado.')
    
    return MessageResponse(message=f"CV de {nombre_cv} rechazado y eliminado")


@router.post("/public", response_model=MessageResponse)
def crear_cv_publico(
    nombre: str = Form(...),
    apellido: str = Form(...),
    dni: str = Form(None),
    fecha_nacimiento: str = Form(None),
    telefono: str = Form(None),
    email: str = Form(None),
    domicilio: str = Form(None),
    oficios: str = Form(None),
    file: UploadFile = File(None),
    foto: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    final_path = None
    foto_final = None
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    
    # Buscar CV anterior aprobado con el mismo DNI
    cv_anterior_id = None
    es_actualizacion = False
    if dni:
        cv_anterior = db.query(CV).filter(
            CV.dni == dni,
            CV.estado == 'aprobado',
            CV.activo == True
        ).first()
        if cv_anterior:
            cv_anterior_id = cv_anterior.id
            es_actualizacion = True
    
    if file and allowed_file(file.filename):
        validate_file_size(file, settings.MAX_FILE_SIZE)
        temp_dir = get_temp_path()
        safe_dni = sanitize_input(dni) or 'cv'
        pdf_filename = f"{safe_dni}_{timestamp}.pdf"
        pdf_path = os.path.join(temp_dir, pdf_filename)
        
        pdf_path = procesar_archivo_a_pdf(file, pdf_path, safe_dni, timestamp)
        
        # Validar que sea un PDF real
        if not validate_pdf_content(pdf_path):
            os.remove(pdf_path)
            raise HTTPException(status_code=400, detail="El archivo no es un PDF válido")
        
        final_path = mover_pdf_a_uploads(pdf_path, safe_dni)
    
    if foto and foto.filename:
        photos_folder = get_photos_path()
        ext = foto.filename.rsplit('.', 1)[1].lower() if '.' in foto.filename else 'jpg'
        foto_filename = f"foto_{dni or timestamp}_{timestamp}.{ext}"
        foto_path = os.path.join(photos_folder, foto_filename)
        
        with open(foto_path, 'wb') as f:
            shutil.copyfileobj(foto.file, f)
        
        foto_final = f"static/photos/{foto_filename}"
    
    nombre_completo = f"{nombre} {apellido}".strip()
    
    cv = CV(
        filename=f"CV_{dni}.pdf" if dni else "CV.pdf",
        path=final_path,
        nombre=nombre_completo,
        dni=dni,
        fecha_nacimiento=fecha_nacimiento,
        telefono=telefono,
        email=email,
        domicilio=domicilio,
        oficios=oficios,
        foto=foto_final,
        estado='pendiente',
        origen='actualizacion' if es_actualizacion else 'qr',
        cv_anterior_id=cv_anterior_id,
        user_id=None
    )
    
    db.add(cv)
    db.commit()
    db.refresh(cv)
    
    if es_actualizacion:
        crear_notificacion_a_todos_admin(db, 'cv_pendiente', 'Actualización de CV', f'{nombre_completo} quiere actualizar su CV.')
    else:
        crear_notificacion_a_todos_admin(db, 'cv_pendiente', 'Nuevo CV Pendiente', f'{nombre_completo} quiere subir su CV.')
    
    return MessageResponse(message="CV enviado exitosamente. Será revisado por un administrador.", success=True)


@router.get("/oficios/list", response_model=list[str])
def get_lista_oficios():
    from app.utils.oficios import get_all_oficios
    return get_all_oficios()


@router.get("/oficios/categorias")
def get_oficios_categorias():
    from app.utils.oficios import get_categorias
    return get_categorias()


@router.post("/extraer", response_model=dict)
def extraer_datos_pdf(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos para extraer datos")
    
    if not allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
    
    temp_path, temp_filename = guardar_pdf_temp(file)
    
    try:
        datos = extraer_datos_cv(temp_path)
    except Exception as e:
        print(f"Error extrayendo datos del PDF: {e}")
        datos = {
            "nombre": "", "dni": "", "fecha_nacimiento": "",
            "edad": "", "domicilio": "", "domicilios_opciones": [],
            "email": "", "telefono": "", "telefonos_opciones": [],
            "oficio": "", "oficios_detectados": [],
        }
    finally:
        limpiar_temp(temp_path)
    
    campos = {
        "Nombre": datos.get("nombre"),
        "DNI": datos.get("dni"),
        "Fecha Nac.": datos.get("fecha_nacimiento"),
        "Teléfono": datos.get("telefono"),
        "Domicilio": datos.get("domicilio"),
        "Email": datos.get("email"),
    }
    encontrados = sum(1 for v in campos.values() if v)
    print(f"\n{'='*50}")
    print(f"📄 Extracción: {file.filename}")
    print(f"   Resultado: {encontrados}/6 campos encontrados")
    for nombre, valor in campos.items():
        icono = '✅' if valor else '❌'
        print(f"   {icono} {nombre}: {valor if valor else '—'}")
    print(f"   🔧 Oficios: {datos.get('oficios_detectados', []) or '—'}")
    print(f"{'='*50}\n")
    
    return datos


@router.get("/{cv_id}/empresas", response_model=list[dict])
def get_empresas_del_cv(
    cv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cv_empresas = db.query(CVEmpresa).filter(CVEmpresa.cv_id == cv_id).order_by(CVEmpresa.fecha_ingreso.desc()).all()
    
    result = []
    for ce in cv_empresas:
        empresa = db.query(Empresa).filter(Empresa.id == ce.empresa_id).first()
        if empresa:
            result.append({
                "id": ce.id,
                "empresa_id": empresa.id,
                "empresa_nombre": empresa.nombre,
                "empresa_eliminada": empresa.deleted_at is not None,
                "fecha_eliminacion": empresa.deleted_at.isoformat() if empresa.deleted_at else None,
                "fecha_ingreso": ce.fecha_ingreso,
                "fecha_salida": ce.fecha_salida,
                "activo": ce.activo,
            })
        else:
            result.append({
                "id": ce.id,
                "empresa_id": ce.empresa_id,
                "empresa_nombre": "[Empresa eliminada]",
                "empresa_eliminada": True,
                "fecha_eliminacion": None,
                "fecha_ingreso": ce.fecha_ingreso,
                "fecha_salida": ce.fecha_salida,
                "activo": ce.activo,
            })
    
    return result


@router.post("/exportar-pdf")
def exportar_cvs_pdf(
    cv_ids: List[int] = Body(...),
    oficio_filtro: Optional[str] = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    cvs = db.query(CV).filter(CV.id.in_(cv_ids), CV.estado == 'aprobado').all()
    
    if not cvs:
        raise HTTPException(status_code=404, detail="No se encontraron CVs")
    
    buffer = BytesIO()
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e3c72'),
        alignment=1,
        spaceAfter=5,
        fontName='Helvetica-Bold'
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#1e3c72'),
        alignment=1,
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )
    
    elements = []
    elements.append(Paragraph("LISTA DE TRABAJADORES", title_style))
    elements.append(Paragraph("UOCRA - Unión Obrera de la Construcción", subtitle_style))
    elements.append(Paragraph(f"Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')} | Total: {len(cvs)} trabajadores", styles['Normal']))
    elements.append(Spacer(1, 10))
    
    data = [['Nombre', 'DNI', 'Teléfono', 'Oficio', 'Categoría']]
    
    for cv in cvs:
        oficios = cv.oficios if cv.oficios else '-'
        if oficio_filtro:
            oficios = oficio_filtro
        else:
            if len(oficios) > 35:
                oficios = oficios[:35] + '...'
        
        data.append([
            cv.nombre or '-',
            cv.dni or '-',
            cv.telefono or '-',
            oficios,
            cv.area or '-'
        ])
    
    table = Table(data, colWidths=[50*mm, 25*mm, 28*mm, 50*mm, 25*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3c72')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(table)
    
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=12*mm, leftMargin=12*mm, topMargin=12*mm, bottomMargin=12*mm)
    doc.build(elements)
    
    buffer.seek(0)
    filename = f"lista_trabajadores_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    
    return Response(
        content=buffer.getvalue(),
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )
