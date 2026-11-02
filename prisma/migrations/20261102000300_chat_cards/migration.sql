-- UI cards (slot picker, visit pass, contact form) shown with an assistant message, so a reload restores them.
ALTER TABLE "ChatMessage" ADD COLUMN "cards" JSONB;
