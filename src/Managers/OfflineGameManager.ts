import type { GameState } from "../context/GameContext";
import type {
  GameManager,
  MoveDirection,
  MoveResult,
  ValidMoves,
  WallPosition,
} from "./GameManager";

type PlayerKey = keyof GameState["players"];

const PLAYER_ORDER: PlayerKey[] = ["player1", "player2", "player3", "player4"];

export class OfflineGameManager implements GameManager {
  GetValidMoves(gameState: GameState): ValidMoves {
    return {
      validPlayerMoves: this.getValidPlayerMoves(gameState),
      validWallPlacements: this.getValidWallPlacements(gameState),
    };
  }

  MovePlayer(gameState: GameState, direction: MoveDirection): MoveResult {
    const validMoves = this.GetValidMoves(gameState).validPlayerMoves;
    if (!validMoves.includes(direction)) {
      return {
        gameState,
        isSuccess: false,
      };
    }

    const currentPlayerKey = gameState.turn;
    const currentPlayer = gameState.players[currentPlayerKey];
    if (!currentPlayer) {
      return {
        gameState,
        isSuccess: false,
      };
    }

    const nextPosition = this.getNextPosition(currentPlayer.position, direction);
    const nextTurn = this.getNextTurn(gameState);

    return {
      gameState: {
        ...gameState,
        turn: nextTurn,
        players: {
          ...gameState.players,
          [currentPlayerKey]: {
            ...currentPlayer,
            position: nextPosition,
          },
        },
      },
      isSuccess: true,
    };
  }

  PlaceWall(gameState: GameState, position: WallPosition): MoveResult {
    void gameState;
    void position;
    throw new Error("OfflineGameManager.PlaceWall is not implemented yet.");
  }

  private getValidPlayerMoves(gameState: GameState): MoveDirection[] {
    const currentPlayer = this.getCurrentPlayer(gameState);
    if (!currentPlayer) {
      return [];
    }

    const currentPosition = currentPlayer.position;
    const occupiedTiles = this.getOccupiedTiles(gameState);
    const wallSet = this.getWallSet(gameState);
    const gridLimit = gameState.boardSize * 2 - 1;

    const validMoves: MoveDirection[] = [];

    this.evaluateDirection({
      direction: "up",
      currentPosition,
      occupiedTiles,
      wallSet,
      gridLimit,
      validMoves,
    });
    this.evaluateDirection({
      direction: "down",
      currentPosition,
      occupiedTiles,
      wallSet,
      gridLimit,
      validMoves,
    });
    this.evaluateDirection({
      direction: "left",
      currentPosition,
      occupiedTiles,
      wallSet,
      gridLimit,
      validMoves,
    });
    this.evaluateDirection({
      direction: "right",
      currentPosition,
      occupiedTiles,
      wallSet,
      gridLimit,
      validMoves,
    });

    return validMoves;
  }

  private getValidWallPlacements(gameState: GameState): WallPosition[] {
    const wallSet = this.getWallSet(gameState);
    const gridLimit = gameState.boardSize * 2 - 1;
    const validWallPlacements: WallPosition[] = [];

    for (let y = 0; y < gridLimit; y += 1) {
      for (let x = 0; x < gridLimit; x += 1) {
        const isVerticalCandidate = x % 2 === 1 && y % 2 === 0;
        const isHorizontalCandidate = x % 2 === 0 && y % 2 === 1;

        if (!isVerticalCandidate && !isHorizontalCandidate) {
          continue;
        }

        if (isVerticalCandidate && y + 2 >= gridLimit) {
          continue;
        }

        if (isHorizontalCandidate && x + 2 >= gridLimit) {
          continue;
        }

        if (wallSet.has(this.toKey(x, y))) {
          continue;
        }

        validWallPlacements.push({ x, y });
      }
    }

    return validWallPlacements;
  }

