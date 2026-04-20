import "./Pawn.css";

interface PawnProps {
  playerId: 0 | 1 | 2 | 3;
}

export default function Pawn({ playerId }: PawnProps) {
  return (
    <svg className="pawn" viewBox="0 0 100 100" data-player-id={playerId}>
      <circle cx="50" cy="50" r="40" />
    </svg>
  );
}
