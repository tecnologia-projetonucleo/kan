import type { NextApiRequest, NextApiResponse } from "next";

import { createNextApiContext } from "@kan/api/trpc-context";
import { withApiLogging } from "@kan/api/utils/apiLogging";
import { hasBoardAccess, hasPermission } from "@kan/api/utils/permissions";
import { withRateLimit } from "@kan/api/utils/rateLimit";
import * as cardAttachmentRepo from "@kan/db/repository/cardAttachment.repo";
import { generateAttachmentUrl } from "@kan/shared/utils";

/**
 * Stable address for an image pasted into a card description or comment.
 * Storage URLs are presigned and expire, so the editor stores this path and
 * each view redirects to a fresh signed URL after checking access.
 */
export default withRateLimit(
  { points: 600, duration: 60 },
  withApiLogging(async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { publicId } = req.query;
    if (typeof publicId !== "string" || publicId.length !== 12) {
      return res.status(400).json({ message: "Invalid attachment id" });
    }

    const { user, db } = await createNextApiContext(req);

    const attachment = await cardAttachmentRepo.getByPublicId(db, publicId);
    if (!attachment || attachment.deletedAt) {
      return res.status(404).json({ message: "Not found" });
    }

    const board = attachment.card.list.board;
    // Public boards show their cards on the share link without a login.
    const isPublic = board.visibility === "public";

    if (!isPublic) {
      const allowed =
        !!user &&
        (await hasPermission(db, user.id, board.workspaceId, "card:view")) &&
        (await hasBoardAccess(db, user.id, board));
      if (!allowed) return res.status(404).json({ message: "Not found" });
    }

    const url = await generateAttachmentUrl(attachment.s3Key, 3600);
    if (!url) return res.status(404).json({ message: "Not found" });

    res.setHeader("Cache-Control", "private, max-age=600");
    return res.redirect(302, url);
  }),
);
