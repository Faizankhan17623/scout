import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'

const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || ''
const isAdminRoute = ADMIN_PATH && window.location.pathname === ADMIN_PATH

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdminRoute ? <AdminApp /> : <App />}
  </StrictMode>,
)
