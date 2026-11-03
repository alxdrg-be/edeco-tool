import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { useToolhubTheme } from "./useToolhubTheme";
import ToolhubHeader from "./ToolhubHeader";

interface Props {
  title: string;
  onHome: () => void;
  onOpenTool?: (id: string) => void;
  currentToolId?: string;
  disabled?: boolean;
  onLogoClick?: () => void;
  children?: ReactNode;
}

export default function ToolHeader({ title, onHome, onOpenTool, currentToolId, disabled, onLogoClick, children }: Props) {
  const { dark, toggle } = useToolhubTheme();
  return <ToolhubHeader title={title} onHome={onHome} onOpenTool={onOpenTool} currentToolId={currentToolId}
    disabled={disabled} onTitleActivate={onLogoClick} className="tool-header">
    {children}
    <button type="button" className="btn toolhub-theme" disabled={disabled} aria-label={dark ? "Heller Modus" : "Dunkler Modus"} onClick={toggle}>{dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}<span>{dark ? "Hell" : "Dunkel"}</span></button>
  </ToolhubHeader>;
}
