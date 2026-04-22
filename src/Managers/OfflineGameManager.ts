import type { AiDifficulty, GameState } from "../context/GameContext";
import type {
  GameManager,
  MoveDirection,
  MoveResult,
  ValidMoves,
  WallPosition,
} from "./GameManager";

type PlayerKey = keyof GameState["players"];

const PLAYER_ORDER: PlayerKey[] = ["player1", "player2", "player3", "player4"];

interface FloodPathResult {
  found: boolean;
  movesNeeded: number;
  moves: MoveDirection[];
  exploredNodes: string[];
}

interface TileLayout {
  tilePositions: Array<{ x: number; y: number }>;
  tileBits: bigint[];
  singleBitToIndex: Map<bigint, number>;
  tilesPerRow: number;
}

export class OfflineGameManager implements GameManager {
  private tileLayoutByGridLimit = new Map<number, TileLayout>();
  private aiPlayerKey: PlayerKey | null = null;
  private aiPlayerId: 0 | 1 | 2 | 3 | null = null;

  GetValidMoves(gameState: GameState): ValidMoves {
    if (gameState.status !== "in_progress") {
      return {
        validPlayerMoves: [],
        validWallPlacements: [],
      };
    }


    return {
      validPlayerMoves: this.getValidPlayerMoves(gameState),
      validWallPlacements: this.getValidWallPlacements(gameState),
    };
  }

