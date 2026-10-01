CREATE TABLE "attendance_explanation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"reason" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"reviewer_id" text,
	"decision" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "attendance_explanation_interval" CHECK ("attendance_explanation"."ends_on">"attendance_explanation"."starts_on"),
	CONSTRAINT "attendance_explanation_state" CHECK ("attendance_explanation"."state" in ('pending','approved','denied'))
);
--> statement-breakpoint
CREATE TABLE "attendance_receipt" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_record" (
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" text NOT NULL,
	"arrival" text,
	"departure" text,
	"time_source" text NOT NULL,
	CONSTRAINT "attendance_record_session_id_student_id_pk" PRIMARY KEY("session_id","student_id"),
	CONSTRAINT "attendance_status" CHECK ("attendance_record"."status" in ('present','absent','late','authorized')),
	CONSTRAINT "attendance_arrival" CHECK (("attendance_record"."status"='late')=("attendance_record"."arrival" is not null)),
	CONSTRAINT "attendance_departure" CHECK ("attendance_record"."departure" is null or "attendance_record"."status" in ('present','late')),
	CONSTRAINT "attendance_times" CHECK (("attendance_record"."arrival" is null or "attendance_record"."arrival" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') and ("attendance_record"."departure" is null or "attendance_record"."departure" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')),
	CONSTRAINT "attendance_time_source" CHECK ("attendance_record"."time_source" in ('reported','estimated'))
);
--> statement-breakpoint
CREATE TABLE "attendance_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"occurrence_id" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"reason" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"reviewer_id" text,
	"decision" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "attendance_request_state" CHECK ("attendance_request"."state" in ('pending','approved','denied'))
);
--> statement-breakpoint
CREATE TABLE "attendance_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" text NOT NULL,
	"version_id" uuid NOT NULL,
	"school_date" date NOT NULL,
	"teacher_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"submitted_by" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"overdue" boolean NOT NULL,
	CONSTRAINT "attendance_session_occurrence_id_unique" UNIQUE("occurrence_id"),
	CONSTRAINT "attendance_revision" CHECK ("attendance_session"."revision">0)
);
--> statement-breakpoint
ALTER TABLE "attendance_explanation" ADD CONSTRAINT "attendance_explanation_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_explanation" ADD CONSTRAINT "attendance_explanation_guardian_id_person_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_explanation" ADD CONSTRAINT "attendance_explanation_reviewer_id_app_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_receipt" ADD CONSTRAINT "attendance_receipt_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_session_id_attendance_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_request" ADD CONSTRAINT "attendance_request_teacher_id_person_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_request" ADD CONSTRAINT "attendance_request_reviewer_id_app_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_revision" ADD CONSTRAINT "attendance_revision_session_id_attendance_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_revision" ADD CONSTRAINT "attendance_revision_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_version_id_timetable_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."timetable_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_teacher_id_person_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_submitted_by_app_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_explanation_student_date" ON "attendance_explanation" USING btree ("student_id","starts_on");--> statement-breakpoint
CREATE INDEX "attendance_explanation_queue" ON "attendance_explanation" USING btree ("state");--> statement-breakpoint
CREATE INDEX "attendance_student_status" ON "attendance_record" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "attendance_request_queue" ON "attendance_request" USING btree ("teacher_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_session_revision" ON "attendance_revision" USING btree ("session_id","revision");--> statement-breakpoint
CREATE INDEX "attendance_date_teacher" ON "attendance_session" USING btree ("school_date","teacher_id");--> statement-breakpoint
CREATE FUNCTION protect_attendance_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Attendance history and receipts are append only'; END; $$;
--> statement-breakpoint
CREATE TRIGGER attendance_revision_immutable BEFORE UPDATE OR DELETE ON attendance_revision FOR EACH ROW EXECUTE FUNCTION protect_attendance_history();
--> statement-breakpoint
CREATE TRIGGER attendance_receipt_immutable BEFORE UPDATE OR DELETE ON attendance_receipt FOR EACH ROW EXECUTE FUNCTION protect_attendance_history();
--> statement-breakpoint
CREATE FUNCTION protect_attendance_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.state<>'pending' THEN RAISE EXCEPTION 'Attendance decisions are immutable'; END IF;
 IF (to_jsonb(NEW)-'state'-'revision'-'reviewer_id'-'decision'-'decided_at') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'revision'-'reviewer_id'-'decision'-'decided_at') THEN RAISE EXCEPTION 'Attendance request content is immutable'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER attendance_explanation_decision BEFORE UPDATE OR DELETE ON attendance_explanation FOR EACH ROW EXECUTE FUNCTION protect_attendance_decision();
--> statement-breakpoint
CREATE TRIGGER attendance_request_decision BEFORE UPDATE OR DELETE ON attendance_request FOR EACH ROW EXECUTE FUNCTION protect_attendance_decision();
