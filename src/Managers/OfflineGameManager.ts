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

export class OfflineGameManager implements GameManager {
  GetValidMoves(gameState: GameState): ValidMoves {
    if (gameState.status !== "in_progress") {
      return {
        validPlayerMoves: [],
        validWallPlacements: [],
      };
    }

    const currentPlayerId = this.getPlayerIdFromTurn(gameState.turn);
    if (currentPlayerId !== undefined) {
      if (false) {
        void this.floodShortestPath(gameState, currentPlayerId as 0 | 1 | 2 | 3);
        void this.hasPathDepthFirstSearch(gameState, currentPlayerId as 0 | 1 | 2 | 3);
      }
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

    const occupiedTiles = this.getOccupiedTiles(gameState, playerKey);
    const movementBlockSet = this.getMovementBlockSet(gameState);
    const gridLimit = gameState.boardSize * 2 - 1;
    const visited = new Set<string>([this.toKey(player.position.x, player.position.y)]);
    const exploredNodes: string[] = [];
    const queue: Array<{ position: { x: number; y: number }; moves: MoveDirection[] }> = [
      { position: player.position, moves: [] },
    ];

    while (queue.length > 0) {
      const currentNode = queue.shift();
      if (!currentNode) {
        continue;
      }

      const currentKey = this.toKey(currentNode.position.x, currentNode.position.y);
      exploredNodes.push(currentKey);

      if (this.hasPlayerReachedGoal(player, currentNode.position)) {
        return {
          found: true,
          movesNeeded: currentNode.moves.length,
          moves: currentNode.moves,
          exploredNodes,
        };
      }

      const nextMoves = this.getValidPlayerMovesFromPosition(
        currentNode.position,
        occupiedTiles,
        movementBlockSet,
        gridLimit,
      );

      nextMoves.forEach((moveDirection) => {
        const nextPosition = this.getNextPosition(currentNode.position, moveDirection);
        const nextKey = this.toKey(nextPosition.x, nextPosition.y);

        if (visited.has(nextKey)) {
          return;
        }

        visited.add(nextKey);
        queue.push({
          position: nextPosition,
          moves: [...currentNode.moves, moveDirection],
        });
      });
    }

    return {
      found: false,
      movesNeeded: 0,
      moves: [],
      exploredNodes,
    };
  }

  private hasPathDepthFirstSearch(gameState: GameState, playerId: 0 | 1 | 2 | 3): boolean {
    const playerKey = this.getPlayerKeyFromPlayerId(playerId);
    const player = playerKey ? gameState.players[playerKey] : undefined;

    if (!player) {
      return false;
    }

    const occupiedTiles = this.getOccupiedTiles(gameState, playerKey);
    const movementBlockSet = this.getMovementBlockSet(gameState);
    const gridLimit = gameState.boardSize * 2 - 1;
    const visited = new Set<string>();

    const search = (position: { x: number; y: number }): boolean => {
      const positionKey = this.toKey(position.x, position.y);
      if (visited.has(positionKey)) {
        return false;
      }

      visited.add(positionKey);

      if (this.hasPlayerReachedGoal(player, position)) {
        return true;
      }

      const nextMoves = this.getValidPlayerMovesFromPosition(
        position,
        occupiedTiles,
        movementBlockSet,
        gridLimit,
      );

      for (const moveDirection of nextMoves) {
        const nextPosition = this.getNextPosition(position, moveDirection);
        if (search(nextPosition)) {
          return true;
        }
      }

      return false;
    };

    return search(player.position);
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

    const allPlayersStillHavePath = this.getActivePlayerIds(gameStateAfterWall).every(
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

    const aiPlayerKey = gameState.turn as PlayerKey;
    const searchResult = this.minimax(gameState, depth, -Infinity, Infinity, aiPlayerKey);

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
    aiPlayerKey: PlayerKey,
  ): { score: number; moveResult: MoveResult | null } {
    if (depth === 0 || gameState.status !== "in_progress") {
      return {
        score: this.evaluateGameState(gameState, aiPlayerKey),
        moveResult: null,
      };
    }

    const actions = this.getCandidateActions(gameState);
    if (actions.length === 0) {
      return {
        score: this.evaluateGameState(gameState, aiPlayerKey),
        moveResult: null,
      };
    }

    const maximizing = gameState.turn === aiPlayerKey;
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
        aiPlayerKey,
      );

      if (maximizing) {
        if (searchResult.score > bestScore) {
          bestScore = searchResult.score;
          bestMoveResult = childResult;
        }

        alpha = Math.max(alpha, bestScore);
      } else {
        if (searchResult.score < bestScore) {
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
      return this.MovePlayer(gameState, action.direction);
    }

    return this.PlaceWall(gameState, action.position);
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

  private evaluateGameState(gameState: GameState, aiPlayerKey: PlayerKey): number {
    if (gameState.status === "finished") {
      return gameState.turn === aiPlayerKey ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    }

    const aiPlayerId = this.getPlayerIdFromPlayerKey(aiPlayerKey);
    if (aiPlayerId === undefined) {
      return Number.NEGATIVE_INFINITY;
    }

    const aiPath = this.getShortestPathMovesNeeded(gameState, aiPlayerId);
    if (!Number.isFinite(aiPath)) {
      return Number.NEGATIVE_INFINITY;
    }

    const opponentPlayerIds = this.getActivePlayerIds(gameState).filter((playerId) => playerId !== aiPlayerId);
    const opponentPaths = opponentPlayerIds
      .map((playerId) => this.getShortestPathMovesNeeded(gameState, playerId))
      .filter((pathLength) => Number.isFinite(pathLength));

    const closestOpponentPath = opponentPaths.length > 0 ? Math.min(...opponentPaths) : aiPath;
    const aiWallsRemaining = gameState.players[aiPlayerKey]?.wallsRemaining ?? 0;
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
    const wallFootprintSet = this.getWallFootprintSet(gameState);
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

        if (this.isWallPlacementOverlapping({ x, y }, wallFootprintSet)) {
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
