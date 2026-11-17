import { randomBytes } from "node:crypto";

import type { dbClient } from "@kan/db/client";
import { verification } from "@kan/db/schema";

/**
 * Creates a password reset token in the format better-auth reads in its
 * POST /reset-password endpoint (identifier "reset-password:<token>", value
 * the user id). Used by workspace admins to hand a reset link to a member
 * when no email server is configured.
 */
export const createPasswordResetToken = async (
  db: dbClient,
  args: { userId: string; expiresAt: Date },
) => {
  const token = randomBytes(24).toString("base64url");
  const now = new Date();

  await db.insert(verification).values({
    identifier: `reset-password:${token}`,
    value: args.userId,
    expiresAt: args.expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  return token;
};
