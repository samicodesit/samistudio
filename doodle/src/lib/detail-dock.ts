/** Down tucks the drawer away; up reveals it. Ignore taps and scrolls across it. */
export function detailDockSwipe(dx: number, dy: number): boolean | null {
  return Math.abs(dy) >= 24 && Math.abs(dy) > Math.abs(dx) * 1.5 ? dy < 0 : null;
}
