import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./Board.css";
import Tile from "./Tile";
import WallSlot from "./WallSlot";
import { useGameState } from "../context/GameContext";
import type { GameManager, MoveDirection } from "../Managers/GameManager";
import { MinimaxWorkerClient } from "../Managers/MinimaxWorkerClient";

interface BoardProps {
  boardSize: number;
  manager: GameManager;
  onRestartGame: () => void;
  onExitGame: () => void;
}

export default function Board({
  boardSize,
  manager,
  onRestartGame,
  onExitGame,
}: BoardProps) {
  const { gameState, setGameState, controls } = useGameState();
  const minimaxWorkerClient = useMemo(() => new MinimaxWorkerClient(), []);
  const [isPauseMenuOpen, setIsPauseMenuOpen] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const playerSideInfo = useMemo(() => {
    const allPlayers = [
      {
        key: "player1",
        label: "Player 1",
        side: "left",
        colorClass: "player-0",
      },
      {
        key: "player2",
        label: "Player 2",
        side: "right",
        colorClass: "player-1",
      },
      {
        key: "player3",
        label: "Player 3",
        side: "left",
        colorClass: "player-2",
      },
      {
        key: "player4",
        label: "Player 4",
        side: "right",
        colorClass: "player-3",
      },
    ] as const;

    const visiblePlayers = allPlayers
      .map((player) => ({
        ...player,
        state: gameState.players[player.key],
      }))
      .filter((player) => player.state);

    return {
      left: visiblePlayers.filter((player) => player.side === "left"),
      right: visiblePlayers.filter((player) => player.side === "right"),
    };
  }, [gameState.players]);
  const isAiAutoTurn =
    controls.type === "1v1" &&
    controls.diff !== "none" &&
    controls.diff !== "online" &&
    gameState.status === "in_progress" &&
    gameState.turn === "player2";
  const validMoves = useMemo(
    () =>
      isAiAutoTurn
        ? { validPlayerMoves: [], validWallPlacements: [] }
        : manager.GetValidMoves(gameState),
    [gameState, isAiAutoTurn, manager],
  );
  const [selectedWallPosition, setSelectedWallPosition] = useState<
    { x: number; y: number } | undefined
  >(undefined);
  const gridSize = boardSize * 2 - 1;
  const trackTemplate = useMemo(
    () =>
      Array.from({ length: gridSize }, (_, index) =>
        index % 2 === 0 ? "var(--tile-size)" : "var(--wall-size)",
      ).join(" "),
    [gridSize],
  );
  const responsiveTileSize = useMemo(() => {
    const boardUnits = boardSize + (boardSize - 1) / 4;
    return `clamp(18px, min(calc((100dvh - 150px) / ${boardUnits}), calc((100dvw - 36px) / ${boardUnits})), 56px)`;
  }, [boardSize]);
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
    return () => {
      minimaxWorkerClient.dispose();
    };
  }, [minimaxWorkerClient]);

  useEffect(() => {
    const shouldAutoPlayAiTurn = isAiAutoTurn;

    if (!shouldAutoPlayAiTurn || isPauseMenuOpen) {
      setIsAiThinking(false);
      return;
    }

    let isCancelled = false;

    const runBackgroundMinimax = async () => {
      if (controls.diff === "none" || controls.diff === "online") {
        return;
      }

      setIsAiThinking(true);

      let aiResult;
      try {
        aiResult = await minimaxWorkerClient.getAIMove(
          gameState,
          controls.diff,
        );
      } catch (error) {
        // Fallback keeps gameplay working if worker crashes/times out.
        void error;
        await new Promise((resolve) => setTimeout(resolve, 50)); // Small buffer for UI paint
        aiResult =
          controls.diff === "easy"
            ? manager.GetAIMoveEasy(gameState)
            : controls.diff === "normal"
              ? manager.GetAIMoveNormal(gameState)
              : controls.diff === "hard"
                ? manager.GetAIMoveHard(gameState)
                : manager.GetAIMoveExpert(gameState);
      }

      if (isCancelled || !aiResult.isSuccess) {
        if (!isCancelled) {
          setIsAiThinking(false);
        }
        return;
      }

      setGameState(aiResult.gameState);
      setSelectedWallPosition(undefined);
      setIsAiThinking(false);
    };

    void runBackgroundMinimax();

    return () => {
      isCancelled = true;
      setIsAiThinking(false);
    };
  }, [
    controls.diff,
    controls.type,
    gameState,
    isAiAutoTurn,
    isPauseMenuOpen,
    minimaxWorkerClient,
    setGameState,
  ]);

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
      <div className="board-topbar">
        <button
          type="button"
          className="pause-button"
          onClick={() => setIsPauseMenuOpen(true)}
        >
          Pause
        </button>
      </div>

      <div className="board-and-walls">
        <aside className="walls-panel walls-panel-left">
          {playerSideInfo.left.map((player) => (
            <div
              key={player.key}
              className={`walls-chip ${player.colorClass} ${gameState.turn === player.key ? "is-current-turn" : ""}`}
            >
              <span className="walls-chip-label">{player.label}</span>
              <span className="walls-chip-value">
                Walls: {player.state?.wallsRemaining ?? 0}
              </span>
            </div>
          ))}
        </aside>

        <div
          className="board"
          style={
            {
              "--tile-size": responsiveTileSize,
              gridTemplateColumns: trackTemplate,
              gridTemplateRows: trackTemplate,
            } as CSSProperties
          }
        >
          {cells}
        </div>

        <aside className="walls-panel walls-panel-right">
          {playerSideInfo.right.map((player) => (
            <div
              key={player.key}
              className={`walls-chip ${player.colorClass} ${gameState.turn === player.key ? "is-current-turn" : ""}`}
            >
              <span className="walls-chip-label">{player.label}</span>
              <span className="walls-chip-value">
                Walls: {player.state?.wallsRemaining ?? 0}
              </span>
            </div>
          ))}
        </aside>
      </div>

      <button
        className="confirm-wall-button"
        disabled={!selectedWallPosition || isAiThinking}
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

      {isAiThinking && !isPauseMenuOpen ? (
        <div
          className="thinking-overlay"
          aria-live="polite"
          aria-label="AI is thinking"
        >
          <div className="thinking-popup">
            <span className="thinking-dot" />
            <span>AI is thinking...</span>
          </div>
        </div>
      ) : null}

      {isPauseMenuOpen ? (
        <div
          className="pause-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Pause menu"
        >
          <div
            className="pause-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="pause-modal-title">Game Paused</h2>
            <div className="pause-modal-actions">
              <button
                type="button"
                className="pause-action"
                onClick={() => {
                  setIsPauseMenuOpen(false);
                  onRestartGame();
                }}
              >
                Restart
              </button>
              <button
                type="button"
                className="pause-action"
                onClick={() => setIsPauseMenuOpen(false)}
              >
                Resume
              </button>
              <button
                type="button"
                className="pause-action pause-action-exit"
                onClick={() => {
                  setIsPauseMenuOpen(false);
                  onExitGame();
                }}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
