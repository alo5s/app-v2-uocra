import { useState, useEffect } from 'react';
import { actividadAPI } from '../api';
import { Card, CardBody, Button, Loader } from '../components/ui';

export default function Actividad() {
  const [historial, setHistorial] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('historial');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [histRes, notifRes] = await Promise.all([
        actividadAPI.getHistorial({ per_page: 50 }),
        actividadAPI.getNotificaciones(),
      ]);
      setHistorial(histRes.data.items);
      setNotificaciones(notifRes.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const marcarTodasLeidas = async () => {
    try {
      await actividadAPI.marcarTodasLeidas();
      setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAccionBadge = (accion) => {
    const classes = {
      crear: 'bg-green-100 text-green-800',
      editar: 'bg-blue-100 text-blue-800',
      eliminar: 'bg-red-100 text-red-800',
    };
    return classes[accion] || 'bg-gray-100 text-gray-800';
  };

  const unreadCount = notificaciones.filter(n => !n.leida).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('historial')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            tab === 'historial' 
              ? 'bg-[#1e3c72] text-white hover:bg-[#2a5298]' 
              : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <i className="bi bi-activity"></i>
          Historial
        </button>
        <button
          onClick={() => setTab('notificaciones')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            tab === 'notificaciones' 
              ? 'bg-[#1e3c72] text-white hover:bg-[#2a5298]' 
              : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <i className="bi bi-bell"></i>
          Notificaciones
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'historial' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Fecha</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Acción</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Tipo</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-5 text-center">
                      <Loader />
                    </td>
                  </tr>
                ) : historial.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-5 text-center text-gray-500">No hay actividad</td>
                  </tr>
                ) : (
                  historial.map(item => (
                    <tr key={item.id} className="border-t border-gray-200">
                      <td className="p-3 text-sm text-gray-500">{formatDate(item.fecha)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getAccionBadge(item.accion)}`}>
                          {item.accion}
                        </span>
                      </td>
                      <td className="p-3 text-sm">{item.tipo}</td>
                      <td className="p-3 text-sm">{item.descripcion || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'notificaciones' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Notificaciones</h3>
            <Button variant="outline" size="sm" onClick={marcarTodasLeidas}>
              <i className="bi bi-check-all"></i>
              Marcar todas como leídas
            </Button>
          </div>
          
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-12">
                <Loader />
              </div>
            ) : notificaciones.length === 0 ? (
              <Card>
                <CardBody className="text-center py-12 text-gray-500">
                  No hay notificaciones
                </CardBody>
              </Card>
            ) : (
              notificaciones.map(notif => (
                <Card key={notif.id} className={!notif.leida ? 'border-l-4 border-l-[#1e3c72]' : ''}>
                  <CardBody>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium mb-1">{notif.titulo}</h4>
                        <p className="text-sm text-gray-500 mb-1">{notif.mensaje}</p>
                        <p className="text-xs text-gray-400">{formatDate(notif.fecha)}</p>
                      </div>
                      {!notif.leida && (
                        <div className="bg-[#1e3c72] rounded-full" style={{ width: '8px', height: '8px' }}></div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}