import { t } from "@lingui/core/macro";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";

import type { CardArea } from "~/components/CardArea";
import { AreaDot, CARD_AREAS, getArea } from "~/components/CardArea";
import CheckboxDropdown from "~/components/CheckboxDropdown";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

interface AreaSelectorProps {
  cardPublicId: string;
  area: CardArea | null | undefined;
  isLoading?: boolean;
  disabled?: boolean;
}

export function AreaSelector({
  cardPublicId,
  area,
  isLoading = false,
  disabled = false,
}: AreaSelectorProps) {
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const updateArea = api.card.update.useMutation({
    onMutate: async (update) => {
      await utils.card.byId.cancel();
      const previousCard = utils.card.byId.getData({ cardPublicId });
      utils.card.byId.setData({ cardPublicId }, (oldCard) =>
        oldCard && update.area ? { ...oldCard, area: update.area } : oldCard,
      );
      return { previousCard };
    },
    onError: (_error, _update, context) => {
      utils.card.byId.setData({ cardPublicId }, context?.previousCard);
      showPopup({
        header: t`Unable to update area`,
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

  const selected = getArea(area);

  return (
    <CheckboxDropdown
      items={CARD_AREAS.map((option) => ({
        key: option.key,
        value: option.name,
        selected: option.key === area,
        leftIcon: <AreaDot colour={option.colour} />,
      }))}
      handleSelect={(_, item) => {
        if (item.key !== area)
          updateArea.mutate({ cardPublicId, area: item.key as CardArea });
      }}
      disabled={disabled}
      asChild
      ariaLabel={t`Responsible area`}
    >
      <div
        className={`flex h-full w-full items-center gap-1.5 rounded-[5px] border-[1px] py-1 pl-2 text-left text-xs ${
          selected
            ? "border-light-50 text-neutral-900 dark:border-dark-50 dark:text-dark-1000"
            : "border-dashed border-amber-500/60 text-amber-700 dark:border-amber-400/50 dark:text-amber-300"
        } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-light-300 hover:bg-light-200 dark:hover:border-dark-200 dark:hover:bg-dark-100"}`}
      >
        {selected ? (
          <>
            <AreaDot colour={selected.colour} />
            {selected.name}
          </>
        ) : (
          <>
            <HiOutlineExclamationTriangle
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />
            {t`Choose the area (required)`}
          </>
        )}
      </div>
    </CheckboxDropdown>
  );
}
