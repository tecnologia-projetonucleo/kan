import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as boardMemberRepo from "@kan/db/repository/boardMember.repo";
import * as reportRepo from "@kan/db/repository/report.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";

import type { ReportCardInput } from "../utils/reportMetrics";
import { cardAreaSchema } from "../schemas/priority";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { assertPermission, isWorkspaceAdmin } from "../utils/permissions";
import { computeReport, getReportTone } from "../utils/reportMetrics";

type Area = z.infer<typeof cardAreaSchema>;

export const reportRouter = createTRPCRouter({
  workspace: protectedProcedure
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        boardPublicId: z.string().min(12).optional(),
        area: z.union([cardAreaSchema, z.literal("none")]).optional(),
        days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );

      if (!workspace || workspace.deletedAt)
        throw new TRPCError({
          message: `Workspace with public ID ${input.workspacePublicId} not found`,
          code: "NOT_FOUND",
        });

      await assertPermission(ctx.db, userId, workspace.id, "board:view");

      // Same board scope as the boards page: admins see every board, other
      // members only the boards they belong to.
      const isAdmin = await isWorkspaceAdmin(ctx.db, userId, workspace.id);
      const memberBoardIds = isAdmin
        ? undefined
        : await boardMemberRepo.getMemberBoardIds(ctx.db, {
            workspaceId: workspace.id,
            userId,
          });

      const boards = await reportRepo.getReportBoards(ctx.db, {
        workspaceId: workspace.id,
        boardIds: memberBoardIds,
      });

      const selectedBoards = input.boardPublicId
        ? boards.filter((board) => board.publicId === input.boardPublicId)
        : boards;

      if (input.boardPublicId && selectedBoards.length === 0)
        throw new TRPCError({
          message: `Board with public ID ${input.boardPublicId} not found`,
          code: "NOT_FOUND",
        });

      const data = await reportRepo.getReportCards(ctx.db, {
        boardIds: selectedBoards.map((board) => board.id),
        area: input.area === "none" ? null : input.area,
      });

      const boardNames = new Map(boards.map((b) => [b.id, b.name]));

      const owners = new Map<number, string[]>();
      for (const member of data.members) {
        const list = owners.get(member.cardId) ?? [];
        const name = member.name?.trim();
        list.push(name && name.length > 0 ? name : member.email);
        owners.set(member.cardId, list);
      }

      // listEnteredAt is the last list move, as on the board
      // (board.repo getCardBoardMeta); progress entries feed the cycle time.
      const lastMove = new Map<number, Date>();
      const progressEntries = new Map<number, Date[]>();
      for (const move of data.moves) {
        const previous = lastMove.get(move.cardId);
        if (!previous || move.at > previous) lastMove.set(move.cardId, move.at);
        if (move.toListName && getReportTone(move.toListName) === "progress") {
          const entries = progressEntries.get(move.cardId) ?? [];
          entries.push(move.at);
          progressEntries.set(move.cardId, entries);
        }
      }

      const cards: ReportCardInput<Area>[] = data.cards.map((card) => ({
        publicId: card.publicId,
        title: card.title,
        cardNumber: card.cardNumber,
        createdAt: card.createdAt,
        dueDate: card.dueDate,
        priority: card.priority,
        area: card.area,
        type: card.type,
        listName: card.listName,
        boardName: boardNames.get(card.boardId) ?? "",
        listEnteredAt: lastMove.get(card.id) ?? card.createdAt,
        progressEntries: progressEntries.get(card.id) ?? [],
        owners: owners.get(card.id) ?? [],
      }));

      const now = new Date();

      return {
        workspace: { publicId: workspace.publicId, name: workspace.name },
        boards: boards.map((board) => ({
          publicId: board.publicId,
          name: board.name,
        })),
        days: input.days,
        generatedAt: now,
        ...computeReport(cards, { now, days: input.days }),
      };
    }),
});
