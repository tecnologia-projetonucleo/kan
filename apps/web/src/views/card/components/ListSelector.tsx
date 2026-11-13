import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiChevronDown } from "react-icons/hi2";

import type { MoveNeeds } from "~/components/MoveRequirementsDialog";
import CheckboxDropdown from "~/components/CheckboxDropdown";
import MoveRequirementsDialog, {
  hasMoveNeeds,
} from "~/components/MoveRequirementsDialog";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";
import {
  isCommentRequiredError,
  isDueDateRequiredError,
} from "~/views/board/utils/listStatus";

interface ListSelectorProps {
  cardPublicId: string;
  lists: {
    key: string;
    value: string;
    selected: boolean;
  }[];
  isLoading: boolean;
  disabled?: boolean;
  showChevron?: boolean;
  // What the card is missing to enter a list (area, responsible, due date,
  // comment); when anything is, a dialog asks for it before moving.
  getMoveNeeds?: (listPublicId: string, listName: string) => MoveNeeds | null;
  members?: { publicId: string; name: string }[];
}

export default function ListSelector({
  cardPublicId,
  lists,
  isLoading,
  disabled = false,
  showChevron = false,
  getMoveNeeds,
  members = [],
}: ListSelectorProps) {
  const [pending, setPending] = useState<{
    listPublicId: string;
    listName: string;
    needs: MoveNeeds;
  } | null>(null);
  const addCardMember = api.card.addOrRemoveMember.useMutation();
  const utils = api.useUtils();

  const { showPopup } = usePopup();

  const updateCardList = api.card.update.useMutation({
    onMutate: async (newList) => {
      await utils.card.byId.cancel();

      const previousCard = utils.card.byId.getData({ cardPublicId });

      utils.card.byId.setData({ cardPublicId }, (oldCard) => {
        if (!oldCard) return oldCard;

        return {
          ...oldCard,
          list: {
            ...oldCard.list,
            publicId: newList.listPublicId ?? "",
            name: oldCard.list.name ?? "",
            board: oldCard.list.board ?? null,
          },
        };
      });

      return { previousCard };
    },
    onError: (error, _newList, context) => {
      utils.card.byId.setData({ cardPublicId }, context?.previousCard);
      if (isCommentRequiredError(error)) {
        showPopup({
          header: t`Comment required`,
          message: t`Moving a card to this list needs a comment.`,
          icon: "error",
        });
        return;
      }
      if (isDueDateRequiredError(error)) {
        showPopup({
          header: t`Due date required`,
          message: t`Set a due date before moving the card to In Progress or any list after it.`,
          icon: "error",
        });
        return;
      }
      showPopup({
        header: t`Unable to update list`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
      await utils.board.byId.invalidate();
    },
  });

  const selectedList = lists.find((list) => list.selected);

  return (
    <>
      {isLoading ? (
        <div className="flex w-full">
          <div className="h-full w-[150px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
        </div>
      ) : (
        <CheckboxDropdown
          items={lists}
          handleSelect={(_, member) => {
            if (member.key === selectedList?.key) return;
            const needs = getMoveNeeds?.(member.key, member.value);
            if (needs && hasMoveNeeds(needs)) {
              setPending({
                listPublicId: member.key,
                listName: member.value,
                needs,
              });
              return;
            }
            updateCardList.mutate({
              cardPublicId,
              listPublicId: member.key,
              index: 0,
            });
          }}
          disabled={disabled}
          asChild
          ariaLabel={t`Current list`}
        >
          <div
            className={`flex h-full w-full items-center rounded-[5px] border-[1px] border-light-50 py-1 pl-2 text-left text-xs text-neutral-900 dark:border-dark-50 dark:text-dark-1000 ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-light-300 hover:bg-light-200 dark:hover:border-dark-200 dark:hover:bg-dark-100"}`}
          >
            {selectedList?.value}
            {showChevron && (
              <HiChevronDown
                className="ml-1 mr-1.5 h-3.5 w-3.5"
                aria-hidden="true"
              />
            )}
          </div>
        </CheckboxDropdown>
      )}
      {pending && (
        <MoveRequirementsDialog
          listName={pending.listName}
          needs={pending.needs}
          members={members}
          isPending={updateCardList.isPending || addCardMember.isPending}
          onCancel={() => setPending(null)}
          onConfirm={async (fill) => {
            try {
              for (const workspaceMemberPublicId of fill.memberPublicIds ?? [])
                await addCardMember.mutateAsync({
                  cardPublicId,
                  workspaceMemberPublicId,
                });
            } catch {
              showPopup({
                header: t`Unable to update card`,
                message: t`Please try again later, or contact customer support.`,
                icon: "error",
              });
              return;
            }
            updateCardList.mutate(
              {
                cardPublicId,
                listPublicId: pending.listPublicId,
                index: 0,
                ...(fill.area && { area: fill.area }),
                ...(fill.dueDate && { dueDate: fill.dueDate }),
                ...(fill.comment && { comment: fill.comment }),
              },
              { onSettled: () => setPending(null) },
            );
          }}
        />
      )}
    </>
  );
}