  private floodShortestPath(gameState: GameState, playerId: 0 | 1 | 2 | 3): FloodPathResult {
    const playerKey = this.getPlayerKeyFromPlayerId(playerId);
    const player = playerKey ? gameState.players[playerKey] : undefined;

    if (!player) {
      return {
        found: false,
        movesNeeded: 0,
        moves: [],
        exploredNodes: [],
      };
    }

    const gridLimit = gameState.boardSize * 2 - 1;
    const gridSize = gridLimit * gridLimit;
    const occupiedGrid = new Uint8Array(gridSize);
    const blockedGrid = new Uint8Array(gridSize);

    PLAYER_ORDER.forEach((otherPlayerKey) => {
      if (otherPlayerKey === playerKey) {
        return;
      }

      const otherPlayer = gameState.players[otherPlayerKey];
      if (!otherPlayer) {
        return;
      }

      occupiedGrid[otherPlayer.position.y * gridLimit + otherPlayer.position.x] = 1;
    });

    gameState.walls.forEach((wall) => {
      const blockedCells = this.getWallBlockedCells(wall);
      blockedCells.forEach((cell) => {
        blockedGrid[cell.y * gridLimit + cell.x] = 1;
      });
    });

    const isTileInside = (x: number, y: number) => (
      x >= 0 && y >= 0 && x < gridLimit && y < gridLimit
    );
    const isOccupied = (x: number, y: number) => occupiedGrid[y * gridLimit + x] === 1;
    const isBlocked = (x: number, y: number) => blockedGrid[y * gridLimit + x] === 1;
    const getIndexFromCoords = (x: number, y: number): number => {
      const tileX = x / 2;
      const tileY = y / 2;
      return tileY * tilesPerRow + tileX;
    };

    const exploredNodes: string[] = [];
    const { tilePositions, tileBits, singleBitToIndex, tilesPerRow } = this.getTileLayout(gridLimit);

    const startIndex = this.getTileIndexFromPosition(player.position, tilesPerRow);
    if (startIndex === undefined) {
      return {
        found: false,
        movesNeeded: 0,
        moves: [],
        exploredNodes,
      };
    }

    const adjacencyMasks: Array<bigint | undefined> = new Array<bigint | undefined>(tilePositions.length);
    let goalMask = 0n;

    tilePositions.forEach((position, index) => {
      if (this.hasPlayerReachedGoal(player, position)) {
        goalMask |= tileBits[index];
      }
    });

    const getAdjacencyMask = (nodeIndex: number): bigint => {
      const cachedAdjacencyMask = adjacencyMasks[nodeIndex];
      if (cachedAdjacencyMask !== undefined) {
        return cachedAdjacencyMask;
      }

      let adjacencyMask = 0n;
      const position = tilePositions[nodeIndex];

      const addDirectionMoves = (
        moveX: number,
        moveY: number,
        wallX: number,
        wallY: number,
        diagonalA: { landingX: number; landingY: number; wallCheckX: number; wallCheckY: number },
        diagonalB: { landingX: number; landingY: number; wallCheckX: number; wallCheckY: number },
      ) => {
        const targetX = position.x + moveX;
        const targetY = position.y + moveY;
        const wallPosX = position.x + wallX;
        const wallPosY = position.y + wallY;

        if (!isTileInside(targetX, targetY) || isBlocked(wallPosX, wallPosY)) {
          return;
        }

        if (!isOccupied(targetX, targetY)) {
          const nextIndex = getIndexFromCoords(targetX, targetY);
          adjacencyMask |= tileBits[nextIndex];
          return;
        }

        const jumpX = position.x + moveX * 2;
        const jumpY = position.y + moveY * 2;
        const jumpWallX = targetX + wallX;
        const jumpWallY = targetY + wallY;

        const jumpBlocked =
          !isTileInside(jumpX, jumpY) ||
          isBlocked(jumpWallX, jumpWallY);

        if (!jumpBlocked && !isOccupied(jumpX, jumpY)) {
          const jumpIndex = getIndexFromCoords(jumpX, jumpY);
          adjacencyMask |= tileBits[jumpIndex];
          return;
        }

        const diagAX = position.x + diagonalA.landingX;
        const diagAY = position.y + diagonalA.landingY;
        const diagAWallX = position.x + diagonalA.wallCheckX;
        const diagAWallY = position.y + diagonalA.wallCheckY;
        if (
          isTileInside(diagAX, diagAY) &&
          !isBlocked(diagAWallX, diagAWallY) &&
          !isOccupied(diagAX, diagAY)
        ) {
          const diagonalIndex = getIndexFromCoords(diagAX, diagAY);
          adjacencyMask |= tileBits[diagonalIndex];
        }

        const diagBX = position.x + diagonalB.landingX;
        const diagBY = position.y + diagonalB.landingY;
        const diagBWallX = position.x + diagonalB.wallCheckX;
        const diagBWallY = position.y + diagonalB.wallCheckY;
        if (
          isTileInside(diagBX, diagBY) &&
          !isBlocked(diagBWallX, diagBWallY) &&
          !isOccupied(diagBX, diagBY)
        ) {
          const diagonalIndex = getIndexFromCoords(diagBX, diagBY);
          adjacencyMask |= tileBits[diagonalIndex];
        }
      };

      // up
      addDirectionMoves(
        0,
        -2,
        0,
        -1,
        { landingX: -2, landingY: -2, wallCheckX: -1, wallCheckY: -2 },
        { landingX: 2, landingY: -2, wallCheckX: 1, wallCheckY: -2 },
      );
      // down
      addDirectionMoves(
        0,
        2,
        0,
        1,
        { landingX: -2, landingY: 2, wallCheckX: -1, wallCheckY: 2 },
        { landingX: 2, landingY: 2, wallCheckX: 1, wallCheckY: 2 },
      );
      // left
      addDirectionMoves(
        -2,
        0,
        -1,
        0,
        { landingX: -2, landingY: -2, wallCheckX: -2, wallCheckY: -1 },
        { landingX: -2, landingY: 2, wallCheckX: -2, wallCheckY: 1 },
      );
      // right
      addDirectionMoves(
        2,
        0,
        1,
        0,
        { landingX: 2, landingY: -2, wallCheckX: 2, wallCheckY: -1 },
        { landingX: 2, landingY: 2, wallCheckX: 2, wallCheckY: 1 },
      );

      adjacencyMasks[nodeIndex] = adjacencyMask;
      return adjacencyMask;
    };

    let movesNeeded = 0;
    let visitedMask = tileBits[startIndex];
    let frontierMask = visitedMask;

    while (frontierMask !== 0n) {
      if ((frontierMask & goalMask) !== 0n) {
        return {
          found: true,
          movesNeeded,
          moves: [],
          exploredNodes,
        };
      }

      let nextFrontierMask = 0n;
      this.forEachSetIndex(frontierMask, singleBitToIndex, (nodeIndex) => {
        nextFrontierMask |= getAdjacencyMask(nodeIndex);
      });

      nextFrontierMask &= ~visitedMask;
      if (nextFrontierMask === 0n) {
        break;
      }

      visitedMask |= nextFrontierMask;
      frontierMask = nextFrontierMask;
      movesNeeded += 1;
    }

    return {
      found: false,
      movesNeeded: 0,
      moves: [],
      exploredNodes,
    };
  }

  private getTileLayout(gridLimit: number): TileLayout {
    const cachedLayout = this.tileLayoutByGridLimit.get(gridLimit);
    if (cachedLayout) {
      return cachedLayout;
    }

    const tilePositions: Array<{ x: number; y: number }> = [];
    const tilesPerRow = (gridLimit + 1) / 2;

    for (let y = 0; y < gridLimit; y += 2) {
      for (let x = 0; x < gridLimit; x += 2) {
        tilePositions.push({ x, y });
      }
    }

    const tileBits = tilePositions.map((_, index) => 1n << BigInt(index));
    const singleBitToIndex = new Map<bigint, number>();
    tileBits.forEach((bit, index) => {
      singleBitToIndex.set(bit, index);
    });

    const layout = {
      tilePositions,
      tileBits,
      singleBitToIndex,
      tilesPerRow,
    };

    this.tileLayoutByGridLimit.set(gridLimit, layout);
    return layout;
  }

