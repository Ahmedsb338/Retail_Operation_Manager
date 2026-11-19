CREATE OR REPLACE FUNCTION "public"."prevent_audit_log_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % operations are prohibited', TG_OP;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "trg_audit_log_no_update_delete"
BEFORE UPDATE OR DELETE ON "public"."audit_log"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_audit_log_mutation"();
--> statement-breakpoint
CREATE TRIGGER "trg_audit_log_no_truncate"
BEFORE TRUNCATE ON "public"."audit_log"
FOR EACH STATEMENT
EXECUTE FUNCTION "public"."prevent_audit_log_mutation"();