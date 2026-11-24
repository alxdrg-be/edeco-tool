"""Entry point for the shared Windows desktop application."""

import sys

if __name__ == "__main__":
    if sys.argv[1:2] == ["--bim-check-worker"]:
        from edeco_toolbox.bim_check.worker import main as process_bim
        raise SystemExit(process_bim(sys.argv[2:]))

    from edeco_toolbox.__main__ import main
    raise SystemExit(main())
