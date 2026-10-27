CREATE TABLE "banner_widget" (
	"content" jsonb DEFAULT '{"content":[{"type":"paragraph"}],"type":"doc"}' NOT NULL,
	"type" text DEFAULT 'banner' NOT NULL,
	"variant" text NOT NULL,
	"widget_id" uuid PRIMARY KEY,
	CONSTRAINT "banner_widget_type_chk" CHECK ("type" IN ('banner')),
	CONSTRAINT "banner_widget_variant_chk" CHECK ("variant" IN ('info', 'idea', 'warning', 'success'))
);
--> statement-breakpoint
CREATE TABLE "image_widget" (
	"alt" text DEFAULT '' NOT NULL,
	"storage_key" text,
	"type" text DEFAULT 'image' NOT NULL,
	"widget_id" uuid PRIMARY KEY,
	CONSTRAINT "image_widget_type_chk" CHECK ("type" IN ('image'))
);
--> statement-breakpoint
CREATE TABLE "page" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"created_by_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "text_widget" (
	"content" jsonb DEFAULT '{"content":[{"type":"paragraph"}],"type":"doc"}' NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"widget_id" uuid PRIMARY KEY,
	CONSTRAINT "text_widget_type_chk" CHECK ("type" IN ('text'))
);
--> statement-breakpoint
CREATE TABLE "widget" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"created_by_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"page_id" uuid NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "widget_id_type_key" UNIQUE("id","type"),
	CONSTRAINT "widget_type_chk" CHECK ("type" IN ('text', 'banner', 'image'))
);
--> statement-breakpoint
CREATE TABLE "widget_audit" (
	"action" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_name" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"page_id" uuid NOT NULL,
	"widget_id" uuid NOT NULL,
	CONSTRAINT "widget_audit_action_chk" CHECK ("action" IN ('created', 'deleted', 'restored'))
);
--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "feature_flag" DROP CONSTRAINT "feature_flag_updated_by_user_id_fkey";--> statement-breakpoint
ALTER TABLE "file" DROP CONSTRAINT "file_organization_id_organization_id_fkey";--> statement-breakpoint
ALTER TABLE "file" DROP CONSTRAINT "file_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_inviter_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_organization_id_organization_id_fkey";--> statement-breakpoint
ALTER TABLE "member" DROP CONSTRAINT "member_organization_id_organization_id_fkey";--> statement-breakpoint
ALTER TABLE "member" DROP CONSTRAINT "member_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_user_id_user_id_fkey";--> statement-breakpoint
DROP TABLE "account";--> statement-breakpoint
DROP TABLE "file";--> statement-breakpoint
DROP TABLE "invitation";--> statement-breakpoint
DROP TABLE "member";--> statement-breakpoint
DROP TABLE "organization";--> statement-breakpoint
DROP TABLE "session";--> statement-breakpoint
DROP TABLE "user";--> statement-breakpoint
DROP TABLE "verification";--> statement-breakpoint
ALTER TABLE "feature_flag" DROP COLUMN "updated_by";--> statement-breakpoint
CREATE INDEX "widget_page_id_created_at_idx" ON "widget" ("page_id","created_at") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "widget_audit_page_id_at_idx" ON "widget_audit" ("page_id","at");--> statement-breakpoint
CREATE INDEX "widget_audit_widget_id_idx" ON "widget_audit" ("widget_id");--> statement-breakpoint
ALTER TABLE "banner_widget" ADD CONSTRAINT "banner_widget_widget_id_type_fkey" FOREIGN KEY ("widget_id","type") REFERENCES "widget"("id","type") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "image_widget" ADD CONSTRAINT "image_widget_widget_id_type_fkey" FOREIGN KEY ("widget_id","type") REFERENCES "widget"("id","type") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "text_widget" ADD CONSTRAINT "text_widget_widget_id_type_fkey" FOREIGN KEY ("widget_id","type") REFERENCES "widget"("id","type") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "widget" ADD CONSTRAINT "widget_page_id_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "page"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "widget_audit" ADD CONSTRAINT "widget_audit_widget_id_widget_id_fkey" FOREIGN KEY ("widget_id") REFERENCES "widget"("id") ON DELETE CASCADE;