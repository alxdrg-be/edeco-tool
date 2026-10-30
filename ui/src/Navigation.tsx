import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useDialogFocus } from "./useDialogFocus";

interface PendingSave {
  flush: () => Promise<void>;
  dirty: () => boolean;
}

interface UnsavedDraft {
  label: () => string;
  dirty: () => boolean;
  save: () => Promise<boolean>;
}

interface DraftPrompt {
  draft: UnsavedDraft;
  resolve: (proceed: boolean) => void;
}

interface Navigation {
  register: (save: PendingSave) => () => void;
  registerDraft: (draft: UnsavedDraft) => () => void;
  navigate: (action: () => void | Promise<void>) => Promise<boolean>;
  pending: boolean;
}

const Context = createContext<Navigation | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const saves = useRef(new Set<PendingSave>());
  const drafts = useRef(new Set<UnsavedDraft>());
  const [prompt, setPrompt] = useState<DraftPrompt | null>(null);
  const switching = useRef(false);
  const [pending, setPending] = useState(false);
  const register = useCallback((save: PendingSave) => {
    saves.current.add(save);
    return () => { saves.current.delete(save); };
  }, []);
  const registerDraft = useCallback((draft: UnsavedDraft) => {
    drafts.current.add(draft);
    return () => { drafts.current.delete(draft); };
  }, []);
  const navigate = useCallback(async (action: () => void | Promise<void>) => {
    if (switching.current) return false;
    switching.current = true;
    setPending(true);
    try {
      for (const save of saves.current) await save.flush();
      for (const draft of drafts.current) {
        if (!draft.dirty()) continue;
        const proceed = await new Promise<boolean>(resolve => setPrompt({ draft, resolve }));
        if (!proceed) return false;
      }
      await action();
      return true;
    } catch {
      // The editor displays the save error and retains the document for a retry.
      return false;
    } finally {
      switching.current = false;
      setPending(false);
    }
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (![...saves.current, ...drafts.current].some(save => save.dirty())) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const value = useMemo(() => ({ register, registerDraft, navigate, pending }), [register, registerDraft, navigate, pending]);
  return <Context.Provider value={value}>
    {children}
    {prompt && <UnsavedChangesDialog prompt={prompt} onDone={(proceed) => {
      setPrompt(null);
      prompt.resolve(proceed);
    }} />}
  </Context.Provider>;
}

function UnsavedChangesDialog({ prompt, onDone }: { prompt: DraftPrompt; onDone: (proceed: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useDialogFocus(ref, () => onDone(false), busy);

  async function save() {
    setBusy(true);
    setError("");
    try {
      if (await prompt.draft.save()) onDone(true);
      else setError("Die Änderungen konnten nicht gespeichert werden. Bitte Eingaben und Verbindung prüfen.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-back unsaved-dialog">
    <div ref={ref} className="modal" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-description" tabIndex={-1}>
      <h3 id="unsaved-title">Änderungen speichern?</h3>
      <p id="unsaved-description">{prompt.draft.label()} enthält ungespeicherte Änderungen.</p>
      {error && <p className="warn-text" role="alert">{error}</p>}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn" disabled={busy} onClick={() => onDone(false)}>Abbrechen</button>
        <button className="btn" disabled={busy} onClick={() => onDone(true)}>Verwerfen</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? "Speichert …" : "Speichern"}</button>
      </div>
    </div>
  </div>;
}

export function useNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error("NavigationProvider fehlt");
  return value;
}

/** Register a manually saved form without capturing an outdated render. */
export function useUnsavedDraft({ label, dirty, save }: { label: string; dirty: boolean; save: () => Promise<boolean> }) {
  const { registerDraft } = useNavigation();
  const latest = useRef({ label, dirty, save });
  latest.current = { label, dirty, save };
  useEffect(() => registerDraft({
    label: () => latest.current.label,
    dirty: () => latest.current.dirty,
    save: () => latest.current.save(),
  }), [registerDraft]);
}
