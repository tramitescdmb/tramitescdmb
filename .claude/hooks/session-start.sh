#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# npm ci respeta package-lock.json (npm install podía modificarlo). postinstall genera el cliente de Prisma.
npm ci --no-audit --no-fund

# Las pruebas importan src/lib/db.ts, que exige una DATABASE_URL con forma válida (no se conecta).
# Es la misma que usa el CI (.github/workflows). Solo si la sesión no trae otra.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export DATABASE_URL="postgresql://ci:ci@localhost:5432/ci"' >> "$CLAUDE_ENV_FILE"
fi
