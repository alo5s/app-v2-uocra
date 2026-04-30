import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { empresasAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/uiStore';
import { Button, Input, Select, Card, CardBody, Badge, Modal, ModalFooter, Loader, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableCheckbox } from '../components/ui';

export default function Empresas() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { user } = useAuthStore();
  const canEdit = user?.is_admin;

  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('cards');
  const [filters, setFilters] = useState({ search: '', afiliada: '' });
  const [selected, setSelected] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loadingSave, setLoadingSave] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', logo: null, descripcion: '', es_afiliada: false });

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const fetchEmpresas = async () => {
    try {
      const res = await empresasAPI.getAll();
      setEmpresas(res.data);
    } catch (error) {
      console.error('Error fetching empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingSave(true);
    try {
      const formData = new FormData();
      formData.append('nombre', form.nombre);
      if (form.email) formData.append('email', form.email);
      if (form.descripcion) formData.append('descripcion', form.descripcion);
      formData.append('es_afiliada', form.es_afiliada);
      if (form.logo) formData.append('logo', form.logo);

      if (editingId) {
        await empresasAPI.update(editingId, formData);
        toast.success('Empresa actualizada');
      } else {
        await empresasAPI.create(formData);
        toast.success('Empresa creada');
      }
      setShowModal(false);
      resetForm();
      fetchEmpresas();
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setLoadingSave(false);
    }
  };

  const handleEdit = (empresa) => {
    setEditingId(empresa.id);
    setForm({ nombre: empresa.nombre, email: empresa.email || '', logo: null, descripcion: empresa.descripcion || '', es_afiliada: empresa.es_afiliada });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta empresa?')) return;
    try {
      await empresasAPI.delete(id);
      toast.success('Empresa eliminada');
      fetchEmpresas();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`¿Eliminar ${selected.length} empresas seleccionadas?`)) return;
    try {
      await Promise.all(selected.map(id => empresasAPI.delete(id)));
      setSelected([]);
      toast.success(`${selected.length} empresas eliminadas`);
      fetchEmpresas();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm(prev => ({ ...prev, logo: file }));
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === filteredEmpresas.length) {
      setSelected([]);
    } else {
      setSelected(filteredEmpresas.map(e => e.id));
    }
  };

  const openNew = () => {
    resetForm();
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ nombre: '', email: '', logo: null, descripcion: '', es_afiliada: false });
  };

  const clearFilters = () => {
    setFilters({ search: '', afiliada: '' });
  };

  const filteredEmpresas = empresas.filter(e => {
    const matchSearch = !filters.search || e.nombre.toLowerCase().includes(filters.search.toLowerCase());
    const matchAfiliada = !filters.afiliada ||
      (filters.afiliada === 'si' && e.es_afiliada) ||
      (filters.afiliada === 'no' && !e.es_afiliada);
    return matchSearch && matchAfiliada;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          <i className="bi bi-building me-2"></i>
          Empresas
        </h1>
        {canEdit && (
          <Button onClick={openNew}>
            <i className="bi bi-plus-lg"></i>
            Nueva Empresa
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <Card>
        <CardBody className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Buscar empresa..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
            <Select
              value={filters.afiliada}
              onChange={(e) => setFilters(prev => ({ ...prev, afiliada: e.target.value }))}
            >
              <option value="">Todas</option>
              <option value="si">Afiliadas</option>
              <option value="no">No afiliadas</option>
            </Select>
            <div className="flex gap-2">
              {(filters.search || filters.afiliada) && (
                <Button variant="ghost" onClick={clearFilters}>
                  <i className="bi bi-x-lg"></i>
                </Button>
              )}
              <div className="flex gap-1 ml-auto">
                <Button
                  variant={viewMode === 'cards' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                >
                  <i className="bi bi-grid-3x3-gap"></i>
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  <i className="bi bi-list"></i>
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Bulk Actions */}
      {selected.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-primary text-white rounded-lg">
          <span>{selected.length} seleccionadas</span>
          <div className="flex gap-2 ml-auto">
            {canEdit && (
              <Button variant="danger" size="sm" onClick={handleDeleteSelected}>
                <i className="bi bi-trash"></i>
                Eliminar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              <i className="bi bi-x"></i>
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Loader />
      ) : filteredEmpresas.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <i className="bi bi-building text-6xl text-gray-300 mb-4 block"></i>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay empresas</h3>
            <p className="text-gray-500 mb-4">Agrega tu primera empresa</p>
            {canEdit && (
              <Button onClick={openNew}>
                <i className="bi bi-plus-lg me-2"></i>
                Crear empresa
              </Button>
            )}
          </CardBody>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmpresas.map(empresa => (
            <Card
              key={empresa.id}
              hover
              className={clsx('relative cursor-pointer', selected.includes(empresa.id) && 'ring-2 ring-primary')}
              onClick={() => navigate(`/empresas/${empresa.id}`)}
            >
              <CardBody className="text-center">
                <div className="absolute top-2 right-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(empresa.id)}
                    onChange={() => toggleSelect(empresa.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded"
                  />
                </div>
                {empresa.logo ? (
                  <img
                    src={`/${empresa.logo}`}
                    alt={empresa.nombre}
                    className="w-16 h-16 rounded-full object-cover mx-auto mb-3"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
                    <i className="bi bi-building text-3xl text-gray-400"></i>
                  </div>
                )}
                <h3 className="font-semibold text-gray-900">{empresa.nombre}</h3>
                <div className="mt-2">
                  {empresa.es_afiliada ? (
                    <Badge variant="success">Afiliada</Badge>
                  ) : (
                    <Badge variant="gray">No afiliada</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3">Click para ver</p>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="w-10">
                  <TableCheckbox
                    checked={selected.length === filteredEmpresas.length && filteredEmpresas.length > 0}
                    onChange={toggleSelectAll}
                  />
                </TableHeader>
                <TableHeader>Logo</TableHeader>
                <TableHeader>Nombre</TableHeader>
                <TableHeader>Estado</TableHeader>
                <TableHeader className="w-24">Acciones</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmpresas.map(empresa => (
                <TableRow
                  key={empresa.id}
                  clickable
                  onClick={() => navigate(`/empresas/${empresa.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <TableCheckbox
                      checked={selected.includes(empresa.id)}
                      onChange={() => toggleSelect(empresa.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {empresa.logo ? (
                      <img src={`/${empresa.logo}`} alt={empresa.nombre} className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                        <i className="bi bi-building text-gray-400"></i>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{empresa.nombre}</TableCell>
                  <TableCell>
                    {empresa.es_afiliada ? <Badge variant="success">Afiliada</Badge> : <Badge variant="gray">No afiliada</Badge>}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/empresas/${empresa.id}`)}>
                        <i className="bi bi-eye"></i>
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(empresa); }}>
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(empresa.id); }}>
                            <i className="bi bi-trash"></i>
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <p className="text-center text-sm text-gray-500">
        Mostrando {filteredEmpresas.length} de {empresas.length} empresas
      </p>

      {/* Modal Form */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Editar Empresa' : 'Nueva Empresa'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Nombre *"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="contacto@empresa.com"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1e3c72] file:text-white hover:file:bg-[#2a5298]"
            />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea
              className="input"
              rows={3}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción breve..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="es_afiliada"
              checked={form.es_afiliada}
              onChange={(e) => setForm({ ...form, es_afiliada: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary"
            />
            <label htmlFor="es_afiliada" className="text-sm text-gray-700">Empresa afiliada</label>
          </div>
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loadingSave}>
              {loadingSave ? 'Guardando...' : 'Guardar'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}