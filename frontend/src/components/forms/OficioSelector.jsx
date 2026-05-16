import { useState, useEffect, useMemo } from 'react';
import { cvsAPI } from '../../api';

function getCategoriaIcon(cat) {
  const icons = {
    'Albañilería': 'bricks',
    'Electricidad': 'lightning',
    'Soldadura': 'thermometer-half',
    'Carpintería': 'scissors',
    'Plomería': 'droplet',
    'Pintura': 'brush',
    'Maquinaria': 'gear',
    'Conductores': 'truck',
    'Montaje': 'wrench',
    'Mecánica': 'tools',
    'Equipos': 'cpu',
    'Varios': 'grid-3x3',
  };
  for (const [key, icon] of Object.entries(icons)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return 'briefcase';
}

export default function OficioSelector({ selected, onChange }) {
  const [categorias, setCategorias] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [activeCat, setActiveCat] = useState(null);

  useEffect(() => {
    cvsAPI.getOficiosCategorias()
      .then(res => {
        const cats = res.data || {};
        setCategorias(cats);
        const keys = Object.keys(cats);
        if (keys.length > 0) setActiveCat(keys[0]);
      })
      .catch(() => {
        cvsAPI.getOficios()
          .then(res => {
            if (res.data) setCategorias({ 'Todos': res.data });
          })
          .catch(() => {});
      });
  }, []);

  const todasLasCategorias = Object.keys(categorias);

  const filteredCategorias = useMemo(() => {
    if (!busqueda) return categorias;
    const q = busqueda.toLowerCase();
    const result = {};
    for (const [cat, oficios] of Object.entries(categorias)) {
      const filtered = oficios.filter(o => o.toLowerCase().includes(q));
      if (filtered.length > 0) result[cat] = filtered;
    }
    return result;
  }, [busqueda, categorias]);

  const toggleOficio = (oficio) => {
    const nuevo = selected.includes(oficio)
      ? selected.filter(o => o !== oficio)
      : [...selected, oficio];
    onChange(nuevo);
  };

  const addCustom = () => {
    const oficio = customInput.trim();
    if (oficio && !selected.includes(oficio)) {
      onChange([...selected, oficio]);
      setCustomInput('');
    }
  };

  const catKeys = Object.keys(filteredCategorias);
  const hayResultados = catKeys.some(cat => filteredCategorias[cat].length > 0);

  return (
    <div>
      <label className="block font-semibold text-gray-800 mb-2">
        Oficios <span className="text-red-600">*</span>
      </label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 p-3 bg-blue-50 rounded-xl">
          {selected.map(oficio => (
            <span
              key={oficio}
              onClick={() => toggleOficio(oficio)}
              className="inline-flex items-center gap-1.5 bg-[#1e3c72] text-white px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer hover:bg-red-600 transition-colors"
            >
              {oficio} <i className="bi bi-x"></i>
            </span>
          ))}
        </div>
      )}

      {!busqueda && todasLasCategorias.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {todasLasCategorias.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCat(activeCat === cat ? null : cat)}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                activeCat === cat
                  ? 'bg-[#1e3c72] text-white shadow'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <i className={`bi bi-${getCategoriaIcon(cat)} me-1`}></i>
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="relative mb-3">
        <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72] transition-all"
          placeholder="Buscar oficio..."
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
        {!hayResultados && (
          <p className="text-gray-400 text-sm text-center py-4">
            No se encontraron oficios con "{busqueda}"
          </p>
        )}

        {catKeys.map(cat => {
          const items = filteredCategorias[cat];
          if (items.length === 0) return null;
          const estaActiva = !busqueda && activeCat === cat;
          const colapsada = !busqueda && activeCat !== null && activeCat !== cat;
          if (colapsada) return null;

          return (
            <div key={cat}>
              {!busqueda && (
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  <i className={`bi bi-${getCategoriaIcon(cat)} me-1`}></i>
                  {cat}
                </h4>
              )}
              <div className="flex flex-wrap gap-1.5">
                {items.map(oficio => {
                  const estaSeleccionado = selected.includes(oficio);
                  return (
                    <button
                      key={oficio}
                      type="button"
                      onClick={() => toggleOficio(oficio)}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${
                        estaSeleccionado
                          ? 'bg-[#1e3c72] text-white border-[#1e3c72] shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-[#1e3c72] hover:text-[#1e3c72] hover:shadow-sm'
                      }`}
                    >
                      {estaSeleccionado ? <i className="bi bi-check-lg me-1"></i> : <i className="bi bi-plus me-1"></i>}
                      {oficio}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          className="flex-1 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3c72]/50 focus:border-[#1e3c72] transition-all"
          placeholder="Otro oficio (no listado)..."
        />
        <button
          type="button"
          onClick={addCustom}
          className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors border border-gray-200"
        >
          <i className="bi bi-plus-lg"></i>
        </button>
      </div>

      {selected.length === 0 && (
        <p className="text-gray-400 text-xs mt-1">Seleccioná al menos un oficio</p>
      )}
    </div>
  );
}
