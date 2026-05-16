import { useState, useEffect } from 'react';
import { cvsAPI } from '../api';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import OficioSelector from '../components/forms/OficioSelector';
import DatePicker, { registerLocale } from 'react-datepicker';
import es from 'date-fns/locale/es';
import 'react-datepicker/dist/react-datepicker.css';
registerLocale('es', es);

export default function SubirCV() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
const [searchParams] = useSearchParams();
const navigate = useNavigate();
const { user: authUser } = useAuthStore();
  const [tokenValido, setTokenValido] = useState(null);
  const [tokenError, setTokenError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    fecha_nacimiento: '',
    telefono: '',
    domicilio: '',
    email: '',
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [fotoFile, setFotoFile] = useState(null);
  const [selectedOficios, setSelectedOficios] = useState([]);
  const [fechaDate, setFechaDate] = useState(null);

  // Validar si es admin o validar token del QR
  useEffect(() => {
    const validarAcceso = async () => {
      // Verificar si es administrador primero (zustand store)
      if (authUser?.is_admin) {
        setIsAdmin(true);
        setTokenValido('admin');
        return;
      }

      // Fallback: verificar localStorage directamente si el store no está listo
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user?.is_admin) {
            setIsAdmin(true);
            setTokenValido('admin');
            return;
          }
        } catch (e) {
          console.error('Error parsing user:', e);
        }
      }

      // Si no es admin, validar token del QR
      const token = searchParams.get('token');
      
      if (!token) {
        try {
          const res = await cvsAPI.generarToken();
          const nuevoToken = res.data.token;
          navigate(`/subir-cv?token=${nuevoToken}`, { replace: true });
        } catch (e) {
          console.error('Error generando token:', e);
          setTokenError(true);
        }
        return;
      }

      try {
        const res = await cvsAPI.validarToken(token);
        if (!res.data.valido) {
          setTokenError(true);
        } else {
          setTokenValido(token);
        }
      } catch (e) {
        console.error('Error validando token:', e);
        setTokenError(true);
      }
    };

    validarAcceso();
  }, [searchParams, navigate, authUser]);

  // Restaurar datos del sessionStorage al cargar
  useEffect(() => {
    const savedData = sessionStorage.getItem('subirCV_datos');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setForm(parsed.form || form);
        setSelectedOficios(parsed.selectedOficios || []);
        setPdfFile(parsed.pdfName ? { name: parsed.pdfName } : null);
        setFotoFile(parsed.fotoName ? { name: parsed.fotoName } : null);
        if (parsed.form?.fecha_nacimiento) {
          const partes = parsed.form.fecha_nacimiento.split('-');
          if (partes.length === 3) {
            setFechaDate(new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2])));
          }
        }
      } catch (e) {
        console.error('Error restoring data:', e);
      }
    }
  }, []);

  // Sincronizar fechaDate -> form.fecha_nacimiento
  useEffect(() => {
    if (fechaDate && !isNaN(fechaDate.getTime())) {
      const anio = fechaDate.getFullYear();
      const mes = String(fechaDate.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaDate.getDate()).padStart(2, '0');
      setForm(prev => ({ ...prev, fecha_nacimiento: `${anio}-${mes}-${dia}` }));
    }
  }, [fechaDate]);

  // Guardar datos en sessionStorage automáticamente
  useEffect(() => {
    const dataToSave = {
      form,
      selectedOficios,
      pdfName: pdfFile?.name || null,
      fotoName: fotoFile?.name || null,
    };
    sessionStorage.setItem('subirCV_datos', JSON.stringify(dataToSave));
  }, [form, selectedOficios, pdfFile, fotoFile]);

  // Limpiar sessionStorage al enviar exitosamente
  const clearSavedData = () => {
    sessionStorage.removeItem('subirCV_datos');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!pdfFile) {
      setError('Debes adjuntar el PDF de tu CV');
      return;
    }
    
    if (selectedOficios.length === 0) {
      setError('Debes ingresar al menos un oficio');
      return;
    }

    const confirmar = window.confirm('¿Estás seguro de enviar tu CV?');
    if (!confirmar) {
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => formData.append(key, form[key]));
      formData.append('oficios', selectedOficios.join(', '));
      formData.append('file', pdfFile);
      if (fotoFile) formData.append('foto', fotoFile);

      if (isAdmin) {
        // Admin: usar endpoint autenticado
        await cvsAPI.create(formData);
      } else {
        // Usuario público: usar endpoint público
        const res = await cvsAPI.createPublic(formData);
        
        if (tokenValido && tokenValido !== 'admin') {
          try {
            await cvsAPI.usarToken(tokenValido, res.data?.cv_id || null);
          } catch (e) {
            console.error('Error marcando token:', e);
          }
        }
      }
      
      clearSavedData();
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Error al enviar el CV');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePdfChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        setError('El archivo PDF no puede superar 16MB');
        return;
      }
      setPdfFile(file);
    }
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('La foto no puede superar 5MB');
        return;
      }
      setFotoFile(file);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-start justify-center p-4 bg-gradient-to-br from-[#1e3c72] to-[#2a5298]">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-[fadeInUp_0.5s_ease-out]">
          <div className="bg-gradient-to-br from-[#1e3c72] to-[#2a5298] py-8 px-10 text-center text-white">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="bi bi-building text-3xl"></i>
            </div>
            <h1 className="text-xl font-bold mb-1">Bolsa de Trabajo UOCRA</h1>
            <p className="text-lg font-semibold">CV Enviado Exitosamente</p>
          </div>
          <div className="p-10 text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-[pulse_2s_infinite]">
              <i className="bi bi-check-circle-fill text-4xl text-white"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">¡Tu CV fue subido exitosamente!</h3>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Tu información está a la espera de ser aprobada y verificada por nuestro equipo.<br/>
              Te contactaremos pronto.
            </p>
            <a 
              href="/subir-cv" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1e3c72] text-white font-semibold rounded-full transition-all duration-300 hover:bg-[#2a5298] hover:shadow-lg hover:-translate-y-0.5"
            >
              <i className="bi bi-qr-code"></i> Volver al Inicio
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-start justify-center p-4 bg-gradient-to-br from-[#1e3c72] to-[#2a5298]">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
          <div className="bg-gradient-to-br from-red-600 to-red-700 py-8 px-10 text-center text-white">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="bi bi-exclamation-triangle text-3xl"></i>
            </div>
            <h1 className="text-xl font-bold mb-1">Acceso Denegado</h1>
          </div>
          <div className="p-10 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="bi bi-qr-code-scan text-4xl text-red-600"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Este enlace ha sido usado o expirado</h3>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Para acceder al formulario de subida de CV, debés escanear el código QR nuevamente.<br/>
              El QR debe escanearse con la cámara del celular, no se puede compartir el enlace.
            </p>
            <a 
              href="/subir-cv" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1e3c72] text-white font-semibold rounded-full transition-all duration-300 hover:bg-[#2a5298]"
            >
              <i className="bi bi-arrow-repeat"></i> Intentar de nuevo
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (tokenValido === null && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e3c72] to-[#2a5298]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center p-4 md:p-8 bg-gradient-to-br from-[#1e3c72] to-[#2a5298]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-[fadeInUp_0.8s_ease-out]">
        <div className="bg-gradient-to-br from-[#1e3c72] to-[#2a5298] py-12 px-10 text-center text-white">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-[fadeIn_1s_ease-out]">
            <i className="bi bi-building text-5xl"></i>
          </div>
          <h1 className="text-2xl font-bold mb-2">Bienvenido a la Bolsa de Trabajo</h1>
          <p className="text-lg opacity-90">Sube tu CV y forma parte de nuestra base de datos</p>
          {isAdmin && (
             <span className="inline-block mt-3 px-4 py-1 bg-white/20 rounded-full text-sm font-semibold">
               <i className="bi bi-shield-fill-check mr-1"></i> Modo Administrador
             </span>
           )}
           {!isAdmin && tokenValido && tokenValido !== 'admin' && (
             <span className="inline-block mt-3 px-4 py-1 bg-green-500/30 rounded-full text-sm font-semibold">
               <i className="bi bi-person mr-1"></i> Modo Invitado
             </span>
           )}
        </div>

        <div className="p-10">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-gray-800 mb-2">Nombre <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72] transition-all duration-300"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-800 mb-2">Apellido <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="apellido"
                  value={form.apellido}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72] transition-all duration-300"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-gray-800 mb-2">DNI <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="dni"
                  value={form.dni}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72] transition-all duration-300"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-800 mb-2">Fecha de Nacimiento</label>
                <DatePicker
                  selected={fechaDate}
                  onChange={date => setFechaDate(date)}
                  dateFormat="dd/MM/yyyy"
                  locale="es"
                  placeholderText="Seleccionar fecha"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72] transition-all duration-300"
                  wrapperClassName="w-full"
                  popperPlacement="bottom"
                  showYearDropdown
                  showMonthDropdown
                  dropdownMode="select"
                  yearDropdownItemNumber={100}
                  minDate={new Date(1940, 0, 1)}
                  maxDate={new Date()}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-800 mb-2">Teléfono <span className="text-red-600">*</span></label>
              <input
                type="tel"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="Ej: 11 1234-5678"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72] transition-all duration-300"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-800 mb-2">Domicilio <span className="text-red-600">*</span></label>
              <input
                type="text"
                name="domicilio"
                value={form.domicilio}
                onChange={handleChange}
                placeholder="Dirección completa"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72] transition-all duration-300"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-800 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72] transition-all duration-300"
              />
            </div>

            <OficioSelector
              selected={selectedOficios}
              onChange={setSelectedOficios}
            />

            <div>
              <label className="block font-semibold text-gray-800 mb-2">CV (PDF o Imagen) <span className="text-red-600">*</span></label>
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                  pdfFile 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-red-500 bg-red-50 hover:border-[#1e3c72] hover:bg-blue-50'
                }`}
                onClick={() => document.getElementById('pdfInput').click()}
              >
                <input 
                  type="file" 
                  id="pdfInput" 
                  accept=".pdf,.jpg,.jpeg,.png" 
                  className="hidden" 
                  onChange={handlePdfChange}
                />
                <div className="text-4xl mb-3">
                  {pdfFile ? (
                    <i className="bi bi-file-earmark-pdf-fill text-green-600"></i>
                  ) : (
                    <i className="bi bi-file-earmark-pdf text-red-500"></i>
                  )}
                </div>
                {pdfFile ? (
                  <p className="text-green-600 font-semibold">{pdfFile.name}</p>
                ) : (
                  <p className="text-gray-600">Click para seleccionar archivo PDF o Imagen</p>
                )}
              </div>
              <small className="text-gray-500 mt-2 block">Formato: PDF, JPG, PNG (max 16MB)</small>
            </div>

            <div>
              <label className="block font-semibold text-gray-800 mb-2">Foto <span className="text-red-600">*</span></label>
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                  fotoFile 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-blue-500 bg-blue-50 hover:border-[#1e3c72] hover:bg-blue-100'
                }`}
                onClick={() => document.getElementById('fotoInput').click()}
              >
                <input 
                  type="file" 
                  id="fotoInput" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFotoChange}
                />
                <div className="text-4xl mb-3">
                  {fotoFile ? (
                    <i className="bi bi-check-circle-fill text-green-600"></i>
                  ) : (
                    <i className="bi bi-camera-fill text-blue-500"></i>
                  )}
                </div>
                {fotoFile ? (
                  <p className="text-green-600 font-semibold">{fotoFile.name}</p>
                ) : (
                  <p className="text-gray-600">Click para seleccionar foto</p>
                )}
              </div>
              <small className="text-gray-500 mt-2 block">Formato: JPG, PNG (max 5MB)</small>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-[#1e3c72] to-[#2a5298] text-white font-semibold text-lg rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-[#1e3c72]/40 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <i className="bi bi-arrow-repeat animate-spin"></i>
                  Enviando...
                </>
              ) : (
                <>
                  <i className="bi bi-send"></i> Enviar mi CV
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
