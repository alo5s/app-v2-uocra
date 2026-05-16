import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { cvsAPI } from '../api';
import { useToastStore } from '../store/uiStore';
import { Button, Card, CardBody, Loader } from '../components/ui';
import OficioSelector from '../components/forms/OficioSelector';

export default function RevisarCV() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToastStore();
  
  const isNewCV = !id || id === 'undefined' || id === 'new';
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [oficiosSeleccionados, setOficiosSeleccionados] = useState([]);
  const [cvData, setCvData] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  
  const [form, setForm] = useState({
    nombre: '',
    dni: '',
    fecha_nacimiento: '',
    genero: '',
    domicilio: '',
    email: '',
    telefono: '',
    area: '',
    afiliado: 'no',
    fue_afiliado: false,
    apodo: '',
    sin_experiencia: false,
    tiene_documentacion: false,
    tiene_licencia: false,
    linea_conducir: '',
    activo: true,
    estado: 'aprobado',
  });

  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);

  useEffect(() => {
    if (isNewCV) {
      const state = location.state;
      if (state?.file) {
        setPendingFile(state.file);
        setPendingUrl(state.previewUrl);
        if (state.datos) {
          setForm(prev => ({
            ...prev,
            nombre: state.datos.nombre || '',
            dni: state.datos.dni || '',
            fecha_nacimiento: state.datos.fecha_nacimiento || '',
            domicilio: state.datos.domicilio || '',
            email: state.datos.email || '',
            telefono: state.datos.telefono || '',
          }));
          if (state.datos.oficios_detectados?.length > 0) {
            setOficiosSeleccionados(state.datos.oficios_detectados);
          }
        }
      }
      setLoadingData(false);
    } else {
      fetchData();
    }
    }, [id]);

  const fetchData = async () => {
    if (isNewCV) {
      setLoadingData(false);
      return;
    }
    
    try {
      const res = await cvsAPI.getById(id);
      const cv = res.data;
      setCvData(cv);
      setForm({
        nombre: cv.nombre || '',
        dni: cv.dni || '',
        fecha_nacimiento: cv.fecha_nacimiento || '',
        genero: cv.genero || '',
        domicilio: cv.domicilio || '',
        email: cv.email || '',
        telefono: cv.telefono || '',
        area: cv.area || '',
        afiliado: cv.afiliado || 'no',
        fue_afiliado: cv.fue_afiliado || false,
        apodo: cv.apodo || '',
        sin_experiencia: cv.sin_experiencia || false,
        tiene_documentacion: cv.tiene_documentacion || false,
        tiene_licencia: cv.tiene_licencia || false,
        linea_conducir: cv.linea_conducir || '',
        activo: cv.activo !== false,
        estado: cv.estado || 'aprobado',
      });
      if (cv.oficios) {
        setOficiosSeleccionados(cv.oficios.split(',').map(o => o.trim()));
      }
    } catch (error) {
      toast.error('Error al cargar el CV');
      navigate('/cvs');
    } finally {
      setLoadingData(false);
    }
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imágenes');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen no puede exceder 5MB');
        return;
      }
      setFoto(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleQuitarFoto = () => {
    setFoto(null);
    setFotoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (oficiosSeleccionados.length === 0) {
      toast.error('Debes agregar al menos un oficio');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('nombre', form.nombre);
      formData.append('dni', form.dni);
      formData.append('fecha_nacimiento', form.fecha_nacimiento);
      formData.append('genero', form.genero);
      formData.append('domicilio', form.domicilio);
      formData.append('email', form.email);
      formData.append('telefono', form.telefono);
      formData.append('area', form.area);
      formData.append('afiliado', form.afiliado);
      formData.append('fue_afiliado', form.fue_afiliado);
      formData.append('apodo', form.apodo);
      formData.append('sin_experiencia', form.sin_experiencia);
      formData.append('tiene_documentacion', form.tiene_documentacion);
      formData.append('tiene_licencia', form.tiene_licencia);
      formData.append('linea_conducir', form.linea_conducir);
      formData.append('activo', form.activo);
      formData.append('estado', 'aprobado');
      if (foto) {
        formData.append('foto', foto);
      }
      formData.append('oficios', oficiosSeleccionados.join(', '));
      
      await cvsAPI.update(id, formData);
      toast.success('CV aprobado exitosamente');
      navigate('/cv/pendientes');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar CV');
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async () => {
    if (isNewCV && !pendingFile) {
      toast.error('No hay archivo de CV');
      return;
    }
    
    if (oficiosSeleccionados.length === 0) {
      toast.error('Debes agregar al menos un oficio');
      return;
    }

    if (!form.area) {
      toast.error('Debes seleccionar una categoría');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('nombre', form.nombre);
      formData.append('dni', form.dni || '');
      formData.append('fecha_nacimiento', form.fecha_nacimiento || '');
      formData.append('genero', form.genero || '');
      formData.append('domicilio', form.domicilio || '');
      formData.append('email', form.email || '');
      formData.append('telefono', form.telefono || '');
      formData.append('area', form.area);
      formData.append('afiliado', form.afiliado);
      formData.append('fue_afiliado', form.fue_afiliado);
      formData.append('apodo', form.apodo || '');
      formData.append('sin_experiencia', form.sin_experiencia);
      formData.append('tiene_documentacion', form.tiene_documentacion);
      formData.append('tiene_licencia', form.tiene_licencia);
      formData.append('linea_conducir', form.linea_conducir || '');
      formData.append('activo', true);
      formData.append('estado', 'aprobado');
      if (foto) {
        formData.append('foto', foto);
      }
      formData.append('oficios', oficiosSeleccionados.join(', '));
      
      if (isNewCV) {
        if (pendingFile) {
          formData.append('file', pendingFile);
        }
        await cvsAPI.create(formData);
        toast.success('CV guardado y aprobado');
      } else {
        await cvsAPI.update(id, formData);
        toast.success('CV aprobado');
      }
      navigate('/cvs');
    } catch (error) {
      toast.error('Error al aprobar CV');
    } finally {
      setLoading(false);
    }
  };

  const handleRechazar = async () => {
    if (!confirm('¿Rechazar y eliminar este CV?')) return;
    try {
      await cvsAPI.rechazar(id);
      toast.success('CV rechazado');
      navigate('/cv/pendientes');
    } catch (error) {
      toast.error('Error al rechazar CV');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center" style={{ height: '250px' }}>
        <Loader />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/cv/pendientes')} 
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revisar CV</h1>
            {cvData?.estado === 'pendiente' && (
              <span className="text-sm text-yellow-600">
                <i className="bi bi-clock me-1"></i> Pendiente de revisión
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {cvData?.path && (
            <Button variant="outline" onClick={() => setShowPdfModal(true)}>
              <i className="bi bi-file-text me-1"></i> Ver CV PDF
            </Button>
          )}
          <Button 
            variant="danger" 
            onClick={handleRechazar}
          >
            <i className="bi bi-x-lg me-1"></i> Rechazar
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Foto del Usuario */}
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <i className="bi bi-camera text-[#1e3c72]"></i>
              Foto del Usuario
            </h2>
            <div className="flex items-center gap-4">
              {fotoPreview ? (
                <>
                  <img
                    src={fotoPreview}
                    alt="Preview"
                    className="w-24 h-24 object-cover rounded-lg border border-gray-300"
                  />
                  <Button type="button" variant="secondary" onClick={handleQuitarFoto}>
                    <i className="bi bi-x-lg me-1"></i> Quitar
                  </Button>
                </>
              ) : (
                <>
                  <label className="cursor-pointer px-4 py-2 bg-[#1e3c72] text-white rounded-lg hover:bg-[#2a4a8c] transition-colors">
                    <i className="bi bi-upload me-1"></i> Seleccionar foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFotoChange}
                      className="hidden"
                    />
                  </label>
                  <span className="text-sm text-gray-500">
                    JPG, PNG máximo 5MB
                  </span>
                </>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Datos Personales */}
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <i className="bi bi-person text-[#1e3c72]"></i>
              Datos Personales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apodo
                </label>
                <input
                  type="text"
                  name="apodo"
                  value={form.apodo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DNI
                </label>
                <input
                  type="text"
                  name="dni"
                  value={form.dni}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72]"
                  placeholder="XX.XXX.XXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de nacimiento
                </label>
                <input
                  type="date"
                  name="fecha_nacimiento"
                  value={form.fecha_nacimiento}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Género
                </label>
                <select 
                  name="genero" 
                  value={form.genero} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72]"
                >
                  <option value="">Seleccionar...</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Domicilio
                </label>
                <input
                  type="text"
                  name="domicilio"
                  value={form.domicilio}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  name="telefono"
                  value={form.telefono}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72]"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Datos Laborales */}
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <i className="bi bi-briefcase text-[#1e3c72]"></i>
              Datos Laborales
            </h2>
            
            <div className="mb-4">
              <OficioSelector
                selected={oficiosSeleccionados}
                onChange={setOficiosSeleccionados}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Área / Categoría
                </label>
                <select 
                  name="area" 
                  value={form.area} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72]"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Ayudante">Ayudante</option>
                  <option value="Medio Oficial">Medio Oficial</option>
                  <option value="Oficial">Oficial</option>
                  <option value="Oficial Especializado">Oficial Especializado</option>
                </select>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Información del Gremio */}
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <i className="bi bi-building text-[#1e3c72]"></i>
              Información del Gremio
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado de Afiliación
                </label>
                <select 
                  name="afiliado" 
                  value={form.afiliado} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72]"
                >
                  <option value="no">No afiliado</option>
                  <option value="si">Afiliado</option>
                  <option value="fue">Fue afiliado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apodo / Alias
                </label>
                <input
                  type="text"
                  name="apodo"
                  value={form.apodo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72]"
                  placeholder="Ej: El Turco, Pepe"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="fue_afiliado"
                  checked={form.fue_afiliado}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-[#1e3c72] focus:ring-[#1e3c72]"
                />
                <span className="text-sm text-gray-700">Fue afiliado</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="sin_experiencia"
                  checked={form.sin_experiencia}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-[#1e3c72] focus:ring-[#1e3c72]"
                />
                <span className="text-sm text-gray-700">Sin exp. en empresas</span>
              </label>
            </div>
          </CardBody>
        </Card>

        {/* Documentación adicional */}
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <i className="bi bi-paperclip text-[#1e3c72]"></i>
              Documentación adicional
            </h2>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="tiene_documentacion"
                  checked={form.tiene_documentacion}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-[#1e3c72] focus:ring-[#1e3c72]"
                />
                <span className="text-sm text-gray-700">Tiene certificaciones, cursos u otros documentos relevantes</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="tiene_licencia"
                  checked={form.tiene_licencia}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-[#1e3c72] focus:ring-[#1e3c72]"
                />
                <span className="text-sm text-gray-700">El trabajador cuenta con licencia de conducir</span>
              </label>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/cv/pendientes')}>
            <i className="bi bi-x-lg me-1"></i> Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <i className="bi bi-arrow-repeat animate-spin"></i> Guardando...
              </>
            ) : (
              <>
                <i className="bi bi-check-lg"></i> Aprobar CV
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Modal para ver PDF */}
      {showPdfModal && cvData?.path && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">CV - {cvData?.nombre}</h3>
              <button 
                onClick={() => setShowPdfModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <i className="bi bi-x-lg text-xl"></i>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe 
                src={`/${cvData.path}`}
                className="w-full h-[70vh]"
                title="CV PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}