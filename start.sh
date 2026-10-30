#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -x .venv/bin/python || ! -f ui/dist/index.html ]]; then
  bash setup.sh
fi
export PYTHONPATH="$PWD/backend${PYTHONPATH:+:$PYTHONPATH}"
exec .venv/bin/python -m edeco_toolbox "$@"
