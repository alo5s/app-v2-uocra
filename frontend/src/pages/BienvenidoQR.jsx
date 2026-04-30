import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CardBody } from '../components/ui';

export default function BienvenidoQR() {
  const [loading, setLoading] = useState(true);
  const qrUrl = (import.meta.env.VITE_PUBLIC_URL || window.location.origin) + '/subir-cv';

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '300px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="relative">
        <CardBody className="relative z-10">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[#1e3c72] mb-2">
              <i className="bi bi-qr-code me-2"></i>
              QR de Bienvenida UOCRA
            </h2>
            <p className="text-gray-600">
              Descargá el código QR para que los trabajadores puedan subir su CV
            </p>
          </div>

          <div className="bg-gray-100 rounded-lg p-6 text-center mb-6">
            <div className="inline-block bg-white p-3 rounded-lg shadow">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                alt="Código QR UOCRA"
                className="mx-auto"
              />
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Escaneá el código QR para acceder al formulario de subir CV
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a 
              href="/bienvenido/pdf" 
              download="uocra_bienvenida.pdf"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#1e3c72] text-white rounded-lg hover:bg-[#2a5298] transition-colors"
            >
              <i className="bi bi-download"></i>
              Descargar PDF
            </a>
            
            <a 
              href="/bienvenido" 
              target="_blank"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <i className="bi bi-box-arrow-up-right"></i>
              Ver Página Web
            </a>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">
              <i className="bi bi-info-circle me-1"></i>
              ¿Cómo funciona?
            </h4>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Descargá el PDF con el código QR</li>
              <li>Imprimilo y entregalo al trabajador</li>
              <li>El trabajador escanea el QR con su celular</li>
              <li>Completa sus datos y sube su CV</li>
              <li>Recibirás una notificación para revisar</li>
            </ol>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}