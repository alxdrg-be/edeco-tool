import type { DeliveryRecord } from "../projektzentrale/projectHubState";

const HEADER = ["Projektnummer", "Lieferdatum", "Empfänger", "Dateiname", "Geschoss", "Planart", "Index", "Massstab", "SHA-256"];

/** One CSV cell for Excel: quoted, and a leading formula character is neutralised. */
export function csvCell(value: string): string {
  return '"' + (/^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? "'" : "") + value.replaceAll('"', '""') + '"';
}

/** Plan list of one delivery as Excel-ready CSV (UTF-8 BOM, semicolon, CRLF). */
export function planListCsv(record: DeliveryRecord): string {
  const rows = [HEADER, ...record.plans.map(plan => [record.project_number, record.delivery_date, record.recipient, plan.filename, plan.floor, plan.plan_type, plan.index, plan.scale, plan.sha256])];
  return "﻿" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
}
