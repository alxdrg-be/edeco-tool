import type { ToolInfo } from "./catalog";

export interface PresentationPolicy {
  revision: string;
  demo_enabled: boolean;
  demo_tools: string[];
  admins: string[];
  identity: string;
  is_admin: boolean;
  can_manage: boolean;
  windows_roles: boolean;
}

export const DEFAULT_DEMO_TOOLS = ["nova-legenden", "berechnungen", "dateien-umbenennen", "pdf-werkzeuge", "elektro-memory"];

export function toolAllowed(tool: ToolInfo, policy: PresentationPolicy): boolean {
  if (tool.hiddenFromHub && !policy.is_admin) return false;
  if (!policy.demo_enabled) return true;
  return tool.status === "available" && policy.demo_tools.includes(tool.parentId ?? tool.id);
}

export function allowedToolId(id: string, tools: readonly ToolInfo[], policy: PresentationPolicy): boolean {
  const tool = tools.find(item => item.id === id);
  return Boolean(tool && tool.status === "available" && toolAllowed(tool, policy));
}
