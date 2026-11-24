import type { DeliveryRecord } from "../projektzentrale/projectHubState";
import { csvCell as sharedCsvCell, csvRows } from "../../shared/csv.ts";

const HEADER = ["Projektnummer", "Lieferdatum", "Empfänger", "Dateiname", "Geschoss", "Planart", "Index", "Massstab", "SHA-256"];

/** Preserve the existing single-cell export for delivery-list callers. */
export function csvCell(value: string): string {
  return sharedCsvCell(value);
}

/** Plan list of one delivery as Excel-ready CSV (UTF-8 BOM, semicolon, CRLF). */
export function planListCsv(record: DeliveryRecord): string {
  const rows = [HEADER, ...record.plans.map(plan => [record.project_number, record.delivery_date, record.recipient, plan.filename, plan.floor, plan.plan_type, plan.index, plan.scale, plan.sha256])];
  return csvRows(rows);
}
