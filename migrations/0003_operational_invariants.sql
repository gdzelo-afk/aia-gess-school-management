-- Administrative mutations serialize at one school-scoped row, including direct interval writes.
CREATE TABLE administration_lock (id integer PRIMARY KEY CHECK (id=1));
--> statement-breakpoint
INSERT INTO administration_lock VALUES (1);
--> statement-breakpoint
CREATE FUNCTION check_school_intervals() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bounds record;
BEGIN
 PERFORM id FROM administration_lock WHERE id=1 FOR UPDATE;
 IF TG_TABLE_NAME='enrollment' THEN
   SELECT y.starts_on,y.ends_on INTO bounds FROM class_section c JOIN academic_year y ON y.id=c.year_id WHERE c.id=NEW.section_id;
   IF NEW.starts_on<bounds.starts_on OR (NEW.ends_on IS NOT NULL AND NEW.ends_on>bounds.ends_on) THEN RAISE EXCEPTION 'enrollment outside year' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM enrollment e WHERE e.student_id=NEW.student_id AND e.id<>NEW.id AND daterange(e.starts_on,e.ends_on,'[)') && daterange(NEW.starts_on,NEW.ends_on,'[)')) THEN RAISE EXCEPTION 'overlapping enrollment' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='guardian_link' THEN
   IF EXISTS(SELECT 1 FROM guardian_link g WHERE g.student_id=NEW.student_id AND g.guardian_person_id=NEW.guardian_person_id AND g.id<>NEW.id AND daterange(g.starts_on,g.ends_on,'[)') && daterange(NEW.starts_on,NEW.ends_on,'[)')) THEN RAISE EXCEPTION 'overlapping guardian relationship' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='semester' THEN
   SELECT starts_on,ends_on INTO bounds FROM academic_year WHERE id=NEW.year_id;
   IF NEW.starts_on<bounds.starts_on OR NEW.ends_on>bounds.ends_on THEN RAISE EXCEPTION 'semester outside year' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM semester t WHERE t.year_id=NEW.year_id AND t.id<>NEW.id AND daterange(t.starts_on,t.ends_on,'[)') && daterange(NEW.starts_on,NEW.ends_on,'[)')) THEN RAISE EXCEPTION 'overlapping semester' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='course_membership' THEN
   SELECT starts_on,ends_on INTO bounds FROM course_offering WHERE id=NEW.offering_id;
   IF NEW.starts_on<bounds.starts_on OR NEW.ends_on>bounds.ends_on THEN RAISE EXCEPTION 'membership outside offering' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM course_membership m WHERE m.student_id=NEW.student_id AND m.offering_id=NEW.offering_id AND m.id<>NEW.id AND daterange(m.starts_on,m.ends_on,'[)') && daterange(NEW.starts_on,NEW.ends_on,'[)')) THEN RAISE EXCEPTION 'overlapping course membership' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER enrollment_effective_guard BEFORE INSERT OR UPDATE ON enrollment FOR EACH ROW EXECUTE FUNCTION check_school_intervals();
--> statement-breakpoint
CREATE TRIGGER guardian_effective_guard BEFORE INSERT OR UPDATE ON guardian_link FOR EACH ROW EXECUTE FUNCTION check_school_intervals();
--> statement-breakpoint
CREATE TRIGGER semester_effective_guard BEFORE INSERT OR UPDATE ON semester FOR EACH ROW EXECUTE FUNCTION check_school_intervals();
--> statement-breakpoint
CREATE TRIGGER membership_effective_guard BEFORE INSERT OR UPDATE ON course_membership FOR EACH ROW EXECUTE FUNCTION check_school_intervals();
