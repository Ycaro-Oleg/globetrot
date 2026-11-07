-- The audit log is append-only: nothing may rewrite or erase history, not even by mistake in application code.
-- (Superusers can still disable triggers; this guards the application's own connection.)
CREATE FUNCTION audit_event_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is append-only' USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_event_no_update_delete
BEFORE UPDATE OR DELETE ON "audit_event"
FOR EACH ROW EXECUTE FUNCTION audit_event_append_only();
--> statement-breakpoint
CREATE TRIGGER audit_event_no_truncate
BEFORE TRUNCATE ON "audit_event"
FOR EACH STATEMENT EXECUTE FUNCTION audit_event_append_only();
