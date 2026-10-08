import { GRID_POSITIONS } from "@/lib/grid-copy";
import "./grid-overlay.css";

export function GridOverlay({ enabled = true }: { enabled?: boolean }) {
  return <span className="copy-grid-overlay" data-enabled={enabled} aria-hidden="true">
    {GRID_POSITIONS.map(position => <span key={position}>
      <span className="copy-grid-line copy-grid-vertical" style={{ left: `${position}%` }} />
      <span className="copy-grid-line copy-grid-horizontal" style={{ top: `${position}%` }} />
    </span>)}
  </span>;
}
