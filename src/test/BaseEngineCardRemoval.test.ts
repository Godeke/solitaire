/**
 * Test for BaseGameEngine card removal methods
 * This tests the specific removeCardsFromPosition method that might be causing duplication
 */

import { SpiderEngine } from '../engines/SpiderEngine';
import { Card } from '../utils/Card';
import { Position } from '../types/card';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';

describe('BaseGameEngine Card Removal', () => {
  let engine: SpiderEngine;

  beforeEach(() => {
    engine = new SpiderEngine();
  });

  test('removeCardsFromPosition should remove correct cards from end', () => {
    const gameState = engine.getGameState();
    gameState.tableau = Array(10).fill(null).map(() => []);
    
    // Set up a column with 5 cards
    const cards = [
      new Card('spades', 5),
      new Card('spades', 4),
      new Card('spades', 3),
      new Card('spades', 2),
      new Card('spades', 1)
    ];
    
    cards.forEach((card, index) => {
      card.faceUp = true;
      card.setPosition({ zone: 'tableau', index: 0, cardIndex: index });
    });
    
    gameState.tableau[0].push(...cards);
    engine.setGameState(gameState);
    
    // Remove 2 cards from the end
    const position: Position = { zone: 'tableau', index: 0 };
    const removedCards = (engine as any).removeCardsFromPosition(position, 2);
    
    // Should remove the 2♠ and A♠ (last 2 cards)
    expect(removedCards).toHaveLength(2);
    expect(removedCards[0].rank).toBe(2);
    expect(removedCards[1].rank).toBe(1);
    
    // Column should now have 3 cards left
    const remainingCards = engine.getGameState().tableau[0];
    expect(remainingCards).toHaveLength(3);
    expect(remainingCards[2].rank).toBe(3); // Top card should be 3♠
  });

  test('should identify the exact issue with card removal in Spider', () => {
    // This test simulates the exact scenario where the bug occurs
    const gameState = engine.getGameState();
    gameState.tableau = Array(10).fill(null).map(() => []);
    
    // Column 0: [5♠, 4♠, 3♠, 2♠, A♠] - we want to drag 2♠ and A♠
    const cards = [
      new Card('spades', 5),
      new Card('spades', 4), 
      new Card('spades', 3),
      new Card('spades', 2),
      new Card('spades', 1)
    ];
    
    cards.forEach((card, index) => {
      card.faceUp = true;
      card.draggable = true;
      card.setPosition({ zone: 'tableau', index: 0, cardIndex: index });
    });
    
    gameState.tableau[0].push(...cards);
    
    // Column 1: [3♥] - target
    const target = new Card('hearts', 3);
    target.faceUp = true;
    target.setPosition({ zone: 'tableau', index: 1, cardIndex: 0 });
    gameState.tableau[1].push(target);
    
    engine.setGameState(gameState);
    
    // Get the 2♠ card (index 3 in the array)
    const card2 = cards[3];
    
    // Test getCardsToMove - this should return [2♠, A♠]
    const from: Position = { zone: 'tableau', index: 0 };
    const cardsToMove = (engine as any).getCardsToMove(from, card2);
    
    console.log('Cards to move:', cardsToMove.map(c => `${c.getRankName()} of ${c.getSuitName()}`));
    
    expect(cardsToMove).toHaveLength(2);
    expect(cardsToMove[0].rank).toBe(2);
    expect(cardsToMove[1].rank).toBe(1);
    
    // Now let's see what happens when we remove cards
    const initialColumn = [...engine.getGameState().tableau[0]];
    console.log('Initial column:', initialColumn.map(c => `${c.getRankName()} of ${c.getSuitName()}`));
    
    // This is what the engine does: removes cardsToMove.length cards from the end
    const removedCards = (engine as any).removeCardsFromPosition(from, cardsToMove.length);
    console.log('Removed cards:', removedCards.map(c => `${c.getRankName()} of ${c.getSuitName()}`));
    
    const remainingColumn = engine.getGameState().tableau[0];
    console.log('Remaining column:', remainingColumn.map(c => `${c.getRankName()} of ${c.getSuitName()}`));
    
    // The issue: removeCardsFromPosition removes from the END (2♠, A♠)
    // But getCardsToMove identified cards starting from a specific position
    // If the cards to move are already at the end, this works fine
    // But if there are cards after the sequence, this creates a problem
    
    expect(removedCards).toHaveLength(2);
    expect(removedCards[0].rank).toBe(2); // This should be the 2♠
    expect(removedCards[1].rank).toBe(1); // This should be the A♠
  });

  test('should fix the bug when cards to move are not at the end', () => {
    // This test verifies that our fix works correctly
    
    const gameState = engine.getGameState();
    gameState.tableau = Array(10).fill(null).map(() => []);
    
    // Create a column where we have a same-suit sequence in the middle
    // [K♠, Q♠, J♠, 10♠, 9♠, 8♠, 7♠, 6♠, 5♠, 4♠, 3♠, 2♠, A♠, K♥, Q♥]
    // If we drag the 2♠, it should take 2♠ and A♠
    // But there are K♥ and Q♥ after them
    
    const spadeCards = [];
    for (let rank = 13; rank >= 1; rank--) {
      const card = new Card('spades', rank);
      card.faceUp = true;
      card.draggable = true;
      spadeCards.push(card);
    }
    
    const heartCards = [
      new Card('hearts', 13), // K♥
      new Card('hearts', 12)  // Q♥
    ];
    heartCards.forEach(card => {
      card.faceUp = true;
      card.draggable = true;
    });
    
    const allCards = [...spadeCards, ...heartCards];
    allCards.forEach((card, index) => {
      card.setPosition({ zone: 'tableau', index: 0, cardIndex: index });
    });
    
    gameState.tableau[0].push(...allCards);
    
    // Create target column with 3♥
    const target3 = new Card('hearts', 3);
    target3.faceUp = true;
    target3.setPosition({ zone: 'tableau', index: 1, cardIndex: 0 });
    gameState.tableau[1].push(target3);
    
    engine.setGameState(gameState);
    
    // Try to drag the 2♠ (which is at index 11, not at the end)
    const card2 = spadeCards[11]; // 2♠
    const from: Position = { zone: 'tableau', index: 0 };
    const to: Position = { zone: 'tableau', index: 1 };
    
    console.log('Column before move:', allCards.map(c => `${c.getRankName()} of ${c.getSuitName()}`));
    
    // Execute the move using the engine (this will use our fix)
    const success = engine.validateMove(from, to, card2);
    expect(success).toBe(true);
    
    const newGameState = engine.executeMove(from, to, card2);
    
    const sourceColumn = newGameState.tableau[0];
    const targetColumn = newGameState.tableau[1];
    
    console.log('Source column after move:', sourceColumn.map(c => `${c.getRankName()} of ${c.getSuitName()}`));
    console.log('Target column after move:', targetColumn.map(c => `${c.getRankName()} of ${c.getSuitName()}`));
    
    // After the fix:
    // - Source column should have [K♠, Q♠, J♠, 10♠, 9♠, 8♠, 7♠, 6♠, 5♠, 4♠, 3♠, K♥, Q♥] (2♠ and A♠ removed)
    // - Target column should have [3♥, 2♠, A♠]
    
    expect(sourceColumn).toHaveLength(13); // Original 15 - 2 moved cards
    expect(targetColumn).toHaveLength(3); // Original 1 + 2 moved cards
    
    // Verify the 2♠ and A♠ are NOT in the source column anymore
    const has2Spades = sourceColumn.some(card => card.rank === 2 && card.suit === 'spades');
    const hasAceSpades = sourceColumn.some(card => card.rank === 1 && card.suit === 'spades');
    
    expect(has2Spades).toBe(false); // Fixed: 2♠ should be removed from source
    expect(hasAceSpades).toBe(false); // Fixed: A♠ should be removed from source
    
    // Verify the K♥ and Q♥ are still in the source column
    const hasKingHearts = sourceColumn.some(card => card.rank === 13 && card.suit === 'hearts');
    const hasQueenHearts = sourceColumn.some(card => card.rank === 12 && card.suit === 'hearts');
    
    expect(hasKingHearts).toBe(true); // K♥ should remain in source
    expect(hasQueenHearts).toBe(true); // Q♥ should remain in source
    
    // Verify target column has the correct cards
    expect(targetColumn[0].rank).toBe(3); // 3♥
    expect(targetColumn[0].suit).toBe('hearts');
    expect(targetColumn[1].rank).toBe(2); // 2♠
    expect(targetColumn[1].suit).toBe('spades');
    expect(targetColumn[2].rank).toBe(1); // A♠
    expect(targetColumn[2].suit).toBe('spades');
    
    // Verify no card duplication
    const allTableauCards: Card[] = [];
    newGameState.tableau.forEach(column => {
      allTableauCards.push(...column as Card[]);
    });
    
    const cardIds = allTableauCards.map(card => card.id);
    const uniqueIds = new Set(cardIds);
    
    expect(cardIds).toHaveLength(uniqueIds.size); // No duplicates
    expect(allTableauCards).toHaveLength(16); // Total cards should be preserved
  });
});