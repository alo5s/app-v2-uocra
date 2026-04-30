import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cvsAPI } from '../api';
import { useToastStore } from '../store/uiStore';
import { Card, CardBody, Button, Loader } from '../components/ui';

export default function CVsPendientes() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCVs();
  }, []);

  const fetchCVs = async () => {
    try {
      const res = await cvsAPI.getAll({ estado: 'pendiente', per_page: 100 });
      setCvs(res.data.items);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async (id) => {
    if (!confirm('¿Aprobar este CV?')) return;
    try {
      await cvsAPI.aprobar(id);
      toast.success('CV aprobado');
      fetchCVs();
    } catch (error) {
      toast.error('Error al aprobar CV');
    }
  };

  const handleRechazar = async (id) => {
    if (!confirm('¿Rechazar y eliminar este CV?')) return;
    try {
      await cvsAPI.rechazar(id);
      toast.success('CV rechazado');
      fetchCVs();
    } catch (error) {
      toast.error('Error al rechazar CV');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-yellow-500">
        <i className="bi bi-clock text-2xl"></i>
        <h2 className="text-xl font-semibold mb-0">{cvs.length} CVs pendientes de revisión</h2>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader />
        </div>
      ) : cvs.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <div className="flex items-center justify-center mx-auto mb-4 rounded-full bg-gray-100 w-20 h-20">
              <i className="bi bi-check-circle text-5xl text-gray-400"></i>
            </div>
            <h4 className="text-gray-600">No hay CVs pendientes</h4>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cvs.map(cv => (
            <Card key={cv.id} className="border-l-4 border-l-yellow-400">
              <CardBody className="p-0">
                <div className="flex">
                  {/* Foto */}
                  <div className="w-24 h-auto min-h-[140px] bg-gray-100 flex-shrink-0 rounded-l-lg overflow-hidden">
                    {cv.foto ? (
                      <img 
                        src={`/${cv.foto}`} 
                        alt={cv.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="bi bi-person text-3xl text-gray-300"></i>
                      </div>
                    )}
                  </div>
                  
                  {/* Contenido */}
                  <div className="flex-1 p-3">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-sm mb-0 leading-tight">{cv.nombre || 'Sin nombre'}</h4>
                      {cv.origen === 'actualizacion' ? (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          <i className="bi bi-arrow-repeat me-1"></i>Actualización
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                          <i className="bi bi-clock me-1"></i>Pendiente
                        </span>
                      )}
                    </div>
                    
                    {/* Info con iconos */}
                    <div className="space-y-1 text-xs text-gray-600 mb-2">
                      {cv.dni && (
                        <p className="mb-0">
                          <i className="bi bi-credit-card text-gray-400 me-1.5"></i>
                          {cv.dni}
                        </p>
                      )}
                      {cv.telefono && (
                        <p className="mb-0">
                          <i className="bi bi-telephone text-gray-400 me-1.5"></i>
                          {cv.telefono}
                        </p>
                      )}
                      {cv.email && (
                        <p className="mb-0">
                          <i className="bi bi-envelope text-gray-400 me-1.5"></i>
                          <span className="truncate">{cv.email}</span>
                        </p>
                      )}
                      {cv.oficios && (
                        <p className="mb-0">
                          <i className="bi bi-tools text-gray-400 me-1.5"></i>
                          <span className="text-xs">{cv.oficios}</span>
                        </p>
                      )}
                      <p className="mb-0 text-gray-500">
                        <i className="bi bi-qr-code text-gray-400 me-1.5"></i>
                        {cv.origen === 'actualizacion' ? 'Actualización' : cv.origen === 'qr' ? 'Código QR' : 'Web'}
                      </p>
                    </div>

                    {/* Botones compactos */}
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs py-1 px-2"
                        onClick={() => navigate(`/cvs/revisar/${cv.id}`)}
                      >
                        <i className="bi bi-pencil me-1"></i>Revisar
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        className="py-1 px-2"
                        onClick={() => handleAprobar(cv.id)}
                      >
                        {cv.origen === 'actualizacion' ? (
                          <><i className="bi bi-arrow-repeat me-1"></i>Act.</>
                        ) : (
                          <i className="bi bi-check-lg"></i>
                        )}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="py-1 px-2"
                        onClick={() => handleRechazar(cv.id)}
                      >
                        <i className="bi bi-x-lg"></i>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}