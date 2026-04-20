import "./Wall.css";

interface WallProps {
  wallKey: string;
  wallPlayerId?: 0 | 1 | 2 | 3;
}

export default function Wall({ wallKey, wallPlayerId }: WallProps) {
  return (
    <div
      className="wall"
      data-wall-key={wallKey}
      data-wall-player-id={wallPlayerId}
    >
      wall
    </div>
  );
}
