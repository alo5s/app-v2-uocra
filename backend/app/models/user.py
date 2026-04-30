from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.security import get_password_hash


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password = Column(String(200), nullable=False)
    nombre = Column(String(100))
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.current_timestamp())
    
    def set_password(self, password: str):
        self.password = get_password_hash(password)
    
    def check_password(self, password: str):
        from app.core.security import verify_password
        return verify_password(password, self.password)
    
    def can_edit(self) -> bool:
        return self.is_admin


class CV(Base):
    __tablename__ = "cvs"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(200))
    path = Column(String(300))
    path_certificados = Column(String(300))
    
    nombre = Column(String(100))
    dni = Column(String(20))
    fecha_nacimiento = Column(String(20))
    genero = Column(String(20))
    domicilio = Column(String(200))
    email = Column(String(100))
    telefono = Column(String(50))
    oficios = Column(String(500))
    area = Column(String(100))
    foto = Column(String(300))
    foto_pagina = Column(Integer)
    activo = Column(Boolean, default=True)
    estado = Column(String(20), default="pendiente")  # pendiente/aprobado
    origen = Column(String(20), default="web")  # web/qr
    
    afiliado = Column(String(20), default="no")  # si/fue/no
    fue_afiliado = Column(Boolean, default=False)
    apodo = Column(String(50))
    sin_experiencia = Column(Boolean, default=False)
    tiene_documentacion = Column(Boolean, default=False)
    tiene_licencia = Column(Boolean, default=False)
    linea_conducir = Column(String(50))
    modo_deteccion = Column(String(20), default="automatico")
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    cv_anterior_id = Column(Integer, ForeignKey("cvs.id"), nullable=True)
    created_at = Column(DateTime, default=func.current_timestamp())
    updated_at = Column(DateTime, default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    user = relationship("User", backref="cvs")
    empresas = relationship("CVEmpresa", back_populates="cv", cascade="all, delete-orphan")
    notas = relationship("Nota", back_populates="cv", cascade="all, delete-orphan")


class Empresa(Base):
    __tablename__ = "empresas"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    email = Column(String(200), nullable=True)
    descripcion = Column(Text, nullable=True)
    logo = Column(String(300))
    es_afiliada = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.current_timestamp())
    deleted_at = Column(DateTime, nullable=True)
    
    cv_empresas = relationship("CVEmpresa", back_populates="empresa", cascade="all, delete-orphan", passive_deletes=True)
    notas = relationship("Nota", back_populates="empresa", cascade="all, delete-orphan")


class CVEmpresa(Base):
    __tablename__ = "cv_empresas"
    
    id = Column(Integer, primary_key=True, index=True)
    cv_id = Column(Integer, ForeignKey("cvs.id"), nullable=False)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False)
    fecha_ingreso = Column(String(20))
    fecha_salida = Column(String(20))
    activo = Column(Boolean, default=True)
    
    cv = relationship("CV", back_populates="empresas")
    empresa = relationship("Empresa", back_populates="cv_empresas")


class Nota(Base):
    __tablename__ = "notas"
    
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    archivo = Column(String(300), nullable=True)
    descripcion = Column(Text)
    fecha_subida = Column(DateTime, default=func.current_timestamp())
    share_token = Column(String(50), unique=True)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    cv_id = Column(Integer, ForeignKey("cvs.id"), nullable=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=True)
    
    user = relationship("User", backref="notas")
    cv = relationship("CV", back_populates="notas")
    empresa = relationship("Empresa", back_populates="notas")


class Historial(Base):
    __tablename__ = "historial"
    
    id = Column(Integer, primary_key=True, index=True)
    accion = Column(String(50), nullable=False)  # crear/editar/eliminar/aprobar
    tipo = Column(String(30), nullable=False)  # CV/Usuario/Empresa
    entidad_id = Column(Integer)
    descripcion = Column(String(500))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    fecha = Column(DateTime, default=func.current_timestamp())
    
    user = relationship("User", backref="historiales")


class Notificacion(Base):
    __tablename__ = "notificaciones"
    
    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(30), nullable=False)
    titulo = Column(String(200), nullable=False)
    mensaje = Column(String(500))
    leida = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    fecha = Column(DateTime, default=func.current_timestamp())
    
    user = relationship("User", backref="notificaciones")


class QRToken(Base):
    __tablename__ = "qr_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(50), unique=True, nullable=False, index=True)
    usado = Column(Boolean, default=False)
    cv_id = Column(Integer, ForeignKey("cvs.id"), nullable=True)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=func.current_timestamp())
    usado_at = Column(DateTime, nullable=True)