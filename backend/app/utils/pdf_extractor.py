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
    
    texto = re.sub(r'\s+', ' ', texto)
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
        
        for img in imagenes:
            img_procesada = _preprocesar_imagen_ocr(img)
            if img_procesada is not None:
                from PIL import Image as PILImage
                img_pil = PILImage.fromarray(img_procesada)
                texto += pytesseract.image_to_string(img_pil, lang='spa', config='--oem 3 --psm 6') + "\n"
            else:
                texto += pytesseract.image_to_string(img, lang='spa', config='--oem 3 --psm 6') + "\n"
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
        texto = ""
        for img in imagenes:
            img_procesada = _preprocesar_imagen_ocr(img)
            if img_procesada is not None:
                from PIL import Image as PILImage
                img_pil = PILImage.fromarray(img_procesada)
                texto += pytesseract.image_to_string(img_pil, lang='spa', config='--oem 3 --psm 6') + "\n"
            else:
                texto += pytesseract.image_to_string(img, lang='spa', config='--oem 3 --psm 6') + "\n"
        return texto
    except Exception as e:
        print(f"Error OCR: {e}")
        return ""


def _extraer_nombre(texto, entidades=None):
    if entidades and entidades.get("person"):
        for nombre in entidades["person"]:
            if len(nombre.split()) >= 2:
                return nombre.title()
    
    texto_limpio = re.sub(r'[™©®°±§¶†‡¨œ∑¢Ø⁄≈_\-\[\]{}]', '', texto)
    texto_limpio = re.sub(r'\s+', ' ', texto_limpio)
    
    match = re.search(r'apellido.*?nombre.*?:\s*([A-Za-zÁÉÍÓÚÑ]{3,},\s*[A-Za-zÁÉÍÓÚÑ]{3,}\s*[A-Za-zÁÉÍÓÚÑ]{3,})', texto_limpio, re.IGNORECASE)
    if match:
        nombre = match.group(1)
        partes = nombre.split(',')
        nombre = f"{partes[1].strip()} {partes[0].strip()}"
        if len(nombre.split()) >= 2:
            return nombre.title()
    
    match = re.search(r'nombre.*?:\s*([A-Za-zÁÉÍÓÚÑ]{3,}\s+[A-Za-zÁÉÍÓÚÑ]{3,})', texto_limpio, re.IGNORECASE)
    if match:
        nombre = match.group(1).strip()
        nombre = re.sub(r'(fecha|dni|edad|estado|domicilio).*', '', nombre, flags=re.IGNORECASE).strip()
        if len(nombre.split()) >= 2:
            return nombre.title()
    
    match = re.search(r'apellido.*?:\s*([A-Za-zÁÉÍÓÚÑ]{3,},\s*[A-Za-zÁÉÍÓÚÑ]{3,})', texto_limpio, re.IGNORECASE)
    if match:
        nombre = match.group(1)
        partes = nombre.split(',')
        nombre = f"{partes[1].strip()} {partes[0].strip()}"
        if len(nombre.split()) >= 2:
            return nombre.title()
    
    nombre_mayusculas = _extraer_nombre_mayusculas_inicio(texto_limpio)
    if nombre_mayusculas:
        return nombre_mayusculas
    
    return _extraer_primera_linea_valida(texto_limpio)


def _extraer_nombre_mayusculas_inicio(texto):
    lineas = texto.split('\n')
    for linea in lineas[:5]:
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
        
        match = re.search(r'^([A-ZÁÉÍÓÚÑ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ]{3,}){1,4})', linea)
        if match:
            nombre_original = match.group(1)
            palabras = nombre_original.split()
            
            if len(palabras) >= 2:
                palabras_validas = []
                for palabra in palabras:
                    palabra_lower = palabra.lower()
                    if palabra_lower not in ['objetivo', 'experiencia', 'formación', 'estudios', 'referencia', 'contacto', 'informacion', 'información', 'profesional', 'empleo', 'puesto', 'trabajo', 'area', 'sectores', 'conseguir']:
                        palabras_validas.append(palabra)
                
                if len(palabras_validas) >= 2:
                    nombre = ' '.join(palabras_validas[:4])
                    return nombre.title()
    return ""


def _extraer_primera_linea_valida(texto):
    lineas = texto.splitlines()
    for linea in lineas:
        linea = linea.strip()
        if len(linea) < 3:
            continue
        if re.search(r'\d{5,}', linea):
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
        partes = linea.split()
        if len(partes) >= 2:
            return linea.title()
    return ""


def _extraer_dni(texto):
    texto_lower = texto.lower()
    
    match = re.search(r'dni\s*[:\s]+(\d{7,8})', texto_lower)
    if match:
        dni = match.group(1)
        return f"{dni[:2]}.{dni[2:5]}.{dni[5:]}"
    
    match = re.search(r'd\.n\.?i\.?\s*[:\s]+(\d{7,8})', texto_lower)
    if match:
        dni = match.group(1)
        return f"{dni[:2]}.{dni[2:5]}.{dni[5:]}"
    
    match = re.search(r'documento\s*[:\s]+(\d{7,8})', texto_lower)
    if match:
        dni = match.group(1)
        return f"{dni[:2]}.{dni[2:5]}.{dni[5:]}"
    
    match = re.search(r'(\d{2}\.\d{3}\.\d{3})', texto)
    if match:
        return match.group(1)
    
    return ""


