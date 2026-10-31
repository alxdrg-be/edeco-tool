# Stirling's official Core build (no login/AI engine), with local OCR tools.
FROM stirlingtools/stirling-pdf:3.2.2-ultra-lite@sha256:a61ebd4f4158b0bbc9722b3abfc3e40e2c0eed0a30bb67a54c3f5ffaae2daea0

USER root
RUN --mount=type=secret,id=proxy_ca,mode=0444 \
    sed -i 's|http://|https://|g' /etc/apt/sources.list.d/*.sources && \
    if [ -s /run/secrets/proxy_ca ]; then pdf_ca_option='-oAcquire::https::CaInfo=/run/secrets/proxy_ca'; else pdf_ca_option=''; fi && \
    apt-get $pdf_ca_option update && \
    apt-get $pdf_ca_option install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-deu tesseract-ocr-eng tesseract-ocr-osd \
      ocrmypdf ghostscript qpdf unpaper imagemagick \
      fonts-dejavu-core fonts-liberation && \
    rm -rf /var/lib/apt/lists/*

ENV ENDPOINTS_GROUPS_TO_REMOVE="" \
    SYSTEM_TESSDATADIR=/usr/share/tesseract-ocr/5/tessdata \
    TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata \
    SYSTEM_CUSTOMPATHS_OPERATIONS_OCRMYPDF=/usr/bin/ocrmypdf
