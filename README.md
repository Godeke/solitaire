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