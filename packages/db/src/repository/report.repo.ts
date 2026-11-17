import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { dbClient } from "@kan/db/client";
import type { CardArea } from "@kan/db/schema";
import {
  boards,
  cardActivities,
  cards,
  cardToWorkspaceMembers,
  lists,
  users,
  workspaceMembers,
} from "@kan/db/schema";

// Active (not archived, not deleted) regular boards of a workspace. When
// `boardIds` is given, only those boards are returned.
export const getReportBoards = (
  db: dbClient,
  args: { workspaceId: number; boardIds?: number[] },
) => {
  if (args.boardIds?.length === 0) return Promise.resolve([]);
  return db
    .select({ id: boards.id, publicId: boards.publicId, name: boards.name })
    .from(boards)
    .where(
      and(
        eq(boards.workspaceId, args.workspaceId),
        isNull(boards.deletedAt),
        eq(boards.type, "regular"),
        eq(boards.isArchived, false),
        args.boardIds ? inArray(boards.id, args.boardIds) : undefined,
      ),
    )
    .orderBy(asc(boards.name));
};

/**
 * Everything the workspace report needs, in three queries scoped by board
 * (not by card id, so large workspaces do not hit the parameter limit):
 * live cards with their list, their assignees and their list moves.
 * `area: null` keeps only cards without an area.
 */
export const getReportCards = async (
  db: dbClient,
  args: { boardIds: number[]; area?: CardArea | null },
) => {
  if (args.boardIds.length === 0) return { cards: [], members: [], moves: [] };

  const cardScope = and(
    inArray(lists.boardId, args.boardIds),
    isNull(lists.deletedAt),
    isNull(cards.deletedAt),
    args.area === undefined
      ? undefined
      : args.area === null
        ? isNull(cards.area)
        : eq(cards.area, args.area),
  );

  const toList = alias(lists, "report_to_list");

  const [cardRows, memberRows, moveRows] = await Promise.all([
    db
      .select({
        id: cards.id,
        publicId: cards.publicId,
        title: cards.title,
        cardNumber: cards.cardNumber,
        createdAt: cards.createdAt,
        dueDate: cards.dueDate,
        priority: cards.priority,
        area: cards.area,
        type: cards.type,
        listName: lists.name,
        boardId: lists.boardId,
      })
      .from(cards)
      .innerJoin(lists, eq(lists.id, cards.listId))
      .where(cardScope),
    db
      .select({
        cardId: cardToWorkspaceMembers.cardId,
        name: users.name,
        email: workspaceMembers.email,
      })
      .from(cardToWorkspaceMembers)
      .innerJoin(cards, eq(cards.id, cardToWorkspaceMembers.cardId))
      .innerJoin(lists, eq(lists.id, cards.listId))
      .innerJoin(
        workspaceMembers,
        eq(workspaceMembers.id, cardToWorkspaceMembers.workspaceMemberId),
      )
      .leftJoin(users, eq(users.id, workspaceMembers.userId))
      .where(and(cardScope, isNull(workspaceMembers.deletedAt))),
    db
      .select({
        cardId: cardActivities.cardId,
        at: cardActivities.createdAt,
        toListName: toList.name,
      })
      .from(cardActivities)
      .innerJoin(cards, eq(cards.id, cardActivities.cardId))
      .innerJoin(lists, eq(lists.id, cards.listId))
      .leftJoin(toList, eq(toList.id, cardActivities.toListId))
      .where(and(cardScope, eq(cardActivities.type, "card.updated.list"))),
  ]);

  return { cards: cardRows, members: memberRows, moves: moveRows };
};
