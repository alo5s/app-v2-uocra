import os
import uuid
import json
import shutil
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Empresa, CVEmpresa, CV
from app.schemas.schemas import (
    EmpresaCreate, EmpresaUpdate, EmpresaResponse,
    CVEmpresaCreate, CVEmpresaUpdate, CVEmpresaResponse, MessageResponse
)

router = APIRouter(prefix="/empresas", tags=["empresas"])


def sanitize_input(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    import re
    text = re.sub(r'[<>]', '', text)
    return text.strip()


@router.get("", response_model=list[EmpresaResponse])
def get_empresas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    empresas = db.query(Empresa).filter(
        Empresa.deleted_at == None
    ).order_by(Empresa.nombre).all()
    return [EmpresaResponse.model_validate(e) for e in empresas]


@router.get("/{empresa_id}", response_model=EmpresaResponse)
def get_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return EmpresaResponse.model_validate(empresa)


@router.post("", response_model=EmpresaResponse)
def create_empresa(
    nombre: str = Form(...),
    email: str = Form(None),
    descripcion: str = Form(None),
    es_afiliada: bool = Form(False),
    logo: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    logo_filename = None
    if logo and logo.filename:
        ext = logo.filename.rsplit('.', 1)[1].lower() if '.' in logo.filename else 'png'
        logo_filename = f"logo_{uuid.uuid4().hex}.{ext}"
        logo_path = os.path.join('static', 'logos', logo_filename)
        os.makedirs(os.path.dirname(logo_path), exist_ok=True)
        
        with open(logo_path, 'wb') as f:
            shutil.copyfileobj(logo.file, f)
    
    empresa = Empresa(
        nombre=sanitize_input(nombre),
        email=sanitize_input(email),
        descripcion=sanitize_input(descripcion),
        logo=f"static/logos/{logo_filename}" if logo_filename else None,
        es_afiliada=es_afiliada
    )
    
    db.add(empresa)
    db.commit()
    db.refresh(empresa)
    
    return EmpresaResponse.model_validate(empresa)


@router.put("/{empresa_id}", response_model=EmpresaResponse)
def update_empresa(
    empresa_id: int,
    nombre: str = Form(None),
    email: str = Form(None),
    descripcion: str = Form(None),
    es_afiliada: bool = Form(None),
    logo: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    if nombre is not None:
        empresa.nombre = sanitize_input(nombre)
    if email is not None:
        empresa.email = sanitize_input(email)
    if descripcion is not None:
        empresa.descripcion = sanitize_input(descripcion)
    if es_afiliada is not None:
        empresa.es_afiliada = es_afiliada
    
    if logo and logo.filename:
        if empresa.logo:
            old_path = empresa.logo.replace('static/', '')
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except:
                    pass
        
        ext = logo.filename.rsplit('.', 1)[1].lower() if '.' in logo.filename else 'png'
        logo_filename = f"logo_{uuid.uuid4().hex}.{ext}"
        logo_path = os.path.join('static', 'logos', logo_filename)
        os.makedirs(os.path.dirname(logo_path), exist_ok=True)
        
        with open(logo_path, 'wb') as f:
            shutil.copyfileobj(logo.file, f)
        
        empresa.logo = f"static/logos/{logo_filename}"
    
    db.commit()
    db.refresh(empresa)
    
    return EmpresaResponse.model_validate(empresa)


@router.delete("/{empresa_id}", response_model=MessageResponse)
def delete_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    emp_nombre = empresa.nombre
    
    cv_empresas = db.query(CVEmpresa).filter(
        CVEmpresa.empresa_id == empresa_id,
        CVEmpresa.activo == True
    ).all()
    
    empleados_historial = []
    for cv_emp in cv_empresas:
        cv = db.query(CV).filter(CV.id == cv_emp.cv_id).first()
        if cv:
            empleados_historial.append({
                "cv_id": cv.id,
                "nombre": cv.nombre,
                "dni": cv.dni,
                "fecha_ingreso": cv_emp.fecha_ingreso,
                "fecha_salida": cv_emp.fecha_salida or datetime.now().strftime("%Y-%m-%d")
            })
        cv_emp.activo = False
    
    empresa.deleted_at = datetime.now()
    empresa.nombre = f"[ELIMINADA] {empresa.nombre}"
    
    db.commit()
    
    return MessageResponse(message=f"Empresa '{emp_nombre}' eliminada. {len(empleados_historial)} empleados marcados como inactivos.")


# CV-Empresa endpoints (asociar trabajadores a empresas)
@router.get("/{empresa_id}/cvs", response_model=dict)
def get_cvs_de_empresa(
    empresa_id: int,
    filtro: str = "todos",
    buscar: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    cv_empresas_query = db.query(CVEmpresa).filter(CVEmpresa.empresa_id == empresa_id)
    
    if filtro == "activos":
        cv_empresas_query = cv_empresas_query.filter(CVEmpresa.activo == True)
    elif filtro == "inactivos":
        cv_empresas_query = cv_empresas_query.filter(CVEmpresa.activo == False)
    
    if buscar:
        cv_empresas_query = cv_empresas_query.join(CV).filter(CV.nombre.ilike(f'%{buscar}%'))
    
    cv_empresas_list = cv_empresas_query.all()
    
    cvs_with_data = []
    for ce in cv_empresas_list:
        cv = db.query(CV).filter(CV.id == ce.cv_id).first()
        cv_data = None
        if cv:
            cv_data = {
                "id": cv.id,
                "nombre": cv.nombre,
                "dni": cv.dni,
                "oficios": cv.oficios
            }
        ce_dict = {
            "id": ce.id,
            "cv_id": ce.cv_id,
            "empresa_id": ce.empresa_id,
            "fecha_ingreso": ce.fecha_ingreso,
            "fecha_salida": ce.fecha_salida,
            "activo": ce.activo,
            "cv": cv_data
        }
        cvs_with_data.append(ce_dict)
    
    total_activos = db.query(CVEmpresa).filter(CVEmpresa.empresa_id == empresa_id, CVEmpresa.activo == True).count()
    total_inactivos = db.query(CVEmpresa).filter(CVEmpresa.empresa_id == empresa_id, CVEmpresa.activo == False).count()
    
    return {
        "empresa": EmpresaResponse.model_validate(empresa),
        "cvs": cvs_with_data,
        "total_activos": total_activos,
        "total_inactivos": total_inactivos,
        "filtro": filtro,
        "buscar": buscar
    }


@router.post("/{empresa_id}/cvs", response_model=dict)
async def agregar_cv_a_empresa(
    empresa_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    body = await request.json()
    cv_id = body.get("cv_id")
    fecha_ingreso = body.get("fecha_ingreso")
    fecha_salida = body.get("fecha_salida")
    activo = body.get("activo", True)
    
    if cv_id is None:
        raise HTTPException(status_code=400, detail="cv_id es requerido")
    
    try:
        cv_id = int(cv_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="cv_id debe ser un número válido")
    
    empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV no encontrado")
    
    existente = db.query(CVEmpresa).filter(CVEmpresa.cv_id == cv_id, CVEmpresa.empresa_id == empresa_id).first()
    if existente:
        raise HTTPException(status_code=400, detail="Este CV ya está asociado a esta empresa")
    
    cv_empresa = CVEmpresa(
        cv_id=cv_id,
        empresa_id=empresa_id,
        fecha_ingreso=sanitize_input(fecha_ingreso),
        fecha_salida=sanitize_input(fecha_salida),
        activo=bool(activo)
    )
    
    db.add(cv_empresa)
    db.commit()
    db.refresh(cv_empresa)
    
    cv_data = None
    if cv:
        cv_data = {"id": cv.id, "nombre": cv.nombre, "dni": cv.dni, "oficios": cv.oficios}
    
    return {
        "id": cv_empresa.id,
        "cv_id": cv_empresa.cv_id,
        "empresa_id": cv_empresa.empresa_id,
        "fecha_ingreso": cv_empresa.fecha_ingreso,
        "fecha_salida": cv_empresa.fecha_salida,
        "activo": cv_empresa.activo,
        "cv": cv_data
    }


@router.put("/cvs/{cv_empresa_id}", response_model=dict)
async def update_cv_empresa(
    cv_empresa_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    body = await request.json()
    fecha_ingreso = body.get("fecha_ingreso")
    fecha_salida = body.get("fecha_salida")
    activo = body.get("activo")
    
    cv_empresa = db.query(CVEmpresa).filter(CVEmpresa.id == cv_empresa_id).first()
    if not cv_empresa:
        raise HTTPException(status_code=404, detail="Asociación no encontrada")
    
    if fecha_ingreso is not None:
        cv_empresa.fecha_ingreso = sanitize_input(fecha_ingreso)
    if fecha_salida is not None:
        cv_empresa.fecha_salida = sanitize_input(fecha_salida)
    if activo is not None:
        cv_empresa.activo = bool(activo)
    
    db.commit()
    db.refresh(cv_empresa)
    
    cv = db.query(CV).filter(CV.id == cv_empresa.cv_id).first()
    cv_data = None
    if cv:
        cv_data = {"id": cv.id, "nombre": cv.nombre, "dni": cv.dni, "oficios": cv.oficios}
    
    return {
        "id": cv_empresa.id,
        "cv_id": cv_empresa.cv_id,
        "empresa_id": cv_empresa.empresa_id,
        "fecha_ingreso": cv_empresa.fecha_ingreso,
        "fecha_salida": cv_empresa.fecha_salida,
        "activo": cv_empresa.activo,
        "cv": cv_data
    }


@router.delete("/cvs/{cv_empresa_id}", response_model=MessageResponse)
def eliminar_cv_de_empresa(
    cv_empresa_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cv_empresa = db.query(CVEmpresa).filter(CVEmpresa.id == cv_empresa_id).first()
    if not cv_empresa:
        raise HTTPException(status_code=404, detail="Relación no encontrada")
    
    db.delete(cv_empresa)
    db.commit()
    
    return MessageResponse(message="Empresa eliminada del trabajador")


@router.post("/cvs/{cv_empresa_id}/toggle", response_model=dict)
def toggle_cv_empresa_activo(
    cv_empresa_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cv_empresa = db.query(CVEmpresa).filter(CVEmpresa.id == cv_empresa_id).first()
    if not cv_empresa:
        raise HTTPException(status_code=404, detail="Relación no encontrada")
    
    cv_empresa.activo = not cv_empresa.activo
    db.commit()
    db.refresh(cv_empresa)
    
    cv = db.query(CV).filter(CV.id == cv_empresa.cv_id).first()
    cv_data = None
    if cv:
        cv_data = {"id": cv.id, "nombre": cv.nombre, "dni": cv.dni, "oficios": cv.oficios}
    
    return {
        "id": cv_empresa.id,
        "cv_id": cv_empresa.cv_id,
        "empresa_id": cv_empresa.empresa_id,
        "fecha_ingreso": cv_empresa.fecha_ingreso,
        "fecha_salida": cv_empresa.fecha_salida,
        "activo": cv_empresa.activo,
        "cv": cv_data
    }