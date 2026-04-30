import { useState, useEffect } from 'react';
import { authAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/uiStore';
import { Card, CardBody, Button, Loader, Modal, ModalFooter } from '../components/ui';

export default function Usuarios() {
  const { user: currentUser } = useAuthStore();
  const toast = useToastStore();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loadingSave, setLoadingSave] = useState(false);
  const [search, setSearch] = useState('');
  
  const [form, setForm] = useState({
    username: '',
    nombre: '',
    password: '',
    is_admin: false,
    is_active: true,
  });

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const res = await authAPI.getAll();
      setUsuarios(res.data);
    } catch (error) {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingSave(true);
    try {
      if (editingId) {
        const data = { ...form };
        if (!data.password) delete data.password;
        await authAPI.update(editingId, data);
        toast.success('Usuario actualizado');
      } else {
        await authAPI.create(form);
        toast.success('Usuario creado');
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ username: '', nombre: '', password: '', is_admin: false, is_active: true });
      fetchUsuarios();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar');
    } finally {
      setLoadingSave(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await authAPI.delete(id);
      toast.success('Usuario eliminado');
      fetchUsuarios();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await authAPI.toggleActive(id);
      toast.success('Estado actualizado');
      fetchUsuarios();
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ username: '', nombre: '', password: '', is_admin: false, is_active: true });
    setShowModal(true);
  };

  const openEdit = (usuario) => {
    setEditingId(usuario.id);
    setForm({
      username: usuario.username,
      nombre: usuario.nombre || '',
      password: '',
      is_admin: usuario.is_admin,
      is_active: usuario.is_active,
    });
    setShowModal(true);
  };

  const filteredUsuarios = usuarios.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.nombre && u.nombre.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-grow" style={{ minWidth: '200px' }}>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="Buscar usuarios..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <Button onClick={openNew}>
          <i className="bi bi-person-plus"></i>
          Nuevo Usuario
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : filteredUsuarios.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12 text-gray-500">
            No hay usuarios
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Usuario</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Nombre</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Rol</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Estado</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsuarios.map(usuario => (
                  <tr key={usuario.id} className="border-t border-gray-200">
                    <td className="p-3 font-medium">{usuario.username}</td>
                    <td className="p-3">{usuario.nombre || '-'}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${usuario.is_admin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                        {usuario.is_admin ? <><i className="bi bi-shield-fill"></i> Admin</> : <><i className="bi bi-person"></i> Usuario</>}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded ${usuario.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {usuario.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleToggleActive(usuario.id)} 
                          className="p-2 border border-gray-300 rounded hover:bg-gray-100"
                          title="Toggle activo"
                        >
                          <i className={`bi bi-toggle-${usuario.is_active ? 'on' : 'off'} text-xl ${usuario.is_active ? 'text-green-500' : 'text-gray-400'}`}></i>
                        </button>
                        <button 
                          onClick={() => openEdit(usuario)} 
                          className="p-2 border border-gray-300 rounded hover:bg-gray-100"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        {currentUser?.id !== usuario.id && (
                          <button 
                            onClick={() => handleDelete(usuario.id)} 
                            className="p-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Editar Usuario' : 'Nuevo Usuario'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              disabled={!!editingId}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {editingId ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña *'}
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editingId}
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_admin"
                checked={form.is_admin}
                onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-[#1e3c72]"
              />
              <span className="text-sm text-gray-700">Es administrador</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-[#1e3c72]"
              />
              <span className="text-sm text-gray-700">Activo</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
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