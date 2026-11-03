-- Run this WHOLE file in the intended project's Supabase SQL Editor as postgres.
-- Repeatable permission repair for the schema_review supplied on 2026-11-03.
-- No customer rows, current admin flags, RLS policies or function bodies change.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Table grants override column restrictions, so remove both kinds of grants.
REVOKE INSERT, UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, full_name, phone, address, is_admin),
       UPDATE (id, full_name, phone, address, is_admin)
  ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT INSERT (id, full_name, phone, address), UPDATE (full_name, phone, address)
  ON TABLE public.profiles TO authenticated;
-- Preserve trusted server/profile provisioning even if its former grants were
-- inherited from PUBLIC. Existing customer SELECT/ownership policies remain.
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO service_role;

-- These legacy RPCs are not called by the website's customer/admin UI.
-- Keep server access and leave the is_admin functions used by RLS untouched.
DO $repair$
DECLARE signature text; target regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.decrement_product_quantity(uuid,integer)',
    'public.finalize_order(uuid,text,text,integer,text,text)'
  ] LOOP
    target := to_regprocedure(signature);
    IF target IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', target);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', target);
    END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'INSERT')
     OR has_column_privilege('anon', 'public.profiles', 'is_admin', 'UPDATE')
     OR has_column_privilege('anon', 'public.profiles', 'is_admin', 'INSERT') THEN
    RAISE EXCEPTION 'Admin flag is still writable through an inherited grant; repair rolled back.';
  END IF;
END
$repair$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Expected: both false for anon/authenticated; both true for service_role.
-- The final three booleans must be true. Reads metadata only, no customer rows.
SELECT jsonb_build_object(
  'admin_flag_permissions', (
    SELECT jsonb_object_agg(role_name, jsonb_build_object(
      'insert', has_column_privilege(role_name, 'public.profiles', 'is_admin', 'INSERT'),
      'update', has_column_privilege(role_name, 'public.profiles', 'is_admin', 'UPDATE')
    )) FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
  ),
  'profile_editing_allowed', has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
    AND has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE')
    AND has_column_privilege('authenticated', 'public.profiles', 'address', 'UPDATE'),
  'profile_creation_allowed', has_column_privilege('authenticated', 'public.profiles', 'id', 'INSERT')
    AND has_column_privilege('authenticated', 'public.profiles', 'full_name', 'INSERT'),
  'profile_reads_preserved', has_table_privilege('authenticated', 'public.profiles', 'SELECT')
) AS security_fix;
