import { beforeEach, describe, expect, it } from "vitest";

import * as boardRepo from "@kan/db/repository/board.repo";
import * as boardMemberRepo from "@kan/db/repository/boardMember.repo";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as schema from "@kan/db/schema";

import type { TestDbClient } from "./test-db";
import { assertBoardAccess } from "../src/utils/permissions";
import { createTestDb, seedTestData } from "./test-db";

describe("board access permission helpers", () => {
  let db: TestDbClient;
  let adminUser: { id: string; name: string | null };
  let workspace: { id: number; publicId: string };

  beforeEach(async () => {
    db = await createTestDb();
    const seeded = await seedTestData(db);
    adminUser = seeded.user;
    workspace = seeded.workspace;
  });

  const addWorkspaceMember = async (
    role: "admin" | "member" | "guest",
    publicId: string,
  ) => {
    const [user] = await db
      .insert(schema.users)
      .values({
        id: crypto.randomUUID(),
        name: `User ${publicId}`,
        email: `${publicId}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await db.insert(schema.workspaceMembers).values({
      publicId,
      email: user!.email,
      workspaceId: workspace.id,
      userId: user!.id,
      createdBy: adminUser.id,
      role,
      status: "active",
      createdAt: new Date(),
    });

    return user!;
  };

  it("lets any workspace member reach a template board", async () => {
    const member = await addWorkspaceMember("member", "wm1template1");

    const template = await boardRepo.create(db, {
      name: "Shared Template",
      createdBy: adminUser.id,
      workspaceId: workspace.id,
      slug: "shared-template",
      type: "template",
    });

    await expect(
      assertBoardAccess(db, member.id, {
        id: template!.id,
        workspaceId: workspace.id,
        type: "template",
      }),
    ).resolves.toBeUndefined();
  });

  it("adds workspace members to boards created after they joined", async () => {
    const member = await addWorkspaceMember("member", "wm1autoadd01");

    const board = await boardRepo.create(db, {
      name: "Auto Board",
      createdBy: adminUser.id,
      workspaceId: workspace.id,
      slug: "auto-board",
    });

    await expect(
      assertBoardAccess(db, member.id, {
        id: board!.id,
        workspaceId: workspace.id,
        type: "regular",
      }),
    ).resolves.toBeUndefined();
  });

  it("blocks assertBoardAccess for a public board a member was removed from", async () => {
    const member = await addWorkspaceMember("member", "wm1public001");

    const board = await boardRepo.create(db, {
      name: "Public Board",
      createdBy: adminUser.id,
      workspaceId: workspace.id,
      slug: "public-board",
    });
    await boardRepo.update(db, {
      name: undefined,
      slug: undefined,
      boardPublicId: board!.publicId,
      visibility: "public",
    });
    await boardMemberRepo.remove(db, {
      boardId: board!.id,
      workspaceMemberId: (await db.query.workspaceMembers.findFirst({
        where: (wm, { eq }) => eq(wm.publicId, "wm1public001"),
      }))!.id,
    });

    await expect(
      assertBoardAccess(db, member.id, {
        id: board!.id,
        workspaceId: workspace.id,
        type: "regular",
      }),
    ).rejects.toThrow();
  });

  it("excludes boards a member was removed from, public ones included", async () => {
    const member = await addWorkspaceMember("member", "wm1listpub01");

    const publicBoard = await boardRepo.create(db, {
      name: "Public Listed Board",
      createdBy: adminUser.id,
      workspaceId: workspace.id,
      slug: "public-listed-board",
    });
    await boardRepo.update(db, {
      name: undefined,
      slug: undefined,
      boardPublicId: publicBoard!.publicId,
      visibility: "public",
    });
    const privateBoard = await boardRepo.create(db, {
      name: "Private Unlisted Board",
      createdBy: adminUser.id,
      workspaceId: workspace.id,
      slug: "private-unlisted-board",
    });
    const listedMemberId = (await db.query.workspaceMembers.findFirst({
      where: (wm, { eq }) => eq(wm.publicId, "wm1listpub01"),
    }))!.id;
    for (const removedFrom of [publicBoard!, privateBoard!])
      await boardMemberRepo.remove(db, {
        boardId: removedFrom.id,
        workspaceMemberId: listedMemberId,
      });

    const visible = await boardRepo.getAllByWorkspaceId(
      db,
      workspace.id,
      member.id,
      {
        isWorkspaceAdmin: false,
      },
    );

    expect(visible.map((b) => b.name)).toEqual([]);
  });

  it("promotes another board member to admin when the sole admin leaves the workspace", async () => {
    const soleAdmin = await addWorkspaceMember("member", "wm1soleadmn1");
    const otherMember = await addWorkspaceMember("member", "wm1othermem1");

    const board = await boardRepo.create(db, {
      name: "Handoff Board",
      createdBy: adminUser.id,
      workspaceId: workspace.id,
      slug: "handoff-board",
    });

    const soleAdminRow = await db.query.workspaceMembers.findFirst({
      where: (wm, { eq }) => eq(wm.publicId, "wm1soleadmn1"),
    });
    const otherMemberRow = await db.query.workspaceMembers.findFirst({
      where: (wm, { eq }) => eq(wm.publicId, "wm1othermem1"),
    });

    // Add soleAdmin as a board admin and otherMember as a board member,
    // then demote the creator, leaving soleAdmin as the board's only admin.
    const creatorMembership = await boardMemberRepo.getMembership(db, {
      boardId: board!.id,
      userId: adminUser.id,
    });
    await boardMemberRepo.updateRole(db, {
      boardId: board!.id,
      workspaceMemberId: soleAdminRow!.id,
      role: "admin",
    });
    await boardMemberRepo.updateRole(db, {
      boardId: board!.id,
      workspaceMemberId: creatorMembership!.workspaceMemberId,
      role: "member",
    });

    expect(await boardMemberRepo.countAdmins(db, board!.id)).toBe(1);

    // Simulate the workspace member leaving entirely.
    await memberRepo.softDelete(db, {
      memberId: soleAdminRow!.id,
      deletedAt: new Date(),
      deletedBy: adminUser.id,
    });

    const remainingAdminCount = await boardMemberRepo.countAdmins(
      db,
      board!.id,
    );
    expect(remainingAdminCount).toBe(1);

    // The promotion picks the longest-standing remaining board member - here
    // that's the board's creator (added automatically on creation), not the
    // member added afterwards.
    const creatorNewMembership = await boardMemberRepo.getMembership(db, {
      boardId: board!.id,
      userId: adminUser.id,
    });
    expect(creatorNewMembership?.role).toBe("admin");

    const otherMemberMembership = await boardMemberRepo.getMembership(db, {
      boardId: board!.id,
      userId: otherMember.id,
    });
    expect(otherMemberMembership?.role).toBe("member");
  });
});
