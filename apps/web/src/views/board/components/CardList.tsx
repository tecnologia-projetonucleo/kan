import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { t } from "@lingui/core/macro";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ListBodyDragData } from "../dnd/types";
import type { BoardCard } from "../types";
import type { ListTone } from "../utils/listStatus";
import { isPlaceholderPublicId } from "~/utils/helpers";
import { getListBodyId } from "../dnd/ids";
import SortableCard from "./SortableCard";

const DONE_PAGE_SIZE = 5;

interface CardListProps {
  listPublicId: string;
  listTone: ListTone;
  requireAssignee?: boolean;
  requireDueDate?: boolean;
  cards: BoardCard[];
  cardPrefix: string;
  canEditCard: boolean;
  freezeHeight: boolean;
  getCardHref: (cardPublicId: string) => string;
  onContextMenu: (event: React.MouseEvent, cardPublicId: string) => void;
}

export default function CardList({
  listPublicId,
  listTone,
  requireAssignee,
  requireDueDate,
  cards,
  cardPrefix,
  canEditCard,
  freezeHeight,
  getCardHref,
  onContextMenu,
}: CardListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [minHeightPx, setMinHeightPx] = useState(0);

  useLayoutEffect(() => {
    if (freezeHeight) {
      const measured = containerRef.current?.getBoundingClientRect().height;
      if (measured != null) {
        setMinHeightPx(Math.round(measured));
      }
    } else if (containerRef.current && contentRef.current) {
      const maxHeight = parseFloat(
        getComputedStyle(containerRef.current).maxHeight,
      );
      const natural = Math.min(
        contentRef.current.scrollHeight,
        Number.isNaN(maxHeight) ? Infinity : maxHeight,
      );
      setMinHeightPx(Math.round(natural));
    } else {
      setMinHeightPx(0);
    }
  }, [freezeHeight, cards]);

  const { setNodeRef } = useDroppable({
    id: getListBodyId(listPublicId),
    data: { type: "LIST_BODY", listPublicId } satisfies ListBodyDragData,
    disabled: isPlaceholderPublicId(listPublicId),
  });

  // Done lists show the 5 most recent cards (the top of the list), with a
  // button revealing 5 more at a time.
  const isDone = listTone === "done";
  const [shownCount, setShownCount] = useState(DONE_PAGE_SIZE);
  const visibleCards = useMemo(
    () => (isDone ? cards.slice(0, shownCount) : cards),
    [isDone, cards, shownCount],
  );
  const hiddenCount = cards.length - visibleCards.length;

  const cardIds = useMemo(
    () => visibleCards.map((card) => card.publicId),
    [visibleCards],
  );

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        setNodeRef(node);
      }}
      data-list-scroll-id={listPublicId}
      style={{
        minHeight: minHeightPx,
        transition: "min-height 200ms ease-out",
      }}
      onTransitionEnd={(e) => {
        if (e.propertyName === "min-height" && !freezeHeight) {
          setMinHeightPx(0);
        }
      }}
      className="list-scroll z-10 max-h-[calc(100dvh-225px)] min-h-[2rem] overflow-y-auto overflow-x-hidden pb-[calc(0.75rem+env(safe-area-inset-bottom))] pr-1"
    >
      <div ref={contentRef}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {visibleCards.map((card) => (
            <SortableCard
              key={card.publicId}
              card={card}
              listPublicId={listPublicId}
              listTone={listTone}
              requireAssignee={requireAssignee}
              requireDueDate={requireDueDate}
              cardPrefix={cardPrefix}
              cardHref={getCardHref(card.publicId)}
              canEditCard={canEditCard}
              onContextMenu={onContextMenu}
            />
          ))}
        </SortableContext>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShownCount((count) => count + DONE_PAGE_SIZE)}
            className="mt-1 w-full rounded-md border border-dashed border-light-400 py-1.5 text-xs font-medium text-light-900 hover:bg-light-200 dark:border-dark-400 dark:text-dark-900 dark:hover:bg-dark-200"
          >
            {t`Show more (${hiddenCount})`}
          </button>
        )}
      </div>
    </div>
  );
}
