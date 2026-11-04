import { createElement, lazy, type ComponentType, type LazyExoticComponent } from "react";

import { WORKBENCH_CATALOG } from "../tools/berechnungen/workbench/catalog";

/** A module must use onHome only after saving or confirming pending edits. */
export interface ToolProps { onHome: () => void; onOpenTool?: (toolId: string) => void }

export const MODULES: Readonly<Record<string, LazyExoticComponent<ComponentType<ToolProps>> | undefined>> = {
  "nova-legenden": lazy(() => import("../App")),
  "rack-dispo": lazy(() => import("../tools/rack-dispo/RackPlanner")),
  "bim2steiger": lazy(() => import("./BimTool")),
  "dokumenten-assistent": lazy(() => import("../tools/dokumenten-assistent/DocumentAssistant")),
  "pdf-werkzeuge": lazy(() => import("../tools/pdf-workshop/PdfWorkshop")),
  "dateien-umbenennen": lazy(() => import("../tools/dateien-umbenennen/FileRename")),
  "projektzentrale": lazy(() => import("../tools/projektzentrale/ProjectHub")),
  "planlieferung": lazy(() => import("../tools/planlieferung/PlanDelivery")),
  "berechnungen": lazy(() => import("../tools/berechnungen/Calculations")),
  "elektro-memory": lazy(() => import("../tools/elektro-memory/ElektroMemory")),
  "formelrechner": lazy(() => import("../tools/elektro-memory/ElektroMemory").then(module => ({ default: (props: ToolProps) => createElement(module.default, { ...props, initialTab: "calculator" }) }))),
  "wissens-hub": lazy(() => import("../tools/berechnungen/KnowledgeHub")),
  "netzplaner": lazy(() => import("../tools/berechnungen/NetworkPlanner")),
  "blitzschutz": lazy(() => import("../tools/berechnungen/Lightning")),
  "kabelberechnung": lazy(() => import("../tools/berechnungen/Cable")),
  "emobilitaet": lazy(() => import("../tools/berechnungen/EV")),
  "berechnungsablage": lazy(() => import("../tools/berechnungen/ablage/ArchiveView")),
  ...Object.fromEntries(WORKBENCH_CATALOG.map(([id]) => [id, lazy(() => import("../tools/berechnungen/workbench/Workbench").then(module => ({ default: (props: ToolProps) => createElement(module.default, { ...props, calculatorId: id }) })))])),
};
