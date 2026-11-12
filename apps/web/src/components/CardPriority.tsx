import { t } from "@lingui/core/macro";
import { HiChevronDoubleUp, HiChevronDown, HiMinus } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

export type CardPriority = "high" | "normal" | "low";

export const CARD_PRIORITIES: CardPriority[] = ["high", "normal", "low"];

export const priorityLabel = (priority: CardPriority) => {
  switch (priority) {
    case "high":
      return t`High`;
    case "low":
      return t`Low`;
    default:
      return t`Normal`;
  }
};

// Class names live in this .tsx file so Tailwind picks them up.
const PRIORITY_STYLE: Record<CardPriority, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-700 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-300",
  normal:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-300",
  low: "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
};

const PRIORITY_ICON: Record<CardPriority, typeof HiMinus> = {
  high: HiChevronDoubleUp,
  normal: HiMinus,
  low: HiChevronDown,
};

export function PriorityIcon({
  priority,
  className,
}: {
  priority: CardPriority;
  className?: string;
}) {
  const Icon = PRIORITY_ICON[priority];
  return <Icon className={twMerge("h-3 w-3", className)} aria-hidden="true" />;
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: CardPriority;
  className?: string;
}) {
  const label = priorityLabel(priority);
  return (
    <span
      title={t`Priority: ${label}`}
      className={twMerge(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-medium leading-4",
        PRIORITY_STYLE[priority],
        className,
      )}
    >
      <PriorityIcon priority={priority} />
      {label}
    </span>
  );
}

/** Segmented control: one of the three priorities is always selected. */
export function PriorityPicker({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: CardPriority;
  onChange: (priority: CardPriority) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t`Priority`}
      className={twMerge(
        "inline-flex rounded-md border border-light-300 p-0.5 dark:border-dark-300",
        className,
      )}
    >
      {CARD_PRIORITIES.map((priority) => {
        const selected = priority === value;
        return (
          <button
            key={priority}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => !selected && onChange(priority)}
            className={twMerge(
              "flex items-center gap-1 rounded border border-transparent px-2 py-1 text-xs font-medium text-light-800 transition-colors hover:bg-light-200 disabled:cursor-not-allowed disabled:opacity-60 dark:text-dark-800 dark:hover:bg-dark-200",
              selected && PRIORITY_STYLE[priority],
              selected && "hover:bg-transparent dark:hover:bg-transparent",
            )}
          >
            <PriorityIcon priority={priority} />
            {priorityLabel(priority)}
          </button>
        );
      })}
    </div>
  );
}
