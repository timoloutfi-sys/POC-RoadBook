#!/bin/bash
# Prépare une session Claude Code dans le cloud : dépendances installées, tests et lint prêts à lancer.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# Le navigateur des tests au doigt est déjà dans l'environnement cloud (/opt/pw-browsers) : pas de téléchargement.
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm install --no-audit --no-fund
echo 'export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers' >> "$CLAUDE_ENV_FILE"
