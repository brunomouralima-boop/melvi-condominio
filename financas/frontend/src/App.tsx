import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Accounts from "./pages/Accounts";
import Categories from "./pages/Categories";
import Patrimonio from "./pages/Patrimonio";
import Definicoes from "./pages/Definicoes";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/lancamentos" element={<Transactions />} />
                <Route path="/contas" element={<Accounts />} />
                <Route path="/categorias" element={<Categories />} />
                <Route path="/patrimonio" element={<Patrimonio />} />
                <Route path="/definicoes" element={<Definicoes />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
