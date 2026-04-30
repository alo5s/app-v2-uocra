import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { empresasAPI, cvsAPI } from '../api';
import { useToastStore } from '../store/uiStore';
import { Button, Card, CardBody, Badge, Modal, ModalFooter, Loader } from '../components/ui';

export default function VerEmpresa() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState(null);
  const [cvsEmpresa, setCvsEmpresa] = useState([]);
  const [cvsDisponibles, setCvsDisponibles] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('table');

  const filteredCvs = cvsEmpresa.filter(ce => {
    let matchesFiltro = filtro === 'todos' || (filtro === 'activos' && ce.activo) || (filtro === 'inactivos' && !ce.activo);
    let matchesSearch = !search || (ce.cv?.nombre || '').toLowerCase().includes(search.toLowerCase()) || (ce.cv?.dni || '').toLowerCase().includes(search.toLowerCase());
    return matchesFiltro && matchesSearch;
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  
  const [editForm, setEditForm] = useState({
    nombre: '',
    email: '',
    logo: null,
    descripcion: '',
    es_afiliada: false,
  });
  
  const [newCv, setNewCv] = useState({
    cv_id: '',
    fecha_ingreso: '',
    activo: true,
  });

  useEffect(() => {
    fetchData();
    setFiltro('todos');
    setSearch('');
  }, [id]);

  const fetchData = async () => {
    try {
      const [empresaRes, cvsRes] = await Promise.all([
        empresasAPI.getById(id),
        empresasAPI.getCVs(id, { filtro }),
      ]);
      setEmpresa(empresaRes.data);
      setCvsEmpresa(cvsRes.data.cvs || []);
      
      const allCvs = await cvsAPI.getAll({ estado: 'aprobado', per_page: 100 });
      setCvsDisponibles(allCvs.data.items || []);
    } catch (error) {
      toast.error('Error al cargar');
      navigate('/empresas');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCv = async (e) => {
    e.preventDefault();
    const cvId = Number(newCv.cv_id);
    if (!cvId || cvId === 0 || isNaN(cvId)) {
      toast.error('Selecciona un trabajador válido');
      return;
    }
    setLoadingSave(true);
    try {
      await empresasAPI.addCV(id, {
        cv_id: cvId,
        fecha_ingreso: newCv.fecha_ingreso || null,
        activo: newCv.activo
      });
      toast.success('Trabajador agregado');
      setShowAddModal(false);
      setNewCv({ cv_id: '', fecha_ingreso: '', activo: true });
      fetchData();
    } catch (error) {
      const msg = error.response?.data?.[0]?.msg || error.response?.data?.detail || 'Error al agregar';
      toast.error(msg);
    } finally {
      setLoadingSave(false);
    }
  };

  const handleToggleActivo = async (cvEmpresaId) => {
    try {
      await empresasAPI.toggleCV(cvEmpresaId);
      toast.success('Estado actualizado');
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const handleRemoveCv = async (cvEmpresaId, activo) => {
    if (activo) {
      const fechaSalida = prompt('Fecha de salida (dejar vacío para hoy):', new Date().toISOString().split('T')[0]);
      if (!fechaSalida) return;
      try {
        await empresasAPI.updateCV(cvEmpresaId, {
          fecha_salida: fechaSalida,
          activo: false
        });
        toast.success('Trabajador inactivado');
        fetchData();
      } catch (error) {
        toast.error('Error al inactivar');
      }
    } else {
      if (!confirm('¿Eliminar trabajador de esta empresa?')) return;
      try {
        await empresasAPI.deleteCV(cvEmpresaId);
        toast.success('Trabajador eliminado');
        fetchData();
      } catch (error) {
        toast.error('Error al eliminar');
      }
    }
  };

  const handleEditEmpresa = async (e) => {
    e.preventDefault();
    setLoadingSave(true);
    try {
      const formData = new FormData();
      formData.append('nombre', editForm.nombre);
      if (editForm.email) formData.append('email', editForm.email);
      if (editForm.descripcion) formData.append('descripcion', editForm.descripcion);
      formData.append('es_afiliada', editForm.es_afiliada);
      if (editForm.logo) formData.append('logo', editForm.logo);
      await empresasAPI.update(id, formData);
      toast.success('Empresa actualizada');
      setShowEditModal(false);
      setEditForm(prev => ({ ...prev, logo: null }));
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar');
    } finally {
      setLoadingSave(false);
    }
  };

  const handleDeleteEmpresa = async () => {
    if (!confirm('¿Eliminar esta empresa? Los trabajadores serán marcados como inactivos.')) return;
    try {
      await empresasAPI.delete(id);
      toast.success('Empresa eliminada');
      navigate('/empresas');
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditForm(prev => ({ ...prev, logo: file }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader />
      </div>
    );
  }

  if (!empresa) return null;

  const activosCount = cvsEmpresa.filter(c => c.activo).length;
  const inactivosCount = cvsEmpresa.filter(c => !c.activo).length;

  return (
    <div className="space-y-4">
      {/* Header Empresa */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {empresa.logo ? (
            <img src={`/${empresa.logo}`} alt={empresa.nombre} className="rounded" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
          ) : (
            <div className="flex items-center justify-center rounded" style={{ width: '64px', height: '64px', backgroundColor: '#e5e7eb' }}>
              <i className="bi bi-building text-4xl text-gray-400"></i>
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold mb-1" style={{ color: '#1f2937' }}>{empresa.nombre}</h1>
            <div className="flex items-center gap-2">
              {empresa.es_afiliada && (
                <Badge variant="success">Afiliada</Badge>
              )}
            </div>
            {empresa.email && <p className="text-sm text-gray-500 mb-0">✉️ {empresa.email}</p>}
            {empresa.descripcion && <p className="text-sm mt-2" style={{ color: '#4b5563', maxWidth: '400px' }}>{empresa.descripcion}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {!empresa.deleted_at && (
            <>
              <Button 
                variant="outline"
                onClick={() => {
                  setEditForm({ nombre: empresa.nombre, email: empresa.email || '', logo: null, descripcion: empresa.descripcion || '', es_afiliada: empresa.es_afiliada });
                  setShowEditModal(true);
                }}
              >
                <i className="bi bi-pencil"></i> Editar
              </Button>
              <Button variant="danger" onClick={handleDeleteEmpresa}>
                <i className="bi bi-trash"></i> Eliminar
              </Button>
            </>
          )}
        </div>
      </div>

      {empresa.deleted_at && (
        <div className="text-sm mb-2 text-gray-400">⚠️ Empresa eliminada</div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => { setFiltro('todos'); setSearch(''); }}
          className="cursor-pointer"
        >
          <Card className={`h-full ${filtro === 'todos' ? 'ring-2 ring-blue-500' : ''}`}>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Trabajadores</p>
                <p className="text-2xl font-bold mb-0">{cvsEmpresa.length}</p>
              </div>
              <div className="flex items-center justify-center rounded" style={{ width: '48px', height: '48px', backgroundColor: '#dbeafe' }}>
                <i className="bi bi-people text-2xl text-blue-500"></i>
              </div>
            </CardBody>
          </Card>
        </div>
        <div 
          onClick={() => { setFiltro('activos'); setSearch(''); }}
          className="cursor-pointer"
        >
          <Card className={`h-full ${filtro === 'activos' ? 'ring-2 ring-green-500' : ''}`}>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-sm mb-1" style={{ color: '#059669' }}>Trabajadores Activos</p>
                <p className="text-2xl font-bold mb-0" style={{ color: '#059669' }}>{activosCount}</p>
              </div>
              <div className="flex items-center justify-center rounded" style={{ width: '48px', height: '48px', backgroundColor: '#d1fae5' }}>
                <i className="bi bi-check-circle text-2xl text-green-500"></i>
              </div>
            </CardBody>
          </Card>
        </div>
        <div 
          onClick={() => { setFiltro('inactivos'); setSearch(''); }}
          className="cursor-pointer"
        >
          <Card className={`h-full ${filtro === 'inactivos' ? 'ring-2 ring-red-500' : ''}`}>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-sm mb-1" style={{ color: '#e11d48' }}>Trabajadores Inactivos</p>
                <p className="text-2xl font-bold mb-0" style={{ color: '#e11d48' }}>{inactivosCount}</p>
              </div>
              <div className="flex items-center justify-center rounded" style={{ width: '48px', height: '48px', backgroundColor: '#ffe4e6' }}>
                <i className="bi bi-x-circle text-2xl text-red-500"></i>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center flex-1" style={{ maxWidth: '400px' }}>
          <div className="px-3 py-2 rounded-l-lg" style={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRight: 'none' }}>
            <i className="bi bi-search text-gray-400"></i>
          </div>
          <input
            type="text"
            placeholder="Buscar trabajador..."
            className="flex-1 px-3 py-2 rounded-r-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="ml-2 text-gray-400 hover:text-gray-600">
              <i className="bi bi-x-lg"></i>
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 rounded p-1" style={{ backgroundColor: '#f3f4f6' }}>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded ${viewMode === 'table' ? 'bg-white shadow' : ''}`}
              style={viewMode === 'table' ? { color: '#2563eb' } : { color: '#4b5563' }}
            >
              <i className="bi bi-list"></i> Tabla
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded ${viewMode === 'cards' ? 'bg-white shadow' : ''}`}
              style={viewMode === 'cards' ? { color: '#2563eb' } : { color: '#4b5563' }}
            >
              <i className="bi bi-grid"></i> Cards
            </button>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <i className="bi bi-plus-lg"></i> Agregar
          </Button>
        </div>
      </div>

      {/* Lista de trabajadores */}
      {filteredCvs.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <div className="flex items-center justify-center mx-auto mb-4 rounded-full" style={{ width: '80px', height: '80px', backgroundColor: '#f3f4f6' }}>
              <i className="bi bi-person text-5xl text-gray-400"></i>
            </div>
            <h4 className="mb-2" style={{ color: '#4b5563' }}>{cvsEmpresa.length === 0 ? 'No hay trabajadores en esta empresa' : 'No hay resultados'}</h4>
            {search && <p className="text-sm text-gray-400">No se encontraron resultados para "{search}"</p>}
          </CardBody>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCvs.map(ce => (
            <Link key={ce.id} to={`/cvs/ver/${ce.cv_id}`} className="no-underline">
              <Card hover className="h-full cursor-pointer">
                <CardBody className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    {ce.cv?.foto ? (
                      <img src={`/${ce.cv.foto}`} alt={ce.cv.nombre} className="rounded-full" style={{ width: '56px', height: '56px', objectFit: 'cover' }} />
                    ) : (
                      <div className="flex items-center justify-center rounded-full" style={{ width: '56px', height: '56px', backgroundColor: '#e5e7eb' }}>
                        <i className="bi bi-person text-2xl text-gray-400"></i>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h5 className="mb-1 text-truncate font-semibold" style={{ color: '#1f2937' }}>{ce.cv?.nombre || 'Sin nombre'}</h5>
                      <p className="text-sm mb-0 text-gray-500">{ce.cv?.dni || '-'}</p>
                    </div>
                  </div>
                  {ce.cv?.oficios && (
                    <p className="text-sm mb-0 text-gray-600">{ce.cv.oficios}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant={ce.activo ? 'success' : 'gray'}>
                      {ce.activo ? '✓ Activo' : '✗ Inactivo'}
                    </Badge>
                    <span className="text-sm text-gray-400">{ce.fecha_ingreso || '-'}</span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                    {ce.activo ? (
                      <button onClick={() => handleRemoveCv(ce.id, true)} className="flex-1 px-2 py-1 text-sm rounded" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                        <i className="bi bi-toggle-off me-1"></i> Inactivar
                      </button>
                    ) : (
                      <>
                        <button onClick={() => handleToggleActivo(ce.id)} className="flex-1 px-2 py-1 text-sm rounded" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                          <i className="bi bi-toggle-on me-1"></i> Activar
                        </button>
                        <button onClick={() => handleRemoveCv(ce.id, false)} className="px-2 py-1 text-sm rounded" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </>
                    )}
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Trabajador</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">DNI</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Oficios</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Ingreso</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Estado</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCvs.map(ce => (
                  <tr key={ce.id} className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/cvs/ver/${ce.cv_id}`)}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {ce.cv?.foto ? (
                          <img src={`/${ce.cv.foto}`} alt={ce.cv.nombre} className="rounded-full" style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
                        ) : (
                          <div className="flex items-center justify-center rounded-full" style={{ width: '40px', height: '40px', backgroundColor: '#e5e7eb' }}>
                            <i className="bi bi-person text-xl text-gray-400"></i>
                          </div>
                        )}
                        <span className="font-medium">{ce.cv?.nombre || 'Sin nombre'}</span>
                      </div>
                    </td>
                    <td className="p-3">{ce.cv?.dni || '-'}</td>
                    <td className="p-3 text-sm text-gray-600">{ce.cv?.oficios || '-'}</td>
                    <td className="p-3 text-sm text-gray-500">{ce.fecha_ingreso || '-'}</td>
                    <td className="p-3">
                      <Badge variant={ce.activo ? 'success' : 'gray'}>
                        {ce.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {ce.activo ? (
                          <button onClick={() => handleRemoveCv(ce.id, true)} className="px-2 py-1 text-sm rounded" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }} title="Inactivar">
                            <i className="bi bi-toggle-off"></i>
                          </button>
                        ) : (
                          <>
                            <button onClick={() => handleToggleActivo(ce.id)} className="px-2 py-1 text-sm rounded" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }} title="Activar">
                              <i className="bi bi-toggle-on"></i>
                            </button>
                            <button onClick={() => handleRemoveCv(ce.id, false)} className="px-2 py-1 text-sm rounded" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }} title="Eliminar">
                              <i className="bi bi-trash"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Agregar Trabajador */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Agregar Trabajador">
        <form onSubmit={handleAddCv} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trabajador *</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              value={newCv.cv_id}
              onChange={(e) => setNewCv({ ...newCv, cv_id: e.target.value })}
              required
            >
              <option value="">Seleccionar trabajador...</option>
              {cvsDisponibles.map(cv => (
                <option key={cv.id} value={cv.id}>{cv.nombre} {cv.dni ? `(${cv.dni})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              value={newCv.fecha_ingreso}
              onChange={(e) => setNewCv({ ...newCv, fecha_ingreso: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="addActivo"
              checked={newCv.activo}
              onChange={(e) => setNewCv({ ...newCv, activo: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-[#1e3c72]"
            />
            <label htmlFor="addActivo" className="text-sm text-gray-700">Activo actualmente</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loadingSave}>
              {loadingSave ? 'Guardando...' : 'Agregar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar Empresa */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Empresa">
        <form onSubmit={handleEditEmpresa} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              value={editForm.nombre}
              onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email de contacto</label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              value={editForm.email || ''}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              placeholder="contacto@empresa.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1e3c72] file:text-white"
              onChange={handleLogoChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              rows={3}
              value={editForm.descripcion}
              onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
              placeholder="Descripción breve de la empresa..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="esAfiliada"
              checked={editForm.es_afiliada}
              onChange={(e) => setEditForm({ ...editForm, es_afiliada: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-[#1e3c72]"
            />
            <label htmlFor="esAfiliada" className="text-sm text-gray-700">Empresa afiliada</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loadingSave}>
              {loadingSave ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}