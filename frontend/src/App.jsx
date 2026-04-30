import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/layout';
import { Toast } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CVs from './pages/CVs';
import NuevoCV from './pages/NuevoCV';
import RevisarCV from './pages/RevisarCV';
import NuevoRevisarCV from './pages/NuevoRevisarCV';
import EditarCV from './pages/EditarCV';
import VerCV from './pages/VerCV';
import VerEmpresa from './pages/VerEmpresa';
import CVsPendientes from './pages/CVsPendientes';
import Actividad from './pages/Actividad';
import Usuarios from './pages/Usuarios';
import Notas from './pages/Notas';
import SubirCV from './pages/SubirCV';
import Empresas from './pages/Empresas';
import BienvenidoQR from './pages/BienvenidoQR';
import Bienvenido from './pages/Bienvenido';

function PrivateRoute({ children }) {
  const { isAuthenticated, token } = useAuthStore();
  
  if (!token) {
    return <Navigate to="/login" />;
  }
  
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/subir-cv" element={<SubirCV />} />
      <Route path="/bienvenido" element={<Bienvenido />} />
      
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/home" />} />
        <Route path="home" element={<Dashboard />} />
        <Route path="cvs" element={<CVs />} />
        <Route path="notas" element={<Notas />} />
        <Route path="cv/nuevo" element={<NuevoCV />} />
        <Route path="cvs/revisar/:id" element={<RevisarCV />} />
        <Route path="cv/revisar" element={<NuevoRevisarCV />} />
        <Route path="cv/qr" element={<BienvenidoQR />} />
        <Route path="cvs/ver/:id" element={<VerCV />} />
        <Route path="cvs/editar/:id" element={<EditarCV />} />
        <Route path="cv/pendientes" element={<CVsPendientes />} />
        <Route path="empresas" element={<Empresas />} />
        <Route path="empresas/:id" element={<VerEmpresa />} />
        <Route path="actividad" element={<Actividad />} />
        <Route path="usuarios" element={<Usuarios />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/home" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
      <Toast />
    </BrowserRouter>
  );
}