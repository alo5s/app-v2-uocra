import re
import os
import shutil
import random
import string
from datetime import datetime
from typing import Optional

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import numpy as np
except ImportError:
    np = None

try:
    import cv2
except ImportError:
    cv2 = None

try:
    from pdf2image import convert_from_path
    import pytesseract
    from PIL import Image
except ImportError:
    convert_from_path = None
    pytesseract = None
    Image = None


ALLOWED_EXTENSIONS = {'pdf', 'docx'}
MAX_FILE_SIZE = 16 * 1024 * 1024

NLP = None

try:
    import spacy
    NLP = spacy.load("es_core_news_sm")
except Exception:
    pass

from app.utils.oficios import OFICIOS


PALABRAS_EXCLUIR_EMPRESA = [
    "empresa", "constructora", "obra", "construcción", "construccion",
    "avellaneda", "sarandí", "modal", "prowel", "laboratorio",
    "telefax", "inspección", "inspeccion", "catamarca", "tucuman",
    "jujuy", "salta", "formosa", "chubut", "comodoro rivadavia",
    "buenos aires", "cap fed", "capital federal"
]

PREFIOS_EXCLUIR_TELEFONO = ("011", "0800", "0810", "0900", "103", "100")

DOMINIOS_PERSONALES = ("gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com")


def allowed_file(filename, allowed_extensions=None):
    if allowed_extensions is None:
        allowed_extensions = ALLOWED_EXTENSIONS
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def sanitize_input(text):
    if text is None:
        return None
    return str(text).strip()


def secure_filename_safe(filename):
    return re.sub(r'[^\w\s.-]', '', filename)


def calcular_edad(fecha_str):
    if not fecha_str:
        return ""
    try:
        formatos = ['%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d', '%d-%m-%y', '%d/%m/%y']
        fecha_obj = None
        for fmt in formatos:
            try:
                fecha_obj = datetime.strptime(fecha_str, fmt)
                break
            except:
                continue
        if not fecha_obj:
            return ""
        hoy = datetime.now()
        edad = (hoy - fecha_obj).days // 365
        if 0 < edad < 120:
            return str(edad)
        return ""
    except:
        return ""


def _limpiar_texto_ocr(texto):
    if not texto:
        return ""
    
    replacements = {
        '™': '', '©': '', '®': '', '°': '', '±': '', '§': '', '¶': '',
        '†': '', '‡': '', '¨': '', 'œ': '', '∑': '', '¢': '',
        'Ø': '0', '⁄': '/', '≈': '', '[': '', ']': '', '{': '',
        '}': '', '(': '', ')': '', '<': '', '>': '', '|': '',
    }
    
    for old, new in replacements.items():
        texto = texto.replace(old, new)
    
    texto = texto.replace('º', '').replace('ª', '')
    
    lineas = texto.split('\n')
    lineas_limpias = []
    for linea in lineas:
        if len(linea) < 3:
            continue
        if re.search(r'^[\W_]+\s*$', linea):
            continue
        if re.search(r'^[a-zA-Z]\s+[a-zA-Z]\s*$', linea):
            continue
        lineas_limpias.append(linea)
    texto = '\n'.join(lineas_limpias)
    
    texto = re.sub(r'[ \t]+', ' ', texto)
    texto = re.sub(r'(\d)\s*-\s*(\d)', r'\1-\2', texto)
    texto = re.sub(r'(\d)\s*\.\s*(\d)', r'\1.\2', texto)
    
    return texto.strip()


def _transformar_texto_extraccion(texto):
    texto = _limpiar_texto_ocr(texto)
    
    reemplazos_simbolos = {
        '📞': 'telefono:', '☎': 'telefono:', '📱': 'celular:',
        '✆': 'telefono:', '✉': 'correo:', '📧': 'correo:',
        '📨': 'correo:', '📍': 'direccion:', '📌': 'direccion:',
        '🏠': 'domicilio:',
    }
    
    for simbolo, texto_rep in reemplazos_simbolos.items():
        texto = texto.replace(simbolo, f' {texto_rep} ')
    
    texto = texto.lower()
    
    reemplazos = {
        r'\bcel\.?\b': 'celular:',
        r'\bcelular\b': 'celular:',
        r'\bwhatsapp\b': 'whatsapp:',
        r'\bwsp\b': 'whatsapp:',
        r'\bm[oó]vil\b': 'movil:',
        r'\btel\.?\b': 'telefono:',
        r'\btel[eé]fono\b': 'telefono:',
        r'\bcorreo\b': 'correo:',
        r'\bmail\b': 'correo:',
        r'\be-mail\b': 'correo:',
        r'\bdirecci[oó]n\b': 'direccion:',
        r'\bdomicilio\b': 'domicilio:',
        r'\bdocumento\b': 'dni:',
        r'\bcu[ií]l\b': 'cuil:',
        r'\bcuit\b': 'cuit:',
        r'\bnro\.?\s*(?:de\s+)?documento\b': 'dni:',
        r'\bn[°º]\s*documento\b': 'dni:',
    }
    
    for patron, reemplazo in reemplazos.items():
        texto = re.sub(patron, reemplazo, texto)
    
    texto = re.sub(r'[ \t]+', ' ', texto)
    texto = re.sub(r'\n+', '\n', texto)
    
    return texto.strip()


