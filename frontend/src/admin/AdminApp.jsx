import { useState } from "react";
import "./admin.css";
import { getAdminToken } from "./adminApi";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => !!getAdminToken());

  return authed ? (
    <AdminDashboard onLogout={() => setAuthed(false)} />
  ) : (
    <AdminLogin onSuccess={() => setAuthed(true)} />
  );
}
