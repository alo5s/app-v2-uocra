import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { actividadAPI } from '../../api';
import { useToastStore } from '../../store/uiStore';

const navItems = [
  { to: '/home', icon: 'bi-house', label: 'Inicio' },
  { to: '/cvs', icon: 'bi-file-earmark-pdf', label: 'CVs' },
  { to: '/empresas', icon: 'bi-building', label: 'Empresas' },
  { to: '/notas', icon: 'bi-file-earmark-text', label: 'Notas' },
];

const adminItems = [
  { to: '/cv/pendientes', icon: 'bi-hourglass-split', label: 'CVs Pendientes' },
  { to: '/usuarios', icon: 'bi-people', label: 'Usuarios' },
  { to: '/actividad', icon: 'bi-activity', label: 'Actividad' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToastStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Cargar conteo inicial
  useEffect(() => {
    const fetchNotifCount = async () => {
      try {
        const res = await actividadAPI.getNotificacionesCount();
        setNotifCount(res.data.count);
      } catch (e) {}
    };
    fetchNotifCount();
    
    // Polling cada 60 segundos
    const interval = setInterval(fetchNotifCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotificaciones = async () => {
    try {
      const res = await actividadAPI.getNotificaciones();
      setNotificaciones(res.data.slice(0, 5));
    } catch (e) {}
  };

  useEffect(() => {
    if (notifOpen) {
      fetchNotificaciones();
    }
  }, [notifOpen]);

  const handleMarcarLeida = async (id) => {
    try {
      await actividadAPI.marcarNotificacionLeida(id);
      setNotificaciones(notificaciones.filter(n => n.id !== id));
      setNotifCount(Math.max(0, notifCount - 1));
    } catch (e) {}
  };

  const handleMarcarTodasLeidas = async () => {
    try {
      await actividadAPI.marcarTodasLeidas();
      setNotificaciones([]);
      setNotifCount(0);
    } catch (e) {}
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const allNavItems = user?.is_admin ? [...navItems, ...adminItems] : navItems;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Toggle Button - solo visible en móvil */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-50 p-2.5 rounded-lg shadow-lg md:hidden"
        style={{ backgroundColor: '#1e3c72', color: 'white' }}
      >
        <i className="bi bi-list text-xl"></i>
      </button>

      {/* Sidebar Backdrop - solo visible cuando sidebar abierto en móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - siempre visible en desktop, overlay en móvil */}
      <aside
        className={clsx(
          'fixed left-0 top-0 h-screen z-40 transition-transform duration-300',
          'w-[250px] flex-shrink-0',
          // Mobile: oculto por defecto, shown cuandoopen
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop (md+): siempre visible
          'md:translate-x-0'
        )}
        style={{
          background: 'linear-gradient(180deg, #1e3c72 0%, #152555 100%)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 className="text-white text-xl font-bold text-center" style={{ letterSpacing: '3px' }}>
            UOCRA
          </h3>
          <p className="text-white text-sm text-center mt-1 opacity-60">Sistema de Gestión</p>
        </div>

        {/* User Section - Below Header */}
        <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20">
                <i className="bi bi-person text-white text-lg"></i>
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {user?.nombre || user?.username}
                </p>
                {user?.is_admin && (
                  <p className="text-yellow-400 text-xs">Administrador</p>
                )}
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <i className="bi bi-three-dots-vertical text-lg"></i>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      onClick={() => { handleLogout(); setUserMenuOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <i className="bi bi-box-arrow-right"></i>
                      Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {allNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg my-1 transition-colors',
                  isActive
                    ? 'bg-white/15 text-white border-l-4 border-yellow-400'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                )
              }
            >
              <i className={clsx(item.icon, 'text-lg w-6')} />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Close Button - solo móvil */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 p-1 text-white/70 hover:text-white md:hidden"
        >
          <i className="bi bi-x-lg text-xl"></i>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen md:ml-[250px]">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 ml-12 md:ml-0">
              <Breadcrumb />
            </div>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button 
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                onClick={() => setNotifOpen(!notifOpen)}
              >
                <i className="bi bi-bell text-xl"></i>
                {notifCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs flex items-center justify-center rounded-full">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              
              {notifOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Notificaciones</h3>
                      <button 
                        className="text-xs text-[#1e3c72] hover:underline"
                        onClick={handleMarcarTodasLeidas}
                      >
                        Marcar todas leídas
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notificaciones.length === 0 ? (
                        <div className="px-4 py-6 text-center text-gray-500">
                          <i className="bi bi-bell-slash text-2xl mb-2 block"></i>
                          <p>No hay notificaciones</p>
                        </div>
                      ) : (
                        notificaciones.map(notif => (
                          <div 
                            key={notif.id} 
                            className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${notif.leida ? 'opacity-60' : ''}`}
                            onClick={() => {
                              if (!notif.leida) handleMarcarLeida(notif.id);
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${notif.leida ? 'bg-gray-300' : 'bg-red-500'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">{notif.titulo}</p>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.mensaje}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(notif.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {!notif.leida && (
                                <button 
                                  className="text-gray-400 hover:text-gray-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarcarLeida(notif.id);
                                  }}
                                >
                                  <i className="bi bi-check-lg"></i>
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="px-4 py-3 border-t border-gray-100">
                      <button 
                        className="w-full text-center text-sm text-[#1e3c72] hover:underline font-medium"
                        onClick={() => {
                          setNotifOpen(false);
                          navigate('/actividad');
                        }}
                      >
                        Ver todas las notificaciones
                        <i className="bi bi-arrow-right ms-1"></i>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Breadcrumb() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(Boolean);

  const labels = {
    home: 'Inicio',
    cvs: 'CVs',
    empresas: 'Empresas',
    notas: 'Notas',
    usuarios: 'Usuarios',
    actividad: 'Actividad',
    pendientes: 'Pendientes',
  };

  return (
    <nav className="flex items-center gap-1 text-sm">
      <NavLink to="/home" className="text-[#1e3c72] hover:underline">
        <i className="bi bi-house"></i>
      </NavLink>
      {pathnames.map((value, index) => {
        const to = '/' + pathnames.slice(0, index + 1).join('/');
        const isLast = index === pathnames.length - 1;
        const label = labels[value] || value;

        return (
          <span key={to} className="flex items-center gap-1">
            <span className="text-gray-400">/</span>
            {isLast ? (
              <span className="text-gray-700 font-medium">{label}</span>
            ) : (
              <NavLink to={to} className="text-[#1e3c72] hover:underline">
                {label}
              </NavLink>
            )}
          </span>
        );
      })}
    </nav>
  );
}