import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const apiPublic = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('token');
      if (token) {
        console.warn('Token expirado o inválido. Por favor, iniciá sesión nuevamente.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    return Promise.reject(error);
  }
);

export const handleAuthError = (error) => {
  if (error.response?.status === 401) {
    return 'Tu sesión puede haber expirado. Intentá de nuevo.';
  }
  return error.response?.data?.detail || 'Error de conexión';
};

export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  getAll: () => api.get('/auth/users'),
  getById: (id) => api.get(`/auth/users/${id}`),
  create: (data) => api.post('/auth/users', data),
  update: (id, data) => api.put(`/auth/users/${id}`, data),
  delete: (id) => api.delete(`/auth/users/${id}`),
  toggleActive: (id) => api.put(`/auth/users/${id}/toggle-active`),
};

export const cvsAPI = {
  getAll: (params) => api.get('/cvs', { params }),
  getById: (id) => api.get(`/cvs/${id}`),
  create: (data) => api.post('/cvs', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/cvs/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/cvs/${id}`),
  aprobar: (id) => api.post(`/cvs/${id}/aprobar`),
  rechazar: (id) => api.post(`/cvs/${id}/rechazar`),
  getOficios: () => api.get('/cvs/oficios/list'),
  getEmpresas: (id) => api.get(`/cvs/${id}/empresas`),
  createPublic: (data) => apiPublic.post('/cvs/public', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  generarToken: () => apiPublic.post('/cvs/generar-token'),
  validarToken: (token) => apiPublic.get('/cvs/validar-token', { params: { token } }),
  usarToken: (token, cvId) => apiPublic.post('/cvs/usar-token', null, { params: { token, cv_id: cvId } }),
  extraerDatosPDF: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/cvs/extraer', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  exportarPDF: (cvIds, oficioFiltro) => {
    return api.post('/cvs/exportar-pdf', { cv_ids: cvIds, oficio_filtro: oficioFiltro }, {
      responseType: 'blob',
    });
  },
};

export const empresasAPI = {
  getAll: () => api.get('/empresas'),
  getById: (id) => api.get(`/empresas/${id}`),
  create: (data) => api.post('/empresas', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/empresas/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/empresas/${id}`),
  getCVs: (id, params) => api.get(`/empresas/${id}/cvs`, { params }),
  addCV: (empresaId, data) => api.post(`/empresas/${empresaId}/cvs`, data, {
    headers: { 'Content-Type': 'application/json' }
  }),
  updateCV: (cvEmpresaId, data) => api.put(`/empresas/cvs/${cvEmpresaId}`, data, {
    headers: { 'Content-Type': 'application/json' }
  }),
  deleteCV: (cvEmpresaId) => api.delete(`/empresas/cvs/${cvEmpresaId}`, {
    headers: { 'Content-Type': 'application/json' }
  }),
  toggleCV: (cvEmpresaId) => api.post(`/empresas/cvs/${cvEmpresaId}/toggle`),
};

export const notasAPI = {
  getAll: (params) => api.get('/notas', { params }),
  getById: (id) => api.get(`/notas/${id}`),
  create: (data) => api.post('/notas', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/notas/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/notas/${id}`),
  descargar: (id) => api.get(`/notas/${id}/descargar`, { responseType: 'blob' }),
  compartir: (id) => api.get(`/notas/${id}/compartir`),
  getStats: () => api.get('/notas/stats'),
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getPorOficio: () => api.get('/dashboard/por-oficio'),
  getPorCategoria: () => api.get('/dashboard/por-categoria'),
};

export const actividadAPI = {
  getHistorial: (params) => api.get('/actividad/historial', { params }),
  getNotificaciones: () => api.get('/actividad/notificaciones'),
  getNotificacionesCount: () => api.get('/actividad/notificaciones/count'),
  marcarTodasLeidas: () => api.post('/actividad/notificaciones/marcar-todas-leidas'),
  marcarNotificacionLeida: (id) => api.put(`/actividad/notificaciones/${id}`),
};

export default api;
