#!/usr/bin/env bash
#
# Production deploy entrypoint for CloudPanel user sadcpf-nexus.
# Refuses root. Delegates to scripts/deploy.sh in the site app root.
#
# On the server:
#   ~/bin/deploy                 # origin/main
#   ~/bin/deploy origin/main
#   ~/bin/deploy <sha>
#
set -euo pipefail

APP_DIR="${SADCPF_NEXUS_APP_DIR:-/home/sadcpf-nexus/htdocs/nexus.sadcpf.org/app}"

if [ "$(id -u)" -eq 0 ]; then
  printf 'ERROR: deploy as sadcpf-nexus, not root.\n' >&2
  exit 1
fi
if [ "$(id -un)" != "sadcpf-nexus" ]; then
  printf 'ERROR: expected user sadcpf-nexus, got %s.\n' "$(id -un)" >&2
  exit 1
fi

cd "$APP_DIR"
exec bash ./scripts/deploy.sh "$@"