  private forEachSetIndex(
    mask: bigint,
    singleBitToIndex: Map<bigint, number>,
    callback: (index: number) => void,
  ) {
    let remainingMask = mask;

    while (remainingMask !== 0n) {
      const leastSignificantBit = remainingMask & -remainingMask;
      const nodeIndex = singleBitToIndex.get(leastSignificantBit);
      if (nodeIndex !== undefined) {
        callback(nodeIndex);
      }

      remainingMask ^= leastSignificantBit;
    }
  }


  private getTileIndexFromPosition(
    position: { x: number; y: number },
    tilesPerRow: number,
  ): number | undefined {
    if (position.x % 2 !== 0 || position.y % 2 !== 0) {
      return undefined;
    }

    const tileX = position.x / 2;
    const tileY = position.y / 2;
    if (tileX < 0 || tileY < 0 || tileX >= tilesPerRow || tileY >= tilesPerRow) {
      return undefined;
    }

    return tileY * tilesPerRow + tileX;
  }
  private hasPathDepthFirstSearch(gameState: GameState, playerId: 0 | 1 | 2 | 3): boolean {
    const playerKey = this.getPlayerKeyFromPlayerId(playerId);
    const player = playerKey ? gameState.players[playerKey] : undefined;

    if (!player) {
      return false;
    }

    const gridLimit = gameState.boardSize * 2 - 1;
    const gridSize = gridLimit * gridLimit;
    const occupiedGrid = new Uint8Array(gridSize);
    const blockedGrid = new Uint8Array(gridSize);

    PLAYER_ORDER.forEach((otherPlayerKey) => {
      if (otherPlayerKey === playerKey) {
        return;
      }

      const otherPlayer = gameState.players[otherPlayerKey];
      if (!otherPlayer) {
        return;
      }

      occupiedGrid[otherPlayer.position.y * gridLimit + otherPlayer.position.x] = 1;
    });

    gameState.walls.forEach((wall) => {
      const blockedCells = this.getWallBlockedCells(wall);
      blockedCells.forEach((cell) => {
        blockedGrid[cell.y * gridLimit + cell.x] = 1;
      });
    });

    return this.hasPathDepthFirstSearchWithGrids(player, occupiedGrid, blockedGrid, gridLimit, gridSize);
  }

