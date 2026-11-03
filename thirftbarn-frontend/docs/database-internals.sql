-- Optional follow-up: run using a PostgreSQL connection with catalog visibility.
-- Read-only transaction; does not execute application functions or alter data.
-- Function bodies and scheduled commands may contain deployment-specific values.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';

-- Tables/views, ownership, and row-level-security flags (including auth.users).
SELECT n.nspname AS schema_name, c.relname, c.relkind,
       pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE (n.nspname = 'public' OR (n.nspname = 'auth' AND c.relname = 'users'))
  AND c.relkind IN ('r', 'p', 'v', 'm')
ORDER BY 1, 2;

-- Actual primary/unique/foreign/check constraints and delete behavior.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       con.conname, con.contype, pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY 1, 2, 3;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public'
ORDER BY tablename, indexname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename, policyname;

-- Both table-level and column-level privileges matter for profiles.is_admin.
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' ORDER BY table_name, grantee, privilege_type;

SELECT table_schema, table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY column_name, grantee, privilege_type;

-- Includes auth user creation triggers; does not invoke them.
SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname,
       t.tgenabled, pg_get_triggerdef(t.oid, true) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND (n.nspname = 'public' OR (n.nspname = 'auth' AND c.relname = 'users'))
ORDER BY 1, 2, 3;

SELECT n.nspname AS schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, p.provolatile, p.proconfig,
       pg_get_userbyid(p.proowner) AS owner, p.proacl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
ORDER BY p.proname, arguments;

SELECT n.nspname AS schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       r.rolname,
       has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY p.proname, arguments, r.rolname;

SELECT extname, extversion FROM pg_extension ORDER BY extname;
SELECT to_regclass('cron.job') AS cron_job_relation;
COMMIT;

-- If cron.job exists and the connection has access, inspect separately:
-- BEGIN READ ONLY;
-- SELECT jobid, schedule, command, database, username, active FROM cron.job ORDER BY jobid;
-- COMMIT;
