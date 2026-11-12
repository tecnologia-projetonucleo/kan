import Link from "next/link";
import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiChevronDown, HiChevronRight } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import type { BoardList } from "../types";
import type { CardArea } from "~/components/CardArea";
import { AreaDot, CARD_AREAS } from "~/components/CardArea";
import { getListTone } from "../utils/listStatus";
import CardPreview from "./CardPreview";

// Kept in a .tsx file: Tailwind only scans .tsx sources for class names.
const TONE_DOT_CLASS: Record<string, string> = {
  backlog: "bg-neutral-400",
  prioritized: "bg-violet-500",
  progress: "bg-blue-500",
  blocked: "bg-red-500",
  done: "bg-green-500",
  cancelled: "bg-neutral-600",
  default: "bg-neutral-400",
};

const NO_AREA = "__none__";

interface AreaLanesViewProps {
  lists: BoardList[];
  cardPrefix: string;
  isTemplate: boolean;
  dueDateRequiredListIds: Set<string>;
  getCardHref: (cardPublicId: string) => string;
}

/**
 * Board grouped into one horizontal swimlane per responsible area, with the
 * lists as columns. Lanes without cards are hidden; cards without an area go
 * to a last "No area" lane. Read-only layout: cards open on click, and are
 * moved with the swimlanes switched off.
 */
export default function AreaLanesView({
  lists,
  cardPrefix,
  isTemplate,
  dueDateRequiredListIds,
  getCardHref,
}: AreaLanesViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const lanes = [
    ...CARD_AREAS.map((area) => ({
      key: area.key as string,
      name: area.name,
      colour: area.colour as string | null,
    })),
    { key: NO_AREA, name: t`No area`, colour: null },
  ]
    .map((lane) => {
      const cells = lists.map((list) =>
        list.cards.filter((card) =>
          lane.key === NO_AREA
            ? !card.area
            : card.area === (lane.key as CardArea),
        ),
      );
      return {
        ...lane,
        cells,
        total: cells.reduce((sum, cards) => sum + cards.length, 0),
      };
    })
    .filter((lane) => lane.total > 0);

  const toggleLane = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const gridStyle = {
    gridTemplateColumns: `repeat(${lists.length}, minmax(260px, 320px))`,
  };

  return (
    <div className="list-scroll h-full overflow-auto px-[10px] pb-6 md:px-8">
      <div className="w-max min-w-full">
        {/* Column headers stay visible while scrolling down the lanes */}
        <div
          className="sticky top-0 z-10 grid gap-3 bg-light-100 py-2 dark:bg-[#0f0f10]"
          style={gridStyle}
        >
          {lists.map((list) => (
            <div
              key={list.publicId}
              className="flex items-center gap-2 rounded-md border border-light-400 bg-light-300 px-3 py-1.5 text-sm font-medium text-neutral-900 dark:border-[#26262b] dark:bg-[#18181b] dark:text-dark-1000"
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT_CLASS[getListTone(list.name)]}`}
              />
              <span className="truncate">{list.name}</span>
              <span className="ml-auto text-xs tabular-nums text-light-800 dark:text-dark-800">
                {list.cards.length}
              </span>
            </div>
          ))}
        </div>

        {lanes.length === 0 && (
          <p className="py-10 text-center text-sm text-light-800 dark:text-dark-800">
            {t`No cards on this board yet`}
          </p>
        )}

        {lanes.map((lane) => {
          const isCollapsed = collapsed.has(lane.key);
          return (
            <section key={lane.key} className="mt-3">
              <button
                type="button"
                onClick={() => toggleLane(lane.key)}
                aria-expanded={!isCollapsed}
                className="sticky left-0 flex items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold text-light-1000 hover:bg-light-200 dark:text-dark-1000 dark:hover:bg-dark-200"
              >
                {isCollapsed ? (
                  <HiChevronRight className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <HiChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
                {lane.colour ? (
                  <AreaDot colour={lane.colour} className="h-2.5 w-2.5" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full border border-dashed border-amber-500"
                  />
                )}
                {lane.name}
                <span className="text-xs font-normal tabular-nums text-light-800 dark:text-dark-800">
                  {lane.total}
                </span>
              </button>
              {!isCollapsed && (
                <div
                  className={twMerge(
                    "mt-1 grid gap-3 rounded-lg border-l-[3px] py-2 pl-2",
                    !lane.colour && "border-dashed border-amber-500/60",
                  )}
                  style={{
                    ...gridStyle,
                    ...(lane.colour ? { borderLeftColor: lane.colour } : {}),
                  }}
                >
                  {lists.map((list, index) => (
                    <div
                      key={list.publicId}
                      className="flex min-h-[48px] flex-col gap-2 rounded-md bg-light-200/60 p-1.5 dark:bg-[#141416]"
                    >
                      {(lane.cells[index] ?? []).map((card) => (
                        <Link
                          key={card.publicId}
                          href={getCardHref(card.publicId)}
                          className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-700"
                        >
                          <CardPreview
                            card={card}
                            cardPrefix={cardPrefix}
                            listTone={getListTone(list.name)}
                            requireAssignee={!isTemplate}
                            requireDueDate={
                              !isTemplate &&
                              dueDateRequiredListIds.has(list.publicId)
                            }
                          />
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
