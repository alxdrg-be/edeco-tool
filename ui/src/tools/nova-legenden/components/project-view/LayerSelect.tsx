import { ProjectDetail } from "../../api";

export function LayerSelect({
  value,
  layers,
  disabled,
  label,
  onChange,
}: {
  value: string;
  layers: ProjectDetail["layers"];
  disabled?: boolean;
  label: string;
  onChange: (layer: string | null) => void;
}) {
  return (
    <select
      className="select"
      style={{ maxWidth: 280 }}
      value={value}
      disabled={disabled}
      aria-label={label}
      title={value ? `Manuell: ${value}. «automatisch» sucht wieder nach dem Namen.` : "automatisch: passender Ebenenname"}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">automatisch</option>
      {layers.map((l) => (
        <option key={l.name} value={l.name}>
          {l.name}
          {l.color ? "" : " (ohne Farbangabe)"}
        </option>
      ))}
    </select>
  );
}
