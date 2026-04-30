import { useState, useEffect } from 'react';
import { notasAPI, cvsAPI, empresasAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/uiStore';
import { Card, CardBody, Button, Loader, Modal, ModalFooter } from '../components/ui';

export default function Notas() {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const canEdit = user?.is_admin;
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loadingSave, setLoadingSave] = useState(false);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [selectedNotas, setSelectedNotas] = useState([]);
  const [cvsDisponibles, setCvsDisponibles] = useState([]);
  const [empresasDisponibles, setEmpresasDisponibles] = useState([]);

  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    cv_id: '',
    empresa_id: '',
    archivo: null,
  });

  const [viewingNota, setViewingNota] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [viewingInfo, setViewingInfo] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    fetchNotas();
    fetchCvsYEmpresas();
  }, [filtro]);

  const fetchNotas = async () => {
    try {
      const res = await notasAPI.getAll({ filtro });
      setNotas(res.data);
    } catch (error) {
      toast.error('Error al cargar notas');
    } finally {
      setLoading(false);
    }
  };

  const fetchCvsYEmpresas = async () => {
    try {
      const [cvsRes, empresasRes] = await Promise.all([
        cvsAPI.getAll({ estado: 'aprobado', per_page: 100 }),
        empresasAPI.getAll(),
      ]);
      setCvsDisponibles(cvsRes.data.items || []);
      setEmpresasDisponibles(empresasRes.data || []);
    } catch (error) {
      console.error('Error fetching cvs/empresas:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingSave(true);
    try {
      const formData = new FormData();
      formData.append('titulo', form.titulo);
      if (form.descripcion) formData.append('descripcion', form.descripcion);
      if (form.cv_id) formData.append('cv_id', form.cv_id);
      if (form.empresa_id) formData.append('empresa_id', form.empresa_id);
      if (form.archivo) formData.append('archivo', form.archivo);

      if (editingId) {
        await notasAPI.update(editingId, formData);
        toast.success('Nota actualizada');
      } else {
        await notasAPI.create(formData);
        toast.success('Nota creada');
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ titulo: '', descripcion: '', cv_id: '', empresa_id: '', archivo: null });
      fetchNotas();
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setLoadingSave(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    try {
      await notasAPI.delete(id);
      toast.success('Nota eliminada');
      fetchNotas();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const toggleNotaSelection = (id) => {
    if (selectedNotas.includes(id)) {
      setSelectedNotas(selectedNotas.filter(n => n !== id));
    } else {
      setSelectedNotas([...selectedNotas, id]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedNotas.length === 0) return;
    if (!confirm(`¿Eliminar ${selectedNotas.length} nota(s) seleccionada(s)?`)) return;
    try {
      for (const id of selectedNotas) {
        await notasAPI.delete(id);
      }
      toast.success(`${selectedNotas.length} nota(s) eliminada(s)`);
      setSelectedNotas([]);
      fetchNotas();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ titulo: '', descripcion: '', cv_id: '', empresa_id: '', archivo: null });
    setShowModal(true);
  };

  const openEdit = (nota) => {
    setEditingId(nota.id);
    setForm({
      titulo: nota.titulo,
      descripcion: nota.descripcion || '',
      cv_id: nota.cv_id || '',
      empresa_id: nota.empresa_id || '',
      archivo: null,
    });
    setShowModal(true);
  };

  const openView = (nota) => {
    if (nota.archivo) {
      setViewingNota(nota);
      setShowPdfModal(true);
    } else {
      setViewingInfo(nota);
      setShowInfoModal(true);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Solo se permiten archivos PDF');
      return;
    }
    setForm({ ...form, archivo: file });
  };

  const filteredNotas = notas.filter(n =>
    n.titulo.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (date) => new Date(date).toLocaleDateString('es-AR');

  const totalNotas = notas.length;
  const notasCv = notas.filter(n => n.cv_id).length;
  const notasEmpresa = notas.filter(n => n.empresa_id).length;
  const notasSueltas = notas.filter(n => !n.cv_id && !n.empresa_id).length;

  const getStatsCard = (label, count, filterValue, icon, colorClass, isActive) => (
    <div
      onClick={() => setFiltro(filterValue)}
      className={`cursor-pointer transition-all ${isActive ? 'ring-2 ring-offset-2' : ''}`}
      style={{ borderColor: isActive ? '#1e3c72' : 'transparent' }}
    >
      <Card className={`h-full ${isActive ? 'bg-blue-50' : ''}`}>
        <CardBody className="text-center py-4">
          <i className={`bi ${icon} text-3xl ${colorClass}`}></i>
          <h4 className={`mb-1 ${colorClass}`}>{count}</h4>
          <small className="text-gray-500">{label}</small>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <h2 className="text-xl font-semibold">
          <i className="bi bi-file-earmark-text mr-2"></i> Notas y Documentos
        </h2>
        <div className="flex gap-2">
          {canEdit && selectedNotas.length > 0 && (
            <Button variant="danger" size="sm" onClick={handleDeleteSelected}>
              <i className="bi bi-trash"></i> Eliminar ({selectedNotas.length})
            </Button>
          )}
          <Button onClick={openNew}>
            <i className="bi bi-plus-lg"></i> Nueva Nota
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {getStatsCard('Total Notas', totalNotas, 'todas', 'bi-files', 'text-[#1e3c72]', filtro === 'todas')}
        {getStatsCard('De CVs', notasCv, 'cv', 'bi-person-badge', 'text-green-600', filtro === 'cv')}
        {getStatsCard('De Empresas', notasEmpresa, 'empresa', 'bi-building', 'text-blue-600', filtro === 'empresa')}
        {getStatsCard('Sueltas', notasSueltas, 'sin_asignar', 'bi-folder', 'text-gray-600', filtro === 'sin_asignar')}
      </div>

      {/* Search */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1" style={{ minWidth: '200px' }}>
              <div className="relative">
                <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Buscar notas..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Lista de notas */}
      {loading ? (
        <div className="text-center py-12">
          <Loader />
        </div>
      ) : filteredNotas.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12 text-gray-500">
            No hay notas
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredNotas.map(nota => (
            <Card key={nota.id} className="hover:shadow-md transition-shadow">
              <CardBody className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {nota.archivo ? (
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <i className="bi bi-file-earmark-pdf text-red-600 text-xl"></i>
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <i className="bi bi-file-earmark-text text-blue-600 text-xl"></i>
                      </div>
                    )}
                  </div>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => openView(nota)}
                  >
                    <h4 className="font-semibold text-gray-900 mb-1">{nota.titulo}</h4>
                    {nota.descripcion && (
                      <p className="text-sm text-gray-500 mb-0 truncate">{nota.descripcion}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        nota.cv_id ? 'bg-green-100 text-green-700' : 
                        nota.empresa_id ? 'bg-blue-100 text-blue-700' : 
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {nota.cv_id ? '📋 CV' : nota.empresa_id ? '🏢 Empresa' : '📁 Suelta'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(nota.fecha_subida).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => openEdit(nota)} 
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                      title="Editar"
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button 
                      onClick={() => handleDelete(nota.id)} 
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded"
                      title="Eliminar"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Editar Nota' : 'Nueva Nota'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              rows={3}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asociar a CV</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              value={form.cv_id}
              onChange={(e) => setForm({ ...form, cv_id: e.target.value, empresa_id: '' })}
            >
              <option value="">Ninguno</option>
              {cvsDisponibles.map(cv => (
                <option key={cv.id} value={cv.id}>{cv.nombre} {cv.dni ? `(${cv.dni})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asociar a Empresa</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50"
              value={form.empresa_id}
              onChange={(e) => setForm({ ...form, empresa_id: e.target.value, cv_id: '' })}
            >
              <option value="">Ninguna</option>
              {empresasDisponibles.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo PDF</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1e3c72] file:text-white"
            />
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

{/* Modal PDF de la nota */}
      {showPdfModal && viewingNota?.archivo && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-40" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="fixed inset-0" onClick={() => setShowPdfModal(false)} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}></div>
          <div className="relative bg-white rounded-xl shadow-2xl z-50 w-full h-full flex flex-col" style={{ maxWidth: '80rem', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-[#1e3c72] to-[#2a5298] rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <i className="bi bi-file-earmark-pdf text-white text-xl"></i>
                </div>
                <h3 className="font-bold text-white text-lg">{viewingNota.titulo}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={`/${viewingNota.archivo}`} 
                  target="_blank" 
                  className="flex items-center gap-2 px-3 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors text-sm font-medium"
                >
                  <i className="bi bi-box-arrow-up-right"></i> Nueva pestaña
                </a>
                <button 
                  onClick={() => setShowPdfModal(false)} 
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                >
                  <i className="bi bi-x-lg text-xl"></i>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe 
                src={`/${viewingNota.archivo}`} 
                className="w-full h-full border-0"
                title="Nota PDF"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal info de la nota (sin PDF) */}
      {showInfoModal && viewingInfo && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-40" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="fixed inset-0" onClick={() => setShowInfoModal(false)} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}></div>
          <div className="relative bg-white rounded-xl shadow-2xl z-50 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-[#1e3c72] to-[#2a5298] rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <i className="bi bi-file-earmark-text text-white text-xl"></i>
                </div>
                <h3 className="font-bold text-white text-lg">{viewingInfo.titulo}</h3>
              </div>
              <button 
                onClick={() => setShowInfoModal(false)} 
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <i className="bi bi-x-lg text-xl"></i>
              </button>
            </div>
            <div className="p-5">
              {viewingInfo.descripcion ? (
                <div className="bg-gray-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">{viewingInfo.descripcion}</div>
              ) : (
                <p className="text-gray-400 italic text-center py-4">Sin descripción</p>
              )}
              <div className="flex items-center justify-between mt-5 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    viewingInfo.cv_id ? 'bg-green-100 text-green-700' : 
                    viewingInfo.empresa_id ? 'bg-blue-100 text-blue-700' : 
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {viewingInfo.cv_id ? '📋 CV' : viewingInfo.empresa_id ? '🏢 Empresa' : '📁 Suelta'}
                  </span>
                </div>
                <span className="text-sm text-gray-400">
                  <i className="bi bi-calendar3 me-1"></i>
                  {new Date(viewingInfo.fecha_subida).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}