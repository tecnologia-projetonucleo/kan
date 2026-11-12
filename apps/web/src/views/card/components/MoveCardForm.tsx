import { t } from "@lingui/core/macro";
import { useEffect, useMemo, useState } from "react";
import { HiXMark } from "react-icons/hi2";

import Button from "~/components/Button";
import { commentTextToHtml } from "~/components/MoveCommentDialog";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";
import {
  getDueDateRequiredListIds,
  isCommentRequiredError,
  isDueDateRequiredError,
  listRequiresComment,
} from "~/views/board/utils/listStatus";

interface MoveCardFormProps {
  cardPublicId: string;
  currentBoardPublicId: string;
  workspacePublicId: string;
  hasDueDate: boolean;
}

const SELECT_CLASS =
  "block w-full rounded-md border-0 bg-white/5 py-1.5 text-sm text-neutral-900 shadow-sm ring-1 ring-inset ring-light-600 focus:ring-2 focus:ring-inset focus:ring-light-700 dark:bg-dark-300 dark:text-dark-1000 dark:ring-dark-700";

/** Moves a card to a list on another board of the same workspace. */
export function MoveCardForm({
  cardPublicId,
  currentBoardPublicId,
  workspacePublicId,
  hasDueDate,
}: MoveCardFormProps) {
  const { closeModal } = useModal();
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const { data: boards, isLoading } = api.board.all.useQuery(
    { workspacePublicId, type: "regular" },
    { enabled: !!workspacePublicId },
  );

  const targets = useMemo(
    () =>
      (boards ?? [])
        .filter((board) => board.publicId !== currentBoardPublicId)
        .map((board) => ({
          ...board,
          lists: [...board.lists].sort((a, b) => a.index - b.index),
        })),
    [boards, currentBoardPublicId],
  );

  const [boardPublicId, setBoardPublicId] = useState("");
  const [listPublicId, setListPublicId] = useState("");
  const [comment, setComment] = useState("");

  const selectedBoard = targets.find(
    (board) => board.publicId === boardPublicId,
  );

  // Default to the first board, then to its first list.
  useEffect(() => {
    if (!boardPublicId && targets[0]) setBoardPublicId(targets[0].publicId);
  }, [targets, boardPublicId]);
  useEffect(() => {
    setListPublicId(selectedBoard?.lists[0]?.publicId ?? "");
  }, [selectedBoard]);

  const selectedListName =
    selectedBoard?.lists.find((list) => list.publicId === listPublicId)?.name ??
    "";
  const needsComment =
    !!selectedListName && listRequiresComment(selectedListName);

  const needsDueDate =
    !!selectedBoard &&
    !hasDueDate &&
    getDueDateRequiredListIds(selectedBoard.lists).has(listPublicId);

  const moveCard = api.card.update.useMutation({
    onSuccess: async () => {
      await invalidateCard(utils, cardPublicId);
      await utils.board.byId.invalidate();
      closeModal();
      showPopup({
        header: t`Card moved`,
        message: t`The card is now on ${selectedBoard?.name ?? ""}.`,
        icon: "success",
      });
    },
    onError: (error) => {
      showPopup({
        header: t`Unable to move card`,
        message: isCommentRequiredError(error)
          ? t`Moving a card to this list needs a comment.`
          : isDueDateRequiredError(error)
            ? t`Set a due date before moving the card to In Progress or any list after it.`
            : t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
  });

  return (
    <div className="p-5">
      <div className="flex w-full items-center justify-between pb-4">
        <h2 className="text-sm font-bold text-neutral-900 dark:text-dark-1000">
          {t`Move to another board`}
        </h2>
        <button
          type="button"
          aria-label={t`Close`}
          className="rounded p-1 hover:bg-light-200 focus:outline-none dark:hover:bg-dark-300"
          onClick={() => closeModal()}
        >
          <HiXMark size={18} className="text-light-900 dark:text-dark-900" />
        </button>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-md bg-light-200 dark:bg-dark-200" />
      ) : targets.length === 0 ? (
        <p className="text-sm text-light-900 dark:text-dark-900">
          {t`There is no other board in this workspace.`}
        </p>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-light-800 dark:text-dark-800">
              {t`Board`}
            </span>
            <select
              className={SELECT_CLASS}
              value={boardPublicId}
              onChange={(e) => setBoardPublicId(e.target.value)}
            >
              {targets.map((board) => (
                <option key={board.publicId} value={board.publicId}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-light-800 dark:text-dark-800">
              {t`List`}
            </span>
            <select
              className={SELECT_CLASS}
              value={listPublicId}
              onChange={(e) => setListPublicId(e.target.value)}
              disabled={!selectedBoard?.lists.length}
            >
              {selectedBoard?.lists.map((list) => (
                <option key={list.publicId} value={list.publicId}>
                  {list.name}
                </option>
              ))}
            </select>
            {selectedBoard && selectedBoard.lists.length === 0 && (
              <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                {t`This board has no lists yet.`}
              </span>
            )}
          </label>

          {needsComment && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-light-800 dark:text-dark-800">
                {t`Comment`}
                <span className="text-red-500" aria-hidden="true">
                  {" "}
                  *
                </span>
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={t`Why is the card going to ${selectedListName}?`}
                className="block w-full resize-y rounded-md border-0 bg-white/5 px-3 py-2 text-sm text-neutral-900 shadow-sm ring-1 ring-inset ring-light-600 focus:ring-2 focus:ring-inset focus:ring-light-700 dark:text-dark-1000 dark:ring-dark-700"
              />
            </label>
          )}

          {needsDueDate && (
            <p className="rounded-md border border-dashed border-amber-500/60 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/50 dark:text-amber-300">
              {t`This list requires a due date. Set one on the card first, or pick an earlier list.`}
            </p>
          )}

          <p className="text-xs text-light-800 dark:text-dark-800">
            {t`Labels from this board are removed, and responsible people without access to the new board are unassigned.`}
          </p>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => closeModal()}>
          {t`Cancel`}
        </Button>
        <Button
          onClick={() =>
            moveCard.mutate({
              cardPublicId,
              listPublicId,
              index: 0,
              ...(needsComment && { comment: commentTextToHtml(comment) }),
            })
          }
          disabled={
            !listPublicId ||
            needsDueDate ||
            (needsComment && !comment.trim()) ||
            moveCard.isPending
          }
          isLoading={moveCard.isPending}
        >
          {t`Move card`}
        </Button>
      </div>
    </div>
  );
}
