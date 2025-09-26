# Solitaire Game Collection

A desktop solitaire game collection built with Electron, React, and TypeScript.

## Features

- Multiple solitaire game variants (Klondike, Spider, FreeCell)
- Intuitive drag-and-drop gameplay
- Offline functionality
- Statistics tracking
- Smooth animations and sound effects

## Development Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

This will start both the Electron main process and the Vite development server for the renderer process.

### Building

Build the application for production:
```bash
npm run build
```

Package the application:
```bash
npm run package
```

### Testing

Run tests:
```bash
npm test
```

Run a subset of the tests:
```powershell
npx vitest run <subset>
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Project Structure

```
src/
├── main/           # Electron main process
├── renderer/       # React renderer process
├── components/     # React components
├── engines/        # Game engine implementations
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── test/           # Test setup and utilities

assets/             # Game assets (images, sounds)
```

## Architecture

The application uses a modular architecture with separate game engines for each solitaire variant, unified card rendering system, and persistent state management.

## Logging

The application includes comprehensive logging for debugging purposes:

- **Log Files**: Timestamped log files are created in the user data directory (`logs/solitaire-YYYY-MM-DDTHH-MM-SS.log`)
- **Log Levels**: DEBUG, INFO, WARN, ERROR with configurable filtering
- **Categories**: Game actions, UI interactions, performance metrics, errors, and system events
- **IPC Integration**: Renderer process logs are sent to main process via Electron IPC
- **Console Fallback**: Development mode shows logs in console, production falls back if IPC fails

### Log Categories

- `GAME`: Game engine actions (moves, initialization, win conditions)
- `UI`: User interface interactions (button clicks, navigation)
- `STORAGE`: Game state persistence operations
- `PERF`: Performance timing measurements
- `ERROR`: Error conditions and stack traces
- `SYSTEM`: Application lifecycle events
- `COMPONENT`: React component lifecycle (mount/unmount)

### Accessing Logs

Log files are stored in:
- **Windows**: `%APPDATA%/solitaire-game-collection/logs/`
- **macOS**: `~/Library/Application Support/solitaire-game-collection/logs/`
- **Linux**: `~/.config/solitaire-game-collection/logs/`