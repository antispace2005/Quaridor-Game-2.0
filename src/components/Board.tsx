import { useEffect, useMemo, useState, type ReactNode } from "react";
import "./Board.css";
import Tile from "./Tile";
import WallSlot from "./WallSlot";
import { useGameState } from "../context/GameContext";
import type { GameManager, MoveDirection } from "../Managers/GameManager";

interface BoardProps {
  boardSize: number;
  manager: GameManager;
}

export default function Board({ boardSize, manager }: BoardProps) {
  const { gameState, setGameState, controls } = useGameState();
  const validMoves = manager.GetValidMoves(gameState);
  const [selectedWallPosition, setSelectedWallPosition] = useState<
    { x: number; y: number } | undefined
  >(undefined);
  const gridSize = boardSize * 2 - 1;
  const cells: ReactNode[] = [];

  const validWallPlacementKeys = useMemo(
    () =>
      new Set(
        validMoves.validWallPlacements.map(
          (position) => `${position.x},${position.y}`,
        ),
      ),
    [validMoves.validWallPlacements],
  );

  const currentPlayer = gameState.players[gameState.turn];
  const validMoveTargets = new Map<string, MoveDirection>();

  if (currentPlayer) {
    validMoves.validPlayerMoves.forEach((direction) => {
      const targetPosition = getMoveTarget(currentPlayer.position, direction);
      validMoveTargets.set(
        `${targetPosition.x},${targetPosition.y}`,
        direction,
      );
    });
  }

  useEffect(() => {
    const shouldAutoPlayAiTurn =
      controls.type === "1v1" &&
      controls.diff !== "none" &&
      controls.diff !== "online" &&
      gameState.status === "in_progress" &&
      gameState.turn === "player2";

    if (!shouldAutoPlayAiTurn) {
      return;
    }

    const aiResult =
      controls.diff === "easy"
        ? manager.GetAIMoveEasy(gameState)
        : controls.diff === "normal"
          ? manager.GetAIMoveNormal(gameState)
          : controls.diff === "hard"
            ? manager.GetAIMoveHard(gameState)
            : manager.GetAIMoveExpert(gameState);

    if (aiResult.isSuccess) {
      setGameState(aiResult.gameState);
      setSelectedWallPosition(undefined);
    }
  }, [controls.diff, controls.type, gameState, manager, setGameState]);

  // Create a map of player positions for quick lookup
  const playerPositions: Record<string, number> = {};
  if (gameState.players.player1) {
    playerPositions[
      `${gameState.players.player1.position.x},${gameState.players.player1.position.y}`
    ] = 0;
  }
  if (gameState.players.player2) {
    playerPositions[
      `${gameState.players.player2.position.x},${gameState.players.player2.position.y}`
    ] = 1;
  }
  if (gameState.players.player3) {
    playerPositions[
      `${gameState.players.player3.position.x},${gameState.players.player3.position.y}`
    ] = 2;
  }
  if (gameState.players.player4) {
    playerPositions[
      `${gameState.players.player4.position.x},${gameState.players.player4.position.y}`
    ] = 3;
  }

  // Create a map of walls for quick lookup
  const wallMap: Record<string, number> = {};
  gameState.walls.forEach((wall) => {
    wallMap[`${wall.x},${wall.y}`] = wall.playerId;
  });

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const isTile = x % 2 === 0 && y % 2 === 0;
      const isOverlapPoint = x % 2 === 1 && y % 2 === 1;

      if (isTile) {
        const posKey = `${x},${y}`;
        const playerId = playerPositions[posKey] as 0 | 1 | 2 | 3 | undefined;
        const showMoveDot =
          validMoveTargets.has(posKey) && playerId === undefined;
        cells.push(
          <Tile
            key={`tile-${x}-${y}`}
            position={{ x, y }}
            playerId={playerId}
            showMoveDot={showMoveDot}
            onClick={
              validMoveTargets.has(posKey)
                ? () => {
                    const direction = validMoveTargets.get(posKey);
                    if (!direction) {
                      return;
                    }

                    const result = manager.MovePlayer(gameState, direction);
                    if (result.isSuccess) {
                      setGameState(result.gameState);
                      setSelectedWallPosition(undefined);
                    }
                  }
                : undefined
            }
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

      const posKey = `${x},${y}`;
      const isWallPlaced = wallMap[posKey] !== undefined;
      const wallPlayerId = isWallPlaced
        ? (wallMap[posKey] as 0 | 1 | 2 | 3)
        : undefined;
      const isWallSlotSelectable =
        !isWallPlaced && validWallPlacementKeys.has(posKey);
      const isSelectedWallSlot =
        selectedWallPosition?.x === x && selectedWallPosition?.y === y;

      cells.push(
        <WallSlot
          key={`wall-slot-${x}-${y}`}
          position={{ x, y }}
          isPlaced={isWallPlaced}
          wallPlayerId={wallPlayerId}
          isSelectable={isWallSlotSelectable}
          isSelected={isSelectedWallSlot}
          onClick={
            isWallSlotSelectable
              ? () => {
                  setSelectedWallPosition((currentValue) => {
                    if (currentValue?.x === x && currentValue?.y === y) {
                      return undefined;
                    }

                    return { x, y };
                  });
                }
              : undefined
          }
        />,
      );
    }
  }

  return (
    <div className="board-section">
      <div
        className="board"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, var(--cell-size))`,
          gridTemplateRows: `repeat(${gridSize}, var(--cell-size))`,
        }}
      >
        {cells}
      </div>
      <button
        className="confirm-wall-button"
        disabled={!selectedWallPosition}
        onClick={() => {
          if (!selectedWallPosition) {
            return;
          }

          const placementResult = manager.PlaceWall(
            gameState,
            selectedWallPosition,
          );
          if (!placementResult.isSuccess) {
            return;
          }

          setGameState(placementResult.gameState);
          setSelectedWallPosition(undefined);
        }}
      >
        Confirm Wall Placement
      </button>
    </div>
  );
}

function getMoveTarget(
  position: { x: number; y: number },
  direction: MoveDirection,
) {
  switch (direction) {
    case "up":
      return { x: position.x, y: position.y - 2 };
    case "down":
      return { x: position.x, y: position.y + 2 };
    case "left":
      return { x: position.x - 2, y: position.y };
    case "right":
      return { x: position.x + 2, y: position.y };
    case "upJump":
      return { x: position.x, y: position.y - 4 };
    case "downJump":
      return { x: position.x, y: position.y + 4 };
    case "leftJump":
      return { x: position.x - 4, y: position.y };
    case "rightJump":
      return { x: position.x + 4, y: position.y };
    case "upRight":
      return { x: position.x + 2, y: position.y - 2 };
    case "upLeft":
      return { x: position.x - 2, y: position.y - 2 };
    case "downRight":
      return { x: position.x + 2, y: position.y + 2 };
    case "downLeft":
      return { x: position.x - 2, y: position.y + 2 };
  }
}
