"""One process-wide lock for pdfium.

pdfium is not thread-safe. Every tool in the Toolhub renders or reads PDFs through
pypdfium2 under this lock. It lives in nova_legend because edeco_toolbox depends on
nova_legend and never the other way round.
"""

import threading

PDF_LOCK = threading.RLock()
