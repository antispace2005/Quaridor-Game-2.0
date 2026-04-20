import "./Tile.css";
import Pawn from "./Pawn";

interface TileProps {
  position: { x: number; y: number };
  playerId?: 0 | 1 | 2 | 3;
  showMoveDot?: boolean;
  onClick?: () => void;
}

export default function Tile({
  position,
  playerId,
  showMoveDot,
  onClick,
}: TileProps) {
  return (
    <div
      className="tile"
      style={{ gridRow: position.y + 1, gridColumn: position.x + 1 }}
      data-x={position.x}
      data-y={position.y}
      onClick={onClick}
    >
      {playerId !== undefined ? <Pawn playerId={playerId} /> : null}
      {showMoveDot ? <div className="tile-move-dot" /> : null}
    </div>
  );
}
