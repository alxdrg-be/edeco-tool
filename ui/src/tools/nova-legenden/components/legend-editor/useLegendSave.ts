import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { LegendDoc } from "../../legend";
import type { SaveSession } from "../../saveSession";
import type { StoredLegend } from "../../api";
import { useNavigation } from "../../Navigation";
import { formatStamp } from "./editorShared.ts";

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Autosave of the legend: 700 ms after the last edit, flushed before navigation. */
export function useLegendSave(saveSession: SaveSession<LegendDoc, { legend: StoredLegend }>, doc: LegendDoc | null, notify: (text: string, error?: boolean) => void) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedInfo, setSavedInfo] = useState("");
  const { register } = useNavigation();
  // Register the latest rendered edit before navigation events can flush it.
  useLayoutEffect(() => { saveSession.update(doc); }, [doc, saveSession]);

  const saveNow = useCallback(async (): Promise<void> => {
    if (!saveSession.dirty) return;
    setSaveState("saving");
    try {
      await saveSession.flush();
      const r = saveSession.result;
      setSaveState("saved");
      if (r) setSavedInfo(`${formatStamp(r.legend.updated_at)} von ${r.legend.updated_by}`);
    } catch (e) {
      setSaveState("error");
      notify(`Legende nicht gespeichert: ${(e as Error).message}. Bitte erneut versuchen; deine Änderungen bleiben im Editor.`, true);
      throw e;
    }
  }, [notify, saveSession]);

  const saveLegend = useCallback(async () => {
    if (!saveSession.dirty) {
      notify("Die Legende ist bereits gespeichert.");
      return;
    }
    try {
      await saveNow();
      notify("Legende gespeichert.");
    } catch {
      /* saveNow already reported the error */
    }
  }, [notify, saveNow, saveSession]);

  useEffect(() => register({ flush: saveNow, dirty: () => saveSession.dirty }), [register, saveNow, saveSession]);

  useEffect(() => {
    if (!saveSession.dirty) return;
    setSaveState("saving");
    const handle = window.setTimeout(() => { saveNow().catch(() => undefined); }, 700);
    return () => window.clearTimeout(handle);
  }, [doc, saveNow, saveSession]);
  return { saveState, savedInfo, setSavedInfo, saveNow, saveLegend };
}
