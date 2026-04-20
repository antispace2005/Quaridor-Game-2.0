import type { ReactNode } from "react";
import "./Board.css";
import Tile from "./Tile";
import WallSlot from "./WallSlot";

interface BoardProps {
  boardSize: number;
}

export default function Board({ boardSize }: BoardProps) {
  const gridSize = boardSize * 2 - 1;
  const cells: ReactNode[] = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const isTile = x % 2 === 0 && y % 2 === 0;
      const isOverlapPoint = x % 2 === 1 && y % 2 === 1;

      if (isTile) {
        const playerId = x === 0 && y === 0 ? (0 as const) : undefined;
        cells.push(
          <Tile
            key={`tile-${x}-${y}`}
            position={{ x, y }}
            playerId={playerId}
          />,
        );
        continue;
      }

      if (isOverlapPoint) {
        continue;
      }

      const isVerticalCandidate = x % 2 === 1 && y % 2 === 0;
      const isHorizontalCandidate = x % 2 === 0 && y % 2 === 1;

      if (isVerticalCandidate && y + 2 >= gridSize) {
        continue;
      }

      if (isHorizontalCandidate && x + 2 >= gridSize) {
        continue;
      }

      const isWallPlaced = x === 4 && y === 3;
      const wallPlayerId = isWallPlaced ? (1 as const) : undefined;

      cells.push(
        <WallSlot
          key={`wall-slot-${x}-${y}`}
          position={{ x, y }}
          isPlaced={isWallPlaced}
          wallPlayerId={wallPlayerId}
        />,
      );
    }
  }

  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: `repeat(${gridSize}, var(--cell-size))`,
        gridTemplateRows: `repeat(${gridSize}, var(--cell-size))`,
      }}
    >
      {cells}
    </div>
  );
}
