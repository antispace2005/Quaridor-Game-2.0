import type { GameState } from "../context/GameContext";
import type { AiDifficulty } from "../context/GameContext";

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
  GetAIMoveEasy(gameState: GameState): MoveResult;
  GetAIMoveNormal(gameState: GameState): MoveResult;
  GetAIMoveHard(gameState: GameState): MoveResult;
  GetAIMoveExpert(gameState: GameState): MoveResult;
}

export function getAIMoveFunctionName(difficulty: AiDifficulty) {
  switch (difficulty) {
    case "easy":
      return "GetAIMoveEasy";
    case "normal":
      return "GetAIMoveNormal";
    case "hard":
      return "GetAIMoveHard";
    case "expert":
      return "GetAIMoveExpert";
  }
}
