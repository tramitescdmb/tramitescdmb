#!/bin/bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# npm install corre "postinstall" (prisma generate), que solo lee el schema
# y no necesita una base de datos real.
npm install
