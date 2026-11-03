-- Run in the Thrift Barn project's Supabase SQL Editor BEFORE the migration.
-- A single read-only SELECT returns schema_review. No customer records are read,
-- no application functions are executed, and no database objects are changed.
WITH app_tables AS (
  SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('orders', 'products', 'profiles')
    AND c.relkind IN ('r', 'p')
), inspected_functions AS (
  SELECT p.oid, p.proname, p.prosecdef,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS result_type,
    p.proconfig AS settings
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND p.proname IN ('finalize_order', 'decrement_product_quantity', 'is_admin',
      'finalize_stripe_checkout_v1', 'claim_stripe_order_effects_v1', 'apply_square_inventory_count_v1')
)
SELECT jsonb_pretty(jsonb_build_object(
  'postgres_version', current_setting('server_version'),
  'tables', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'name', relname, 'rls_enabled', relrowsecurity, 'rls_forced', relforcerowsecurity
  ) ORDER BY relname) FROM app_tables), '[]'::jsonb),
  'columns', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'table', t.relname, 'column', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
    'required', a.attnotnull, 'default', pg_get_expr(d.adbin, d.adrelid)
  ) ORDER BY t.relname, a.attnum)
    FROM app_tables t JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum), '[]'::jsonb),
  'constraints', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'table', t.relname, 'name', c.conname, 'definition', pg_get_constraintdef(c.oid, true)
  ) ORDER BY t.relname, c.conname)
    FROM app_tables t JOIN pg_constraint c ON c.conrelid = t.oid), '[]'::jsonb),
  'triggers', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'table', t.relname, 'name', g.tgname, 'enabled', g.tgenabled,
    'definition', pg_get_triggerdef(g.oid, true),
    'function', g.tgfoid::regprocedure::text
  ) ORDER BY t.relname, g.tgname)
    FROM app_tables t JOIN pg_trigger g ON g.tgrelid = t.oid WHERE NOT g.tgisinternal), '[]'::jsonb),
  'policies', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'table', tablename, 'name', policyname, 'roles', roles, 'command', cmd,
    'using', qual, 'check', with_check
  ) ORDER BY tablename, policyname)
    FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('orders', 'products', 'profiles')), '[]'::jsonb),
  'functions', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'name', f.proname, 'arguments', f.arguments, 'result', f.result_type,
    'security_definer', f.prosecdef, 'settings', f.settings,
    'execute_roles', (SELECT jsonb_object_agg(r.rolname, has_function_privilege(r.oid, f.oid, 'EXECUTE'))
      FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated', 'service_role'))
  ) ORDER BY f.proname, f.arguments) FROM inspected_functions f), '[]'::jsonb),
  'admin_flag_update_privileges', coalesce((SELECT jsonb_object_agg(
    r.rolname, has_column_privilege(r.oid, t.oid, a.attnum, 'UPDATE')
  ) FROM app_tables t JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = 'is_admin' AND NOT a.attisdropped
    CROSS JOIN pg_roles r WHERE t.relname = 'profiles' AND r.rolname IN ('anon', 'authenticated', 'service_role')), '{}'::jsonb),
  'existing_effects_table', to_regclass('public.stripe_order_effects')::text
)) AS schema_review;
