import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cvsAPI, notasAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/uiStore';
import { Button, Card, CardBody, Loader, Badge } from '../components/ui';

export default function VerCV() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const { user } = useAuthStore();
  const canEdit = user?.is_admin;
  
  const [loading, setLoading] = useState(true);
  const [cv, setCv] = useState(null);
  const [notas, setNotas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [error, setError] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setError(false);
    setErrorDetail('');
    setLoading(true);
    
    try {
      console.log('Fetching CV:', id);
      const [cvResult, notasResult, empresasResult] = await Promise.all([
        cvsAPI.getById(id),
        notasAPI.getAll({ cv_id: id }),
        cvsAPI.getEmpresas(id).catch(() => ({ data: [] }))
      ]);
      
      if (cvResult.data) setCv(cvResult.data);
      if (notasResult.data) setNotas(notasResult.data);
      setEmpresas(empresasResult?.data || []);
      
    } catch (error) {
      console.error('Error fetching CV:', error);
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      
      let detail = 'Error desconocido';
      if (error.response?.status === 401) detail = 'No autorizado';
      else if (error.response?.status === 404) detail = 'CV no encontrado';
      else if (error.response?.status) detail = `Error ${error.response?.status}`;
      else if (error.message) detail = error.message;
      
      setError(true);
      setErrorDetail(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar este CV?\n\nEsta acción no se puede deshacer.')) return;
    try {
      await cvsAPI.delete(id);
      toast.success('CV eliminado');
      navigate('/cvs');
    } catch (error) {
      toast.error('Error al eliminar CV');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '16rem' }}>
        <Loader />
      </div>
    );
  }

  if (error || !cv) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-4">
          <i className="bi bi-exclamation-triangle text-4xl"></i>
          <p className="mt-2 font-bold">Error al cargar el CV</p>
          <p className="text-gray-500 text-sm">{errorDetail}</p>
        </div>
        <Button onClick={() => navigate('/cvs')}>
          Volver a CVs
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/cvs')} 
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{cv.nombre || 'CV sin nombre'}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            cv.estado === 'aprobado' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {cv.estado === 'aprobado' ? 'Aprobado' : 'Pendiente'}
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {cv.path && (
            <Button onClick={() => setShowPdfModal(true)}>
              <i className="bi bi-file-text"></i> Ver PDF
            </Button>
          )}
          {canEdit && (
            <>
              <Button variant="secondary" onClick={() => navigate(`/cvs/editar/${id}`)}>
                <i className="bi bi-pencil"></i> Editar
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                <i className="bi bi-trash"></i> Eliminar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda - Perfil */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardBody className="text-center">
              <div className="relative inline-block mb-4">
                {cv.foto ? (
                  <img 
                    src={`/${cv.foto}`} 
                    alt={cv.nombre}
                    className="rounded-full object-cover border-4"
                    style={{ width: '8rem', height: '8rem', borderColor: '#1e3c72' }}
                  />
                ) : (
                  <div className="bg-gray-400 rounded-full flex items-center justify-center mx-auto" style={{ width: '8rem', height: '8rem' }}>
                    <i className="bi bi-person text-white text-6xl"></i>
                  </div>
                )}
              </div>
              
              <h3 className="font-semibold text-lg">{cv.nombre || 'Sin nombre'}</h3>
              {cv.apodo && (
                <p className="text-sm text-gray-500"><i className="bi bi-tag"></i> {cv.apodo}</p>
              )}
              
              {/* Badges de estado */}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {cv.afiliado === 'si' && (
                  <span className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                    <i className="bi bi-check-circle"></i> Afiliado
                  </span>
                )}
                {cv.afiliado === 'fue' && (
                  <span className="flex items-center gap-1 bg-yellow-500 text-gray-800 px-2 py-1 rounded-full text-xs">
                    <i className="bi bi-clock"></i> Fue afiliado
                  </span>
                )}
                {cv.afiliado === 'no' && (
                  <span className="bg-gray-500 text-white px-2 py-1 rounded-full text-xs">
                    No afiliado
                  </span>
                )}
                {cv.sin_experiencia && (
                  <span className="bg-gray-600 text-white px-2 py-1 rounded-full text-xs">
                    Sin exp.
                  </span>
                )}
                {cv.tiene_documentacion && (
                  <span className="flex items-center gap-1 bg-blue-500 text-white px-2 py-1 rounded-full text-xs">
                    <i className="bi bi-award"></i> Docs
                  </span>
                )}
              </div>
              
              <hr className="my-4" />
              
              {/* Datos personales */}
              <div className="text-left text-sm">
                <p className="flex items-center gap-2 mb-2">
                  <span className="text-gray-500">DNI:</span>
                  <span className="font-medium">{cv.dni || '-'}</span>
                </p>
                <p className="flex items-center gap-2 mb-2">
                  <i className="bi bi-calendar text-gray-500"></i>
                  <span className="text-gray-500">Fec. Nac.:</span>
                  <span className="font-medium">{cv.fecha_nacimiento || '-'}</span>
                </p>
                <p className="flex items-center gap-2 mb-0">
                  <span className="text-gray-500">Género:</span>
                  <span className="font-medium capitalize">{cv.genero || '-'}</span>
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Columna Derecha - Detalles */}
        <div className="lg:col-span-9 flex flex-col gap-6">
          {/* Datos de contacto */}
          <Card>
            <CardBody>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <i className="bi bi-person text-[#1e3c72]"></i>
                Datos de Contacto
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="flex items-start gap-2 mb-0">
                    <i className="bi bi-geo-alt text-gray-500 mt-1"></i>
                    <span>
                      <span className="text-gray-500">Domicilio:</span>
                      <br />{cv.domicilio || '-'}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="flex items-start gap-2 mb-0">
                    <i className="bi bi-envelope text-gray-500 mt-1"></i>
                    <span>
                      <span className="text-gray-500">Email:</span>
                      <br />{cv.email || '-'}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="flex items-start gap-2 mb-0">
                    <i className="bi bi-telephone text-gray-500 mt-1"></i>
                    <span>
                      <span className="text-gray-500">Teléfono:</span>
                      <br />{cv.telefono || '-'}
                    </span>
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Datos laborales */}
          <Card>
            <CardBody>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <i className="bi bi-file-text text-[#1e3c72]"></i>
                Datos Laborales
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 mb-2">Oficios:</p>
                  <div className="flex flex-wrap gap-2">
                    {cv.oficios ? (
                      cv.oficios.split(',').map((oficio, idx) => (
                        <span key={idx} className="bg-[#1e3c72]/10 text-[#1e3c72] px-2 py-1 rounded-full text-sm">
                          {oficio.trim()}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500">No especificado</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-0">
                    <span className="text-gray-500">Categoría:</span>
                    <span className="font-medium ml-2">{cv.area || '-'}</span>
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Historial laboral */}
          {empresas.length > 0 && (
            <Card>
              <CardBody>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <i className="bi bi-building text-[#1e3c72]"></i>
                  Historial laboral
                </h4>
                <div className="flex flex-col gap-3">
                  {empresas.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{emp.empresa_nombre}</span>
                          {emp.empresa_eliminada && (
                            <span className="bg-red-500 text-white px-2 py-0.5 rounded text-xs">Empresa eliminada</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {emp.fecha_ingreso || 'Sin fecha'} - {emp.fecha_salida || (emp.activo ? 'Actual' : 'Inactivo')}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${emp.activo ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>
                        {emp.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Documentación */}
          <Card>
            <CardBody>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <i className="bi bi-award text-[#1e3c72]"></i>
                Documentación adicional
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <p className="flex items-center gap-2 mb-0">
                  <i className="bi bi-award text-gray-500"></i>
                  <span className="text-gray-500">Certificaciones/Cursos:</span>
                  <span className={`px-2 py-1 rounded text-xs ${cv.tiene_documentacion ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>
                    {cv.tiene_documentacion ? 'Sí' : 'No'}
                  </span>
                </p>
                <p className="flex items-center gap-2 mb-0">
                  <i className="bi bi-car-front text-gray-500"></i>
                  <span className="text-gray-500">Licencia de conducir:</span>
                  <span className="font-medium">{cv.licencia_conducir || '-'}</span>
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Notas */}
          {notas.length > 0 && (
            <Card>
              <CardBody>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <i className="bi bi-file-text text-[#1e3c72]"></i>
                  Notas
                </h4>
                <div className="flex flex-col gap-2">
                  {notas.map(nota => (
                    <div key={nota.id} className="p-3 bg-gray-100 rounded-lg">
                      <div className="font-medium">{nota.titulo}</div>
                      {nota.descripcion && <p className="text-sm text-gray-500 mb-0">{nota.descripcion}</p>}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Metadata */}
          <Card className="bg-gray-50">
            <CardBody>
              <h4 className="font-semibold mb-3 text-gray-500">Información del sistema</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Origen:</span>
                  <span className="ml-2 font-medium">{cv.origen === 'qr' ? 'Código QR' : 'Web'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Estado:</span>
                  <span className="ml-2 font-medium capitalize">{cv.estado}</span>
                </div>
                <div>
                  <span className="text-gray-500">Activo:</span>
                  <span className="ml-2 font-medium">{cv.activo ? 'Sí' : 'No'}</span>
                </div>
                <div>
                  <span className="text-gray-500">ID:</span>
                  <span className="ml-2 font-medium">{cv.id}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Modal PDF */}
      {showPdfModal && cv.path && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="absolute inset-0" onClick={() => setShowPdfModal(false)} style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full h-full flex flex-col" style={{ maxWidth: '80rem', maxHeight: '90vh' }}>
            {/* Header del modal */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-xl">
              <h3 className="font-semibold text-gray-900 mb-0">CV - {cv.nombre}</h3>
              <div className="flex gap-2">
                <a 
                  href={`/${cv.path}`} 
                  target="_blank" 
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                >
                  <i className="bi bi-box-arrow-up-right"></i> Abrir en nueva pestaña
                </a>
                <button 
                  onClick={() => setShowPdfModal(false)} 
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
            {/* Iframe del PDF */}
            <div className="flex-1">
              <iframe 
                src={`/${cv.path}`} 
                className="w-full h-full rounded-b-xl border-0"
                title="CV PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}