  private evaluateDirection({
    direction,
    currentPosition,
    occupiedTiles,
    wallSet,
    gridLimit,
    validMoves,
  }: {
    direction: Exclude<MoveDirection, "upJump" | "downJump" | "leftJump" | "rightJump" | "upRight" | "upLeft" | "downRight" | "downLeft">;
    currentPosition: { x: number; y: number };
    occupiedTiles: Set<string>;
    wallSet: Set<string>;
    gridLimit: number;
    validMoves: MoveDirection[];
  }) {
    const moveDelta = this.getMoveDelta(direction);
    const wallPosition = {
      x: currentPosition.x + moveDelta.wallX,
      y: currentPosition.y + moveDelta.wallY,
    };
    const targetPosition = {
      x: currentPosition.x + moveDelta.moveX,
      y: currentPosition.y + moveDelta.moveY,
    };

    if (!this.isInsideBoard(targetPosition, gridLimit) || wallSet.has(this.toKey(wallPosition.x, wallPosition.y))) {
      return;
    }

    const targetKey = this.toKey(targetPosition.x, targetPosition.y);
    if (!occupiedTiles.has(targetKey)) {
      validMoves.push(direction);
      return;
    }

    const jumpPosition = {
      x: currentPosition.x + moveDelta.moveX * 2,
      y: currentPosition.y + moveDelta.moveY * 2,
    };
    const jumpWallPosition = {
      x: targetPosition.x + moveDelta.wallX,
      y: targetPosition.y + moveDelta.wallY,
    };

    const jumpBlocked =
      !this.isInsideBoard(jumpPosition, gridLimit) ||
      wallSet.has(this.toKey(jumpWallPosition.x, jumpWallPosition.y));

    if (!jumpBlocked && !occupiedTiles.has(this.toKey(jumpPosition.x, jumpPosition.y))) {
      validMoves.push(this.toJumpDirection(direction));
      return;
    }

    this.addDiagonalMoves({
      direction,
      currentPosition,
      occupiedTiles,
      wallSet,
      gridLimit,
      validMoves,
    });
  }

  private addDiagonalMoves({
    direction,
    currentPosition,
    occupiedTiles,
    wallSet,
    gridLimit,
    validMoves,
  }: {
    direction: Exclude<MoveDirection, "upJump" | "downJump" | "leftJump" | "rightJump" | "upRight" | "upLeft" | "downRight" | "downLeft">;
    currentPosition: { x: number; y: number };
    occupiedTiles: Set<string>;
    wallSet: Set<string>;
    gridLimit: number;
    validMoves: MoveDirection[];
  }) {
    const diagonals = this.getDiagonalChecks(direction, currentPosition);

    diagonals.forEach(({ moveDirection, landingPosition, wallCheckPosition }) => {
      if (!this.isInsideBoard(landingPosition, gridLimit)) {
        return;
      }

      if (wallSet.has(this.toKey(wallCheckPosition.x, wallCheckPosition.y))) {
        return;
      }

      if (occupiedTiles.has(this.toKey(landingPosition.x, landingPosition.y))) {
        return;
      }

      validMoves.push(moveDirection);
    });
  }

