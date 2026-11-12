import { api, type ProjectDetail } from "../../api";
import type { Run } from "./types.ts";

export interface IgnoredTabProps { items: ProjectDetail["ignored"]; run: Run; load: () => void }

export function IgnoredTab({ items, run, load }: IgnoredTabProps) {
  return (
    <table className="list-table">
      <thead>
        <tr>
          <th>Element</th>
          <th>Grund</th>
          <th className="num-col">Anzahl</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {items.map((g) => (
          <tr key={g.source_key}>
            <td>{g.name}</td>
            <td className="hint">{g.manual ? "von Hand ignoriert (gilt für die ganze Firma)" : g.reason}</td>
            <td className="num-col">{g.total}</td>
            <td style={{ textAlign: "right" }}>
              {g.manual && (
                <button
                  className="btn small"
                  onClick={async () => {
                    await run(() => api.setMapping(g.source_key, null), "Wird wieder berücksichtigt");
                    load();
                  }}
                >
                  Wieder berücksichtigen
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
