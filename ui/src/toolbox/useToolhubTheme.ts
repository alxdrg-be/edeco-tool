import { useEffect, useState } from "react";
import { applyTheme, effectiveDark, loadTheme, saveTheme } from "../shared/theme";

/** Every workspace follows the same stored theme and operating-system setting. */
export function useToolhubTheme() {
  const [dark, setDark] = useState(() => effectiveDark(loadTheme()));
  useEffect(() => {
    const sync = () => setDark(effectiveDark(loadTheme()));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("edeco-theme-change", sync);
    window.addEventListener("storage", sync);
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener("edeco-theme-change", sync);
      window.removeEventListener("storage", sync);
      media.removeEventListener("change", sync);
    };
  }, []);
  return { dark, toggle: () => {
    const next = dark ? "light" : "dark";
    applyTheme(next);
    saveTheme(next).catch(() => undefined);
  } };
}
