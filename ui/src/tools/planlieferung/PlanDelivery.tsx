import FileRename from "../dateien-umbenennen/FileRename";
import type { ToolProps } from "../../toolbox/modules";
export default function PlanDelivery(props: ToolProps) { return <FileRename {...props} deliveryMode />; }
