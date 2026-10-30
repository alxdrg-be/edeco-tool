'use strict';
// Same-origin bridge to the common launcher. The original standalone UI keeps working.
if (document.documentElement.dataset.toolbox === 'true') {
  window.edecoToolbox = {
    async prepareLeave() {
      if (pendingToolRequests > 0) {
        toast('Bitte warten, bis der laufende Vorgang abgeschlossen ist.');
        return false;
      }
      if (document.querySelector('dialog[open]')) {
        toast('Bitte den offenen Dialog zuerst abschliessen oder schliessen.');
        return false;
      }
      try {
        // Unlike the original convenience save helpers, errors must prevent leaving.
        localStorage.setItem('steiger2bim.tender.v1', JSON.stringify(tenderLines));
        const project = activeProject();
        if (project) { project.lines = tenderLines; project.model_import = modelImport; }
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(projectStore));
        if (modelImport) localStorage.setItem(MODEL_KEY, JSON.stringify(modelImport));
        else localStorage.removeItem(MODEL_KEY);
        localStorage.setItem('bim2steiger:merkliste:v1', JSON.stringify(state.favorites.map(key => {
          const [id, va] = key.split('/');
          return { id, va };
        })));
        localStorage.setItem(favoriteExtraKey, JSON.stringify(favoriteExtra));
        return true;
      } catch {
        toast('Lokale Speicherung fehlgeschlagen. Bitte Ausschreibung, Import und Favoriten als JSON sichern.');
        return false;
      }
    },
  };
  $('themeToggle').addEventListener('click', () => {
    try { localStorage.setItem('nova-legenden-theme', document.documentElement.dataset.theme); } catch {}
  });
}