def _extraer_fecha_nacimiento(texto):
    texto_limpio = re.sub(r'[™©®°±§¶†‡¨œ∑¢Ø⁄≈\[\]{}]', '', texto)
    
    patrones = [
        r'nacim?i?en?to?[:.\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'fech?a?\s+de\s+nacim?i?en?to?[:.\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'fecha[:.\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'nacido\s+el[:.\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})',
    ]
    
    for patron in patrones:
        match = re.search(patron, texto_limpio, re.IGNORECASE)
        if match:
            fecha = match.group(1).replace('/', '-').replace('.', '-')
            return _normalizar_fecha(fecha)
    
    match_fecha = re.search(r'\b(\d{2})[\s/\-\.]+(\d{2})[\s/\-\.]+(\d{4})\b', texto_limpio)
    if match_fecha:
        fecha = f"{match_fecha.group(1)}-{match_fecha.group(2)}-{match_fecha.group(3)}"
        return _normalizar_fecha(fecha)
    
    return ""


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
            if edad < 16 or edad > 80:
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
        r'(?:cel|celular|movil)[\s\-]*(\d{3,4}[\s\-]*\d{3,4}[\s\-]*\d{2,4})',
        r'(?:tel|telefono)[\s\-]*(\d{2,4}[\s\-]*\d{3,4}[\s\-]*\d{2,4})',
        r'(\+?54\s?9?\s?\d{2,4}\s?\d{6,8})',
    ]
    
    for patron in patrones_prioritarios:
        coincidencias = re.findall(patron, texto_limpio, re.IGNORECASE)
        for tel in coincidencias:
            if isinstance(tel, tuple):
                tel = ''.join(tel)
            numero = re.sub(r'\D', '', tel)
            if 10 <= len(numero) <= 12 and not numero.startswith(PREFIOS_EXCLUIR_TELEFONO):
                if numero not in telefonos:
                    telefonos.append(numero)
    
    telefonos_limpios = []
    for tel in telefonos:
        tel_normalizado = tel
        if tel.startswith('549') and len(tel) > 10:
            tel_normalizado = tel[2:]
        elif tel.startswith('15') and len(tel) == 10:
            tel_normalizado = '11' + tel[2:]
        tel_normalizado = tel_normalizado.lstrip('0')
        telefonos_limpios.append(tel_normalizado)
    
    principales = list(dict.fromkeys(telefonos_limpios))
    principal = principales[0] if principales else ""
    return principal, principales[:5]


def _extraer_email(texto, nombre=None):
    texto_limpio = re.sub(r'[™©®°±§¶†‡¨œ∑¢Ø⁄≈\[\]{}]', '', texto)
    texto_lower = texto_limpio.lower()
    
    emails = []
    
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
        match = re.search(r'(\S+@\S+)', texto_limpio)
        if match:
            emails.append(match.group(1))
    
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
    
    for email in emails:
        if any(email.endswith(d) for d in DOMINIOS_PERSONALES):
            return email
    
    return emails[0]


def _extraer_domicilio(texto):
    domicile = []
    texto_limpio = re.sub(r'[™©®°±§¶†‡¨œ∑¢Ø⁄≈\[\]{}]', '', texto)
    
    PALABRAS_PARADA = r'(?:ibero|americana|deseado|experiencia|educaci|estudios|formaci|informaci|referencia|capacitaci|certificado|idioma|herramienta|tarea|alambrado|vereda|muro|mampostería|poste|hormig|construcci|contacto|telefono|celular|email|dni|documento|localidad|nacionalidad|estado civil)'
    
    patrones = [
        r'calle\s*[:\s]+([A-Za-zÁÉÍÓÚÑ][^\n' + PALABRAS_PARADA + r']{8,50})',
        r'domicilio\s*[:\s]+([A-Za-zÁÉÍÓÚÑ][^\n' + PALABRAS_PARADA + r']{8,50})',
        r'direcci[oó]n\s*[:\s]+([A-Za-zÁÉÍÓÚÑ][^\n' + PALABRAS_PARADA + r']{8,50})',
        r'barrio\s*[:\s]+([A-Za-zÁÉÍÓÚÑ][^\n' + PALABRAS_PARADA + r']{8,50})',
        r'b°\s*[:\s]*([A-Za-zÁÉÍÓÚÑ][^\n' + PALABRAS_PARADA + r']{8,50})',
    ]
    
    for patron in patrones:
        coincidencias = re.findall(patron, texto_limpio, re.IGNORECASE)
        for direccion in coincidencias:
            direccion_limpia = direccion.strip()
            if len(direccion_limpia) > 5:
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
    return principal, domicile[:3]


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
    
    return oficios_detectados[:3]


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
    
    resultado["nombre"] = _extraer_nombre(texto_transformado, entidades)
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