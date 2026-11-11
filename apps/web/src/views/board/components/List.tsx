import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { t } from "@lingui/core/macro";
import { useForm } from "react-hook-form";
import {
  HiChevronDoubleLeft,
  HiChevronDoubleRight,
  HiEllipsisHorizontal,
  HiOutlineAdjustmentsHorizontal,
  HiOutlinePlusSmall,
  HiOutlineSquaresPlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import { authClient } from "@kan/auth/client";

import type { ListDragData } from "../dnd/types";
import type { ListTone } from "../utils/listStatus";
import Dropdown from "~/components/Dropdown";
import { Tooltip } from "~/components/Tooltip";
import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";
import { api } from "~/utils/api";
import { isPlaceholderPublicId } from "~/utils/helpers";
import {
  getListTone,
  TONE_TINT,
  useListPreferences,
} from "../utils/listStatus";

// Kept in a .tsx file: Tailwind only scans .tsx sources for class names.
const TONE_DOT_CLASS: Record<ListTone, string> = {
  backlog: "bg-neutral-400",
  prioritized: "bg-violet-500",
  progress: "bg-blue-500",
  blocked: "bg-red-500",
  done: "bg-green-500",
  cancelled: "bg-neutral-600",
  default: "bg-neutral-400",
};

interface ListProps {
  children: ReactNode;
  list: List;
  cardCount: number;
  setSelectedPublicListId: (publicListId: PublicListId) => void;
}

interface List {
  publicId: string;
  name: string;
  createdBy?: string | null;
}

interface FormValues {
  listPublicId: string;
  name: string;
}

type PublicListId = string;

export default function List({
  children,
  list,
  cardCount,
  setSelectedPublicListId,
}: ListProps) {
  const tone = getListTone(list.name);
  const { preferences, update: updatePreferences } = useListPreferences(
    list.publicId,
  );
  const wipLimit = preferences.wipLimit;
  const isOverWip = wipLimit != null && cardCount > wipLimit;

  const handleSetWipLimit = () => {
    const answer = window.prompt(
      t`Maximum number of cards in this list (leave empty to remove the limit)`,
      wipLimit != null ? String(wipLimit) : "",
    );
    if (answer === null) return;
    const parsed = Number.parseInt(answer, 10);
    updatePreferences({
      wipLimit: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
    });
  };
  const { openModal } = useModal();
  const { canCreateCard, canEditList, canDeleteList } = usePermissions();
  const { data: session } = authClient.useSession();
  const isCreator = list.createdBy && session?.user.id === list.createdBy;
  const isOptimistic = isPlaceholderPublicId(list.publicId);
  const canEdit = canEditList || isCreator;
  const canDrag = !isOptimistic && (canEditList || isCreator);

  const openNewCardForm = (publicListId: PublicListId) => {
    if (!canCreateCard || isOptimistic) return;
    openModal("NEW_CARD");
    setSelectedPublicListId(publicListId);
  };

  const updateList = api.list.update.useMutation();

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      listPublicId: list.publicId,
      name: list.name,
    },
    values: {
      listPublicId: list.publicId,
      name: list.name,
    },
  });

  const onSubmit = (values: FormValues) => {
    if (!canEdit || isOptimistic) return;
    updateList.mutate({
      listPublicId: values.listPublicId,
      name: values.name,
    });
  };

  const handleOpenDeleteListConfirmation = () => {
    setSelectedPublicListId(list.publicId);
    openModal("DELETE_LIST");
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: list.publicId,
    data: { type: "LIST" } satisfies ListDragData,
    disabled: { draggable: !canDrag, droppable: false },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundImage: TONE_TINT[tone],
  };

  const countBadge = (
    <Tooltip
      content={
        wipLimit != null
          ? isOverWip
            ? t`Over the WIP limit of ${wipLimit}`
            : t`WIP limit: ${wipLimit}`
          : undefined
      }
    >
      <span
        aria-label={t`${cardCount} cards`}
        className={twMerge(
          "shrink-0 rounded-full px-1.5 text-xs tabular-nums text-light-800 dark:text-dark-800",
          isOverWip &&
            "bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-400",
        )}
      >
        {wipLimit != null ? `${cardCount}/${wipLimit}` : cardCount}
      </span>
    </Tooltip>
  );

  const baseClassName = twMerge(
    "dark-text-dark-1000 mr-5 h-fit snap-start rounded-md border border-light-400 bg-light-300 py-2 text-neutral-900 dark:border-[#26262b] dark:bg-[#18181b] md:snap-align-none",
    tone === "blocked" && "border-red-300/60 dark:border-red-500/25",
    isOverWip && "border-amber-500/70 dark:border-amber-500/60",
    canDrag ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "",
  );

  if (preferences.collapsed) {
    return (
      <div
        data-board-draggable
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={twMerge(
          baseClassName,
          "flex w-11 shrink-0 flex-col items-center gap-3 px-1",
        )}
      >
        <button
          type="button"
          onClick={() => updatePreferences({ collapsed: false })}
          aria-label={t`Expand list`}
          className="rounded-md p-1 text-dark-900 hover:bg-light-400 dark:hover:bg-dark-200"
        >
          <HiChevronDoubleRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className={`h-2 w-2 rounded-full ${TONE_DOT_CLASS[tone]}`} />
        {countBadge}
        <span className="whitespace-nowrap text-sm font-medium [writing-mode:vertical-rl]">
          {list.name}
        </span>
      </div>
    );
  }

  return (
    <div
      data-board-draggable
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={twMerge(
        baseClassName,
        "min-w-[280px] max-w-[360px] flex-[1_1_280px] pl-2 pr-1",
      )}
    >
      <div className="mb-2 flex justify-between">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full min-w-0 items-center gap-2 pl-3 pt-1 focus-visible:outline-none"
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT_CLASS[tone]}`}
          />
          <input
            id="name"
            type="text"
            aria-label={t`List name`}
            {...register("name")}
            onBlur={handleSubmit(onSubmit)}
            readOnly={!canEdit || isOptimistic}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-neutral-900 focus:ring-0 focus-visible:outline-none dark:text-dark-1000"
          />
          {countBadge}
        </form>
        <div className="flex items-center">
          <Tooltip
            content={!canCreateCard ? t`You don't have permission` : undefined}
          >
            <button
              className="mx-1 inline-flex h-fit items-center rounded-md p-1 px-1 text-sm font-semibold text-dark-50 hover:bg-light-400 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-dark-200"
              onClick={() => openNewCardForm(list.publicId)}
              disabled={!canCreateCard || isOptimistic}
              aria-label={t`Add card`}
            >
              <HiOutlinePlusSmall
                className="h-5 w-5 text-dark-900"
                aria-hidden="true"
              />
            </button>
          </Tooltip>
          {(() => {
            const dropdownItems = [
              ...(canCreateCard && !isOptimistic
                ? [
                    {
                      label: t`Add a card`,
                      action: () => openNewCardForm(list.publicId),
                      icon: (
                        <HiOutlineSquaresPlus className="h-[18px] w-[18px] text-dark-900" />
                      ),
                    },
                  ]
                : []),
              // Preferences are keyed by publicId, so an optimistic list
              // (placeholder id) gets no menu until the server confirms it.
              ...(!isOptimistic
                ? [
                    {
                      label: t`Collapse list`,
                      action: () => updatePreferences({ collapsed: true }),
                      icon: (
                        <HiChevronDoubleLeft className="h-[18px] w-[18px] text-dark-900" />
                      ),
                    },
                    {
                      label:
                        wipLimit != null
                          ? t`Change WIP limit (${wipLimit})`
                          : t`Set WIP limit`,
                      action: handleSetWipLimit,
                      icon: (
                        <HiOutlineAdjustmentsHorizontal className="h-[18px] w-[18px] text-dark-900" />
                      ),
                    },
                  ]
                : []),
              ...(!isOptimistic && (canDeleteList || isCreator)
                ? [
                    {
                      label: t`Delete list`,
                      action: handleOpenDeleteListConfirmation,
                      icon: (
                        <HiOutlineTrash className="h-[18px] w-[18px] text-dark-900" />
                      ),
                    },
                  ]
                : []),
            ];

            if (dropdownItems.length === 0) {
              return null;
            }

            return (
              <div className="relative mr-1 inline-block">
                <Dropdown items={dropdownItems} ariaLabel={t`List options`}>
                  <HiEllipsisHorizontal className="h-5 w-5 text-dark-900" />
                </Dropdown>
              </div>
            );
          })()}
        </div>
      </div>
      {children}
    </div>
  );
}
