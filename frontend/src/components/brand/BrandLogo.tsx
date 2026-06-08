import { cn } from "@/lib/utils";
import colorLogo from "@/assets/melvi-logo.png";
import whiteLogo from "@/assets/melvi-logo-white.png";

interface BrandLogoProps {
  /**
   * "color" → letras laranja/navy (para fundos claros/brancos).
   * "white" → letras brancas, fundo transparente (para fundos escuros/navy).
   */
  variant?: "color" | "white";
  /** Classes de tamanho — usar altura fixa (ex.: "h-9"); a largura ajusta-se sozinha. */
  className?: string;
}

/**
 * Logótipo "Melvi Condomínio".
 *
 * Sempre dimensionado por ALTURA (`h-*`) + `w-auto` + `object-contain`, para
 * nunca distorcer. As imagens estão recortadas no rácio natural (~2,5:1).
 */
export function BrandLogo({ variant = "color", className }: BrandLogoProps) {
  return (
    <img
      src={variant === "white" ? whiteLogo : colorLogo}
      alt="Melvi Condomínio"
      className={cn("h-9 w-auto object-contain select-none", className)}
      draggable={false}
    />
  );
}
