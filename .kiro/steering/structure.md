# Project Structure

## Directory Organization

```
src/
├── main/           # Electron main process code
├── renderer/       # React renderer process entry point
├── components/     # React UI components
├── engines/        # Game engine implementations
├── types/          # TypeScript type definitions
├── utils/          # Utility functions and classes
└── test/           # Test files and setup

assets/             # Static assets (card images, sounds)
dist/               # Build output directory
scripts/            # Build and development scripts
```

## Architecture Patterns

### Game Engines
- All game engines extend `BaseGameEngine` abstract class
- Each engine implements game-specific logic while sharing common utilities
- Engines handle move validation, state management, and win conditions
- Located in `src/engines/` with corresponding tests

### Components
- Functional React components using hooks
- Each component has corresponding CSS and test files
- Components follow naming convention: `ComponentName.tsx`, `ComponentName.css`, `ComponentName.test.tsx`
- Use TypeScript interfaces for props with optional `className` prop

### State Management
- Game state managed through engine classes, not external state libraries
- Persistent state handled by `GameStateManager` utility
- Component state uses React hooks (`useState`, `useCallback`, `useEffect`)

### Testing Strategy
- Unit tests for all engines, utilities, and components
- Tests located in `src/test/` directory
- Use `@testing-library/react` for component testing
- Test files mirror source structure with `.test.ts` or `.test.tsx` extensions

## Naming Conventions

- **Files**: PascalCase for components (`GameManager.tsx`), camelCase for utilities (`gameStateManager.ts`)
- **Classes**: PascalCase (`BaseGameEngine`, `Card`)
- **Interfaces**: PascalCase with descriptive names (`GameState`, `MoveValidationResult`)
- **Functions**: camelCase (`validateMove`, `handleStartGame`)
- **Constants**: UPPER_SNAKE_CASE for module-level constants

## Import Guidelines

- Use path aliases (`@components`, `@engines`, etc.) instead of relative imports
- Group imports: external libraries first, then internal modules
- Prefer named imports over default imports for utilities
- Use default exports for React components