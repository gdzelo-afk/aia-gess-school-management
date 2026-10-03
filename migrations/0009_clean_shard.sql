CREATE TABLE "assessment_criteria_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"year_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"text" text NOT NULL,
	"file_id" uuid,
	"actor_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_criteria_revision_positive" CHECK ("assessment_criteria_version"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "assessment_policy_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid NOT NULL,
	"semester_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"policy" jsonb NOT NULL,
	"offering_mode" text NOT NULL,
	"required_summatives" integer,
	"requirement_basis" text NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_policy_revision_positive" CHECK ("assessment_policy_version"."revision">0),
	CONSTRAINT "assessment_policy_mode_valid" CHECK ("assessment_policy_version"."offering_mode" in ('policy_default','formative_only','pass_fail')),
	CONSTRAINT "assessment_requirement_valid" CHECK ("assessment_policy_version"."required_summatives" is null or "assessment_policy_version"."required_summatives" between 0 and 100),
	CONSTRAINT "assessment_requirement_basis" CHECK ("assessment_policy_version"."requirement_basis" in ('configured','demo'))
);
--> statement-breakpoint
CREATE TABLE "gradebook_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year_id" uuid NOT NULL,
	"semester_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"scope" jsonb NOT NULL,
	"offering_ids" uuid[] NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"activity" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"mode" text NOT NULL,
	"criteria_id" uuid,
	"occurrence_id" text,
	"policy" jsonb NOT NULL,
	"roster" jsonb NOT NULL,
	"entries" jsonb NOT NULL,
	"roster_token" text NOT NULL,
	"labels" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gradebook_assessment_status" CHECK ("gradebook_assessment"."status" in ('draft','published','void')),
	CONSTRAINT "gradebook_assessment_category" CHECK ("gradebook_assessment"."category" in ('classwork','homework','summative')),
	CONSTRAINT "gradebook_assessment_mode" CHECK ("gradebook_assessment"."mode" in ('numeric_10','pass_fail','formative_only')),
	CONSTRAINT "gradebook_assessment_revision" CHECK ("gradebook_assessment"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "gradebook_command_receipt" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gradebook_recovery_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text NOT NULL,
	"assessment_revision" integer NOT NULL,
	"original_value" jsonb NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"physical_follow_up" boolean DEFAULT false NOT NULL,
	"extended_until" date,
	"decision" text,
	"decided_by" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "gradebook_recovery_status" CHECK ("gradebook_recovery_request"."status" in ('submitted','follow_up','review','approved','denied','completed','expired')),
	CONSTRAINT "gradebook_recovery_revision" CHECK ("gradebook_recovery_request"."revision">0),
	CONSTRAINT "gradebook_recovery_approval" CHECK ("gradebook_recovery_request"."status"<>'approved' or ("gradebook_recovery_request"."physical_follow_up" and "gradebook_recovery_request"."decided_by" is not null and "gradebook_recovery_request"."decision" is not null))
);
--> statement-breakpoint
CREATE TABLE "gradebook_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"object_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gradebook_revision_kind" CHECK ("gradebook_revision"."kind" in ('assessment','writing','recovery')),
	CONSTRAINT "gradebook_revision_positive" CHECK ("gradebook_revision"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "gradebook_writing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"year_id" uuid NOT NULL,
	"offering_id" uuid,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"body" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gradebook_writing_kind" CHECK ("gradebook_writing"."kind" in ('narrative','guardian_note','homeroom_note')),
	CONSTRAINT "gradebook_writing_status" CHECK ("gradebook_writing"."status" in ('draft','published','void')),
	CONSTRAINT "gradebook_writing_revision" CHECK ("gradebook_writing"."revision">0),
	CONSTRAINT "gradebook_writing_scope" CHECK (("gradebook_writing"."kind"='homeroom_note' and "gradebook_writing"."offering_id" is null) or ("gradebook_writing"."kind"<>'homeroom_note' and "gradebook_writing"."offering_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "assessment_criteria_version" ADD CONSTRAINT "assessment_criteria_version_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_criteria_version" ADD CONSTRAINT "assessment_criteria_version_year_id_academic_year_id_fk" FOREIGN KEY ("year_id") REFERENCES "public"."academic_year"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_criteria_version" ADD CONSTRAINT "assessment_criteria_version_file_id_file_metadata_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file_metadata"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_criteria_version" ADD CONSTRAINT "assessment_criteria_version_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_policy_version" ADD CONSTRAINT "assessment_policy_version_offering_id_course_offering_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."course_offering"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_policy_version" ADD CONSTRAINT "assessment_policy_version_semester_id_semester_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semester"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_policy_version" ADD CONSTRAINT "assessment_policy_version_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_assessment" ADD CONSTRAINT "gradebook_assessment_year_id_academic_year_id_fk" FOREIGN KEY ("year_id") REFERENCES "public"."academic_year"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_assessment" ADD CONSTRAINT "gradebook_assessment_semester_id_semester_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semester"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_assessment" ADD CONSTRAINT "gradebook_assessment_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_assessment" ADD CONSTRAINT "gradebook_assessment_teacher_id_person_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_assessment" ADD CONSTRAINT "gradebook_assessment_criteria_id_assessment_criteria_version_id_fk" FOREIGN KEY ("criteria_id") REFERENCES "public"."assessment_criteria_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_command_receipt" ADD CONSTRAINT "gradebook_command_receipt_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_recovery_request" ADD CONSTRAINT "gradebook_recovery_request_assessment_id_gradebook_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."gradebook_assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_recovery_request" ADD CONSTRAINT "gradebook_recovery_request_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_recovery_request" ADD CONSTRAINT "gradebook_recovery_request_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_recovery_request" ADD CONSTRAINT "gradebook_recovery_request_decided_by_app_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_revision" ADD CONSTRAINT "gradebook_revision_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_writing" ADD CONSTRAINT "gradebook_writing_year_id_academic_year_id_fk" FOREIGN KEY ("year_id") REFERENCES "public"."academic_year"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_writing" ADD CONSTRAINT "gradebook_writing_offering_id_course_offering_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."course_offering"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_writing" ADD CONSTRAINT "gradebook_writing_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_writing" ADD CONSTRAINT "gradebook_writing_teacher_id_person_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_criteria_scope_revision" ON "assessment_criteria_version" USING btree ("subject_id","year_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_policy_scope_revision" ON "assessment_policy_version" USING btree ("offering_id","semester_id","revision");--> statement-breakpoint
CREATE INDEX "gradebook_assessment_lens" ON "gradebook_assessment" USING btree ("year_id","semester_id","subject_id","date");--> statement-breakpoint
CREATE INDEX "gradebook_assessment_teacher" ON "gradebook_assessment" USING btree ("teacher_id","status");--> statement-breakpoint
CREATE INDEX "gradebook_recovery_queue" ON "gradebook_recovery_request" USING btree ("status","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gradebook_recovery_pending" ON "gradebook_recovery_request" USING btree ("assessment_id","student_id") WHERE "gradebook_recovery_request"."status" in ('submitted','follow_up','review','approved');--> statement-breakpoint
CREATE UNIQUE INDEX "gradebook_revision_identity" ON "gradebook_revision" USING btree ("kind","object_id","revision");--> statement-breakpoint
CREATE INDEX "gradebook_writing_student" ON "gradebook_writing" USING btree ("student_id","year_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "gradebook_narrative_scope" ON "gradebook_writing" USING btree ("year_id","offering_id","student_id") WHERE "gradebook_writing"."kind"='narrative' and "gradebook_writing"."status"<>'void';--> statement-breakpoint
CREATE FUNCTION gradebook_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Academic version/history is immutable'; END; $$;
--> statement-breakpoint
CREATE TRIGGER gradebook_policy_history BEFORE UPDATE OR DELETE ON assessment_policy_version FOR EACH ROW EXECUTE FUNCTION gradebook_append_only();
--> statement-breakpoint
CREATE TRIGGER gradebook_criteria_history BEFORE UPDATE OR DELETE ON assessment_criteria_version FOR EACH ROW EXECUTE FUNCTION gradebook_append_only();
--> statement-breakpoint
CREATE TRIGGER gradebook_revision_history BEFORE UPDATE OR DELETE ON gradebook_revision FOR EACH ROW EXECUTE FUNCTION gradebook_append_only();
--> statement-breakpoint
CREATE TRIGGER gradebook_receipt_history BEFORE UPDATE OR DELETE ON gradebook_command_receipt FOR EACH ROW EXECUTE FUNCTION gradebook_append_only();
--> statement-breakpoint
CREATE FUNCTION gradebook_protect_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   IF OLD.status<>'draft' THEN RAISE EXCEPTION 'Published academic records cannot be deleted'; END IF;
   RETURN OLD;
 END IF;
 IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Academic revision must advance exactly once'; END IF;
 IF OLD.status<>'draft' THEN
   IF NEW.status='draft' THEN RAISE EXCEPTION 'Publication cannot return to a private draft'; END IF;
   IF NOT EXISTS (SELECT 1 FROM gradebook_revision WHERE kind=TG_ARGV[0] AND object_id=OLD.id AND revision=NEW.revision AND length(trim(reason))>=5)
   THEN RAISE EXCEPTION 'Published correction requires immutable reason/history'; END IF;
 END IF;
 IF OLD.status='draft' AND NEW.status='published' AND NOT EXISTS
   (SELECT 1 FROM gradebook_revision WHERE kind=TG_ARGV[0] AND object_id=OLD.id AND revision=NEW.revision AND action='publish')
 THEN RAISE EXCEPTION 'Publication requires immutable history'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER gradebook_assessment_publication BEFORE UPDATE OR DELETE ON gradebook_assessment FOR EACH ROW EXECUTE FUNCTION gradebook_protect_publication('assessment');
--> statement-breakpoint
CREATE TRIGGER gradebook_writing_publication BEFORE UPDATE OR DELETE ON gradebook_writing FOR EACH ROW EXECUTE FUNCTION gradebook_protect_publication('writing');
--> statement-breakpoint
CREATE FUNCTION gradebook_valid_entries(value jsonb, mode text, category text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE e jsonb; k text; pupil text; seen text[] := '{}';
BEGIN
 IF jsonb_typeof(value)<>'array' OR jsonb_array_length(value) NOT BETWEEN 1 AND 400 THEN RETURN false; END IF;
 FOR e IN SELECT * FROM jsonb_array_elements(value) LOOP
   pupil:=e->>'studentId'; k:=e->'value'->>'kind';
   IF pupil IS NULL OR pupil!~'^[a-f0-9-]{36}$' OR pupil=ANY(seen) OR k IS NULL THEN RETURN false; END IF;
   seen:=array_append(seen,pupil);
   IF k='numeric' THEN
     IF mode<>'numeric_10' OR jsonb_typeof(e->'value'->'score') IS DISTINCT FROM 'number' OR (e->'value'->>'score')!~'^([1-9]|10)$' THEN RETURN false; END IF;
   ELSIF k='pass_fail' THEN
     IF mode<>'pass_fail' OR jsonb_typeof(e->'value'->'passed') IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
   ELSIF k='formative' THEN
     IF jsonb_typeof(e->'value'->'text') IS DISTINCT FROM 'string' OR length(trim(e->'value'->>'text')) NOT BETWEEN 1 AND 2000 THEN RETURN false; END IF;
   ELSIF k='state' THEN
     IF (e->'value'->>'state') IS NULL OR (e->'value'->>'state') NOT IN ('unassessed','absent','recovery_required','exempt') THEN RETURN false; END IF;
     IF (e->'value'->>'state')='recovery_required' AND category<>'summative' THEN RETURN false; END IF;
   ELSE RETURN false;
   END IF;
 END LOOP;
 RETURN true;
END; $$;
--> statement-breakpoint
ALTER TABLE gradebook_assessment ADD CONSTRAINT gradebook_result_values CHECK (gradebook_valid_entries(entries,mode,category));
--> statement-breakpoint
ALTER TABLE gradebook_assessment ADD CONSTRAINT gradebook_roster_size CHECK (jsonb_typeof(roster)='array' AND jsonb_array_length(roster)=jsonb_array_length(entries));
--> statement-breakpoint
CREATE FUNCTION gradebook_recovery_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Gradebook recovery history cannot be deleted'; END IF;
 IF NEW.assessment_id<>OLD.assessment_id OR NEW.student_id<>OLD.student_id OR NEW.actor_id<>OLD.actor_id OR NEW.reason<>OLD.reason OR NEW.original_value<>OLD.original_value OR NEW.assessment_revision<>OLD.assessment_revision THEN
   RAISE EXCEPTION 'Recovery request meaning is immutable';
 END IF;
 IF NEW.revision<>OLD.revision+1 OR NOT EXISTS(SELECT 1 FROM gradebook_revision r WHERE r.kind='recovery' AND r.object_id=OLD.id AND r.revision=NEW.revision AND length(trim(r.reason))>=5) THEN
   RAISE EXCEPTION 'Recovery decision requires immutable reasoned history';
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER gradebook_recovery_protection BEFORE UPDATE OR DELETE ON gradebook_recovery_request FOR EACH ROW EXECUTE FUNCTION gradebook_recovery_history();
--> statement-breakpoint
CREATE FUNCTION gradebook_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_identity jsonb; new_identity jsonb;
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'draft' THEN RAISE EXCEPTION 'Academic publication requires an explicit draft transition'; END IF;
   RETURN NEW;
 END IF;
 IF OLD.status<>'draft' THEN
   IF TG_TABLE_NAME='gradebook_assessment' THEN
     old_identity:=to_jsonb(OLD)-ARRAY['entries','title','description','activity','status','revision'];
     new_identity:=to_jsonb(NEW)-ARRAY['entries','title','description','activity','status','revision'];
   ELSE
     old_identity:=to_jsonb(OLD)-ARRAY['body','status','revision'];
     new_identity:=to_jsonb(NEW)-ARRAY['body','status','revision'];
   END IF;
   IF old_identity<>new_identity THEN RAISE EXCEPTION 'Published academic identity and snapshots are immutable'; END IF;
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER gradebook_assessment_identity BEFORE INSERT OR UPDATE ON gradebook_assessment FOR EACH ROW EXECUTE FUNCTION gradebook_identity_guard();
--> statement-breakpoint
CREATE TRIGGER gradebook_writing_identity BEFORE INSERT OR UPDATE ON gradebook_writing FOR EACH ROW EXECUTE FUNCTION gradebook_identity_guard();
--> statement-breakpoint
CREATE FUNCTION gradebook_criteria_file_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM assessment_criteria_version c WHERE c.file_id=OLD.id) THEN RAISE EXCEPTION 'Versioned criteria file metadata cannot be replaced or removed'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER gradebook_criteria_file_protection BEFORE UPDATE OR DELETE ON file_metadata FOR EACH ROW EXECUTE FUNCTION gradebook_criteria_file_guard();
--> statement-breakpoint
CREATE FUNCTION gradebook_roster_matches(roster jsonb, entries jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
SELECT jsonb_array_length(roster)=jsonb_array_length(entries)
 AND (SELECT count(DISTINCT r->>'studentId') FROM jsonb_array_elements(roster) r)=jsonb_array_length(roster)
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(entries) e WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(roster) r WHERE r->>'studentId'=e->>'studentId'));
$$;
--> statement-breakpoint
ALTER TABLE gradebook_assessment ADD CONSTRAINT gradebook_roster_membership CHECK (gradebook_roster_matches(roster,entries));
