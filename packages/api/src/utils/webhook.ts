import crypto from "crypto";
import { env } from "next-runtime-env";
import { z } from "zod";

import type { dbClient } from "@kan/db/client";
import type { WebhookEvent } from "@kan/db/schema";
import * as webhookRepo from "@kan/db/repository/webhook.repo";
import { createLogger } from "@kan/logger";

const log = createLogger("webhook");

export type WebhookEventType = WebhookEvent;

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  // Human-readable summary. Slack-compatible incoming webhooks (Slack,
  // Mattermost, Rocket.Chat) post it as the message; other consumers can
  // ignore it.
  text: string;
  // Slack-style coloured attachment: the card title as a link and its board
  // and list in the footer (same layout as the daily due-date digest).
  attachments?: SlackAttachment[];
  data: {
    card: {
      id: string;
      publicId: string;
      title: string;
      description?: string | null;
      dueDate?: string | null; // ISO string after JSON serialization
      listId: string;
      boardId: string;
    };
    board?: {
      id: string;
      name: string;
    };
    list?: {
      id: string;
      name: string;
    };
    user?: {
      id: string;
      name: string | null;
    };
    changes?: Record<string, { from: unknown; to: unknown }>;
  };
}

export interface SlackAttachment {
  color: string;
  fallback: string;
  title: string;
  title_link?: string;
  footer: string;
}

function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Zod schema for webhook URLs with SSRF mitigation.
 * Requires HTTPS and blocks private/internal IP ranges, localhost,
 * and cloud metadata endpoints.
 */
export const webhookUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine(
    (url) => {
      try {
        return new URL(url).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Only HTTPS URLs are allowed" },
  )
  .refine(
    (url) => {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        return !(
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "::1" ||
          hostname === "0.0.0.0"
        );
      } catch {
        return false;
      }
    },
    { message: "Localhost URLs are not allowed" },
  )
  .refine(
    (url) => {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        return !(
          hostname === "169.254.169.254" ||
          hostname === "metadata.google.internal"
        );
      } catch {
        return false;
      }
    },
    { message: "Cloud metadata endpoints are not allowed" },
  )
  .refine(
    (url) => {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        const ipv4Match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname);
        if (ipv4Match) {
          const [, a, b] = ipv4Match.map(Number);
          if (
            a === 10 ||
            (a === 172 && b! >= 16 && b! <= 31) ||
            (a === 192 && b === 168)
          ) {
            return false;
          }
        }
        return true;
      } catch {
        return false;
      }
    },
    { message: "Private IP addresses are not allowed" },
  );

/**
 * Send a webhook payload to a specific URL.
 *
 * SSRF note: URL validation (HTTPS-only, no private IPs, no cloud metadata)
 * is enforced both here at delivery time and at webhook creation via
 * webhookUrlSchema. This function is only reachable by workspace admins.
 */
export async function sendWebhookToUrl(
  url: string,
  secret: string | undefined,
  payload: WebhookPayload,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const result = webhookUrlSchema.safeParse(url);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message };
  }

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": payload.event,
    "X-Webhook-Timestamp": payload.timestamp,
  };

  if (secret) {
    headers["X-Webhook-Signature"] = generateSignature(body, secret);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        error: `${response.status} ${response.statusText}`,
      };
    }

    return { success: true, statusCode: response.status };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Request timed out" };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send webhook to all active webhooks for a workspace that are subscribed to the event.
 * Wrapped in try/catch so callers using fire-and-forget don't risk unhandled rejections.
 */
export async function sendWebhooksForWorkspace(
  db: dbClient,
  workspaceId: number,
  payload: WebhookPayload,
): Promise<void> {
  try {
    // Get active webhooks for this workspace and filter by event client-side
    const allWebhooks = await webhookRepo.getActiveByWorkspaceId(
      db,
      workspaceId,
    );
    const webhooksForEvent = allWebhooks.filter((w) =>
      w.events.includes(payload.event),
    );

    // Send to all subscribed webhooks in parallel (fire and forget)
    const promises = webhooksForEvent.map((webhook) =>
      sendWebhookToUrl(webhook.url, webhook.secret ?? undefined, payload).then(
        (result) => {
          if (!result.success) {
            log.error(
              {
                url: webhook.url,
                event: payload.event,
                error: result.error,
                statusCode: result.statusCode,
              },
              "Webhook delivery failed",
            );
          } else {
            log.info(
              {
                url: webhook.url,
                event: payload.event,
                statusCode: result.statusCode,
              },
              "Webhook delivered",
            );
          }
        },
      ),
    );

    // Wait for all to complete but don't block on failures
    await Promise.allSettled(promises);
  } catch (error) {
    log.error(
      { err: error, workspaceId },
      "Failed to send webhooks for workspace",
    );
  }
}

