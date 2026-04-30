import { useState, useEffect } from 'react';

export default function Bienvenido() {
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    const targetUrl = `${baseUrl}/subir-cv`;
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(targetUrl)}`);
  }, []);

  const handleQrLoad = () => {
    setQrLoaded(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#1e3c72] to-[#2a5298]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1e3c72] to-[#2a5298] py-12 px-8 text-center text-white">
          <h5 className="text-6xl font-bold mp-2 uppercase tracking-widest text-white-600 mb-1">UOCRA</h5>

          <p className="text-sm uppercase font-medium tracking-wide border-b-2 border-white/50 pb-1 inline-block">
            SECRETARIO GENERAL
          </p>
          <h3 className="text-1xl font-bold mb-1 tracking-wider">RICARDO TRUQUIL</h3>


        </div>

        {/* QR Section */}
        <div className="bg-gray-100 p-6 mx-6 mt-6 mb-6 rounded-2xl relative z-10">
          <h3 className="text-lg font-semibold text-gray-700 text-center mb-4">
            Escanear el código QR para subir tu CV
          </h3>
          
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl shadow-md">
              {!qrLoaded && (
                <div className="w-[200px] h-[200px] flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-gray-200 border-t-[#1e3c72] rounded-full animate-spin"></div>
                </div>
              )}
              <img
                src={qrUrl}
                alt="Código QR para subir tu CV"
                className={`w-[200px] h-[200px] ${qrLoaded ? 'block' : 'hidden'}`}
                onLoad={handleQrLoad}
              />
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="px-6 -mt-2 pb-6 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/subir-cv"
            target="_blank"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1e3c72] text-white font-semibold rounded-full hover:bg-[#2a5298] transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Subir mi CV
          </a>
          <a
            href="/bienvenido/pdf"
            download="uocra_bienvenida.pdf"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar PDF
          </a>
        </div>

        {/* Instrucciones */}
        <div className="px-6 pb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h4 className="font-semibold text-[#1e3c72] mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ¿Cómo funciona?
            </h4>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Escaneá el código QR con tu celular o hacé clic en "Subir mi CV"</li>
              <li>Completá tus datos personales</li>
              <li>Subí una foto tipo carnet (opcional)</li>
              <li>¡Listo! Un administrador revisará tu información</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
