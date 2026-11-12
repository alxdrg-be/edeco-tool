

export function GroupRows({
  title,
  color,
  layer,
  state,
  colSpan,
  picker,
  children,
}: {
  title: string;
  color?: string;
  layer: string;
  state: string;
  colSpan: number;
  picker?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="group-row">
        <td colSpan={colSpan}>
          <div className="row" style={{ position: "sticky", left: 8, display: "inline-flex" }}>
            <span className={`swatch ${color ? "" : "none"}`} style={color ? { background: color } : undefined} title={`${layer} ${color ?? ""}`} />
            <span>{title}</span>
            {state && <span className="hint">· {state}</span>}
            {picker}
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}
