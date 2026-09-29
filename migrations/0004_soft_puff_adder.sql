ALTER TYPE "public"."role_key" ADD VALUE 'founders_office' BEFORE 'principal';--> statement-breakpoint
CREATE TABLE "timetable_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"weekdays" jsonb,
	"period_numbers" jsonb NOT NULL,
	"reason" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "availability_interval" CHECK ("timetable_availability"."ends_on">"timetable_availability"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "timetable_exception" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"date" date NOT NULL,
	"target_date" date NOT NULL,
	"change" jsonb NOT NULL,
	"labels" jsonb NOT NULL,
	"reason" text NOT NULL,
	"overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"reason" text NOT NULL,
	"changes" jsonb NOT NULL,
	"absence" jsonb,
	"affected" jsonb NOT NULL,
	"decision" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_state" CHECK ("timetable_request"."state" in ('pending','approved','denied','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "timetable_room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	CONSTRAINT "timetable_room_number_unique" UNIQUE("number"),
	CONSTRAINT "room_number" CHECK ("timetable_room"."number" ~ '^[0-9]{1,6}$')
);
--> statement-breakpoint
CREATE TABLE "timetable_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"document" jsonb NOT NULL,
	"labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" text,
	CONSTRAINT "timetable_interval" CHECK ("timetable_version"."ends_on">"timetable_version"."starts_on"),
	CONSTRAINT "timetable_status" CHECK ("timetable_version"."status" in ('draft','published'))
);
--> statement-breakpoint
ALTER TABLE "timetable_availability" ADD CONSTRAINT "timetable_availability_teacher_id_person_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_exception" ADD CONSTRAINT "timetable_exception_version_id_timetable_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."timetable_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_exception" ADD CONSTRAINT "timetable_exception_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_request" ADD CONSTRAINT "timetable_request_teacher_id_person_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_version" ADD CONSTRAINT "timetable_version_year_id_academic_year_id_fk" FOREIGN KEY ("year_id") REFERENCES "public"."academic_year"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_version" ADD CONSTRAINT "timetable_version_published_by_app_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_teacher_date" ON "timetable_availability" USING btree ("teacher_id","starts_on");--> statement-breakpoint
CREATE INDEX "exception_occurrence" ON "timetable_exception" USING btree ("version_id","date","lesson_id");--> statement-breakpoint
CREATE INDEX "exception_target_date" ON "timetable_exception" USING btree ("target_date");--> statement-breakpoint
CREATE INDEX "request_teacher_state" ON "timetable_request" USING btree ("teacher_id","state");--> statement-breakpoint
CREATE INDEX "timetable_year_date" ON "timetable_version" USING btree ("year_id","starts_on");--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_publication_start" ON "timetable_version" USING btree ("year_id","starts_on") WHERE "timetable_version"."status"='published';