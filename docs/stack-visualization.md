# Stack Visualization Feature

## Overview

The Klondike solitaire game now includes visual indicators to show how many cards are underneath the currently visible card in both the stock and waste piles. This makes it clear to players that multiple cards are being drawn at once (typically 3 cards in Klondike).

## Visual Design

### Stock Pile
- Shows up to 3 stacked card outlines behind the top card
- Displays a count badge showing the total number of cards remaining
- Stack cards have a blue gradient background (representing face-down cards)
- Each stack indicator is offset by 2px to create a layered effect

### Waste Pile
- Shows up to 3 fanned card outlines behind the top card, spreading to the right
- Cards are positioned with increasing horizontal offset and slight rotation for realistic fanning
- Displays a count badge when there are more than 4 cards (showing "+X" format)
- Stack cards have a light blue-gray gradient background with subtle shadows and white borders for better visibility
- Only the top card is interactive and draggable
- Fanning effect mimics real solitaire card layout

## Implementation Details

### Components Modified
- `KlondikeGameBoard.tsx`: Updated `renderStockPile()` and `renderWastePile()` functions
- `KlondikeGameBoard.css`: Added styles for stack visualization

### CSS Classes Added
- `.stock-stack`, `.waste-stack`: Container for stack visualization
- `.stock-stack-indicators`, `.waste-stack-indicators`: Container for stack card indicators
- `.stock-stack-card`, `.waste-stack-card`: Individual stack card indicators
- `.stock-stack-count`, `.waste-stack-count`: Count badges

### Key Features
1. **Responsive Design**: Stack indicators scale with card size
2. **Performance Optimized**: Only renders up to 3 stack indicators regardless of actual stack size
3. **Accessibility**: Count badges provide clear numerical feedback
4. **Visual Hierarchy**: Proper z-index management ensures top card is always on top
5. **Realistic Fanning**: Waste pile cards fan out to the right with rotation and shadows
6. **Dynamic Layout**: Waste pile area automatically adjusts width to accommodate fanned cards

## User Experience Benefits

1. **Clarity**: Players can immediately see how many cards are in each pile
2. **Game Understanding**: Makes the 3-card draw mechanic visually obvious
3. **Strategic Planning**: Helps players understand how many cards remain in stock
4. **Visual Polish**: Adds depth and professionalism to the game interface

## Technical Notes

- Stack indicators are purely visual and don't interfere with game logic
- The feature automatically adapts to different deal counts (if changed from default 3)
- Stack visualization is disabled when piles are empty (shows placeholder instead)
- All existing drag-and-drop functionality remains unchanged