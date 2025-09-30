# Technology Stack

## Build Platform
- **Windows**: Ensure we are using Powershell Syntax and not bash or others

## Core Technologies

- **Electron**: Desktop application framework
- **React 18**: UI framework with hooks and functional components
- **TypeScript**: Strict typing with ES2020 target
- **Vite**: Build tool and development server
- **Vitest**: Testing framework with jsdom environment

## Key Libraries

- **react-dnd**: Drag and drop functionality for card interactions
- **framer-motion**: Smooth animations and transitions
- **@testing-library/react**: Component testing utilities

## Development Tools

- **ESLint**: Code linting with TypeScript and React rules
- **Concurrently**: Run multiple development processes
- **Electron Builder**: Application packaging and distribution

## Path Aliases

The project uses TypeScript path mapping for clean imports:
- `@/*` → `src/*`
- `@components/*` → `src/components/*`
- `@engines/*` → `src/engines/*`
- `@types/*` → `src/types/*`
- `@utils/*` → `src/utils/*`
- `@assets/*` → `assets/*`

## Common Commands

### Development
```bash
npm run dev              # Start development with hot reload
npm run dev:renderer     # Start only Vite dev server
npm run dev:electron     # Start only Electron process
```

### Building
```bash
npm run build           # Build for production
npm run build:renderer  # Build React app only
npm run build:main      # Build Electron main process only
npm run package         # Package desktop application
```

### Testing
```bash
npx vitest run         # Run all tests once (equivalent to vitest --run)
npx vitest run src/test/SpecificTest.test.ts  # Run specific test file
npx vitest run --reporter=verbose             # Run with verbose output
```

**Important**: Do NOT use `npm test -- --run` syntax as this project uses Vitest, not Jest. Always use the commands above.

## Build Configuration

- **Renderer Process**: Built with Vite, outputs to `dist/renderer`
- **Main Process**: Built with TypeScript compiler, outputs to `dist/main`
- **Development Server**: Runs on port 3002 with strict port enforcement
- **Package Output**: Applications built to `release/` directory