import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { dashboardAPI, empresasAPI } from '../api';
import { useAuthStore } from '../store/authStore';

const statCards = [
  { label: 'Total CVs', key: 'total_cvs', icon: 'bi-people', color: '#1e3c72', link: '/cvs' },
  { label: 'Afiliados', key: 'afiliados', icon: 'bi-person-check', color: '#198754', link: '/cvs?afiliado=si' },
  { label: 'Empresas', key: 'total_empresas', icon: 'bi-building', color: '#0dcaf0', link: '/empresas' },
  { label: 'Notas', key: 'total_notas', icon: 'bi-stickies', color: '#ffc107', link: '/notas' },
];

export default function Dashboard() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [porOficio, setPorOficio] = useState([]);
  const [porCategoria, setPorCategoria] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState({ fecha: '', hora: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, oficioRes, categoriaRes, empresasRes] = await Promise.all([
          dashboardAPI.getStats(),
          dashboardAPI.getPorOficio(),
          dashboardAPI.getPorCategoria(),
          empresasAPI.getAll(),
        ]);
        setStats(statsRes.data);
        setPorOficio(oficioRes.data);
        setPorCategoria(categoriaRes.data);
        setEmpresas(empresasRes.data.filter(e => e.es_afiliada).slice(0, 8));
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    const updateDateTime = () => {
      const now = new Date();
      setCurrentDate({
        fecha: now.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }),
        hora: now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      });
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const quickLinks = [
    { label: 'Nuevo CV', icon: 'bi-plus-circle', link: '/cv/nuevo', bg: '#1e3c72', hover: '#2a5298' },
    { label: 'Ver Historial de CVs', icon: 'bi-clock-history', link: '/cvs', bg: '#6b7280', hover: '#4b5563' },
    { label: 'QR Bienvenida', icon: 'bi-qr-code', link: '/cv/qr', bg: '#198754', hover: '#146c43' },
    { label: 'Gestionar Empresas', icon: 'bi-building', link: '/empresas', bg: '#3b82f6', hover: '#2563eb' },
    { label: 'Notas y Documentos', icon: 'bi-stickies', link: '/notas', bg: '#eab308', hover: '#ca8a04' },
    { label: 'Cerrar Sesión', icon: 'bi-box-arrow-right', action: handleLogout, bg: 'transparent', hover: '#dc2626', border: '#dc2626', text: '#dc2626' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '300px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h4 className="text-xl font-bold text-gray-900">
          <i className="bi bi-house mr-2"></i>
          Inicio
        </h4>
        <div className="text-right">
          <p className="font-medium text-sm text-gray-700">{currentDate.fecha}</p>
          <p className="text-xs text-gray-500">{currentDate.hora}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.key}
            to={card.link}
            className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            style={{ borderTop: `4px solid ${card.color}` }}
          >
            <div className="p-4 text-center">
              <i className={clsx('bi', card.icon)} style={{ fontSize: '2rem', color: card.color, display: 'block', marginBottom: '8px' }}></i>
              <h4 style={{ fontWeight: 'bold', fontSize: '1.75rem', color: card.color, marginBottom: '4px' }}>
                {stats?.[card.key] || 0}
              </h4>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Empresas Afiliadas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h6 className="mb-3 font-semibold text-gray-900">
            <i className="bi bi-building mr-2"></i>
            Empresas Afiliadas
          </h6>
          {empresas.length > 0 ? (
            <div className="space-y-2">
              {empresas.map((empresa) => (
                <Link
                  key={empresa.id}
                  to={`/empresas/${empresa.id}`}
                  className="block"
                >
                  <div className="flex items-center gap-2 p-2 rounded border border-gray-200 hover:border-[#1e3c72] hover:shadow-sm transition-all">
                    {empresa.logo ? (
                      <img src={`/${empresa.logo}`} alt={empresa.nombre} className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <i className="bi bi-building text-gray-500"></i>
                    )}
                    <span className="text-sm text-gray-700 truncate">{empresa.nombre}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No hay empresas afiliadas</p>
          )}
          {empresas.length >= 8 && (
            <div className="text-center mt-3">
              <Link to="/empresas" className="text-sm text-[#1e3c72] hover:underline">
                Ver todas ({empresas.length})
              </Link>
            </div>
          )}
        </div>

        {/* Trabajadores por Oficio */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h6 className="mb-3 font-semibold text-gray-900">
            <i className="bi bi-tools mr-2"></i>
            Trabajadores por Oficio
          </h6>
          {porOficio.length > 0 ? (
            <div className="space-y-2">
              {porOficio.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700 truncate">{item.oficio}</span>
                  <span className="bg-[#1e3c72] text-white text-xs px-2 py-1 rounded-full">{item.cantidad}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Sin datos</p>
          )}
        </div>

        {/* Trabajadores por Categoría */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h6 className="mb-3 font-semibold text-gray-900">
            <i className="bi bi-bar-chart mr-2"></i>
            Por Categoría
          </h6>
          {porCategoria.length > 0 ? (
            <div className="space-y-2">
              {porCategoria.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">{item.categoria}</span>
                  <span className="bg-[#0dcaf0] text-white text-xs px-2 py-1 rounded-full">{item.cantidad}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Sin datos</p>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h6 className="mb-3 font-semibold text-gray-900">
            <i className="bi bi-lightning mr-2"></i>
            Accesos Rápidos
          </h6>
          <div className="space-y-2">
            {quickLinks.map((link, idx) => (
              link.action ? (
                <button
                  key={idx}
                  onClick={link.action}
                  className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: link.bg,
                    border: link.border ? `2px solid ${link.border}` : 'none',
                    color: link.text || 'white',
                  }}
                >
                  <i className={clsx('bi', link.icon)}></i>
                  {link.label}
                </button>
              ) : (
                <Link
                  key={idx}
                  to={link.link}
                  className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white"
                  style={{ backgroundColor: link.bg }}
                >
                  <i className={clsx('bi', link.icon)}></i>
                  {link.label}
                </Link>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}