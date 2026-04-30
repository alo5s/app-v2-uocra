import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showWoman, setShowWoman] = useState(false);

  useEffect(() => {
    // Siempre empezar con hombre
    setTimeout(() => {
      setShowWoman(true);
    }, 4000);
    
    const interval = setInterval(() => {
      setShowWoman(prev => !prev);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);

    if (result.success) {
      navigate('/home');
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #205BC3 100%)' }}
    >
      <div className="w-full bg-white rounded-xl shadow-xl" style={{ maxWidth: '400px' }}>
        <div className="p-8">
          {/* Logo y Titulo */}
          <div className="text-center mb-6">
            <div className="relative w-40 h-20 mx-auto mb-4">
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-in-out ${showWoman ? 'opacity-0 -translate-x-3' : 'opacity-100 translate-x-0'}`}>
                <img 
                  src="/icono_uocra_hombre.png" 
                  alt="Hombre" 
                  style={{ width: '10rem' }} 
                  className="h-auto"
                />
              </div>
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-in-out ${showWoman ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'}`}>
                <img 
                  src="/icono_uocra_mujer.png" 
                  alt="Mujer" 
                  style={{ width: '7.5rem' }} 
                  className="h-auto"
                />
              </div>
            </div>
            <h1
              className="text-2xl font-bold mb-1"
              style={{ color: '#1e3c72' }}
            >
              UOCRA
            </h1>
            <p className="text-gray-500">Unión Obrera de la Construcción</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usuario
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72] transition-all duration-200 [-webkit-autofill:bg-white]"
                style={{ backgroundColor: '#ffffff !important' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingrese su usuario"
                required
                autoComplete="username"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72] transition-all duration-200 pr-10"
                  style={{ backgroundColor: '#ffffff !important' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <i className={showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
              style={{ backgroundColor: '#1e3c72', color: 'white' }}
            >
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-gray-500 text-sm mt-5 mb-0">
            Panel de Administración de CVs
          </p>
          <p className="text-center text-gray-500 text-sm mt-1 mb-0">
            Equipo de Gestión de Ricardo Treuquil
          </p>
        </div>
      </div>
    </div>
  );
}