def _preprocesar_imagen_ocr(img):
    try:
        if cv2 is None or np is None:
            return None
        img_array = np.array(img)
        
        if len(img_array.shape) == 2:
            gris = img_array
        elif img_array.shape[2] == 4:
            gris = cv2.cvtColor(img_array, cv2.COLOR_RGBA2GRAY)
        else:
            gris = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        _, binary = cv2.threshold(gris, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        kernel = np.ones((2, 2), np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        
        return binary
    except Exception:
        return None


def _extraer_texto_ocr(pdf_path):
    texto = ""
    try:
        if convert_from_path is None or pytesseract is None:
            return texto
        
        imagenes = convert_from_path(pdf_path, dpi=300)
        if not imagenes:
            return texto
        
        modos_psm = ['--oem 3 --psm 3', '--oem 3 --psm 4', '--oem 3 --psm 6']
        mejor_modo = '--oem 3 --psm 3'
        mejor_len = 0
        
        img_prueba = imagenes[0]
        img_procesada = _preprocesar_imagen_ocr(img_prueba)
        if img_procesada is not None:
            from PIL import Image as PILImage
            img_pil = PILImage.fromarray(img_procesada)
            for modo in modos_psm:
                t = pytesseract.image_to_string(img_pil, lang='spa', config=modo)
                if len(t.strip()) > mejor_len:
                    mejor_len = len(t.strip())
                    mejor_modo = modo
        else:
            for modo in modos_psm:
                t = pytesseract.image_to_string(img_prueba, lang='spa', config=modo)
                if len(t.strip()) > mejor_len:
                    mejor_len = len(t.strip())
                    mejor_modo = modo
        
        for img in imagenes:
            img_procesada = _preprocesar_imagen_ocr(img)
            if img_procesada is not None:
                from PIL import Image as PILImage
                img_pil = PILImage.fromarray(img_procesada)
                texto += pytesseract.image_to_string(img_pil, lang='spa', config=mejor_modo) + "\n"
            else:
                texto += pytesseract.image_to_string(img, lang='spa', config=mejor_modo) + "\n"
    except Exception:
        pass
    return texto


def _extraer_texto_docx(docx_path):
    try:
        import docx
        doc = docx.Document(docx_path)
        texto = "\n".join([p.text for p in doc.paragraphs])
        return texto
    except Exception:
        return ""


def detectar_si_necesita_ocr(pdf_path, umbral_caracteres=50, porcentaje_minimo=0.2):
    resultado = {
        "requiere_ocr": True,
        "paginas_con_texto": 0,
        "paginas_sin_texto": 0,
        "total_paginas": 0,
        "porcentaje_texto": 0.0
    }
    
    if pdfplumber is None:
        return resultado
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_paginas = len(pdf.pages)
            resultado["total_paginas"] = total_paginas
            
            if total_paginas == 0:
                return resultado
            
            for page in pdf.pages:
                texto = page.extract_text(x_tolerance=2, y_tolerance=2, layout=True) or ""
                
                if len(texto.strip()) >= umbral_caracteres:
                    resultado["paginas_con_texto"] += 1
                else:
                    resultado["paginas_sin_texto"] += 1
            
            porcentaje = resultado["paginas_con_texto"] / total_paginas
            resultado["porcentaje_texto"] = round(porcentaje, 2)
            
            if porcentaje >= porcentaje_minimo:
                resultado["requiere_ocr"] = False
    
    except Exception as e:
        print(f"Error analizando PDF: {e}")
    
    return resultado


def _extraer_texto_pdf_paginas(pdf_path, inicio=0, cantidad=2):
    texto = ""
    
    if pdfplumber is None:
        return texto
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_paginas = len(pdf.pages)
            fin = min(inicio + cantidad, total_paginas)
            
            for i in range(inicio, fin):
                page = pdf.pages[i]
                contenido = page.extract_text(x_tolerance=2, y_tolerance=2, layout=True)
                if contenido:
                    texto += contenido + "\n"
    except Exception as e:
        print(f"Error extrayendo texto: {e}")
    
    return texto


def _extraer_texto_ocr_paginas(pdf_path, inicio=0, cantidad=2):
    try:
        if convert_from_path is None or pytesseract is None:
            return ""
        
        imagenes = convert_from_path(pdf_path, dpi=300, first_page=inicio+1, last_page=inicio+cantidad)
        if not imagenes:
            return ""
        
        modos_psm = ['--oem 3 --psm 3', '--oem 3 --psm 4', '--oem 3 --psm 6']
        mejor_modo = '--oem 3 --psm 3'
        mejor_len = 0
        
        img_prueba = imagenes[0]
        img_procesada = _preprocesar_imagen_ocr(img_prueba)
        if img_procesada is not None:
            from PIL import Image as PILImage
            for modo in modos_psm:
                t = pytesseract.image_to_string(PILImage.fromarray(img_procesada), lang='spa', config=modo)
                if len(t.strip()) > mejor_len:
                    mejor_len = len(t.strip())
                    mejor_modo = modo
        else:
            for modo in modos_psm:
                t = pytesseract.image_to_string(img_prueba, lang='spa', config=modo)
                if len(t.strip()) > mejor_len:
                    mejor_len = len(t.strip())
                    mejor_modo = modo
        
        texto = ""
        for img in imagenes:
            img_procesada = _preprocesar_imagen_ocr(img)
            if img_procesada is not None:
                from PIL import Image as PILImage
                img_pil = PILImage.fromarray(img_procesada)
                texto += pytesseract.image_to_string(img_pil, lang='spa', config=mejor_modo) + "\n"
            else:
                texto += pytesseract.image_to_string(img, lang='spa', config=mejor_modo) + "\n"
        return texto
    except Exception as e:
        print(f"Error OCR: {e}")
        return ""


def _extraer_nombre(texto, entidades=None, texto_original=None):
    if entidades and entidades.get("person"):
        for nombre in entidades["person"]:
            if len(nombre.split()) >= 2:
                return nombre.title()
    
    texto_limpio = re.sub(r'[™©®°±§¶†‡¨œ∑¢Ø⁄≈_\-\[\]{}]', '', texto)
    texto_limpio = re.sub(r'\s+', ' ', texto_limpio)
    
    match = re.search(r'apellido.*?nombre.*?:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]{3,},\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,})', texto_limpio, re.IGNORECASE)
    if match:
        nombre = match.group(1)
        partes = nombre.split(',')
        nombre = f"{partes[1].strip()} {partes[0].strip()}"
        if len(nombre.split()) >= 2:
            return nombre.title()
    
    match = re.search(r'nombre.*?:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,})', texto_limpio, re.IGNORECASE)
    if match:
        nombre = match.group(1).strip()
        nombre = re.sub(r'(fecha|dni|edad|estado|domicilio).*', '', nombre, flags=re.IGNORECASE).strip()
        if len(nombre.split()) >= 2:
            return nombre.title()
    
    match = re.search(r'apellido.*?:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]{3,},\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,})', texto_limpio, re.IGNORECASE)
    if match:
        nombre = match.group(1)
        partes = nombre.split(',')
        nombre = f"{partes[1].strip()} {partes[0].strip()}"
        if len(nombre.split()) >= 2:
            return nombre.title()
    
    texto_para_fallback = texto_original if texto_original else texto_limpio
    
    nombre_mayusculas = _extraer_nombre_mayusculas_inicio(texto_para_fallback)
    if nombre_mayusculas:
        return nombre_mayusculas
    
    return _extraer_primera_linea_valida(texto_para_fallback)


def _extraer_nombre_mayusculas_inicio(texto):
    SECCIONES = {'formación', 'educación', 'experiencia', 'académica', 'laboral',
                 'referencias', 'objetivo', 'perfil', 'capacitación', 'capacitaciones',
                 'habilidades', 'conocimientos', 'aptitudes', 'estudios', 'cursos',
                 'información', 'adicional', 'informatica', 'idiomas'}
    PALABRAS_NO_NOMBRE = {'objetivo', 'experiencia', 'formación', 'estudios', 'referencia',
                          'contacto', 'informacion', 'información', 'profesional', 'empleo',
                          'puesto', 'trabajo', 'area', 'sectores', 'conseguir', 'perfil',
                          'accidentes', 'personales', 'resumen', 'logros', 'aptitudes',
                          'lengua', 'literatura', 'enviar', 'mensaje', 'organización',
                          'productor', 'cliente', 'asociado', 'productos', 'tecnológicos',
                          'capacidad', 'interés', 'interes', 'estudiante',
                          'en', 'con', 'para', 'por', 'sin', 'entre', 'durante',
                          'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una',
                          'y', 'e', 'o', 'a', 'su', 'que',
                          'aprender', 'aplicar', 'conocimientos', 'habilidades',
                          'desarrollar', 'busca', 'oportunidad', 'ámbito',
                          'laboral', 'tener', 'académica', 'educación',
                          'secundario', 'título', 'carrera', 'técnico',
                          'universidad', 'instituto', 'colegio', 'escuela',
                          'estudie', 'cursando', 'finalizado', 'incompleto',
                          'completo', 'mis', 'sus', 'desarrollador', 'freelance',
                          'oficial', 'técnico', 'electromecánico', 'electromecanico',
                          'prestación', 'servicio', 'prestacion', 'tareas'}
    
    lineas = texto.split('\n')
    for linea in lineas[:15]:
        linea = linea.strip()
        if len(linea) < 3:
            continue
        if re.search(r'\d{5,}', linea):
            continue
        if re.search(r'@|www\.|\.com|\.gov|\.edu', linea, re.IGNORECASE):
            continue
        if re.search(r'telefono|tel|móvil|movil|cel|email|correo|dni|documento', linea, re.IGNORECASE):
            continue
        if re.search(r'domicilio|direccion|dom:', linea, re.IGNORECASE):
            continue
        if re.search(r'fecha|nacimiento|nacim|fec\.? nac|edad|sexo|genero', linea, re.IGNORECASE):
            continue
        
        # Try all-caps pattern (highest confidence)
        match = re.search(r'^([A-ZÁÉÍÓÚÑ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ]{3,}){1,4})', linea)
        if match:
            nombre_original = match.group(1)
            palabras = nombre_original.split()
            if len(palabras) >= 2:
                palabras_validas = [p for p in palabras if p.lower() not in PALABRAS_NO_NOMBRE]
                if len(palabras_validas) >= 2:
                    nombre = ' '.join(palabras_validas[:4])
                    return nombre.title()
        
        # Try title-case pattern (only if line contains a section header)
        tiene_seccion = any(s in linea.lower() for s in SECCIONES)
        if not tiene_seccion:
            continue
        match = re.search(r'^((?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\s+){1,3}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})', linea)
        if match:
            nombre_original = match.group(1)
            palabras = nombre_original.split()
            if len(palabras) >= 2:
                palabras_validas = [p for p in palabras if p.lower() not in PALABRAS_NO_NOMBRE]
                if len(palabras_validas) >= 2:
                    nombre = ' '.join(palabras_validas[:4])
                    return nombre.title()
    return ""


def _extraer_primera_linea_valida(texto):
    PALABRAS_EXCLUIDAS = {'objetivo', 'experiencia', 'estudios', 'referencia',
                         'contacto', 'informacion', 'información', 'profesional', 'empleo',
                         'puesto', 'trabajo', 'area', 'sectores', 'conseguir', 'perfil',
                         'accidentes', 'personales', 'resumen', 'logros', 'aptitudes',
                         'lengua', 'literatura', 'enviar', 'mensaje', 'organización',
                         'productor', 'cliente', 'asociado', 'productos', 'tecnológicos',
                         'capacidad', 'interés', 'interes', 'estudiante',
                         'en', 'con', 'para', 'por', 'sin', 'entre', 'durante',
                         'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una',
                         'y', 'e', 'o', 'a', 'su', 'que',
                         'aprender', 'aplicar', 'conocimientos', 'habilidades',
                         'desarrollar', 'busca', 'oportunidad', 'ámbito',
                         'laboral', 'tener', 'formación', 'académica', 'educación',
                         'secundario', 'título', 'carrera', 'técnico',
                         'universidad', 'instituto', 'colegio', 'escuela',
                         'estudie', 'cursando', 'finalizado', 'incompleto',
                         'completo', 'mis', 'sus'}
    lineas = texto.splitlines()
    for linea in lineas:
        linea = linea.strip()
        if len(linea) < 3:
            continue
        if re.search(r'[\d]{5,}', linea):
            continue
        if re.search(r'curriculum|cv|curriculo|vitae', linea, re.IGNORECASE):
            continue
        if re.search(r'@|www\.|\.com|\.gov|\.edu', linea):
            continue
        if re.search(r'telefono|tel|móvil|movil|cel|email|correo|dni', linea, re.IGNORECASE):
            continue
        if re.search(r'^domicilio\s*[:\s]', linea, re.IGNORECASE):
            continue
        if re.search(r'^direcci[oó]n\s*[:\s]', linea, re.IGNORECASE):
            continue
        if re.search(r'fecha|nacimiento|nacim|fec\.? nac', linea, re.IGNORECASE):
            continue
        if re.search(r'edad|sexo|genero|estado civil', linea, re.IGNORECASE):
            continue
        if re.search(r'nacionalidad|pais|provincia|localidad', linea, re.IGNORECASE):
            continue
        if re.search(r'objetivo|experiencia|formación|estudios|referencia', linea, re.IGNORECASE):
            continue
        palabra_excluir = ['manzana', 'lote', 'casa', 'departamento', 'piso']
        if any(p + ':' in linea.lower() for p in palabra_excluir):
            continue
        if re.search(r'^calle\s*[:\s]', linea, re.IGNORECASE):
            continue
        if re.search(r'^barrio\s*[:\s]', linea, re.IGNORECASE):
            continue
        if re.search(r'^av\.\s*[:\s]', linea, re.IGNORECASE):
            continue
        if re.search(r'^[•\-\*\[\]\(\)]', linea):
            continue
        if re.search(r'\$', linea):
            continue
        if re.search(r'^\d+\s', linea):
            continue
        partes = linea.split()
        if len(partes) < 2 or len(partes) > 6:
            continue
        palabras_no_excluidas = [p for p in partes if p.strip('.,;:!?¿¡\"\'').lower() not in PALABRAS_EXCLUIDAS and len(p.strip('.,;:!?¿¡\"\'')) >= 3]
        if len(palabras_no_excluidas) < 2:
            continue
        if len(set(p.strip('.,;:!?¿¡\"\'').lower() for p in partes)) < len(partes):
            continue
        return linea.title()
    return ""


def _extraer_dni(texto):
    texto_lower = texto.lower()
    
    match = re.search(r'cu[ií]l\s*[:\s]*([\d\-]{11,13})', texto_lower)
    if match:
        return match.group(1).strip()
    
    match = re.search(r'cuit\s*[:\s]*([\d\-]{11,13})', texto_lower)
    if match:
        return match.group(1).strip()
    
    match = re.search(r'(?:dni|d\.n\.?i\.?|documento|nro\.?\s*doc|n[°º]\s*documento|n[uú]mero\s+de\s+documento)\s*[:\s]+(\d{6,8})', texto_lower)
    if match:
        dni = match.group(1)
        if len(dni) == 6:
            return dni
        return f"{dni[:2]}.{dni[2:5]}.{dni[5:]}"
    
    match = re.search(r'(\d{2}\.\d{3}\.\d{3})', texto)
    if match:
        return match.group(1)
    
    match = re.search(r'(\d{2}\-\d{8}\-\d{1})', texto)
    if match:
        return match.group(1)
    
    match = re.search(r'cuil\s*[:\s]+(\d{11})', texto_lower)
    if match:
        return match.group(1)
    
    return ""


def _extraer_fecha_nacimiento(texto):
    texto_limpio = re.sub(r'[™©®°±§¶†‡¨œ∑¢Ø⁄≈\[\]{}]', '', texto)
    
    MESES = r'(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)'
    
    patrones = [
        r'nacim?i?en?to?[:.\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'fech?a?\s+de\s+nacim?i?en?to?[:.\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'fecha[:.\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'nacido\s+el[:.\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})',
        r'nac[íi]\s+el[:.\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'f\.?\s*nasc[:.\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'data\s+de\s+nascim?i?en?to?[:.\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'nasc[ia][o]?\s*(?:em|ao|:)?\s*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'(\d{1,2})\s+de\s+' + MESES + r'\s+de\s+(\d{4})',
    ]
    
    for patron in patrones:
        match = re.search(patron, texto_limpio, re.IGNORECASE)
        if match:
            if match.lastindex >= 3:
                dia = match.group(1)
                mes = _mes_a_numero(match.group(2))
                anio = match.group(3)
                return _normalizar_fecha(f"{dia}-{mes}-{anio}")
            fecha = match.group(1).replace('/', '-').replace('.', '-')
            return _normalizar_fecha(fecha)
    
    match_fecha = re.search(r'\b(\d{2})[\s/\-\.]+(\d{2})[\s/\-\.]+(\d{4})\b', texto_limpio)
    if match_fecha:
        fecha = f"{match_fecha.group(1)}-{match_fecha.group(2)}-{match_fecha.group(3)}"
        return _normalizar_fecha(fecha)
    
    return ""


def _mes_a_numero(mes):
    m = mes.lower()
    meses = {
        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
        'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
        'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
        'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05',
        'jun': '06', 'jul': '07', 'ago': '08', 'set': '09', 'out': '10',
        'nov': '11', 'dez': '12',
    }
    return meses.get(m, '01')


def _normalizar_fecha(fecha):
    try:
        partes = re.split(r'[\/\-]', fecha)
        if len(partes) == 3:
            dia, mes, anio = partes
            
            if len(anio) == 2:
                anio = f"19{anio}" if int(anio) > 50 else f"20{anio}"
            
            fecha_obj = datetime(int(anio), int(mes), int(dia))
            
            if fecha_obj > datetime.now():
                return ""
            
            edad = (datetime.now() - fecha_obj).days // 365
            if edad < 14 or edad > 80:
                return ""
            
            return fecha_obj.strftime('%d-%m-%Y')
    except:
        pass
    return ""


def _extraer_telefono(texto):
    telefonos = []
    texto_limpio = re.sub(r'[™©®°±§¶†‡¨œ∑¢Ø⁄≈\[\]{}]', '', texto)
    
    todos_numeros = re.findall(r'\b\d{9,10}\b', texto_limpio)
    for num in todos_numeros:
        if not num.startswith(PREFIOS_EXCLUIR_TELEFONO):
            if num not in telefonos:
                telefonos.append(num)
    
    if not telefonos:
        patrones_telefono = [
            r'trio\s*k[\s.\-]*(\d{9,})',
            r'contacto[\s.\-:]*(\d{9,})',
            r'cel[ular]*[\s.\-:]*(\d{9,})',
            r'whatsapp[\s.\-:]*(\d{9,})',
        ]
        
        for patron in patrones_telefono:
            matches = re.findall(patron, texto_limpio, re.IGNORECASE)
            for tel in matches:
                if not tel.startswith(PREFIOS_EXCLUIR_TELEFONO):
                    if tel not in telefonos and len(tel) >= 9:
                        telefonos.append(tel)
    
    if not telefonos:
        coincidencias = re.findall(r'\b\d{8,11}\b', texto_limpio)
        for numero in coincidencias:
            if not numero.startswith(PREFIOS_EXCLUIR_TELEFONO):
                if int(numero[:2] or 0) <= 9:
                    continue
                if len(numero) <= 8:
                    continue
                if numero not in telefonos:
                    telefonos.append(numero)
    
    patrones_prioritarios = [
        r'[☎📞📱✆]\s*([\+]?[\d\s\-\(\)]{8,20})',
        r'(?:celular|movil|telefono|whatsapp|wsp)[:\s]*([\d\s\-\+]{8,20})',
        r'(?:cel|celular|movil)[\s\-]*(\d{3,5}[\s\-]*\d{3,4}[\s\-]*\d{2,4})',
        r'(?:tel|telefono)[\s\-]*(\d{2,5}[\s\-]*\d{3,4}[\s\-]*\d{2,4})',
        r'(\+?54[\s\-]?9?[\s\-]?\d{2,5}[\s\-]?\d{3,4}[\s\-]?\d{3,4})',
        r'(\+\d{1,3}[\s\-]?\d{2,5}[\s\-]?\d{3,4}[\s\-]?\d{3,4})',
        r'\((\d{2,4})\)\s*(\d{3,5})[\s\-]*(\d{3,4})',
        r'\b15[\s\-]?(\d{7,8})\b',
    ]
    
    for patron in patrones_prioritarios:
        coincidencias = re.findall(patron, texto_limpio, re.IGNORECASE)
        for tel in coincidencias:
            if isinstance(tel, tuple):
                tel = ''.join(tel)
            numero = re.sub(r'\D', '', tel)
            if 10 <= len(numero) <= 14:
                if numero not in telefonos:
                    telefonos.append(numero)
    
    telefonos_limpios = []
    for tel in telefonos:
        tel_normalizado = re.sub(r'\D', '', tel)
        if tel_normalizado.startswith('549') and len(tel_normalizado) > 10:
            tel_normalizado = tel_normalizado[3:]
        elif tel_normalizado.startswith('54') and len(tel_normalizado) > 10:
            tel_normalizado = tel_normalizado[2:]
        elif tel_normalizado.startswith('15') and len(tel_normalizado) == 10:
            tel_normalizado = '11' + tel_normalizado[2:]
        tel_normalizado = tel_normalizado.lstrip('0')
        telefonos_limpios.append(tel_normalizado)
    
    principales = list(dict.fromkeys(telefonos_limpios))
    principal = principales[0] if principales else ""
    return principal, principales[:5]


def _extraer_email(texto, nombre=None):
    texto_limpio = re.sub(r'[™©®°±§¶†‡¨œ∑¢Ø⁄≈\[\]{}]', '', texto)
    texto_lower = texto_limpio.lower()
    
    emails = []
    
    matches = re.findall(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+', texto_lower)
    for m in matches:
        m_clean = m.strip('.,;:()\'\"')
        if m_clean not in emails:
            emails.append(m_clean)
    
    texto_unido = texto_lower.replace('\n', '').replace('\r', '')
    matches_unido = re.findall(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+', texto_unido)
    for m in matches_unido:
        m_clean = m.strip('.,;:()\'\"')
        if m_clean not in emails:
            emails.append(m_clean)
    
    if not emails:
        dominios = ['gmail', 'hotmail', 'outlook', 'yahoo', 'live']
        for dominio in dominios:
            if dominio in texto_lower:
                pos = texto_lower.find(dominio)
                inicio = texto_lower.rfind(' ', 0, pos)
                if inicio < 0:
                    inicio = 0
                email = texto_lower[inicio:pos+len(dominio)+4]
                email = email.strip()
                if '@' not in email and 'gmail' in email:
                    email = email.replace(dominio, '@' + dominio)
                emails.append(email)
    
    if not emails:
        return ""
    
    emails = list(dict.fromkeys([e.lower() for e in emails]))
    
    if nombre:
        nombre_norm = nombre.lower()
        partes = nombre_norm.split()
        for email in emails:
            usuario = email.split('@')[0]
            if any(p in usuario for p in partes if len(p) > 3):
                return email
    
    dominios_preferidos = DOMINIOS_PERSONALES + ('hotmail.com.ar', 'gmail.com.ar', 'yahoo.com.ar', 'outlook.com.ar', 'live.com.ar', 'icloud.com.ar')
    for email in emails:
        if any(email.endswith(d) for d in dominios_preferidos):
            return email
    
    return emails[0]


def _extraer_domicilio(texto):
    domicile = []
    texto_limpio = re.sub(r'[™©®°±§¶†‡¨œ∑¢Ø⁄≈\[\]{}]', '', texto)
    
    patrones = [
        r'calle\s*[:\s]+([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ][^\n]{5,60})',
        r'domicilio\s*[:\s]+([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ][^\n]{5,60})',
        r'direcci[oó]n\s*[:\s]+([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ][^\n]{5,60})',
        r'barrio\s*[:\s]+([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ][^\n]{5,60})',
        r'b°\s*[:\s]*([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ][^\n]{5,60})',
        r'localidad\s*[:\s]+([A-Za-zÁÉÍÓÚÑáéíóúñ][^\n]{4,40})',
        r'provincia\s*[:\s]+([A-Za-zÁÉÍÓÚÑáéíóúñ][^\n]{4,30})',
        r'c[oó]digo\s+postal\s*[:\s]+(\d{4})',
        r'cp\s*[:\s]+(\d{4})',
        r'(\d{1,5}\s+[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ\s]{3,40})',
    ]
    
    for patron in patrones:
        coincidencias = re.findall(patron, texto_limpio, re.IGNORECASE)
        for direccion in coincidencias:
            direccion_limpia = direccion.strip()
            if len(direccion_limpia) > 3:
                if direccion_limpia not in domicile:
                    domicile.append(direccion_limpia)
    
    match_mza = re.search(r'(?:domicilio|direcci[oó]n)?\s*:?\s*(s/?n\s+)?mza\.?\s*(\d+)\s*(?:solar\s*(\d+))?\s*[-–]\s*([a-záéíóúñ\s]+?)(?:\s*-\s*localidad|\s+localidad|\s*-\s*[A-Z][a-z]+\s*-)', texto_limpio, re.IGNORECASE)
    if match_mza:
        partes = []
        if match_mza.group(1):
            partes.append("S/N")
        partes.append(f"Mza. {match_mza.group(2)}")
        if match_mza.group(3):
            partes.append(f"Solar {match_mza.group(3)}")
        partes.append(match_mza.group(4).strip())
        direccion_extraida = " - ".join(partes)
        if len(direccion_extraida) > 8 and direccion_extraida not in domicile:
            domicile.append(direccion_extraida)
    
    principal = domicile[0] if domicile else ""
    return principal, domicile[:5]


def _extraer_oficios(texto):
    texto_lower = texto.lower()
    oficios_detectados = []
    oficios_vistos = set()
    
    for oficio, keywords in OFICIOS.items():
        detected = False
        for keyword in keywords:
            keyword_lower = keyword.lower()
            
            if keyword_lower == 'mig' or keyword_lower == 'mag' or keyword_lower == 'tig':
                if 'soldador' in texto_lower:
                    pos_soldador = texto_lower.find('soldador')
                    pos_tecnica = texto_lower.find(keyword_lower)
                    if pos_tecnica > 0 and abs(pos_soldador - pos_tecnica) > 30:
                        continue
                    detected = True
                else:
                    continue
            elif keyword_lower in texto_lower:
                detected = True
            
            if detected:
                oficio_key = oficio.lower().strip()
                if oficio_key not in oficios_vistos:
                    oficios_detectados.append(oficio)
                    oficios_vistos.add(oficio_key)
                break
    
    return oficios_detectados


def _extraer_experiencia_laboral(texto):
    patrones_seccion = [
        r'experiencia[s]?\s+laboral[:\s]*(.*?)(?:formación|estudios|referencias|capacitación|certificados|$)',
        r'experiencia\s+profesional[:\s]*(.*?)(?:formación|estudios|referencias|capacitación|certificados|$)',
        r'trayectoria\s+laboral[:\s]*(.*?)(?:formación|estudios|referencias|capacitación|certificados|$)',
    ]
    
    for patron in patrones_seccion:
        match = re.search(patron, texto, re.IGNORECASE | re.DOTALL)
        if match:
            seccion_experiencia = match.group(1)
            oficios_exp = _extraer_oficios(seccion_experiencia)
            if oficios_exp:
                return oficios_exp
    
    return []


def _spacy_ner(texto):
    if not NLP:
        return {}
    
    try:
        doc = NLP(texto[:50000])
        resultado = {"person": [], "loc": [], "org": []}
        
        for ent in doc.ents:
            if ent.label_ == "PER":
                resultado["person"].append(ent.text)
            elif ent.label_ in ("LOC", "GPE"):
                resultado["loc"].append(ent.text)
            elif ent.label_ == "ORG":
                resultado["org"].append(ent.text)
        
        return resultado
    except Exception:
        return {}


def extraer_datos_personales(texto):
    resultado = {
        "nombre": "", "dni": "", "fecha_nacimiento": "",
        "edad": "", "domicilio": "", "domicilios_opciones": [],
        "email": "", "telefono": "", "telefonos_opciones": [],
    }
    
    if not texto:
        return resultado
    
    texto_limpio = _limpiar_texto_ocr(texto)
    texto_transformado = _transformar_texto_extraccion(texto_limpio)
    entidades = _spacy_ner(texto_limpio)
    
    resultado["nombre"] = _extraer_nombre(texto_transformado, entidades, texto_limpio)
    resultado["dni"] = _extraer_dni(texto_transformado)
    resultado["fecha_nacimiento"] = _extraer_fecha_nacimiento(texto_transformado)
    resultado["edad"] = calcular_edad(resultado["fecha_nacimiento"])
    resultado["domicilio"], resultado["domicilios_opciones"] = _extraer_domicilio(texto_transformado)
    resultado["telefono"], resultado["telefonos_opciones"] = _extraer_telefono(texto_transformado)
    resultado["email"] = _extraer_email(texto_transformado, resultado["nombre"])
    
    return resultado


def extraer_oficios_experiencia(texto):
    oficios_lista = _extraer_oficios(texto)
    oficios_experiencia = _extraer_experiencia_laboral(texto)
    
    oficios_totales = []
    for of in oficios_experiencia:
        if of not in oficios_totales:
            oficios_totales.append(of)
    for of in oficios_lista:
        if of not in oficios_totales:
            oficios_totales.append(of)
    
    return oficios_totales


def extraer_datos_cv(pdf_path):
    resultado = {
        "nombre": "", "dni": "", "fecha_nacimiento": "",
        "edad": "", "domicilio": "", "domicilios_opciones": [],
        "email": "", "telefono": "", "telefonos_opciones": [],
        "oficio": "", "oficios_detectados": [],
    }
    
    if not pdf_path or not os.path.exists(pdf_path):
        return resultado
    
    info_ocr = detectar_si_necesita_ocr(pdf_path)
    
    if info_ocr["requiere_ocr"]:
        texto_completo = _extraer_texto_ocr(pdf_path)
    else:
        texto_completo = ""
        try:
            if pdfplumber:
                with pdfplumber.open(pdf_path) as pdf:
                    for page in pdf.pages:
                        contenido = page.extract_text(x_tolerance=2, y_tolerance=2, layout=True)
                        if contenido:
                            texto_completo += contenido + "\n"
        except Exception as e:
            print(f"Error extrayendo texto: {e}")
            texto_completo = ""
    
    if not texto_completo.strip():
        return resultado
    
    datos_personales = extraer_datos_personales(texto_completo)
    
    resultado.update(datos_personales)
    
    oficios = extraer_oficios_experiencia(texto_completo)
    resultado["oficios_detectados"] = oficios
    resultado["oficio"] = oficios[0] if oficios else ""
    
    resultado["info_ocr"] = {
        "requiere_ocr": info_ocr["requiere_ocr"],
        "total_paginas": info_ocr["total_paginas"],
        "porcentaje_texto": info_ocr["porcentaje_texto"]
    }
    
    return resultado


def get_temp_path():
    carpeta = os.path.join('static', 'temp')
    os.makedirs(carpeta, exist_ok=True)
    return carpeta


def guardar_pdf_temp(file) -> tuple[str, str]:
    carpeta = get_temp_path()
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    filename = f"temp_{timestamp}_{random_str}.pdf"
    filepath = os.path.join(carpeta, filename)
    
    with open(filepath, 'wb') as f:
        shutil.copyfileobj(file.file, f)
    
    return filepath, filename


def limpiar_temp(filepath):
    if filepath and os.path.exists(filepath):
        try:
            os.remove(filepath)
        except:
            pass