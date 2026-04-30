import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cvsAPI } from '../api';
import { useToastStore } from '../store/uiStore';
import { Button, Card, CardBody } from '../components/ui';

export default function RevisarCV() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToastStore();
  const [loading, setLoading] = useState(false);
  const [oficios, setOficios] = useState([]);
  const [showPdf, setShowPdf] = useState(true);

  const locationState = location.state || {};
  const { file, previewUrl, datos, modo } = locationState;

  const [form, setForm] = useState({
    nombre: datos?.nombre || '',
    dni: datos?.dni || '',
    fecha_nacimiento: datos?.fecha_nacimiento || '',
    genero: '',
    domicilio: datos?.domicilio || '',
    email: datos?.email || '',
    telefono: datos?.telefono || '',
    area: '',
    afiliado: 'no',
    apodo: '',
    sin_experiencia: false,
    tiene_documentacion: false,
    tiene_licencia: false,
  });

  const [oficiosSeleccionados, setOficiosSeleccionados] = useState(datos?.oficios_detectados || []);
  const [oficioInput, setOficioInput] = useState('');

  const [domicilioOpcion, setDomicilioOpcion] = useState(
    datos?.domicilio_opciones?.length > 1 ? datos.domicilio : ''
  );
  const [telefonoOpcion, setTelefonoOpcion] = useState(
    datos?.telefono_opciones?.length > 1 ? datos.telefono : ''
  );

  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);

  useEffect(() => {
    fetchOficios();
  }, []);

  const fetchOficios = async () => {
    try {
      const res = await cvsAPI.getOficios();
      setOficios(res.data);
    } catch (e) {}
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddOficio = () => {
    const oficio = oficioInput.trim();
    if (oficio && !oficiosSeleccionados.includes(oficio)) {
      setOficiosSeleccionados([...oficiosSeleccionados, oficio]);
      setOficioInput('');
    }
  };

  const handleRemoveOficio = (oficio) => {
    setOficiosSeleccionados(oficiosSeleccionados.filter(o => o !== oficio));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOficio();
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
    if (!form.nombre) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      }

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
      if (foto) {
        formData.append('foto', foto);
      }
      formData.append('oficios', oficiosSeleccionados.join(', '));
      formData.append('modo_deteccion', modo || 'automatico');

      await cvsAPI.create(formData);
      toast.success('CV creado exitosamente');
      navigate('/cvs');
    } catch (error) {
      const detail = error.response?.data?.detail;
      let msg = 'Error al crear CV';
      if (Array.isArray(detail)) {
        msg = detail[0]?.msg || 'Error de validación';
      } else if (typeof detail === 'string') {
        msg = detail;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarPdf = () => {
    navigate('/cv/nuevo');
  };

  const isDetectado = (campo) => {
    return datos && datos[campo] && datos[campo] !== '';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Revisar CV</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleCambiarPdf}>
            <i className="bi bi-arrow-repeat mr-2"></i> Cambiar PDF
          </Button>
          <Button variant="secondary" onClick={() => navigate('/cvs')}>
            <i className="bi bi-x-lg mr-2"></i> Cancelar
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-2/3">
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

            <Card>
              <CardBody>
                <div className="flex justify-content-between items-start mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <i className="bi bi-person text-[#1e3c72]"></i>
                    Datos Personales
                  </h2>
                  <span className="text-xs bg-gray-100 border border-gray-300 px-2 py-1 rounded">
                    <i className="bi bi-info-circle me-1"></i>
                    Los campos en verde fueron detectados del PDF
                  </span>
                </div>
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
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 ${
                        isDetectado('nombre') ? 'border-green-500 bg-green-50' : 'border-gray-300'
                      }`}
                      required
                    />
                    {isDetectado('nombre') && (
                      <span className="text-xs text-green-600 mt-1 block">
                        <i className="bi bi-check-circle"></i> Detectado del PDF
                      </span>
                    )}
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
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 ${
                        isDetectado('dni') ? 'border-green-500 bg-green-50' : 'border-gray-300'
                      }`}
                      placeholder="XX.XXX.XXX"
                    />
                    {isDetectado('dni') && (
                      <span className="text-xs text-green-600 mt-1 block">
                        <i className="bi bi-check-circle"></i> Detectado del PDF
                      </span>
                    )}
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
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 ${
                        isDetectado('fecha_nacimiento') ? 'border-green-500 bg-green-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Edad
                    </label>
                    <input
                      type="text"
                      name="edad"
                      value={datos?.edad || form.edad}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 bg-gray-50"
                      placeholder="Años"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
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
                    {datos?.domicilio_opciones?.length > 1 ? (
                      <select
                        value={domicilioOpcion}
                        onChange={(e) => {
                          setDomicilioOpcion(e.target.value);
                          setForm(prev => ({ ...prev, domicilio: e.target.value }));
                        }}
                        className="w-full px-3 py-2 border border-green-500 bg-green-50 rounded-lg"
                      >
                        <option value="">Seleccionar...</option>
                        {datos.domicilio_opciones.map((dom, idx) => (
                          <option key={idx} value={dom}>{dom}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        name="domicilio"
                        value={form.domicilio}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 ${
                          isDetectado('domicilio') ? 'border-green-500 bg-green-50' : 'border-gray-300'
                        }`}
                      />
                    )}
                    {isDetectado('domicilio') && (
                      <span className="text-xs text-green-600 mt-1 block">
                        <i className="bi bi-check-circle"></i> Detectado del PDF
                      </span>
                    )}
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
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 ${
                        isDetectado('email') ? 'border-green-500 bg-green-50' : 'border-gray-300'
                      }`}
                    />
                    {isDetectado('email') && (
                      <span className="text-xs text-green-600 mt-1 block">
                        <i className="bi bi-check-circle"></i> Detectado del PDF
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    {datos?.telefono_opciones?.length > 1 ? (
                      <select
                        value={telefonoOpcion}
                        onChange={(e) => {
                          setTelefonoOpcion(e.target.value);
                          setForm(prev => ({ ...prev, telefono: e.target.value }));
                        }}
                        className="w-full px-3 py-2 border border-green-500 bg-green-50 rounded-lg"
                      >
                        <option value="">Seleccionar...</option>
                        {datos.telefono_opciones.map((tel, idx) => (
                          <option key={idx} value={tel}>{tel}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        name="telefono"
                        value={form.telefono}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 ${
                          isDetectado('telefono') ? 'border-green-500 bg-green-50' : 'border-gray-300'
                        }`}
                      />
                    )}
                    {isDetectado('telefono') && (
                      <span className="text-xs text-green-600 mt-1 block">
                        <i className="bi bi-check-circle"></i> Detectado del PDF
                      </span>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <i className="bi bi-briefcase text-[#1e3c72]"></i>
                  Datos Laborales
                </h2>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Oficios *
                  </label>
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={oficioInput}
                        onChange={(e) => setOficioInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
                        placeholder="Escribir oficio y presionar Enter"
                        list="oficios-list-revisar"
                      />
                      <datalist id="oficios-list-revisar">
                        {oficios.map(oficio => (
                          <option key={oficio} value={oficio} />
                        ))}
                      </datalist>
                    </div>
                    <Button type="button" variant="secondary" onClick={handleAddOficio}>
                      <i className="bi bi-plus-lg"></i> Agregar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-100 rounded-lg min-h-[50px]">
                    {oficiosSeleccionados.length === 0 ? (
                      <span className="text-gray-500 text-sm">Selecciona al menos un oficio</span>
                    ) : (
                      oficiosSeleccionados.map((oficio, idx) => (
                        <span
                          key={idx}
                          className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded-full cursor-pointer hover:bg-red-600 transition-colors"
                          onClick={() => handleRemoveOficio(oficio)}
                        >
                          {oficio} <i className="bi bi-x"></i>
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría
                    </label>
                    <select
                      name="area"
                      value={form.area}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
                      placeholder="Ej: El Turco, Pepe"
                    />
                  </div>
                </div>
                <div className="mt-4">
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
                    <span className="text-sm text-gray-700">Este CV tiene certificaciones, cursos u otros documentos relevantes</span>
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

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => navigate('/cvs')}>
                Cancelar
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
                    <i className="bi bi-check-lg"></i> Guardar CV
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        <div className="lg:w-1-3">
          <Card>
            <CardBody>
              <div className="flex justify-content-between items-center mb-3">
                <h6 className="font-semibold">
                  <i className="bi bi-file-earmark-pdf mr-2"></i>
                  Vista previa del PDF
                </h6>
                <button
                  type="button"
                  onClick={() => setShowPdf(!showPdf)}
                  className="text-sm text-[#1e3c72]"
                >
                  {showPdf ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {showPdf && previewUrl && (
                <iframe
                  src={previewUrl}
                  className="w-full rounded border border-gray-300"
                  style={{ height: '400px' }}
                  title="PDF Preview"
                />
              )}
              <div className="mt-3">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline-primary w-full"
                >
                  <i className="bi bi-box-arrow-up-right mr-2"></i>
                  Abrir PDF
                </a>
              </div>
            </CardBody>
          </Card>

          <Card className="mt-4">
            <CardBody>
              <h6 className="font-semibold mb-3">
                <i className="bi bi-list-check mr-2"></i>
                Resumen de extracción
              </h6>
              <ul className="text-sm space-y-2">
                <li className="flex justify-between">
                  <span><i className="bi bi-person mr-2"></i>Nombre:</span>
                  <span className={isDetectado('nombre') ? 'text-green-600' : 'text-gray-400'}>
                    {datos?.nombre || 'No encontrado'}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span><i className="bi bi-card-text mr-2"></i>DNI:</span>
                  <span className={isDetectado('dni') ? 'text-green-600' : 'text-gray-400'}>
                    {datos?.dni || 'No encontrado'}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span><i className="bi bi-calendar mr-2"></i>Fec. Nac.:</span>
                  <span className={isDetectado('fecha_nacimiento') ? 'text-green-600' : 'text-gray-400'}>
                    {datos?.fecha_nacimiento || 'No encontrada'}
                    {datos?.edad ? ` (${datos.edad} años)` : ''}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span><i className="bi bi-house mr-2"></i>Domicilio:</span>
                  <span className={isDetectado('domicilio') ? 'text-green-600' : 'text-gray-400'}>
                    {datos?.domicilio || 'No encontrado'}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span><i className="bi bi-telephone mr-2"></i>Teléfono:</span>
                  <span className={isDetectado('telefono') ? 'text-green-600' : 'text-gray-400'}>
                    {datos?.telefono || 'No encontrado'}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span><i className="bi bi-envelope mr-2"></i>Email:</span>
                  <span className={isDetectado('email') ? 'text-green-600' : 'text-gray-400'}>
                    {datos?.email || 'No encontrado'}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span><i className="bi bi-tools mr-2"></i>Oficios:</span>
                  <span className={isDetectado('oficios_detectados') ? 'text-green-600' : 'text-gray-400'}>
                    {datos?.oficios_detectados?.join(', ') || 'No encontrados'}
                  </span>
                </li>
              </ul>
            </CardBody>
          </Card>

          <div className="mt-4 p-3 border border-yellow-400 bg-yellow-50 rounded-lg">
            <h6 className="text-yellow-700 font-semibold mb-2">
              <i className="bi bi-exclamation-triangle mr-2"></i>
              ¿El PDF tiene más información?
            </h6>
            <p className="text-sm text-gray-600">
              Si el CV tiene fotocopias de documentos, certificados u otra información relevante, podés:
            </p>
            <ul className="text-sm text-gray-600 mt-2 pl-4">
              <li>Guardar el CV con los datos extraídos</li>
              <li>Subir los documentos adicionales por separado en "Notas"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

