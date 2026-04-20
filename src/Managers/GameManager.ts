import type { GameState } from "../context/GameContext";

export type MoveDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "upJump"
  | "downJump"
  | "leftJump"
  | "rightJump"
  | "upRight"
  | "upLeft"
  | "downRight"
  | "downLeft";

export interface WallPosition {
  x: number;
  y: number;
}

export interface MoveResult {
  gameState: GameState;
  isSuccess: boolean;
}

export interface ValidMoves {
  validPlayerMoves: MoveDirection[];
  validWallPlacements: WallPosition[];
}

export interface GameManager {
  GetValidMoves(gameState: GameState): ValidMoves;
  MovePlayer(gameState: GameState, direction: MoveDirection): MoveResult;
  PlaceWall(gameState: GameState, position: WallPosition): MoveResult;
}