  private hasPathDepthFirstSearchWithGrids(
    player: NonNullable<GameState["players"][PlayerKey]>,
    occupiedGrid: Uint8Array,
    blockedGrid: Uint8Array,
    gridLimit: number,
    gridSize: number,
  ): boolean {
    const visitedGrid = new Uint8Array(gridSize);

    const isTileInside = (x: number, y: number) => (
      x >= 0 && y >= 0 && x < gridLimit && y < gridLimit
    );
    const isOccupied = (x: number, y: number) => occupiedGrid[y * gridLimit + x] === 1;
    const isBlocked = (x: number, y: number) => blockedGrid[y * gridLimit + x] === 1;

    const stack: Array<{ x: number; y: number }> = [player.position];

    const tryPushDirectionMoves = (
      position: { x: number; y: number },
      moveX: number,
      moveY: number,
      wallX: number,
      wallY: number,
      diagonalA: { landingX: number; landingY: number; wallCheckX: number; wallCheckY: number },
      diagonalB: { landingX: number; landingY: number; wallCheckX: number; wallCheckY: number },
    ) => {
      const targetX = position.x + moveX;
      const targetY = position.y + moveY;
      const wallPosX = position.x + wallX;
      const wallPosY = position.y + wallY;

      if (!isTileInside(targetX, targetY) || isBlocked(wallPosX, wallPosY)) {
        return;
      }

      if (!isOccupied(targetX, targetY)) {
        stack.push({ x: targetX, y: targetY });
        return;
      }

      const jumpX = position.x + moveX * 2;
      const jumpY = position.y + moveY * 2;
      const jumpWallX = targetX + wallX;
      const jumpWallY = targetY + wallY;

      const jumpBlocked =
        !isTileInside(jumpX, jumpY) ||
        isBlocked(jumpWallX, jumpWallY);

      if (!jumpBlocked && !isOccupied(jumpX, jumpY)) {
        stack.push({ x: jumpX, y: jumpY });
        return;
      }

      const diagAX = position.x + diagonalA.landingX;
      const diagAY = position.y + diagonalA.landingY;
      const diagAWallX = position.x + diagonalA.wallCheckX;
      const diagAWallY = position.y + diagonalA.wallCheckY;
      if (
        isTileInside(diagAX, diagAY) &&
        !isBlocked(diagAWallX, diagAWallY) &&
        !isOccupied(diagAX, diagAY)
      ) {
        stack.push({ x: diagAX, y: diagAY });
      }

      const diagBX = position.x + diagonalB.landingX;
      const diagBY = position.y + diagonalB.landingY;
      const diagBWallX = position.x + diagonalB.wallCheckX;
      const diagBWallY = position.y + diagonalB.wallCheckY;
      if (
        isTileInside(diagBX, diagBY) &&
        !isBlocked(diagBWallX, diagBWallY) &&
        !isOccupied(diagBX, diagBY)
      ) {
        stack.push({ x: diagBX, y: diagBY });
      }
    };

    while (stack.length > 0) {
      const position = stack.pop();
      if (!position) {
        break;
      }

      const index = position.y * gridLimit + position.x;
      if (visitedGrid[index] === 1) {
        continue;
      }

      visitedGrid[index] = 1;

      if (this.hasPlayerReachedGoal(player, position)) {
        return true;
      }

      // up
      tryPushDirectionMoves(
        position,
        0,
        -2,
        0,
        -1,
        { landingX: -2, landingY: -2, wallCheckX: -1, wallCheckY: -2 },
        { landingX: 2, landingY: -2, wallCheckX: 1, wallCheckY: -2 },
      );
      // down
      tryPushDirectionMoves(
        position,
        0,
        2,
        0,
        1,
        { landingX: -2, landingY: 2, wallCheckX: -1, wallCheckY: 2 },
        { landingX: 2, landingY: 2, wallCheckX: 1, wallCheckY: 2 },
      );
      // left
      tryPushDirectionMoves(
        position,
        -2,
        0,
        -1,
        0,
        { landingX: -2, landingY: -2, wallCheckX: -2, wallCheckY: -1 },
        { landingX: -2, landingY: 2, wallCheckX: -2, wallCheckY: 1 },
      );
      // right
      tryPushDirectionMoves(
        position,
        2,
        0,
        1,
        0,
        { landingX: 2, landingY: -2, wallCheckX: 2, wallCheckY: -1 },
        { landingX: 2, landingY: 2, wallCheckX: 2, wallCheckY: 1 },
      );
    }

    return false;
  }

