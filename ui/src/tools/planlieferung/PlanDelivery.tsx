import FileRename from "../dateien-umbenennen/FileRename";
import type { ToolProps } from "../../toolbox/modules";
import { usePresentation } from "../../toolbox/PresentationSettings";
import { designBetaEnabled } from "../../toolbox/presentationPolicy";

export default function PlanDelivery(props: ToolProps) {
  const { policy } = usePresentation();
  return <FileRename {...props} deliveryMode betaDelivery={designBetaEnabled(policy)} />;
}
