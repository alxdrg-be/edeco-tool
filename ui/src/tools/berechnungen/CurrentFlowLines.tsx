import { currentFlowClass } from "./currentFlow";
import "./current-flow.css";

/** Each bus section carries only the power of the branches beyond it. */
export function CurrentBus({ x, y, firstX, spacing = 180, powers, colour, width = 3, testId, state }: {
  x: number; y: number; firstX: number; spacing?: number; powers: number[]; colour: string; width?: number; testId?: string; state?: string;
}) {
  return <g data-testid={testId} data-state={state}>{powers.map((_, column) => <path key={column} data-flow-column={column}
    className={currentFlowClass(powers.slice(column).reduce((sum, power) => sum + power, 0))}
    d={`M${column ? firstX + (column - 1) * spacing : x} ${y}H${firstX + column * spacing}`}
    stroke={colour} strokeWidth={width} fill="none" />)}</g>;
}

/** The vertical section below the final active row has no calculated flow. */
export function CurrentTrunk({ x, startY, firstY, spacing, rowPowers, colour, width = 3, testId, state, initialX }: {
  x: number; startY: number; firstY: number; spacing: number; rowPowers: number[]; colour: string; width?: number; testId?: string; state?: string; initialX?: number;
}) {
  return <g>{rowPowers.map((_, row) => <path key={row} data-flow-row={row} data-testid={row ? undefined : testId} data-state={state}
    className={currentFlowClass(rowPowers.slice(row).reduce((sum, power) => sum + power, 0))}
    d={row === 0 && initialX !== undefined ? `M${initialX} ${startY}H${x}V${firstY}` : `M${x} ${row ? firstY + (row - 1) * spacing : startY}V${firstY + row * spacing}`}
    stroke={colour} strokeWidth={width} fill="none" />)}</g>;
}
