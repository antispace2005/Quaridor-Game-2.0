import type { AiDifficulty, GameState } from "../context/GameContext";
import type { MoveResult } from "../Managers/GameManager";
import { OfflineGameManager } from "../Managers/OfflineGameManager";

type MinimaxWorkerRequest = {
  requestId: number;
  gameState: GameState;
  difficulty: AiDifficulty;
};

type MinimaxWorkerResponse = {
  requestId: number;
  result: MoveResult;
};

const manager = new OfflineGameManager();

self.onmessage = (event: MessageEvent<MinimaxWorkerRequest>) => {
  const { requestId, gameState, difficulty } = event.data;

  let result: MoveResult;
  if (difficulty === "easy") {
    result = manager.GetAIMoveEasy(gameState);
  } else if (difficulty === "normal") {
    result = manager.GetAIMoveNormal(gameState);
  } else if (difficulty === "hard") {
    result = manager.GetAIMoveHard(gameState);
  } else {
    result = manager.GetAIMoveExpert(gameState);
  }

  const response: MinimaxWorkerResponse = {
    requestId,
    result,
  };

  self.postMessage(response);
};
