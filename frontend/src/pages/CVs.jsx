import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { cvsAPI, empresasAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/uiStore';
import { Button, Input, Select, Card, CardBody, Badge, StatusBadge, Modal, ModalFooter, Loader, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableCheckbox } from '../components/ui';

const categorias = ['', 'Ayudante', 'Medio Oficial', 'Oficial', 'Especializado'];
const generos = ['', 'Masculino', 'Femenino'];
const afiliaciones = ['', { value: 'si', label: 'Es afiliado' }, { value: 'fue', label: 'Fue afiliado' }, { value: 'no', label: 'No afiliado' }];

export default function CVs() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { user } = useAuthStore();
  const canEdit = user?.is_admin;

  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [empresas, setEmpresas] = useState([]);
  const [oficios, setOficios] = useState([]);

  const [viewMode, setViewMode] = useState('cards');
  const [filters, setFilters] = useState({ nombre: '', categoria: '', oficio: '', genero: '', afiliado: '', empresa: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [currentCvNombre, setCurrentCvNombre] = useState('');

  useEffect(() => {
    fetchCVs();
    fetchEmpresas();
    fetchOficios();
  }, [pagination.page, filters]);

  const fetchCVs = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, estado: 'aprobado', ...filters };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);

      const res = await cvsAPI.getAll(params);
      setCvs(res.data.items);
      setPagination(prev => ({ ...prev, ...res.data }));
    } catch (error) {
      console.error('Error fetching CVs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmpresas = async () => {
    try {
      const res = await empresasAPI.getAll();
      setEmpresas(res.data);
    } catch (error) {}
  };

  const fetchOficios = async () => {
    try {
      const res = await cvsAPI.getOficios();
      setOficios(res.data);
    } catch (error) {}
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este CV?')) return;
    try {
      await cvsAPI.delete(id);
      toast.success('CV eliminado');
      fetchCVs();
    } catch (error) {
      toast.error('Error al eliminar CV');
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`¿Eliminar ${selected.length} CVs seleccionados?`)) return;
    try {
      await Promise.all(selected.map(id => cvsAPI.delete(id)));
      setSelected([]);
      toast.success(`${selected.length} CVs eliminados`);
      fetchCVs();
    } catch (error) {
      toast.error('Error al eliminar CVs');
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleExportarPDF = async () => {
    if (selected.length === 0) {
      toast.error('Selecciona al menos un CV');
      return;
    }
    try {
      const oficioFiltro = filters.oficio || null;
      const response = await cvsAPI.exportarPDF(selected, oficioFiltro);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const filename = `lista_trabajadores_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`PDF exportado con ${selected.length} trabajadores`);
    } catch (error) {
      toast.error('Error al exportar PDF');
    }
  };

  const toggleSelectAll = () => {
    if (selected.length === cvs.length) {
      setSelected([]);
    } else {
      setSelected(cvs.map(cv => cv.id));
    }
  };

  const clearFilters = () => {
    setFilters({ nombre: '', categoria: '', oficio: '', genero: '', afiliado: '', empresa: '' });
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          <i className="bi bi-people me-2"></i>
          Gestión de CVs
        </h1>
        {canEdit && (
          <Button onClick={() => navigate('/cv/nuevo')}>
            <i className="bi bi-plus-lg"></i>
            Nuevo CV
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <Card className="w-full">
        <div className="py-3 px-4">
<form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); fetchCVs(); }}>
            <input
              type="text"
              className="w-full lg:flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-base leading-none"
              placeholder="Buscar por Nombre y DNI..."
              value={filters.nombre}
              onChange={(e) => setFilters(prev => ({ ...prev, nombre: e.target.value }))}
            />
            <select
              className="w-full lg:flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-base leading-none"
              value={filters.categoria}
              onChange={(e) => setFilters(prev => ({ ...prev, categoria: e.target.value }))}
            >
              <option value="">Categoría</option>
              {categorias.slice(1).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="text"
              className="w-full lg:flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-base leading-none"
              placeholder="Oficio..."
              value={filters.oficio}
              onChange={(e) => setFilters(prev => ({ ...prev, oficio: e.target.value }))}
            />
            <div className="w-full lg:w-auto flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 bg-primary text-white hover:bg-primary-light active:bg-primary-dark"
              >
                <i className="bi bi-search"></i>
                Buscar
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-all duration-200 text-gray-600 hover:bg-gray-100"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
          </form>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selected.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-primary text-white rounded-lg">
          <span>{selected.length} seleccionados</span>
          <div className="flex gap-2 ml-auto">
            <Button variant="light" size="sm" onClick={handleExportarPDF}>
              <i className="bi bi-download"></i>
              Exportar
            </Button>
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

      {/* View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TableCheckbox
            checked={selected.length === cvs.length && cvs.length > 0}
            onChange={toggleSelectAll}
          />
          <span className="text-sm text-gray-500">Seleccionar todos</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border border-gray-300 text-gray-600 hover:bg-gray-100"
            >
              <i className="bi bi-sliders text-sm"></i>
              Filtros
            </button>
            {showFilters && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border p-4 z-10 min-w-[280px]">
                <h4 className="font-medium mb-3">Filtros adicionales</h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Empresa</label>
                    <select
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                      value={filters.empresa}
                      onChange={(e) => setFilters(prev => ({ ...prev, empresa: e.target.value }))}
                    >
                      <option value="">Todas</option>
                      {empresas.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Afiliación</label>
                    <select
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                      value={filters.afiliado}
                      onChange={(e) => setFilters(prev => ({ ...prev, afiliado: e.target.value }))}
                    >
                      <option value="">Todas</option>
                      {afiliaciones.slice(1).map(af => (
                        <option key={af.value} value={af.value}>{af.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Género</label>
                    <select
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                      value={filters.genero}
                      onChange={(e) => setFilters(prev => ({ ...prev, genero: e.target.value }))}
                    >
                      <option value="">Todos</option>
                      {generos.slice(1).map(gen => (
                        <option key={gen} value={gen}>{gen}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-white hover:bg-primary-light"
                    onClick={() => { fetchCVs(); setShowFilters(false); }}
                  >
                    <i className="bi bi-check-lg"></i>
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex bg-gray-100 rounded p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'cards' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <i className="bi bi-grid-3x3-gap text-base"></i>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <i className="bi bi-list text-base"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <Loader />
      ) : cvs.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <i className="bi bi-people text-6xl text-gray-300 mb-4 block"></i>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay CVs registrados</h3>
            <p className="text-gray-500 mb-4">Comienza subiendo tu primer CV</p>
            {canEdit && (
              <Button onClick={() => navigate('/cv/nuevo')}>
                <i className="bi bi-plus-lg me-2"></i>
                Crear el primero
              </Button>
            )}
          </CardBody>
        </Card>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cvs.map(cv => (
            <Card
              key={cv.id}
              hover
              className={clsx('relative cursor-pointer', selected.includes(cv.id) && 'ring-2 ring-primary')}
              onClick={() => navigate(`/cvs/ver/${cv.id}`)}
            >
              <CardBody className="text-center">
                <div className="absolute top-2 right-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(cv.id)}
                    onChange={() => toggleSelect(cv.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded"
                  />
                </div>
                <div className="relative inline-block mb-4">
                  {cv.foto ? (
                    <img
                      src={`/${cv.foto}`}
                      alt={cv.nombre}
                      className="w-20 h-20 rounded-full object-cover mx-auto"
                      style={{ border: '3px solid var(--primary)' }}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                      <i className="bi bi-person text-4xl text-gray-400"></i>
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900">{cv.nombre || 'Sin nombre'}</h3>
                {cv.apodo && (
                  <p className="text-sm text-gray-500">{cv.apodo}</p>
                )}

                {cv.oficios && (
                  <div className="mt-3 flex flex-wrap justify-center gap-1">
                    {cv.oficios.split(',').slice(0, 3).map((oficio, idx) => (
                      <span key={idx} className="bg-[#1e3c72] text-white text-xs px-2 py-1 rounded-full">{oficio.trim()}</span>
                    ))}
                    {cv.oficios.split(',').length > 3 && (
                      <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded-full">+{cv.oficios.split(',').length - 3}</span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap justify-center gap-1">
                  {cv.afiliado === 'si' && (
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                      <i className="bi bi-person-check me-1"></i>Afiliado
                    </span>
                  )}
                  {cv.afiliado === 'fue' && (
                    <span className="bg-yellow-500 text-gray-800 text-xs px-2 py-1 rounded-full">
                      <i className="bi bi-clock-history me-1"></i>Fue afiliado
                    </span>
                  )}
                  {cv.sin_experiencia && (
                    <span className="bg-gray-700 text-white text-xs px-2 py-1 rounded-full">
                      <i className="bi bi-briefcase-x me-1"></i>Sin exp.
                    </span>
                  )}
                  {cv.tiene_documentacion && (
                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                      <i className="bi bi-award me-1"></i>Docs
                    </span>
                  )}
                </div>

                {cv.area && (
                  <div className="mt-2">
                    <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded-full">
                      <i className="bi bi-star me-1"></i>{cv.area}
                    </span>
                  </div>
                )}

                <div className="mt-2 flex gap-1 justify-center">
                  {cv.path && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPdfUrl(`/${cv.path}`);
                        setCurrentCvNombre(cv.nombre || 'CV');
                        setShowPdfModal(true);
                      }}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                    >
                      <i className="bi bi-file-earmark-pdf me-1"></i>Ver PDF
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/cvs/editar/${cv.id}`);
                    }}
                    className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded transition-colors"
                  >
                    <i className="bi bi-pencil me-1"></i>Editar
                  </button>
                </div>

                <p className="text-xs text-gray-400 mt-2">Click para ver detalles</p>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        /* Table View */
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="w-10">
                  <TableCheckbox
                    checked={selected.length === cvs.length && cvs.length > 0}
                    onChange={toggleSelectAll}
                  />
                </TableHeader>
                <TableHeader>Foto</TableHeader>
                <TableHeader>Nombre</TableHeader>
                <TableHeader>DNI</TableHeader>
                <TableHeader>Oficio</TableHeader>
                <TableHeader>Afiliación</TableHeader>
                <TableHeader className="w-20">Acciones</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {cvs.map(cv => (
                <TableRow
                  key={cv.id}
                  clickable
                  onClick={() => navigate(`/cvs/ver/${cv.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <TableCheckbox
                      checked={selected.includes(cv.id)}
                      onChange={() => toggleSelect(cv.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {cv.foto ? (
                      <img src={`/${cv.foto}`} alt={cv.nombre} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <i className="bi bi-person text-gray-400"></i>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{cv.nombre || '-'}</TableCell>
                  <TableCell>{cv.dni || '-'}</TableCell>
                  <TableCell>{cv.oficios || '-'}</TableCell>
                  <TableCell>
                    {cv.afiliado && <StatusBadge status={cv.afiliado} />}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/cvs/ver/${cv.id}`)}>
                      <i className="bi bi-eye"></i>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-500 px-4">
            Página {pagination.page} de {pagination.pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={pagination.page >= pagination.pages}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Siguiente
          </Button>
        </div>
      )}

      <p className="text-center text-sm text-gray-500">
        Mostrando {cvs.length} de {pagination.total} CVs
      </p>

      {/* Modal PDF */}
      {showPdfModal && pdfUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">CV - {currentCvNombre}</h3>
              <button 
                onClick={() => setShowPdfModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <i className="bi bi-x-lg text-xl"></i>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe 
                src={pdfUrl}
                className="w-full h-[70vh]"
                title="CV PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
