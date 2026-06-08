import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

interface Props {
  /** Texto que aparece à direita do ícone — varia conforme layout (Administrador, Condómino, Porteiro) */
  title: string;
  /** Chama quando o utilizador clica no botão hamburguer */
  onMenuClick: () => void;
}

/**
 * Topbar visível APENAS em mobile (md:hidden).
 * Tem o botão hamburguer para abrir a sidebar e mostra o branding.
 * Em desktop é completamente escondida — a sidebar já está visível.
 */
export function MobileTopbar({ title, onMenuClick }: Props) {
  return (
    <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <button
        onClick={onMenuClick}
        className="-ml-1.5 rounded-md p-1.5 text-brand-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-900/20"
        aria-label="Abrir menu"
      >
        <Menu className="h-6 w-6" />
      </button>
      <div className="flex items-center">
        <BrandLogo variant="color" className="h-7" />
      </div>
      <div className="ml-auto text-[11px] uppercase tracking-wider text-slate-400">{title}</div>
    </div>
  );
}
