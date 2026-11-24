"""Entry point for the shared Windows desktop application."""

import sys

if __name__ == "__main__":
    if sys.argv[1:2] == ["--bim-check-worker"]:
        # The worker runs without a window. Neither Windows error reporting nor the
        # PyInstaller crash box may wait for a click, the server must get an exit code.
        if sys.platform == "win32":
            import ctypes
            ctypes.windll.kernel32.SetErrorMode(0x0001 | 0x0002)  # SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX
        try:
            from edeco_toolbox.bim_check.worker import main as process_bim
        except BaseException:
            import traceback
            from pathlib import Path
            if len(sys.argv) > 4:
                Path(sys.argv[4], "crash.txt").write_text(traceback.format_exc()[-8000:], encoding="utf-8")
            raise SystemExit(1) from None
        raise SystemExit(process_bim(sys.argv[2:]))

    from edeco_toolbox.__main__ import main
    raise SystemExit(main())
