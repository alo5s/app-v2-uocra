import os
import uuid
import shutil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Nota, CV, Empresa
from app.schemas.schemas import NotaCreate, NotaUpdate, NotaResponse, MessageResponse
from app.utils.validators import sanitize_input, validate_file_size, allowed_file, validate_pdf_content

router = APIRouter(prefix="/notas", tags=["notas"])


@router.get("", response_model=list[NotaResponse])
def get_notas(
    filtro: str = "todas",
    buscar: str = "",
    cv_id: int = None,
    empresa_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Nota).order_by(Nota.fecha_subida.desc())
    
    if cv_id:
        query = query.filter(Nota.cv_id == cv_id)
    elif empresa_id:
        query = query.filter(Nota.empresa_id == empresa_id)
    elif filtro == "cv":
        query = query.filter(Nota.cv_id != None)
    elif filtro == "empresa":
        query = query.filter(Nota.empresa_id != None)
    elif filtro == "sin_asignar":
        query = query.filter(Nota.cv_id == None, Nota.empresa_id == None)
    
    if buscar:
        search = f"%{buscar}%"
        query = query.filter(Nota.titulo.ilike(search))
    
    notas = query.all()
    return [NotaResponse.model_validate(n) for n in notas]


@router.get("/{nota_id}", response_model=NotaResponse)
def get_nota(
    nota_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    nota = db.query(Nota).filter(Nota.id == nota_id).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return NotaResponse.model_validate(nota)


@router.post("", response_model=NotaResponse)
def create_nota(
    titulo: str = Form(...),
    descripcion: str = Form(None),
    cv_id: int = Form(None),
    empresa_id: int = Form(None),
    archivo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    archivo_path = None
    
    if archivo and archivo.filename:
        if not archivo.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
        
        ext = 'pdf'
        filename = f"nota_{uuid.uuid4().hex}.{ext}"
        upload_dir = os.path.join('static', 'uploads', 'notas')
        os.makedirs(upload_dir, exist_ok=True)
        
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, 'wb') as f:
            shutil.copyfileobj(archivo.file, f)
        archivo_path = f"static/uploads/notas/{filename}"
    
    nota = Nota(
        titulo=sanitize_input(titulo),
        archivo=archivo_path,
        descripcion=sanitize_input(descripcion),
        user_id=current_user.id,
        cv_id=cv_id,
        empresa_id=empresa_id
    )
    
    db.add(nota)
    db.commit()
    db.refresh(nota)
    
    return NotaResponse.model_validate(nota)


@router.put("/{nota_id}", response_model=NotaResponse)
def update_nota(
    nota_id: int,
    titulo: str = Form(None),
    descripcion: str = Form(None),
    cv_id: int = Form(None),
    empresa_id: int = Form(None),
    archivo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    nota = db.query(Nota).filter(Nota.id == nota_id).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    
    if titulo is not None:
        nota.titulo = sanitize_input(titulo)
    if descripcion is not None:
        nota.descripcion = sanitize_input(descripcion)
    nota.cv_id = cv_id
    nota.empresa_id = empresa_id
    
    if archivo and archivo.filename:
        if not archivo.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
        
        ext = 'pdf'
        filename = f"nota_{uuid.uuid4().hex}.{ext}"
        upload_dir = os.path.join('static', 'uploads', 'notas')
        os.makedirs(upload_dir, exist_ok=True)
        
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, 'wb') as f:
            shutil.copyfileobj(archivo.file, f)
        nota.archivo = f"static/uploads/notas/{filename}"
    
    db.commit()
    db.refresh(nota)
    
    return NotaResponse.model_validate(nota)


@router.delete("/{nota_id}", response_model=MessageResponse)
def delete_nota(
    nota_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    nota = db.query(Nota).filter(Nota.id == nota_id).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    
    if nota.archivo:
        archivo_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', nota.archivo)
        try:
            if os.path.exists(archivo_path):
                os.remove(archivo_path)
        except:
            pass
    
    db.delete(nota)
    db.commit()
    
    return MessageResponse(message="Nota eliminada exitosamente")


@router.get("/{nota_id}/descargar")
def descargar_nota(
    nota_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    nota = db.query(Nota).filter(Nota.id == nota_id).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    
    if not nota.archivo or not os.path.exists(nota.archivo):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    return FileResponse(
        nota.archivo,
        media_type='application/pdf',
        filename=f"{nota.titulo}.pdf"
    )


@router.get("/{nota_id}/compartir")
def compartir_nota(
    nota_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    nota = db.query(Nota).filter(Nota.id == nota_id).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    
    if not nota.share_token:
        nota.share_token = uuid.uuid4().hex
        db.commit()
    
    return {
        "share_url": f"/notas/shared/{nota.share_token}",
        "titulo": nota.titulo,
        "descripcion": nota.descripcion
    }


@router.get("/shared/{token}")
def ver_nota_compartida(
    token: str,
    db: Session = Depends(get_db)
):
    nota = db.query(Nota).filter(Nota.share_token == token).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Enlace no válido o expirado")
    
    if not nota.archivo or not os.path.exists(nota.archivo):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    return FileResponse(
        nota.archivo,
        media_type='application/pdf'
    )


@router.get("/stats", response_model=dict)
def get_notas_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total = db.query(Nota).count()
    notas_cv = db.query(Nota).filter(Nota.cv_id != None).count()
    notas_empresa = db.query(Nota).filter(Nota.empresa_id != None).count()
    notas_sueltas = db.query(Nota).filter(Nota.cv_id == None, Nota.empresa_id == None).count()
    
    return {
        "total": total,
        "notas_cv": notas_cv,
        "notas_empresa": notas_empresa,
        "notas_sueltas": notas_sueltas
    }