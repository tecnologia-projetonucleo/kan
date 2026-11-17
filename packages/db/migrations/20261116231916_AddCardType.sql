CREATE TYPE "public"."card_type" AS ENUM('bug', 'improvement');--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "type" "card_type";