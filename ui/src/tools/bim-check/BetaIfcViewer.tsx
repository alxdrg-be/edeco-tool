import type { ToolProps } from "../../toolbox/modules";
import BimCheck from "./BimCheck";

export default function BetaIfcViewer(props: ToolProps) {
  return <BimCheck {...props} viewerWorkspace />;
}
