# Quaridor Game

A browser implementation of the board game Quoridor built with React, TypeScript and Vite. Includes 1v1 and 4-player modes, an AI opponent implemented with a Minimax search (alpha-beta pruning), and offloaded AI computation via a Web Worker.

--

## Features

- Play Quoridor in 1v1 or 4-player mode
- Local AI opponent with four difficulty levels: `easy`, `normal`, `hard`
- AI runs in a Web Worker to keep the UI responsive (`src/workers/minimaxWorker.ts`)
- Complete rule enforcement (valid moves, wall placement, path checks) in `src/Managers/OfflineGameManager.ts`
- Lightweight React + TypeScript frontend using Vite

## Quick start

Prerequisites: Node.js (>=16), npm or yarn.

Install dependencies:

```
npm install
```

Run development server with hot reload:

```
npm run dev
```

Build for production:

```
npm run build
```

Preview a production build:

```
npm run preview
```

Open the app in your browser (Vite will print the URL, usually `http://localhost:5173`).

## Project structure (high level)

- `src/` — application source
  - `components/` — React UI components (board, pawn, wall, menus)
  - `context/` — `GameContext`, game state factory and example states
  - `Managers/` — game rules, AI client, and offline manager (game logic)
  - `workers/` — Web Worker entry for Minimax AI

Key files:

- [src/Managers/OfflineGameManager.ts](src/Managers/OfflineGameManager.ts) — Game rules, move generation, Minimax implementation, evaluation function and path checks.
- [src/workers/minimaxWorker.ts](src/workers/minimaxWorker.ts) — Worker entry that calls `OfflineGameManager` to compute AI moves.
- [src/Managers/MinimaxWorkerClient.ts](src/Managers/MinimaxWorkerClient.ts) — Client that communicates with the worker and enforces a timeout.
- [src/context/GameStateFactory.ts](src/context/GameStateFactory.ts) — Helpers to create 2-player and 4-player initial game states.
- [src/context/GameContext.tsx](src/context/GameContext.tsx) — React context that holds the `GameState` and controls.

## Architecture & main ideas

- Game state is represented by the `GameState` interface in `src/context/GameContext.tsx`. It contains player positions, remaining walls, board size and placed walls.
- `OfflineGameManager` contains the complete game engine: rules for valid moves and walls, pathfinding checks to ensure walls don't block all players, and a Minimax implementation using alpha-beta pruning.
- The AI search is offloaded to a Web Worker (`minimaxWorker.ts`) so the UI thread remains snappy. The worker protocol is simple message passing with an enforced timeout (`MinimaxWorkerClient` defaults to 2500ms).
- Minimax depths per difficulty:
  - `easy` → depth 1
  - `normal` → depth 2
  - `hard` → depth 3

## Extending or testing the AI

- To experiment with evaluation or search, modify `OfflineGameManager.evaluateGameState` or adjust the search depth mapping in `getAIDepth`.
- To run the AI on the main thread (for debugging), you can call the manager directly: `new OfflineGameManager().GetAIMoveEasy(gameState)`.

## License

This repository does not include an explicit license file. Add one if you plan to publish or share the code.

## Demo Video

https://drive.google.com/file/d/1ZZ-5N3z52uRnvudt2AswxztYRmswV817/view?usp=sharing
