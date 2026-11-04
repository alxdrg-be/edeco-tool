/* Small integration hook. PDF operations remain entirely in Stirling Core. */
(() => {
  let hasWork = false;
  let lastFiles = [];
  const root = "/tools/pdf-werkstatt/";
  const toolIds = new Set(['pdfTextEditor','multiTool','merge','certSign','timestampPdf','sign','addText','addImage','annotate','addPassword','watermark','addStamp','sanitize','flatten','unlockPDFForms','formFill','autoFormDetection','changePermissions','getPdfInfo','validateSignature','read','changeMetadata','editTableOfContents','crop','rotate','autoRotate','split','reorganizePages','scalePages','addPageNumbers','pageLayout','bookletImposition','pdfToSinglePage','addAttachments','createPortfolio','extractPages','extractImages','removePages','removeBlanks','removeAnnotations','removeImage','removePassword','removeCertSign','automate','autoRename','adjustContrast','repair','scannerImageSplit','overlayPdfs','replaceColor','showJS','compare','classify','compress','convert','ocr','redact']);
  let applicationReady = false;
  const isReady = () => {
    // Settings pages need not contain an importer. Once Core has mounted, it
    // remains routable while that page is open and the file library stays alive.
    if (document.querySelector('input[type="file"]')) applicationReady = true;
    return applicationReady;
  };
  const navigation = path => {
    // Use Core's own history/PopState routing: the React file library stays alive.
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const waitReady = () => new Promise((resolve, reject) => {
    const deadline = Date.now() + 20000;
    const check = () => {
      if (isReady()) resolve();
      else if (Date.now() >= deadline) reject(new Error("Die PDF-Oberfläche ist noch nicht bereit. Bitte erneut versuchen."));
      else setTimeout(check, 100);
    };
    check();
  });
  const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const openSettings = () => {
    if (!isReady()) return false;
    navigation(root + "settings/general");
    return true;
  };
  window.edecoPDF = {
    hasWork: () => hasWork,
    isReady,
    activateTool: async id => {
      if (!toolIds.has(id)) throw new Error("Dieses PDF-Werkzeug ist nicht bekannt.");
      await waitReady();
      navigation(root + "?tool=" + encodeURIComponent(id));
      await settle();
    },
    openHome: async () => { await waitReady(); navigation(root); await settle(); },
    openSettings,
    importFiles: async files => {
      await waitReady();
      const picker = document.querySelector('input[type="file"]');
      if (!picker) throw new Error("Die Dateiauswahl ist noch nicht bereit. Bitte erneut versuchen.");
      const transfer = new DataTransfer();
      for (const file of files) transfer.items.add(file);
      picker.files = transfer.files;
      picker.dispatchEvent(new Event("change", { bubbles: true }));
      await settle();
    },
  };
  let previousReady = null;
  const publish = () => {
    const ready = isReady();
    if (ready !== previousReady) {
      previousReady = ready;
      window.parent.postMessage({ type: "edeco-pdf-state", ready }, window.location.origin);
    }
  };
  const localSettings = () => {
    if (!window.edecoOffline) return;
    document.querySelectorAll('button, [role="button"]').forEach(button => {
      const label = button.getAttribute("aria-label") || "";
      if (!button.classList.contains("edeco-settings-control") && !/^(Benutzer|User)(?:\s*[—–-]\s*(Konto|Account))?$/i.test(label)) return;
      button.classList.add("edeco-settings-control");
      button.setAttribute("aria-label", "Einstellungen");
      button.setAttribute("title", "PDF-Einstellungen");
    });
  };
  const clarifyControls = () => {
    const toolSearch = document.querySelector('#super-search-input');
    if (toolSearch instanceof HTMLInputElement) {
      toolSearch.placeholder = 'PDF-Werkzeuge suchen …';
      toolSearch.setAttribute('aria-label', 'PDF-Werkzeuge suchen');
      toolSearch.title = 'Werkzeuge und Funktionen suchen. Text im PDF findest du in der Dokumentansicht.';
    }
    document.querySelectorAll('button, [role="button"]').forEach(button => {
      const label = (button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '').trim();
      if (/^(?:Auswählen und bearbeiten|Select and edit)$/i.test(label)) {
        button.setAttribute('aria-label', 'Anmerkung auswählen und bearbeiten');
        button.setAttribute('title', 'Vorhandene Anmerkungen, Textfelder und Stempel auswählen und bearbeiten. Den Seitentext änderst du über „PDF bearbeiten“.');
      }
      if (/(?:^|\s)(?:close|schliessen|schließen)(?:\s|$)/i.test(label)
          || button.querySelector('svg[data-testid="CloseIcon"], svg.lucide-x')) {
        button.classList.add('edeco-close-control');
        if (!label) { button.setAttribute('aria-label', 'Schliessen'); button.setAttribute('title', 'Schliessen'); }
      }
    });
  };
  const observe = () => {
    let pending = false;
    const refresh = () => { pending = false; localSettings(); clarifyControls(); publish(); };
    new MutationObserver(() => {
      if (!pending) { pending = true; queueMicrotask(refresh); }
    }).observe(document.body, { childList: true, subtree: true });
    refresh();
  };
  if (document.body) observe(); else document.addEventListener("DOMContentLoaded", observe, { once: true });
  document.addEventListener("click", event => {
    const action = event.target instanceof Element ? event.target.closest('button, a, [role="button"]') : null;
    const label = (action?.getAttribute("aria-label") || action?.getAttribute("title") || action?.textContent || "").trim();
    if (window.parent !== window && (action?.getAttribute("data-tour") === "tool-button-crop" || /^(?:PDF zuschneiden|Zuschneiden|Crop PDF|Crop)$/i.test(label))) {
      event.preventDefault(); event.stopImmediatePropagation();
      const pdfFiles = lastFiles.filter(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name));
      window.parent.postMessage({ type: "edeco-pdf-native-tool", tool: "crop", files: pdfFiles.length === 1 ? pdfFiles : [] }, window.location.origin);
      return;
    }
    const target = event.target instanceof Element ? event.target.closest(".edeco-settings-control") : null;
    if (window.edecoOffline && target && openSettings()) { event.preventDefault(); event.stopPropagation(); }
  }, true);
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
    if (event.target instanceof HTMLInputElement && event.target.type === "file" && event.target.files?.length) {
      hasWork = true; lastFiles = Array.from(event.target.files);
    }
  }, true);
  document.addEventListener("drop", event => {
    if (event.dataTransfer?.files?.length) { hasWork = true; lastFiles = Array.from(event.dataTransfer.files); }
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
          input.placeholder = 'PDF-Werkzeuge suchen …';
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
