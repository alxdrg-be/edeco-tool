import { presentationCatalog, type ToolInfo } from "./catalog.ts";
import { DEMO_DEFAULT_IDS } from './toolContract.ts';

export interface PresentationPolicy {
  revision: string;
  demo_enabled: boolean;
  demo_tools: string[];
  admins: string[];
  identity: string;
  is_admin: boolean;
  can_manage: boolean;
  windows_roles: boolean;
  design_beta_enabled: boolean;
  design_beta_error: string;
}

/** A missing policy or an ordinary user's preference must never activate beta. */
export function designBetaEnabled(policy: PresentationPolicy | null): boolean {
  return policy?.is_admin === true && policy.design_beta_enabled === true;
}

export const DEFAULT_DEMO_TOOLS = DEMO_DEFAULT_IDS;

export function toolAllowed(tool: ToolInfo, policy: PresentationPolicy): boolean {
  if (tool.designBetaOnly && (!designBetaEnabled(policy) || policy.demo_enabled)) return false;
  if (tool.hiddenFromHub && !policy.is_admin) return false;
  if (!policy.demo_enabled) return true;
  return tool.status === "available" && policy.demo_tools.includes(tool.parentId ?? tool.id);
}

export function toolsForPresentation(policy: PresentationPolicy | null): readonly ToolInfo[] {
  if (!policy) return [];
  return presentationCatalog(designBetaEnabled(policy) && !policy.demo_enabled).filter(tool => toolAllowed(tool, policy));
}

export function allowedToolId(id: string, tools: readonly ToolInfo[], policy: PresentationPolicy): boolean {
  const tool = tools.find(item => item.id === id);
  return Boolean(tool && tool.status === "available" && toolAllowed(tool, policy));
}
