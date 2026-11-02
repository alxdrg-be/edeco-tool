/** Direction follows a known signed power/current; ratings never imply a flow. */
export function currentFlowClass(value: number | undefined, valid = true): string | undefined {
  if (!valid || value === undefined || !Number.isFinite(value) || Math.abs(value) <= 1e-9) return undefined;
  return value < 0 ? "lab-current-flow lab-current-flow-reverse" : "lab-current-flow";
}
