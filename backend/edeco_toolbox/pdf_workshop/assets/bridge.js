/* Small integration hook. PDF operations remain entirely in Stirling Core. */
(() => {
  let hasWork = false;
  window.edecoPDF = { hasWork: () => hasWork };
  try {
    const parentRoot = window.parent.document.documentElement;
    const syncTheme = () => {
      const mode = parentRoot.dataset.theme;
      const theme = mode === "dark" || (mode !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
      document.documentElement.dataset.edecoTheme = theme;
      document.documentElement.dataset.mantineColorScheme = theme;
    };
    syncTheme();
    new MutationObserver(syncTheme).observe(parentRoot, { attributes: true, attributeFilter: ["data-theme"] });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncTheme);
  } catch { /* The complete integration uses the same-origin Toolbox proxy. */ }
  document.addEventListener("change", event => {
    if (event.target instanceof HTMLInputElement && event.target.type === "file" && event.target.files?.length) hasWork = true;
  }, true);
  document.addEventListener("drop", event => {
    if (event.dataTransfer?.files?.length) hasWork = true;
  }, true);
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || (input instanceof Request ? input.method : "GET");
    if (method.toUpperCase() === "POST" && url.includes("/api/v1/")) hasWork = true;
    return originalFetch.apply(this, arguments);
  };
  if (window.edecoOffline) {
    // Core's Tesseract fallback cannot apply OCRmyPDF's advanced options.
    originalFetch('/tools/pdf-werkstatt/edeco/offline-options.json').then(r => r.json()).then(labels => {
      const unavailable = new Set(labels);
      const refresh = () => {
        document.querySelectorAll('input[placeholder*="Stirling"]').forEach(input => {
          input.placeholder = input.placeholder.includes('durchsuchen') ? 'PDF-Werkstatt durchsuchen' : 'Search PDF workshop';
        });
        document.querySelectorAll('img[alt="Stirling"]').forEach(img => { img.alt = 'edeco PDF-Werkstatt'; });
        document.querySelectorAll('.sui-brandmark[aria-label="Stirling"]').forEach(mark => { mark.setAttribute('aria-label', 'edeco PDF-Werkstatt'); });
        document.querySelectorAll('[role="option"]').forEach(option => {
          if (unavailable.has(option.textContent.trim())) { option.hidden = true; option.setAttribute('aria-disabled', 'true'); }
        });
        document.querySelectorAll('label').forEach(label => {
          if (!unavailable.has(label.textContent.trim())) return;
          const input = document.getElementById(label.htmlFor) || label.querySelector('input');
          if (input instanceof HTMLInputElement) input.disabled = true;
          const row = label.closest('.mantine-Checkbox-root, .mantine-Switch-root');
          if (row && !row.hidden) row.hidden = true;
        });
      };
      const start = () => { refresh(); new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true }); };
      if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
    });
  }
  // Keep downloads inside the native Toolbox download handler.
  document.addEventListener("click", event => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (link?.hasAttribute("download")) link.removeAttribute("target");
  }, true);
})();
