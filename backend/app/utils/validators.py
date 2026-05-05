import re
import os
from typing import Optional
from fastapi import UploadFile, HTTPException


def sanitize_input(text: Optional[str]) -> Optional[str]:
    """Limpia input de caracteres peligrosos"""
    if not text:
        return None
    text = re.sub(r'[<>]', '', text)
    return text.strip()


def validate_file_size(file: UploadFile, max_size: int) -> None:
    """Valida que el archivo no exceda el tamaño máximo"""
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    
    if size > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo demasiado grande. Máximo: {max_size // (1024*1024)}MB"
        )


def allowed_file(filename: str, allowed_extensions: set = None) -> bool:
    """Valida extensión de archivo"""
    if not filename or '.' not in filename:
        return False
    
    if allowed_extensions is None:
        allowed_extensions = {'pdf', 'jpg', 'jpeg', 'png'}
    
    ext = filename.lower().split('.')[-1]
    return ext in allowed_extensions


def validate_pdf_content(file_path: str) -> bool:
    """Valida que el archivo sea realmente un PDF"""
    try:
        with open(file_path, 'rb') as f:
            header = f.read(4)
            return header.startswith(b'%PDF')
    except:
        return False


def validate_image_content(file_path: str) -> bool:
    """Valida que el archivo sea realmente una imagen"""
    try:
        from PIL import Image
        img = Image.open(file_path)
        img.verify()
        return True
    except:
        return False
