from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# User schemas
class UserBase(BaseModel):
    username: str
    nombre: Optional[str] = None


class UserCreate(UserBase):
    password: str
    is_admin: bool = False


class UserUpdate(BaseModel):
    nombre: Optional[str] = None
    password: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_admin: bool
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# CV schemas
class CVBase(BaseModel):
    nombre: Optional[str] = None
    dni: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    genero: Optional[str] = None
    domicilio: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    oficios: Optional[str] = None
    area: Optional[str] = None
    afiliado: str = "no"
    fue_afiliado: bool = False
    apodo: Optional[str] = None
    sin_experiencia: bool = False
    tiene_documentacion: bool = False
    tiene_licencia: bool = False
    linea_conducir: Optional[str] = None
    modo_deteccion: str = "automatico"


class CVCreate(CVBase):
    filename: Optional[str] = None
    path: Optional[str] = None
    path_certificados: Optional[str] = None
    foto: Optional[str] = None
    foto_pagina: Optional[int] = None
    estado: str = "aprobado"
    origen: str = "web"
    user_id: Optional[int] = None


class CVUpdate(CVBase):
    filename: Optional[str] = None
    path: Optional[str] = None
    foto: Optional[str] = None
    foto_pagina: Optional[int] = None
    activo: Optional[bool] = None
    estado: Optional[str] = None


class CVPublicCreate(BaseModel):
    nombre: str
    apellido: str
    dni: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    oficios: Optional[str] = None


class CVResponse(CVBase):
    id: int
    filename: Optional[str]
    path: Optional[str]
    path_certificados: Optional[str]
    foto: Optional[str]
    foto_pagina: Optional[int]
    activo: bool
    estado: str
    origen: str
    user_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Empresa schemas
class EmpresaBase(BaseModel):
    nombre: str
    email: Optional[str] = None
    descripcion: Optional[str] = None
    es_afiliada: bool = False


class EmpresaCreate(EmpresaBase):
    logo: Optional[str] = None


class EmpresaUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
    descripcion: Optional[str] = None
    logo: Optional[str] = None
    es_afiliada: Optional[bool] = None


class EmpresaResponse(EmpresaBase):
    id: int
    logo: Optional[str]
    created_at: datetime
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# CVEmpresa schemas
class CVEmpresaBase(BaseModel):
    empresa_id: int
    fecha_ingreso: Optional[str] = None
    fecha_salida: Optional[str] = None
    activo: bool = True


class CVEmpresaCreate(CVEmpresaBase):
    pass


class CVEmpresaUpdate(BaseModel):
    fecha_ingreso: Optional[str] = None
    fecha_salida: Optional[str] = None
    activo: Optional[bool] = None


class CVEmpresaResponse(CVEmpresaBase):
    id: int
    cv_id: int
    cv: Optional[dict] = None
    
    class Config:
        from_attributes = True


# Nota schemas
class NotaBase(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    cv_id: Optional[int] = None
    empresa_id: Optional[int] = None


class NotaCreate(NotaBase):
    pass


class NotaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    cv_id: Optional[int] = None
    empresa_id: Optional[int] = None


class NotaResponse(NotaBase):
    id: int
    archivo: Optional[str] = None
    share_token: Optional[str]
    fecha_subida: datetime
    user_id: Optional[int]
    
    class Config:
        from_attributes = True


# Historial schemas
class HistorialResponse(BaseModel):
    id: int
    accion: str
    tipo: str
    entidad_id: Optional[int]
    descripcion: Optional[str]
    user_id: Optional[int]
    fecha: datetime
    
    class Config:
        from_attributes = True


# Notificacion schemas
class NotificacionResponse(BaseModel):
    id: int
    tipo: str
    titulo: str
    mensaje: Optional[str]
    leida: bool
    user_id: Optional[int]
    fecha: datetime
    
    class Config:
        from_attributes = True


class NotificacionUpdate(BaseModel):
    leida: bool = True


# Dashboard stats
class DashboardStats(BaseModel):
    total_cvs: int
    activos: int
    afiliados: int
    fueron_afiliados: int
    no_afiliados: int
    sin_exp_count: int
    total_users: int
    total_empresas: int
    empresas_activas: int
    total_notas: int


# Generic response
class MessageResponse(BaseModel):
    message: str
    success: bool = True