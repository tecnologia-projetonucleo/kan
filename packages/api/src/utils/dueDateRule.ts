import { TRPCError } from "@trpc/server";

// Lists have no status field, so the "in progress" list is found by name, the
// same way the board colours its columns (apps/web listStatus.ts).
const PROGRESS_PATTERN = /andamento|progress|doing|fazendo|desenvolv/;

const normalize = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * A due date is required from the "in progress" list onwards: that list and
 * every list to its right. Boards without such a list never require it.
 */
export function listRequiresDueDate(
  lists: { id: number; name: string; index: number }[],
  listId: number,
): boolean {
  const ordered = [...lists].sort((a, b) => a.index - b.index);
  const progressAt = ordered.findIndex((list) =>
    PROGRESS_PATTERN.test(normalize(list.name)),
  );
  if (progressAt < 0) return false;
  const position = ordered.findIndex((list) => list.id === listId);
  return position >= progressAt;
}

export const dueDateRequiredError = () =>
  new TRPCError({
    code: "BAD_REQUEST",
    message:
      "DUE_DATE_REQUIRED: a due date is required for cards in the in-progress list and the lists after it",
  });
