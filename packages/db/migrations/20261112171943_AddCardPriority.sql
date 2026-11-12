CREATE TYPE "public"."card_priority" AS ENUM('high', 'normal', 'low');--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "priority" "card_priority" DEFAULT 'normal' NOT NULL;