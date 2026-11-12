import type { ProjectDetail } from "../../api";

export type Tab = "list" | "legend" | "unknown" | "layers" | "ignored" | "changes" | "review";

export interface ImportStatus {
  kind: "busy" | "ok" | "error";
  text: string;
}

/** Runs one server action with the busy flag; errors become a notice and the result is undefined. */
export type Run = <T>(action: () => Promise<T>, ok?: string) => Promise<T | undefined>;
export type SetData = (data: ProjectDetail) => void;
/** Leave the current view after unsaved edits were flushed (see Navigation.tsx). */
export type Navigate = (action: () => void | Promise<void>) => Promise<boolean>;
