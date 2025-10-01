/**
 * Test for Spider Solitaire card duplication bug
 * When dragging a stack of cards, the wrong cards are being removed from the source
 */

import { SpiderEngine } from '../engines/SpiderEngine';
import { Card } from '../utils/Card';
import { Position } from '../types/card';
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
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';

describe('Spider Card Duplication Bug', () => {
  let engine: SpiderEngine;

  beforeEach(() => {
    engine = new SpiderEngine();
  });

  test('should not duplicate cards when dragging from middle of column', () => {
    // This test reproduces the specific bug scenario:
    // Column has [4♠, 3♠, 2♠, A♠] and we drag 2♠ and A♠
    // The bug occurs because removeCardsFromPosition removes from the end,
    // but getCardsToMove might identify cards from the middle
    
    const gameState = engine.getGameState();
    gameState.tableau = Array(10).fill(null).map(() => []);
    
    // Column 0: has 4♠, 3♠, 2♠, A♠
    const card4 = new Card('spades', 4);
    const card3 = new Card('spades', 3);
    const card2 = new Card('spades', 2);
    const cardA = new Card('spades', 1);
    
    [card4, card3, card2, cardA].forEach((card, index) => {
      card.faceUp = true;
      card.draggable = true;
      card.setPosition({ zone: 'tableau', index: 0, cardIndex: index });
    });
    
    gameState.tableau[0].push(card4, card3, card2, cardA);
    
    // Column 1: has 5♥ (target for the 4♠)
    const card5 = new Card('hearts', 5);
    card5.faceUp = true;
    card5.draggable = true;
    card5.setPosition({ zone: 'tableau', index: 1, cardIndex: 0 });
    
    gameState.tableau[1].push(card5);
    
    engine.setGameState(gameState);
    
    // Try to drag the 4♠ (which should take the entire sequence 4♠, 3♠, 2♠, A♠)
    const from: Position = { zone: 'tableau', index: 0 };
    const to: Position = { zone: 'tableau', index: 1 };
    
    // First, let's check what getCardsToMove returns
    const cardsToMove = (engine as any).getCardsToMove(from, card4);
    expect(cardsToMove).toHaveLength(4); // Should move all 4 cards
    
    // Execute the move
    const success = engine.validateMove(from, to, card4);
    expect(success).toBe(true);
    
    const newGameState = engine.executeMove(from, to, card4);
    
    const sourceColumn = newGameState.tableau[0];
    const targetColumn = newGameState.tableau[1];
    
    // Check source column - should be empty
    expect(sourceColumn).toHaveLength(0);
    
    // Check target column - should have 5♥, 4♠, 3♠, 2♠, A♠
    expect(targetColumn).toHaveLength(5);
    expect(targetColumn[0].rank).toBe(5); // 5♥
    expect(targetColumn[1].rank).toBe(4); // 4♠
    expect(targetColumn[2].rank).toBe(3); // 3♠
    expect(targetColumn[3].rank).toBe(2); // 2♠
    expect(targetColumn[4].rank).toBe(1); // A♠
    
    // Verify no duplicates
    const allCards: Card[] = [...sourceColumn, ...targetColumn] as Card[];
    const cardIds = allCards.map(card => card.id);
    const uniqueIds = new Set(cardIds);
    expect(cardIds).toHaveLength(uniqueIds.size);
  });

  test('should reproduce the exact bug scenario from the screenshot', () => {
    // Based on the screenshot, it looks like there's a column with multiple cards
    // and when dragging a 2 and ACE stack, the 2 gets left behind
    
    const gameState = engine.getGameState();
    gameState.tableau = Array(10).fill(null).map(() => []);
    
    // Set up a column that might cause the issue
    // Let's say we have: [K♠, Q♠, J♠, 10♠, 9♠, 8♠, 7♠, 6♠, 5♠, 4♠, 3♠, 2♠, A♠]
    // And we try to drag just the 2♠ and A♠
    
    const cards: Card[] = [];
    for (let rank = 13; rank >= 1; rank--) {
      const card = new Card('spades', rank);
      card.faceUp = true;
      card.draggable = true;
      card.setPosition({ zone: 'tableau', index: 0, cardIndex: 13 - rank });
      cards.push(card);
    }
    
    gameState.tableau[0].push(...cards);
    
    // Target column with a 3
    const target3 = new Card('hearts', 3);
    target3.faceUp = true;
    target3.draggable = true;
    target3.setPosition({ zone: 'tableau', index: 1, cardIndex: 0 });
    gameState.tableau[1].push(target3);
    
    engine.setGameState(gameState);
    
    // Try to drag the 2♠ (which should only take 2♠ and A♠ since they're same suit sequence)
    const card2 = cards[11]; // 2♠ is at index 11 (13-2)
    const from: Position = { zone: 'tableau', index: 0 };
    const to: Position = { zone: 'tableau', index: 1 };
    
    // Check what cards would move
    const cardsToMove = (engine as any).getCardsToMove(from, card2);
    expect(cardsToMove).toHaveLength(2); // Should only move 2♠ and A♠
    expect(cardsToMove[0].rank).toBe(2);
    expect(cardsToMove[1].rank).toBe(1);
    
    const initialSourceLength = engine.getGameState().tableau[0].length;
    
    // Execute the move
    const success = engine.validateMove(from, to, card2);
    expect(success).toBe(true);
    
    const newGameState = engine.executeMove(from, to, card2);
    
    const sourceColumn = newGameState.tableau[0];
    const targetColumn = newGameState.tableau[1];
    
    // Source should have 2 fewer cards (the 2♠ and A♠ that moved)
    expect(sourceColumn).toHaveLength(initialSourceLength - 2);
    
    // The top card of source should now be 3♠
    expect(sourceColumn[sourceColumn.length - 1].rank).toBe(3);
    
    // Target should have the 3♥, 2♠, A♠
    expect(targetColumn).toHaveLength(3);
    expect(targetColumn[0].rank).toBe(3); // 3♥
    expect(targetColumn[1].rank).toBe(2); // 2♠
    expect(targetColumn[2].rank).toBe(1); // A♠
    
    // Check for duplicates - this is where the bug would show up
    const allTableauCards: Card[] = [];
    newGameState.tableau.forEach(column => {
      allTableauCards.push(...column as Card[]);
    });
    
    const cardIds = allTableauCards.map(card => card.id);
    const uniqueIds = new Set(cardIds);
    
    if (cardIds.length !== uniqueIds.size) {
      // If we have duplicates, let's find them
      const duplicates = cardIds.filter((id, index) => cardIds.indexOf(id) !== index);
      console.log('DUPLICATE CARD IDs FOUND:', duplicates);
      
      // Find the actual duplicate cards
      const duplicateCards = allTableauCards.filter(card => duplicates.includes(card.id));
      console.log('DUPLICATE CARDS:', duplicateCards.map(c => `${c.getRankName()} of ${c.getSuitName()}`));
    }
    
    expect(cardIds).toHaveLength(uniqueIds.size); // This should fail if there's a bug
  });

  test('should correctly identify cards to move in sequence', () => {
    // Test the getCardsToMove method specifically
    const gameState = engine.initializeGame();
    const column0 = gameState.tableau[0];
    
    // Clear and set up test scenario
    column0.length = 0;
    
    const card5 = new Card('hearts', 5);
    const card4 = new Card('hearts', 4);
    const card3 = new Card('hearts', 3);
    const card2 = new Card('spades', 2); // Different suit - breaks sequence
    const cardA = new Card('spades', 1);
    
    [card5, card4, card3, card2, cardA].forEach((card, index) => {
      card.faceUp = true;
      card.draggable = true;
      card.setPosition({ zone: 'tableau', index: 0, cardIndex: index });
    });
    
    column0.push(card5, card4, card3, card2, cardA);
    
    // When dragging the 4♥, it should only take 4♥ and 3♥ (same suit sequence)
    const from: Position = { zone: 'tableau', index: 0 };
    const cardsToMove = (engine as any).getCardsToMove(from, card4);
    
    expect(cardsToMove).toHaveLength(2);
    expect(cardsToMove[0].rank).toBe(4);
    expect(cardsToMove[0].suit).toBe('hearts');
    expect(cardsToMove[1].rank).toBe(3);
    expect(cardsToMove[1].suit).toBe('hearts');
  });
});