const CHANGE_LABELS: Record<string, string> = {
  title: "título",
  description: "descrição",
  dueDate: "data de vencimento",
  listId: "coluna",
};

// Slack mrkdwn needs &, < and > escaped in user text.
export const escapeSlack = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const buildCardLink = (publicId: string, title: string) => {
  const baseUrl = env("NEXT_PUBLIC_BASE_URL") ?? "";
  return baseUrl
    ? `<${baseUrl}/cards/${publicId}|${escapeSlack(title)}>`
    : `*${escapeSlack(title)}*`;
};

// Side-bar colour per event in Slack.
const EVENT_COLOURS: Record<string, string> = {
  "card.created": "#1D4ED8",
  "card.moved": "#6D28D9",
  "card.deleted": "#4B5563",
  "card.assigned": "#0F766E",
  "card.mentioned": "#B45309",
};
const DEFAULT_COLOUR = "#4B5563";

/**
 * Coloured attachment for a card: linked title, then `[BOARD] list` and any
 * extra details in the small footer. Deleted cards get no link.
 */
export function buildCardAttachment(
  event: WebhookEventType,
  card: { publicId: string; title: string },
  context: { boardName?: string; listName?: string; fromListName?: string },
  extra: string[] = [],
): SlackAttachment {
  const baseUrl = env("NEXT_PUBLIC_BASE_URL") ?? "";
  const list =
    context.fromListName && context.fromListName !== context.listName
      ? `${context.fromListName} → ${context.listName ?? ""}`
      : context.listName;
  const place = [
    context.boardName && `[${context.boardName.toUpperCase()}]`,
    list,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    color: EVENT_COLOURS[event] ?? DEFAULT_COLOUR,
    fallback: card.title,
    title: card.title,
    ...(baseUrl && event !== "card.deleted"
      ? { title_link: `${baseUrl}/cards/${card.publicId}` }
      : {}),
    footer: [place, ...extra].filter(Boolean).join(" · "),
  };
}

/** Headline shown above the card attachment. */
export function buildWebhookText(
  event: WebhookEventType,
  context: { user?: { name: string | null } },
): string {
  const who = escapeSlack(context.user?.name ?? "Alguém");
  switch (event) {
    case "card.created":
      return `🆕 *Card criado* por ${who}`;
    case "card.moved":
      return `➡️ *Card movido* por ${who}`;
    case "card.deleted":
      return `🗑️ *Card excluído* por ${who}`;
    default:
      return `✏️ *Card atualizado* por ${who}`;
  }
}

const changedFields = (changes?: Record<string, unknown>) =>
  Object.keys(changes ?? {})
    .filter((key) => key !== "listId")
    .map((key) => CHANGE_LABELS[key] ?? key)
    .join(", ");

export function createCardWebhookPayload(
  event: WebhookEventType,
  card: {
    id: string;
    publicId: string;
    title: string;
    description?: string | null;
    dueDate?: Date | null;
    listId: string;
  },
  context: {
    boardId: string;
    boardName?: string;
    listName?: string;
    fromListName?: string;
    user?: {
      id: string;
      name: string | null;
    };
    changes?: Record<string, { from: unknown; to: unknown }>;
  },
): WebhookPayload {
  const fields =
    event === "card.updated" ? changedFields(context.changes) : "";
  return {
    event,
    timestamp: new Date().toISOString(),
    text: buildWebhookText(event, context),
    attachments: [
      buildCardAttachment(event, card, context, fields ? [fields] : []),
    ],
    data: {
      card: {
        id: card.id,
        publicId: card.publicId,
        title: card.title,
        description: card.description,
        dueDate: card.dueDate?.toISOString() ?? null,
        listId: card.listId,
        boardId: context.boardId,
      },
      board: context.boardName
        ? { id: context.boardId, name: context.boardName }
        : undefined,
      list: context.listName
        ? { id: card.listId, name: context.listName }
        : undefined,
      user: context.user,
      changes: context.changes,
    },
  };
}
