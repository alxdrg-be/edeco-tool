/* Small integration hook. PDF operations remain entirely in Stirling Core. */
(() => {
  let hasWork = false;
  window.edecoPDF = { hasWork: () => hasWork };
  try {
    const mode = window.parent.document.documentElement.dataset.theme;
    document.documentElement.dataset.edecoTheme = mode === "dark" || (mode !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
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
  // Keep downloads inside the native Toolbox download handler.
  document.addEventListener("click", event => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (link?.hasAttribute("download")) link.removeAttribute("target");
  }, true);
})();
