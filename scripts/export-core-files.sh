#!/usr/bin/env bash
set -euo pipefail

OUT_PATH="${1:-core-project-files.tar.gz}"

# Export only core project files, preserving folder structure.
tar \
  --exclude='dist' \
  --exclude='images' \
  --exclude='node_modules' \
  -czf "$OUT_PATH" \
  src \
  supabase \
  package.json \
  tsconfig.json \
  vite.config.*

# Print compact manifest for easy import/inspection.
tar -tzf "$OUT_PATH"