  MovePlayer(gameState: GameState, direction: MoveDirection): MoveResult {
    if (gameState.status !== "in_progress") {
      return {
        gameState,
        isSuccess: false,
      };
    }

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
    const hasWon = this.hasPlayerReachedGoal(currentPlayer, nextPosition);
    const nextTurn = this.getNextTurn(gameState);

    return {
      gameState: {
        ...gameState,
        status: hasWon ? "finished" : gameState.status,
        turn: hasWon ? currentPlayerKey : nextTurn,
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
    if (gameState.status !== "in_progress") {
      return {
        gameState,
        isSuccess: false,
      };
    }

    const currentPlayerKey = gameState.turn;
    const currentPlayer = gameState.players[currentPlayerKey];
    const currentPlayerId = this.getPlayerIdFromTurn(currentPlayerKey);

    if (!currentPlayer || currentPlayerId === undefined) {
      return {
        gameState,
        isSuccess: false,
      };
    }

    if (currentPlayer.wallsRemaining <= 0) {
      return {
        gameState,
        isSuccess: false,
      };
    }

    const validWallPlacements = this.GetValidMoves(gameState).validWallPlacements;
    const isPlacementValid = validWallPlacements.some(
      (wallPosition) => wallPosition.x === position.x && wallPosition.y === position.y,
    );

    if (!isPlacementValid) {
      return {
        gameState,
        isSuccess: false,
      };
    }
    
    const gameStateAfterWall: GameState = {
      ...gameState,
      walls: [...gameState.walls, { ...position, playerId: currentPlayerId }],
    };

    const shouldSkipPathCheck = currentPlayer.wallsRemaining < gameState.boardSize / 2;
    const allPlayersStillHavePath = shouldSkipPathCheck || this.getActivePlayerIds(gameStateAfterWall).every(
      (playerId) => this.hasPathDepthFirstSearch(gameStateAfterWall, playerId),
    );

    if (!allPlayersStillHavePath) {
      return {
        gameState,
        isSuccess: false,
      };
    }

    return {
      gameState: {
        ...gameStateAfterWall,
        turn: this.getNextTurn(gameStateAfterWall),
        players: {
          ...gameStateAfterWall.players,
          [currentPlayerKey]: {
            ...currentPlayer,
            wallsRemaining: currentPlayer.wallsRemaining - 1,
          },
        },
      },
      isSuccess: true,
    };
  }

  GetAIMoveEasy(gameState: GameState): MoveResult {
    return this.runAIMinimax(gameState, this.getAIDepth("easy"));
  }

  GetAIMoveNormal(gameState: GameState): MoveResult {
    return this.runAIMinimax(gameState, this.getAIDepth("normal"));
  }

  GetAIMoveHard(gameState: GameState): MoveResult {
    return this.runAIMinimax(gameState, this.getAIDepth("hard"));
  }

  GetAIMoveExpert(gameState: GameState): MoveResult {
    return this.runAIMinimax(gameState, this.getAIDepth("expert"));
  }

  private runAIMinimax(gameState: GameState, depth: number): MoveResult {
    if (gameState.status !== "in_progress") {
      return {
        gameState,
        isSuccess: false,
      };
    }

    this.aiPlayerKey = gameState.turn as PlayerKey;
    this.aiPlayerId = this.getPlayerIdFromPlayerKey(this.aiPlayerKey) ?? null;

    if (this.aiPlayerId === null) {
      return {
        gameState,
        isSuccess: false,
      };
    }
    const searchResult = this.minimax(gameState, depth, -Infinity, Infinity);

    if (!searchResult.moveResult) {
      return {
        gameState,
        isSuccess: false,
      };
    }

    return searchResult.moveResult;
  }

  private minimax(
    gameState: GameState,
    depth: number,
    alpha: number,
    beta: number,
  ): { score: number; moveResult: MoveResult | null } {
    if (!this.aiPlayerKey || this.aiPlayerId === null) {
      return {
        score: Number.NEGATIVE_INFINITY,
        moveResult: null,
      };
    }

    if (depth === 0 || gameState.status !== "in_progress") {
      const score = this.evaluateGameState(gameState);

      return {
        score,
        moveResult: null,
      };
    }

    const actions = this.getCandidateActions(gameState);

    if (actions.length === 0) {
      const score = this.evaluateGameState(gameState);

      return {
        score,
        moveResult: null,
      };
    }

    const maximizing = gameState.turn === this.aiPlayerKey;
    let bestScore = maximizing ? -Infinity : Infinity;
    let bestMoveResult: MoveResult | null = null;

    for (const action of actions) {
      const childResult = this.applyAction(gameState, action);

      if (!childResult.isSuccess) {
        continue;
      }

      const searchResult = this.minimax(
        childResult.gameState,
        depth - 1,
        alpha,
        beta,
      );

      if (maximizing) {
        if (searchResult.score > bestScore || !bestMoveResult) {
          bestScore = searchResult.score;
          bestMoveResult = childResult;
        }

        alpha = Math.max(alpha, bestScore);
      } else {
        if (searchResult.score < bestScore || !bestMoveResult) {
          bestScore = searchResult.score;
          bestMoveResult = childResult;
        }

        beta = Math.min(beta, bestScore);
      }

      if (beta <= alpha) {
        break;
      }
    }

    return {
      score: bestScore,
      moveResult: bestMoveResult,
    };
  }

  private getCandidateActions(gameState: GameState): Array<
    | { kind: "move"; direction: MoveDirection }
    | { kind: "wall"; position: WallPosition }
  > {
    const validMoves = this.GetValidMoves(gameState);
    const actions: Array<
      | { kind: "move"; direction: MoveDirection }
      | { kind: "wall"; position: WallPosition }
    > = validMoves.validPlayerMoves.map((direction) => ({
      kind: "move",
      direction,
    }));

    const currentPlayer = this.getCurrentPlayer(gameState);
    if (currentPlayer && currentPlayer.wallsRemaining > 0) {
      validMoves.validWallPlacements.forEach((position) => {
        actions.push({
          kind: "wall",
          position,
        });
      });
    }

    return actions;
  }

  private applyAction(
    gameState: GameState,
    action:
      | { kind: "move"; direction: MoveDirection }
      | { kind: "wall"; position: WallPosition },
  ): MoveResult {
    if (action.kind === "move") {
      return this.applyMoveWithoutValidation(gameState, action.direction);
    }

    return this.applyWallWithoutValidation(gameState, action.position);
  }

  private applyMoveWithoutValidation(
    gameState: GameState,
    direction: MoveDirection,
  ): MoveResult {
    const currentPlayerKey = gameState.turn;
    const currentPlayer = gameState.players[currentPlayerKey];

    if (!currentPlayer) {
      return {
        gameState,
        isSuccess: false,
      };
    }

    const nextPosition = this.getNextPosition(currentPlayer.position, direction);
    const hasWon = this.hasPlayerReachedGoal(currentPlayer, nextPosition);
    const nextTurn = this.getNextTurn(gameState);

    return {
      gameState: {
        ...gameState,
        status: hasWon ? "finished" : gameState.status,
        turn: hasWon ? currentPlayerKey : nextTurn,
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

  private applyWallWithoutValidation(
    gameState: GameState,
    position: WallPosition,
  ): MoveResult {
    if (gameState.status !== "in_progress") {
      return {
        gameState,
        isSuccess: false,
      };
    }

    const currentPlayerKey = gameState.turn;
    const currentPlayer = gameState.players[currentPlayerKey];
    const currentPlayerId = this.getPlayerIdFromTurn(currentPlayerKey);

    if (!currentPlayer || currentPlayerId === undefined || currentPlayer.wallsRemaining <= 0) {
      return {
        gameState,
        isSuccess: false,
      };
    }

    const gameStateAfterWall: GameState = {
      ...gameState,
      walls: [...gameState.walls, { ...position, playerId: currentPlayerId }],
    };

    return {
      gameState: {
        ...gameStateAfterWall,
        turn: this.getNextTurn(gameStateAfterWall),
        players: {
          ...gameStateAfterWall.players,
          [currentPlayerKey]: {
            ...currentPlayer,
            wallsRemaining: currentPlayer.wallsRemaining - 1,
          },
        },
      },
      isSuccess: true,
    };
  }

  private getAIDepth(difficulty: AiDifficulty): number {
    switch (difficulty) {
      case "easy":
        return 1;
      case "normal":
        return 2;
      case "hard":
        return 3;
      case "expert":
        return 4;
    }
  }

  private evaluateGameState(gameState: GameState): number {
    if (!this.aiPlayerKey || this.aiPlayerId === null) {
      return Number.NEGATIVE_INFINITY;
    }

    if (gameState.status === "finished") {
      return gameState.turn === this.aiPlayerKey ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    }

    const aiPath = this.getShortestPathMovesNeeded(gameState, this.aiPlayerId);
    if (!Number.isFinite(aiPath)) {
      return Number.NEGATIVE_INFINITY;
    }

    const opponentPlayerIds = this.getActivePlayerIds(gameState).filter((playerId) => playerId !== this.aiPlayerId);
    const opponentPaths = opponentPlayerIds
      .map((playerId) => this.getShortestPathMovesNeeded(gameState, playerId))
      .filter((pathLength) => Number.isFinite(pathLength));

    const closestOpponentPath = opponentPaths.length > 0 ? Math.min(...opponentPaths) : aiPath;
    const aiWallsRemaining = gameState.players[this.aiPlayerKey]?.wallsRemaining ?? 0;
    const opponentWalls = opponentPlayerIds
      .map((playerId) => {
        const playerKey = this.getPlayerKeyFromPlayerId(playerId);
        return playerKey ? gameState.players[playerKey]?.wallsRemaining ?? 0 : 0;
      })
      .filter((wallsRemaining) => Number.isFinite(wallsRemaining));
    const averageOpponentWalls = opponentWalls.length > 0
      ? opponentWalls.reduce((totalWalls, wallsRemaining) => totalWalls + wallsRemaining, 0) / opponentWalls.length
      : 0;

    const pathScore = (closestOpponentPath - aiPath) * 100;
    const wallScore = (aiWallsRemaining - averageOpponentWalls) * 10;

    return pathScore + wallScore;
  }

  private getShortestPathMovesNeeded(gameState: GameState, playerId: 0 | 1 | 2 | 3): number {
    const result = this.floodShortestPath(gameState, playerId);

    return result.found ? result.movesNeeded : Number.POSITIVE_INFINITY;
  }

  private getPlayerIdFromPlayerKey(playerKey: PlayerKey): 0 | 1 | 2 | 3 | undefined {
    const playerIndex = PLAYER_ORDER.indexOf(playerKey);
    if (playerIndex < 0) {
      return undefined;
    }

    return playerIndex as 0 | 1 | 2 | 3;
  }

  private getValidPlayerMoves(gameState: GameState): MoveDirection[] {
    const currentPlayer = this.getCurrentPlayer(gameState);
    if (!currentPlayer) {
      return [];
    }

    const currentPosition = currentPlayer.position;
    const occupiedTiles = this.getOccupiedTiles(gameState, gameState.turn);
    const movementBlockSet = this.getMovementBlockSet(gameState);
    const gridLimit = gameState.boardSize * 2 - 1;

    return this.getValidPlayerMovesFromPosition(
      currentPosition,
      occupiedTiles,
      movementBlockSet,
      gridLimit,
    );
  }

  private getValidWallPlacements(gameState: GameState): WallPosition[] {
    const validWallPlacements: WallPosition[] = [];

    const currentPlayer = this.getCurrentPlayer(gameState);
    const currentPlayerId = this.getPlayerIdFromTurn(gameState.turn);
    if (!currentPlayer || currentPlayerId === undefined || currentPlayer.wallsRemaining === 0) {
      return validWallPlacements;
    }

    const wallFootprintSet = this.getWallFootprintSet(gameState);
    const gridLimit = gameState.boardSize * 2 - 1;
    const gridSize = gridLimit * gridLimit;
    const activePlayerIds = this.getActivePlayerIds(gameState);

    const allPlayersOccupiedGrid = new Uint8Array(gridSize);
    PLAYER_ORDER.forEach((playerKey) => {
      const player = gameState.players[playerKey];
      if (!player) {
        return;
      }

      allPlayersOccupiedGrid[player.position.y * gridLimit + player.position.x] = 1;
    });

    const occupiedGridByPlayerId = new Map<0 | 1 | 2 | 3, Uint8Array>();
    activePlayerIds.forEach((playerId) => {
      const playerKey = this.getPlayerKeyFromPlayerId(playerId);
      const player = playerKey ? gameState.players[playerKey] : undefined;
      if (!player) {
        return;
      }

      const occupiedGrid = allPlayersOccupiedGrid.slice();
      occupiedGrid[player.position.y * gridLimit + player.position.x] = 0;
      occupiedGridByPlayerId.set(playerId, occupiedGrid);
    });

    const blockedGrid = new Uint8Array(gridSize);
    gameState.walls.forEach((wall) => {
      const blockedCells = this.getWallBlockedCells(wall);
      blockedCells.forEach((cell) => {
        blockedGrid[cell.y * gridLimit + cell.x] = 1;
      });
    });

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

        if (this.isWallPlacementOverlapping({ x, y }, wallFootprintSet)) {
          continue;
        }

        const candidateBlockedCells = this.getWallBlockedCells({ x, y });
        const previousBlockValues: number[] = [];
        candidateBlockedCells.forEach((cell) => {
          const index = cell.y * gridLimit + cell.x;
          previousBlockValues.push(blockedGrid[index]);
          blockedGrid[index] = 1;
        });

        const allPlayersStillHavePath = activePlayerIds.every((playerId) => {
          const playerKey = this.getPlayerKeyFromPlayerId(playerId);
          const player = playerKey ? gameState.players[playerKey] : undefined;
          const occupiedGrid = occupiedGridByPlayerId.get(playerId);
          if (!player || !occupiedGrid) {
            return false;
          }

          return this.hasPathDepthFirstSearchWithGrids(player, occupiedGrid, blockedGrid, gridLimit, gridSize);
        });

        candidateBlockedCells.forEach((cell, index) => {
          blockedGrid[cell.y * gridLimit + cell.x] = previousBlockValues[index] ?? 0;
        });

        if (!allPlayersStillHavePath) {
          continue;
        }

        validWallPlacements.push({ x, y });
      }
    }

    return validWallPlacements;
  }

  private getValidPlayerMovesFromPosition(
    currentPosition: { x: number; y: number },
    occupiedTiles: Set<string>,
    movementBlockSet: Set<string>,
    gridLimit: number,
  ): MoveDirection[] {
    const validMoves: MoveDirection[] = [];

    this.evaluateDirection({
      direction: "up",
      currentPosition,
      occupiedTiles,
      movementBlockSet,
      gridLimit,
      validMoves,
    });
    this.evaluateDirection({
      direction: "down",
      currentPosition,
      occupiedTiles,
      movementBlockSet,
      gridLimit,
      validMoves,
    });
    this.evaluateDirection({
      direction: "left",
      currentPosition,
      occupiedTiles,
      movementBlockSet,
      gridLimit,
      validMoves,
    });
    this.evaluateDirection({
      direction: "right",
      currentPosition,
      occupiedTiles,
      movementBlockSet,
      gridLimit,
      validMoves,
    });

    return validMoves;
  }

  private evaluateDirection({
    direction,
    currentPosition,
    occupiedTiles,
    movementBlockSet,
    gridLimit,
    validMoves,
  }: {
    direction: Exclude<MoveDirection, "upJump" | "downJump" | "leftJump" | "rightJump" | "upRight" | "upLeft" | "downRight" | "downLeft">;
    currentPosition: { x: number; y: number };
    occupiedTiles: Set<string>;
    movementBlockSet: Set<string>;
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

    if (!this.isInsideBoard(targetPosition, gridLimit) || movementBlockSet.has(this.toKey(wallPosition.x, wallPosition.y))) {
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
      movementBlockSet.has(this.toKey(jumpWallPosition.x, jumpWallPosition.y));

    if (!jumpBlocked && !occupiedTiles.has(this.toKey(jumpPosition.x, jumpPosition.y))) {
      validMoves.push(this.toJumpDirection(direction));
      return;
    }

    this.addDiagonalMoves({
      direction,
      currentPosition,
      occupiedTiles,
      movementBlockSet,
      gridLimit,
      validMoves,
    });
  }

  private addDiagonalMoves({
    direction,
    currentPosition,
    occupiedTiles,
    movementBlockSet,
    gridLimit,
    validMoves,
  }: {
    direction: Exclude<MoveDirection, "upJump" | "downJump" | "leftJump" | "rightJump" | "upRight" | "upLeft" | "downRight" | "downLeft">;
    currentPosition: { x: number; y: number };
    occupiedTiles: Set<string>;
    movementBlockSet: Set<string>;
    gridLimit: number;
    validMoves: MoveDirection[];
  }) {
    const diagonals = this.getDiagonalChecks(direction, currentPosition);

    diagonals.forEach(({ moveDirection, landingPosition, wallCheckPosition }) => {
      if (!this.isInsideBoard(landingPosition, gridLimit)) {
        return;
      }

      if (movementBlockSet.has(this.toKey(wallCheckPosition.x, wallCheckPosition.y))) {
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

  private getPlayerKeyFromPlayerId(playerId: 0 | 1 | 2 | 3): PlayerKey | undefined {
    return PLAYER_ORDER[playerId];
  }

  private getPlayerIdFromTurn(turn: GameState["turn"]): 0 | 1 | 2 | 3 | undefined {
    const playerIndex = PLAYER_ORDER.indexOf(turn as PlayerKey);
    if (playerIndex < 0) {
      return undefined;
    }

    return playerIndex as 0 | 1 | 2 | 3;
  }

  private getActivePlayerIds(gameState: GameState): Array<0 | 1 | 2 | 3> {
    return PLAYER_ORDER.reduce<Array<0 | 1 | 2 | 3>>((activePlayerIds, playerKey, index) => {
      if (gameState.players[playerKey]) {
        activePlayerIds.push(index as 0 | 1 | 2 | 3);
      }

      return activePlayerIds;
    }, []);
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

  private getOccupiedTiles(gameState: GameState, excludePlayerKey?: PlayerKey): Set<string> {
    const occupiedTiles = new Set<string>();

    PLAYER_ORDER.forEach((playerKey) => {
      if (playerKey === excludePlayerKey) {
        return;
      }

      const player = gameState.players[playerKey];
      if (!player) {
        return;
      }

      occupiedTiles.add(this.toKey(player.position.x, player.position.y));
    });

    return occupiedTiles;
  }

  private getMovementBlockSet(gameState: GameState): Set<string> {
    const movementBlockSet = new Set<string>();

    gameState.walls.forEach((wall) => {
      const blockedCells = this.getWallBlockedCells(wall);
      blockedCells.forEach((cell) => {
        movementBlockSet.add(this.toKey(cell.x, cell.y));
      });
    });

    return movementBlockSet;
  }

  private getWallFootprintSet(gameState: GameState): Set<string> {
    const wallFootprintSet = new Set<string>();

    gameState.walls.forEach((wall) => {
      const footprintCells = this.getWallFootprintCells(wall);
      footprintCells.forEach((cell) => {
        wallFootprintSet.add(this.toKey(cell.x, cell.y));
      });
    });

    return wallFootprintSet;
  }

  private isWallPlacementOverlapping(
    position: WallPosition,
    wallFootprintSet: Set<string>,
  ) {
    const candidateFootprint = this.getWallFootprintCells(position);
    return candidateFootprint.some((cell) => wallFootprintSet.has(this.toKey(cell.x, cell.y)));
  }

  private getWallFootprintCells(position: WallPosition) {
    const isVertical = position.x % 2 === 1 && position.y % 2 === 0;

    if (isVertical) {
      return [
        { x: position.x, y: position.y },
        { x: position.x, y: position.y + 1 },
        { x: position.x, y: position.y + 2 },
      ];
    }

    return [
      { x: position.x, y: position.y },
      { x: position.x + 1, y: position.y },
      { x: position.x + 2, y: position.y },
    ];
  }

  private getWallBlockedCells(position: WallPosition) {
    const isVertical = position.x % 2 === 1 && position.y % 2 === 0;

    if (isVertical) {
      return [
        { x: position.x, y: position.y },
        { x: position.x, y: position.y + 2 },
      ];
    }

    return [
      { x: position.x, y: position.y },
      { x: position.x + 2, y: position.y },
    ];
  }

  private hasPlayerReachedGoal(
    player: NonNullable<GameState["players"][PlayerKey]>,
    position: { x: number; y: number },
  ) {
    if (player.goalColumn !== undefined) {
      return position.x === player.goalColumn;
    }

    return position.y === player.goalRow;
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
