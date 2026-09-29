CREATE FUNCTION protect_timetable_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME = 'timetable_exception' OR OLD.status = 'published' THEN
  RAISE EXCEPTION 'Published timetable history is immutable';
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER timetable_history BEFORE UPDATE OR DELETE ON timetable_version FOR EACH ROW EXECUTE FUNCTION protect_timetable_history();
--> statement-breakpoint
CREATE FUNCTION protect_timetable_exception() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Timetable exceptions are append only'; END; $$;
--> statement-breakpoint
CREATE TRIGGER timetable_exception_history BEFORE UPDATE OR DELETE ON timetable_exception FOR EACH ROW EXECUTE FUNCTION protect_timetable_exception();
