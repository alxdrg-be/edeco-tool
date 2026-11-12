import { useMemo } from "react";
import { DATASET_LABEL, type Category, type ProjectDetail } from "../../api";
import type { QuantitySource } from "../../quantityList";

/** Rows of the quantity list (recognised and unknown) and lookups by category id. */
export function useProjectQuantities(data: ProjectDetail | null, projectId: string, categories: Category[]) {
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const quantityRows = useMemo((): QuantitySource[] => {
    if (!data || data.id !== projectId) return [];
    const recognized = data.rows.map((row) => ({
      key: row.family_key,
      category: catById[row.categories[0]]?.title ?? "Ohne Kategorie",
      title: row.title,
      names: row.names,
      code: row.item,
      dataset: row.datasets.map(DATASET_LABEL).join(", "),
      assignment: "erkannt" as const,
      counts: row.counts,
      total: row.total,
    }));
    const unknown = data.unknown.map((row) => ({
      key: row.source_key,
      category: "Unbekannt",
      title: row.name || "(ohne Namen)",
      names: row.graphic_name && row.graphic_name !== row.name ? [row.graphic_name] : [],
      code: row.item,
      dataset: row.dataset ? DATASET_LABEL(row.dataset) : "",
      assignment: "unbekannt" as const,
      counts: row.counts,
      total: row.total,
    }));
    return [...recognized, ...unknown];
  }, [data, projectId, catById]);
  const colorById = useMemo(
    () => Object.fromEntries((data?.category_colors ?? []).map((c) => [c.id, c])),
    [data],
  );
  return { catById, quantityRows, colorById };
}
