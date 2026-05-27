import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { PiggyBank } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { Button, Field, Input } from "../components/ui";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("brunomouralima@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      toast.error("Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <PiggyBank className="h-12 w-12 text-brand" />
          <h1 className="text-xl font-bold">Finanças & Património</h1>
          <p className="text-sm text-slate-500">Gestão financeira do agregado familiar</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Palavra-passe">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "A entrar…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
