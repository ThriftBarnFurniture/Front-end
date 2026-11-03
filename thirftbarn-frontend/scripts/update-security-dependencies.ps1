# Run from a terminal with npm registry access. No commit or deployment occurs.
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  & npm.cmd install next@16.4.4 eslint-config-next@16.4.4 nodemailer@10.3.1
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
  # Apply remaining fixes allowed by existing semver ranges. Never use --force.
  # Report moderate development-tool advisories, while blocking high/critical
  # issues here and blocking every production advisory in the final audit.
  & npm.cmd audit fix --audit-level=high
  if ($LASTEXITCODE -ne 0) { throw 'High/critical dependency advisories remain, or the audit failed. Run npm audit to review; do not use --force.' }
  & npm.cmd run lint
  if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'Regression tests failed.' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
  & npm.cmd audit --omit=dev
  if ($LASTEXITCODE -ne 0) { throw 'Production dependency advisories remain.' }
} finally {
  Pop-Location
}
