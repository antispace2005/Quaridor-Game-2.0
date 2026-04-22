import type { AiDifficulty, GameState } from "../context/GameContext";
import type { MoveResult } from "./GameManager";

type MinimaxWorkerRequest = {
  requestId: number;
  gameState: GameState;
  difficulty: AiDifficulty;
};

type MinimaxWorkerResponse = {
  requestId: number;
  result: MoveResult;
};

const WORKER_RESPONSE_TIMEOUT_MS = 2500;

export class MinimaxWorkerClient {
  private worker: Worker;
  private nextRequestId = 1;
  private workerAvailable = true;
  private pending = new Map<
    number,
    {
      resolve: (result: MoveResult) => void;
      reject: (error: Error) => void;
      timeoutId: number;
    }
  >();

  constructor() {
    this.worker = new Worker(new URL("../workers/minimaxWorker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (event: MessageEvent<MinimaxWorkerResponse>) => {
      const { requestId, result } = event.data;
      const pendingRequest = this.pending.get(requestId);
      if (!pendingRequest) {
        return;
      }

      this.pending.delete(requestId);
      clearTimeout(pendingRequest.timeoutId);
      pendingRequest.resolve(result);
    };

    this.worker.onerror = () => {
      this.workerAvailable = false;
      this.rejectAllPending(new Error("Minimax worker failed"));
    };

    this.worker.onmessageerror = () => {
      this.workerAvailable = false;
      this.rejectAllPending(new Error("Minimax worker message error"));
    };
  }

  getAIMove(gameState: GameState, difficulty: AiDifficulty): Promise<MoveResult> {
    if (!this.workerAvailable) {
      return Promise.reject(new Error("Minimax worker unavailable"));
    }

    const requestId = this.nextRequestId;
    this.nextRequestId += 1;

    return new Promise<MoveResult>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        const pendingRequest = this.pending.get(requestId);
        if (!pendingRequest) {
          return;
        }

        this.pending.delete(requestId);
        this.workerAvailable = false;
        this.worker.terminate();
        pendingRequest.reject(new Error("Minimax worker timed out"));
      }, WORKER_RESPONSE_TIMEOUT_MS);

      this.pending.set(requestId, {
        resolve,
        reject,
        timeoutId,
      });

      const payload: MinimaxWorkerRequest = {
        requestId,
        gameState,
        difficulty,
      };

      try {
        this.worker.postMessage(payload);
      } catch {
        this.pending.delete(requestId);
        clearTimeout(timeoutId);
        this.workerAvailable = false;
        this.worker.terminate();
        reject(new Error("Minimax worker postMessage failed"));
      }
    });
  }

  private rejectAllPending(error: Error): void {
    this.pending.forEach((pendingRequest) => {
      clearTimeout(pendingRequest.timeoutId);
      pendingRequest.reject(error);
    });
    this.pending.clear();
  }

  dispose(): void {
    this.rejectAllPending(new Error("Minimax worker disposed"));
    this.worker.terminate();
  }
}
