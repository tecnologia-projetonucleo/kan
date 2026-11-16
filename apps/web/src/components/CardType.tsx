import { t } from "@lingui/core/macro";
import { HiOutlineBugAnt, HiOutlineSparkles } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

export type CardType = "bug" | "improvement";

export const CARD_TYPES: CardType[] = ["bug", "improvement"];

export const typeLabel = (type: CardType) => {
  switch (type) {
    case "bug":
      return t`Bug`;
    default:
      return t`Improvement`;
  }
};

// Class names live in this .tsx file so Tailwind picks them up.
const TYPE_STYLE: Record<CardType, string> = {
  bug: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-300",
  improvement:
    "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:border-teal-400/30 dark:bg-teal-500/15 dark:text-teal-300",
};

const TYPE_ICON_COLOUR: Record<CardType, string> = {
  bug: "text-rose-600 dark:text-rose-300",
  improvement: "text-teal-600 dark:text-teal-300",
};

const TYPE_ICON: Record<CardType, typeof HiOutlineBugAnt> = {
  bug: HiOutlineBugAnt,
  improvement: HiOutlineSparkles,
};

export function TypeIcon({
  type,
  coloured = false,
  className,
}: {
  type: CardType;
  // Use the type's own colour, for places without a tinted background.
  coloured?: boolean;
  className?: string;
}) {
  const Icon = TYPE_ICON[type];
  return (
    <Icon
      className={twMerge(
        "h-3 w-3 shrink-0",
        coloured && TYPE_ICON_COLOUR[type],
        className,
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Compact type marker for board cards, or a dashed "no type" hint for cards
 * created before the field existed.
 */
export function TypeBadge({
  type,
  className,
}: {
  type: CardType | null;
  className?: string;
}) {
  if (!type) {
    return (
      <span
        title={t`This card has no type yet`}
        className={twMerge(
          "inline-flex shrink-0 items-center rounded-full border border-dashed border-light-600 px-1.5 text-[10px] font-medium leading-4 text-light-800 dark:border-dark-600 dark:text-dark-800",
          className,
        )}
      >
        {t`No type`}
      </span>
    );
  }

  const label = typeLabel(type);
  return (
    <span
      title={t`Type: ${label}`}
      className={twMerge(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-medium leading-4",
        TYPE_STYLE[type],
        className,
      )}
    >
      <TypeIcon type={type} />
      {label}
    </span>
  );
}
