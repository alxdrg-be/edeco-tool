import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/** A module must use onHome only after saving or confirming pending edits. */
export interface ToolProps { onHome: () => void }

export const MODULES: Readonly<Record<string, LazyExoticComponent<ComponentType<ToolProps>> | undefined>> = {
  "nova-legenden": lazy(() => import("../App")),
};
