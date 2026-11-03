import toolhubMark from "../assets/toolbox-icon.svg";
import "./toolhub-brand.css";

/** One product identity for the start page, tools and embedded workspaces. */
export default function ToolhubBrand({ compact = false, className = "" }: {
  compact?: boolean;
  className?: string;
}) {
  return <span className={`toolhub-brand${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
    role="img" aria-label="edeco Toolhub">
    <img className="toolhub-brand-mark" src={toolhubMark} alt="" aria-hidden="true" />
    {!compact && <span className="toolhub-brand-wordmark" aria-hidden="true"><strong>edeco</strong><span>Toolhub</span></span>}
  </span>;
}
