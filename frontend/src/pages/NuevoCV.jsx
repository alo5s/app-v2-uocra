import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cvsAPI } from '../api';
import { useToastStore } from '../store/uiStore';
import { Button, Card, CardBody } from '../components/ui';

export default function NuevoCV() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const [extrayendo, setExtrayendo] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [modoExtraccion, setModoExtraccion] = useState('automatico');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Solo se permiten archivos PDF');
        return;
      }
      if (file.size > 16 * 1024 * 1024) {
        toast.error('El archivo excede el tamaño máximo de 16MB');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));

      if (modoExtraccion === 'automatico') {
        extraerDatosDelPDF(file);
      } else {
        navigate('/cv/revisar', { 
          state: { 
            file: file,
            previewUrl: URL.createObjectURL(file),
            datos: {
              nombre: '',
              dni: '',
              fecha_nacimiento: '',
              domicilio: '',
              email: '',
              telefono: '',
              oficios_detectados: [],
              edad: '',
              domicilio_opciones: [],
              telefono_opciones: [],
            },
            modo: modoExtraccion,
          } 
        });
      }
    }
  };

  const extraerDatosDelPDF = async (file) => {
    setExtrayendo(true);
    try {
      const res = await cvsAPI.extraerDatosPDF(file);
      const datos = res.data;

      const datosExtraidos = {
        nombre: datos.nombre || '',
        dni: datos.dni || '',
        fecha_nacimiento: datos.fecha_nacimiento || '',
        domicilio: datos.domicilio || '',
        email: datos.email || '',
        telefono: datos.telefono || '',
        oficios_detectados: datos.oficios_detectados || [],
        edad: datos.edad || '',
        domicilio_opciones: datos.domicilios_opciones || [],
        telefono_opciones: datos.telefonos_opciones || [],
      };

      toast.success('Datos extraídos del PDF');
      
      navigate('/cv/revisar', { 
        state: { 
          file: file,
          previewUrl: URL.createObjectURL(file),
          datos: datosExtraidos,
          modo: modoExtraccion,
        } 
      });
    } catch (error) {
      console.error('Error extrayendo datos:', error);
      toast.error('Error al extraer datos del PDF');
    } finally {
      setExtrayendo(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const toggleModoExtraccion = (nuevoModo) => {
    setModoExtraccion(nuevoModo);
    if (nuevoModo === 'automatico' && selectedFile) {
      extraerDatosDelPDF(selectedFile);
    } else if (nuevoModo === 'manual' && selectedFile) {
      navigate('/cv/revisar', { 
        state: { 
          file: selectedFile,
          previewUrl: previewUrl,
          datos: {
            nombre: '',
            dni: '',
            fecha_nacimiento: '',
            domicilio: '',
            email: '',
            telefono: '',
            oficios_detectados: [],
            edad: '',
            domicilio_opciones: [],
            telefono_opciones: [],
          },
          modo: nuevoModo,
        } 
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo CV</h1>
        <Button variant="secondary" onClick={() => navigate('/cvs')}>
          <i className="bi bi-x-lg"></i> Cancelar
        </Button>
      </div>

      <div className="space-y-6">
        {/* Modo de Extracción */}
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Modo de carga:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleModoExtraccion('automatico')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    modoExtraccion === 'automatico'
                      ? 'bg-[#1e3c72] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="bi bi-robot mr-2"></i>
                  Automático
                </button>
                <button
                  type="button"
                  onClick={() => toggleModoExtraccion('manual')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    modoExtraccion === 'manual'
                      ? 'bg-[#1e3c72] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="bi bi-pencil mr-2"></i>
                  Manual
                </button>
              </div>
              {modoExtraccion === 'automatico' && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <i className="bi bi-check-circle"></i>
                  Los datos se extraerán automáticamente
                </span>
              )}
              {modoExtraccion === 'manual' && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <i className="bi bi-info-circle"></i>
                  Debés completar los datos manualmente
                </span>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Archivo PDF del CV */}
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <i className="bi bi-upload text-[#1e3c72]"></i>
              Archivo PDF del CV
            </h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {previewUrl ? (
                <div className="flex flex-col items-center">
                  <iframe 
                    src={previewUrl} 
                    className="w-full mb-3 rounded border border-gray-300" 
                    style={{ height: '320px' }}
                    title="PDF Preview"
                  />
                  <div className="flex gap-2 flex-wrap justify-center">
                    {modoExtraccion === 'automatico' && selectedFile && !extrayendo && (
                      <button 
                        type="button"
                        onClick={() => extraerDatosDelPDF(selectedFile)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                      >
                        <i className="bi bi-robot"></i>
                        Extraer datos del PDF
                      </button>
                    )}
                    {extrayendo && (
                      <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg w-full">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                          <span className="text-gray-700 font-medium">Extrayendo datos del CV...</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Esto puede tardar unos segundos</p>
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={removeFile}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <i className="bi bi-file-earmark-pdf text-gray-400 text-5xl mb-4 block"></i>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label 
                    htmlFor="pdf-upload" 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3c72] text-white rounded-lg hover:bg-[#2a5298] cursor-pointer"
                  >
                    <i className="bi bi-upload"></i>
                    Seleccionar PDF
                  </label>
                  <p className="text-sm text-gray-500 mt-2">Máximo 16MB</p>
                </>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-700">
            <i className="bi bi-info-circle me-2"></i>
            Seleccioná el modo de carga y subí el CV en PDF. 
            {modoExtraccion === 'automatico' 
              ? 'Los datos se extraerán automáticamente y podrás revisarlos en la siguiente pantalla.' 
              : 'Completá los datos manualmente en la siguiente pantalla.'}
          </p>
        </div>
      </div>
    </div>
  );
}