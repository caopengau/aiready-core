#!/bin/bash
# scripts/build.sh
# Safely handles pnpm's --silent flag for turbo

TASK=$1
shift # remove task from arguments

# pnpm often appends --silent to the end of the command
# but turbo does not support it. We filter it out.
ARGS=()
SILENT=0

for arg in "$@"; do
  if [ "$arg" = "--silent" ]; then
    SILENT=1
  else
    ARGS+=("$arg")
  fi
done

# If pnpm's silent mode is on via loglevel, also be silent
if [ "$npm_config_loglevel" = "silent" ]; then
  SILENT=1
fi

if [ "$SILENT" = "1" ]; then
  # Use turbo-compatible silence
  turbo run "$TASK" "${ARGS[@]}" --filter=!@aiready/serverlessclaw --output-logs=errors-only
else
  turbo run "$TASK" "${ARGS[@]}" --filter=!@aiready/serverlessclaw
fi
