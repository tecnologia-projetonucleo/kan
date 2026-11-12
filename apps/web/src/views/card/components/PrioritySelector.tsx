import { t } from "@lingui/core/macro";

import type { CardPriority } from "~/components/CardPriority";
import { PriorityPicker } from "~/components/CardPriority";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

interface PrioritySelectorProps {
  cardPublicId: string;
  priority: CardPriority | undefined;
  isLoading?: boolean;
  disabled?: boolean;
}

export function PrioritySelector({
  cardPublicId,
  priority,
  isLoading = false,
  disabled = false,
}: PrioritySelectorProps) {
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const updatePriority = api.card.update.useMutation({
    onMutate: async (update) => {
      await utils.card.byId.cancel();
      const previousCard = utils.card.byId.getData({ cardPublicId });
      utils.card.byId.setData({ cardPublicId }, (oldCard) =>
        oldCard && update.priority
          ? { ...oldCard, priority: update.priority }
          : oldCard,
      );
      return { previousCard };
    },
    onError: (_error, _update, context) => {
      utils.card.byId.setData({ cardPublicId }, context?.previousCard);
      showPopup({
        header: t`Unable to update priority`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
      await utils.board.byId.invalidate();
    },
  });

  if (isLoading || !priority) {
    return (
      <div className="my-1 h-7 w-[200px] animate-pulse rounded-md bg-light-200 dark:bg-dark-200" />
    );
  }

  return (
    <PriorityPicker
      className="my-1"
      value={priority}
      disabled={disabled}
      onChange={(next) =>
        updatePriority.mutate({ cardPublicId, priority: next })
      }
    />
  );
}
