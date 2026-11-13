import { t } from "@lingui/core/macro";
import { twMerge } from "tailwind-merge";

export type CardArea =
  | "produto"
  | "dados"
  | "tecnologia"
  | "risco"
  | "sportbook"
  | "cassino"
  | "atendimento"
  | "criativo"
  | "crm"
  | "afiliado"
  | "financeiro"
  | "marketing"
  | "diretoria";

// Names are team names, not UI copy, so they are not translated.
// Twelve hues spread around the colour wheel so no two areas look alike,
// mid-tone enough to read on light and dark backgrounds.
export const CARD_AREAS: { key: CardArea; name: string; colour: string }[] = [
  { key: "produto", name: "Produto", colour: "#7C3AED" }, // violet
  { key: "dados", name: "Dados", colour: "#2563EB" }, // blue
  { key: "tecnologia", name: "Tecnologia", colour: "#0EA5E9" }, // sky
  { key: "risco", name: "Risco", colour: "#DC2626" }, // red
  { key: "sportbook", name: "Sportbook", colour: "#16A34A" }, // green
  { key: "cassino", name: "Cassino", colour: "#CA8A04" }, // gold
  { key: "atendimento", name: "Atendimento", colour: "#EA580C" }, // orange
  { key: "criativo", name: "Criativo", colour: "#EC4899" }, // pink
  { key: "crm", name: "CRM", colour: "#64748B" }, // slate
  { key: "afiliado", name: "Afiliado", colour: "#C026D3" }, // fuchsia
  { key: "financeiro", name: "Financeiro", colour: "#84CC16" }, // lime
  { key: "marketing", name: "Marketing", colour: "#0D9488" }, // teal
  { key: "diretoria", name: "Diretoria", colour: "#9F1239" }, // wine
];

export const getArea = (key: CardArea | null | undefined) =>
  key ? CARD_AREAS.find((area) => area.key === key) : undefined;

export function AreaDot({
  colour,
  className,
}: {
  colour: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={twMerge("h-2 w-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: colour }}
    />
  );
}

/**
 * Compact owner marker for board cards: a coloured dot and the area name,
 * or a dashed "no area" hint for cards created before the field existed.
 */
export function AreaTag({
  area,
  className,
}: {
  area: CardArea | null | undefined;
  className?: string;
}) {
  const info = getArea(area);

  if (!info) {
    return (
      <span
        title={t`This card has no responsible area yet`}
        className={twMerge(
          "inline-flex min-w-0 items-center rounded-full border border-dashed border-amber-500/60 px-1.5 text-[10px] font-medium leading-4 text-amber-700 dark:border-amber-400/50 dark:text-amber-300",
          className,
        )}
      >
        {t`No area`}
      </span>
    );
  }

  return (
    <span
      title={t`Responsible area: ${info.name}`}
      className={twMerge(
        "inline-flex min-w-0 items-center gap-1 text-[11px] font-medium leading-4 text-light-900 dark:text-dark-900",
        className,
      )}
    >
      <AreaDot colour={info.colour} />
      <span className="truncate">{info.name}</span>
    </span>
  );
}
