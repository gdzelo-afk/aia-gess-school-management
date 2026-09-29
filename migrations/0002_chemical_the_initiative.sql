CREATE TABLE "school_calendar_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"grade_from" integer DEFAULT 1 NOT NULL,
	"grade_to" integer DEFAULT 12 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "calendar_interval" CHECK ("school_calendar_event"."ends_on">"school_calendar_event"."starts_on"),
	CONSTRAINT "calendar_kind" CHECK ("school_calendar_event"."kind" in ('holiday','vacation','milestone')),
	CONSTRAINT "calendar_grades" CHECK ("school_calendar_event"."grade_from" between 1 and 12 and "school_calendar_event"."grade_to" between "school_calendar_event"."grade_from" and 12)
);
--> statement-breakpoint
CREATE TABLE "course_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	CONSTRAINT "membership_interval" CHECK ("course_membership"."ends_on">"course_membership"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "course_offering" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"elective" boolean DEFAULT false NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "offering_interval" CHECK ("course_offering"."ends_on">"course_offering"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "onboarding_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"digest" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_token_digest_unique" UNIQUE("digest"),
	CONSTRAINT "onboarding_purpose" CHECK ("onboarding_token"."purpose" in ('invite','recovery'))
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "subject_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "academic_year" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "academic_year" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "class_section" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "teaching_assignment" ADD COLUMN "offering_id" uuid;--> statement-breakpoint
ALTER TABLE "teaching_assignment" ADD COLUMN "kind" text DEFAULT 'homeroom' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "school_calendar_event" ADD CONSTRAINT "school_calendar_event_year_id_academic_year_id_fk" FOREIGN KEY ("year_id") REFERENCES "public"."academic_year"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_membership" ADD CONSTRAINT "course_membership_offering_id_course_offering_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."course_offering"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_membership" ADD CONSTRAINT "course_membership_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offering" ADD CONSTRAINT "course_offering_section_id_class_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."class_section"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offering" ADD CONSTRAINT "course_offering_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_token" ADD CONSTRAINT "onboarding_token_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_year_date" ON "school_calendar_event" USING btree ("year_id","starts_on");--> statement-breakpoint
CREATE INDEX "membership_scope" ON "course_membership" USING btree ("offering_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offering_section_subject" ON "course_offering" USING btree ("section_id","subject_id");--> statement-breakpoint
CREATE INDEX "onboarding_user" ON "onboarding_token" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "teaching_assignment" ADD CONSTRAINT "teaching_assignment_offering_id_course_offering_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."course_offering"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_current_year" ON "academic_year" USING btree ("status") WHERE "academic_year"."status" = 'active';--> statement-breakpoint
ALTER TABLE "academic_year" ADD CONSTRAINT "year_status" CHECK ("academic_year"."status" in ('draft','active','archived'));