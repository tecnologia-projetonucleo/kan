import { t } from "@lingui/core/macro";

import type { CardType } from "~/components/CardType";
import { CARD_TYPES, TypeIcon, typeLabel } from "~/components/CardType";
import CheckboxDropdown from "~/components/CheckboxDropdown";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

interface TypeSelectorProps {
  cardPublicId: string;
  type: CardType | null | undefined;
  isLoading?: boolean;
  disabled?: boolean;
}

export function TypeSelector({
  cardPublicId,
  type,
  isLoading = false,
  disabled = false,
}: TypeSelectorProps) {
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const updateType = api.card.update.useMutation({
    onMutate: async (update) => {
      await utils.card.byId.cancel();
      const previousCard = utils.card.byId.getData({ cardPublicId });
      utils.card.byId.setData({ cardPublicId }, (oldCard) =>
        oldCard && update.type ? { ...oldCard, type: update.type } : oldCard,
      );
      return { previousCard };
    },
    onError: (_error, _update, context) => {
      utils.card.byId.setData({ cardPublicId }, context?.previousCard);
      showPopup({
        header: t`Unable to update type`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
      await utils.board.byId.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex w-full">
        <div className="h-full w-[150px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
      </div>
    );
  }

  return (
    <CheckboxDropdown
      items={CARD_TYPES.map((option) => ({
        key: option,
        value: typeLabel(option),
        selected: option === type,
        leftIcon: <TypeIcon type={option} coloured />,
      }))}
      handleSelect={(_, item) => {
        if (item.key !== type)
          updateType.mutate({ cardPublicId, type: item.key as CardType });
      }}
      disabled={disabled}
      asChild
      ariaLabel={t`Type`}
    >
      <div
        className={`flex h-full w-full items-center gap-1.5 rounded-[5px] border-[1px] py-1 pl-2 text-left text-xs ${
          type
            ? "border-light-50 text-neutral-900 dark:border-dark-50 dark:text-dark-1000"
            : "border-dashed border-light-600 text-light-800 dark:border-dark-600 dark:text-dark-800"
        } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-light-300 hover:bg-light-200 dark:hover:border-dark-200 dark:hover:bg-dark-100"}`}
      >
        {type ? (
          <>
            <TypeIcon type={type} coloured className="h-3.5 w-3.5" />
            {typeLabel(type)}
          </>
        ) : (
          t`Choose the type`
        )}
      </div>
    </CheckboxDropdown>
  );
}