  private getDiagonalChecks(
    direction: Exclude<MoveDirection, "upJump" | "downJump" | "leftJump" | "rightJump" | "upRight" | "upLeft" | "downRight" | "downLeft">,
    currentPosition: { x: number; y: number },
  ) {
    if (direction === "up") {
      return [
        {
          moveDirection: "upLeft" as const,
          landingPosition: { x: currentPosition.x - 2, y: currentPosition.y - 2 },
          wallCheckPosition: { x: currentPosition.x - 1, y: currentPosition.y - 2 },
        },
        {
          moveDirection: "upRight" as const,
          landingPosition: { x: currentPosition.x + 2, y: currentPosition.y - 2 },
          wallCheckPosition: { x: currentPosition.x + 1, y: currentPosition.y - 2 },
        },
      ];
    }

    if (direction === "down") {
      return [
        {
          moveDirection: "downLeft" as const,
          landingPosition: { x: currentPosition.x - 2, y: currentPosition.y + 2 },
          wallCheckPosition: { x: currentPosition.x - 1, y: currentPosition.y + 2 },
        },
        {
          moveDirection: "downRight" as const,
          landingPosition: { x: currentPosition.x + 2, y: currentPosition.y + 2 },
          wallCheckPosition: { x: currentPosition.x + 1, y: currentPosition.y + 2 },
        },
      ];
    }

    if (direction === "left") {
      return [
        {
          moveDirection: "upLeft" as const,
          landingPosition: { x: currentPosition.x - 2, y: currentPosition.y - 2 },
          wallCheckPosition: { x: currentPosition.x - 2, y: currentPosition.y - 1 },
        },
        {
          moveDirection: "downLeft" as const,
          landingPosition: { x: currentPosition.x - 2, y: currentPosition.y + 2 },
          wallCheckPosition: { x: currentPosition.x - 2, y: currentPosition.y + 1 },
        },
      ];
    }

    return [
      {
        moveDirection: "upRight" as const,
        landingPosition: { x: currentPosition.x + 2, y: currentPosition.y - 2 },
        wallCheckPosition: { x: currentPosition.x + 2, y: currentPosition.y - 1 },
      },
      {
        moveDirection: "downRight" as const,
        landingPosition: { x: currentPosition.x + 2, y: currentPosition.y + 2 },
        wallCheckPosition: { x: currentPosition.x + 2, y: currentPosition.y + 1 },
      },
    ];
  }

  private getMoveDelta(direction: Exclude<MoveDirection, "upJump" | "downJump" | "leftJump" | "rightJump" | "upRight" | "upLeft" | "downRight" | "downLeft">) {
    if (direction === "up") {
      return { moveX: 0, moveY: -2, wallX: 0, wallY: -1 };
    }

    if (direction === "down") {
      return { moveX: 0, moveY: 2, wallX: 0, wallY: 1 };
    }

    if (direction === "left") {
      return { moveX: -2, moveY: 0, wallX: -1, wallY: 0 };
    }

    return { moveX: 2, moveY: 0, wallX: 1, wallY: 0 };
  }

  private getNextPosition(position: { x: number; y: number }, direction: MoveDirection) {
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

  private getNextTurn(gameState: GameState): GameState["turn"] {
    const availablePlayers = PLAYER_ORDER.filter((playerKey) => gameState.players[playerKey]);
    if (availablePlayers.length === 0) {
      return gameState.turn;
    }

    const currentIndex = availablePlayers.indexOf(gameState.turn);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % availablePlayers.length;
    return availablePlayers[nextIndex] ?? gameState.turn;
  }

  private toJumpDirection(direction: Exclude<MoveDirection, "upJump" | "downJump" | "leftJump" | "rightJump" | "upRight" | "upLeft" | "downRight" | "downLeft">): Extract<MoveDirection, "upJump" | "downJump" | "leftJump" | "rightJump"> {
    if (direction === "up") {
      return "upJump";
    }

    if (direction === "down") {
      return "downJump";
    }

    if (direction === "left") {
      return "leftJump";
    }

    return "rightJump";
  }

  private getCurrentPlayer(gameState: GameState) {
    return gameState.players[gameState.turn];
  }

  private getOccupiedTiles(gameState: GameState): Set<string> {
    const occupiedTiles = new Set<string>();

    PLAYER_ORDER.forEach((playerKey) => {
      const player = gameState.players[playerKey];
      if (!player) {
        return;
      }

      occupiedTiles.add(this.toKey(player.position.x, player.position.y));
    });

    return occupiedTiles;
  }

  private getWallSet(gameState: GameState): Set<string> {
    const wallSet = new Set<string>();

    gameState.walls.forEach((wall) => {
      wallSet.add(this.toKey(wall.x, wall.y));
    });

    return wallSet;
  }

  private isInsideBoard(position: { x: number; y: number }, gridLimit: number) {
    return (
      position.x >= 0 &&
      position.y >= 0 &&
      position.x < gridLimit &&
      position.y < gridLimit
    );
  }

  private toKey(x: number, y: number) {
    return `${x},${y}`;
  }
}
