import "./WallSlot.css";
import Wall from "./Wall";

interface WallSlotProps {
  position: { x: number; y: number };
  isPlaced?: boolean;
  wallPlayerId?: 0 | 1 | 2 | 3;
}

export default function WallSlot({
  position,
  isPlaced,
  wallPlayerId,
}: WallSlotProps) {
  const orientation =
    position.x % 2 === 1 && position.y % 2 === 0 ? "vertical" : "horizontal";

  const style =
    orientation === "horizontal"
      ? {
          gridColumn: `${position.x + 1} / span 3`,
          gridRow: position.y + 1,
        }
      : {
          gridColumn: position.x + 1,
          gridRow: `${position.y + 1} / span 3`,
        };

  return (
    <div
      className={`wall-slot ${orientation}`}
      style={style}
      data-x={position.x}
      data-y={position.y}
    >
      {isPlaced && (
        <Wall
          wallKey={`${position.x},${position.y}`}
          wallPlayerId={wallPlayerId}
        />
      )}
    </div>
  );
}
