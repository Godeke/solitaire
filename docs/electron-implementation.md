# Electron Implementation

This document describes the Electron main process implementation for the Solitaire Game Collection.

## Overview

The Electron main process provides window management, application lifecycle handling, menu system, and IPC communication between the main and renderer processes.

## Key Features

### Window Management
- **Dimensions**: 1200x800 default, 800x600 minimum
- **Security**: Context isolation enabled, node integration disabled
- **Platform-specific**: macOS hidden inset title bar, proper icon handling
- **Resize handling**: Automatic layout adaptation and logging

### Application Menu
- **Cross-platform**: Different menu structures for macOS vs Windows/Linux
- **Keyboard shortcuts**: Full keyboard navigation support
- **Game controls**: Direct access to game functions via menu
- **Standard items**: Cut/copy/paste, zoom, developer tools

### Keyboard Shortcuts
- `Ctrl/Cmd+N`: New Game
- `Ctrl/Cmd+T`: Statistics
- `Ctrl/Cmd+Z`: Undo Move
- `Ctrl/Cmd+Shift+Z`: Redo Move
- `Ctrl/Cmd+1/2/3`: Select Game (Klondike/Spider/FreeCell)
- `Ctrl/Cmd+A`: Auto-Complete
- `Ctrl/Cmd+H`: Show Hint
- `Ctrl/Cmd+?`: Keyboard Shortcuts Help

### IPC Communication
- **Logging**: Centralized logging from renderer to main process
- **Window control**: Minimize, maximize, close operations
- **Game state**: Persistence and restoration
- **Menu events**: Bidirectional communication for menu actions

### Security Features
- **External navigation prevention**: Blocks navigation to external URLs
- **External link handling**: Opens external links in default browser
- **Content security**: Web security enabled, no insecure content
- **Context isolation**: Secure communication via preload script

### Build Configuration
- **Cross-platform**: Windows (NSIS, Portable), macOS (DMG), Linux (AppImage, DEB)
- **Code signing**: Ready for production code signing
- **Auto-updater**: Framework in place for future updates
- **Asset handling**: Proper inclusion of game assets and icons

## File Structure

```
src/main/
├── main.ts          # Main process entry point
├── preload.ts       # Preload script for secure IPC
└── ...

src/types/
├── electron.d.ts    # TypeScript definitions for Electron API
└── ...

assets/
├── icon.ico         # Windows icon
├── icon.icns        # macOS icon
├── icon.png         # Linux icon
└── dmg-background.png # macOS DMG background
```

## Development

### Running in Development
```bash
npm run dev              # Start both renderer and Electron
npm run dev:renderer     # Start only Vite dev server
npm run dev:electron     # Start only Electron process
```

### Building
```bash
npm run build           # Build both renderer and main process
npm run build:renderer  # Build React app only
npm run build:main      # Build Electron main process only
```

### Packaging
```bash
npm run package         # Package for current platform
npm run package:win     # Package for Windows
npm run package:mac     # Package for macOS
npm run package:linux   # Package for Linux
```

## Testing

The Electron implementation includes comprehensive tests:

- **Unit tests**: Configuration validation and component testing
- **Integration tests**: Full application workflow testing
- **Packaging tests**: Build configuration validation

Run tests with:
```bash
npx vitest run src/test/ElectronMain.test.ts
npx vitest run src/test/ElectronIntegration.test.ts
npx vitest run src/test/ElectronPackaging.test.ts
```

## Platform-Specific Considerations

### macOS
- App menu with About, Services, etc.
- Hidden inset title bar style
- Dock icon and app activation handling
- DMG installer with custom background

### Windows
- NSIS installer with desktop/start menu shortcuts
- Proper Windows icon handling
- Publisher name for security warnings
- Portable executable option

### Linux
- AppImage and DEB package formats
- Desktop entry and icon installation
- Game category classification
- System integration

## Security

The implementation follows Electron security best practices:

1. **Context Isolation**: Enabled to prevent renderer access to Node.js
2. **Node Integration**: Disabled in renderer process
3. **Preload Script**: Secure API exposure via contextBridge
4. **Content Security**: Web security enabled, external navigation blocked
5. **External Links**: Handled by system default browser

## Future Enhancements

- Auto-updater implementation
- Native notifications for game events
- System tray integration
- Custom protocol handling
- Performance monitoring and crash reporting