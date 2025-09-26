import { describe, it, expect } from 'vitest';
import { Card, Deck } from '@utils/index';
import { Suit, Rank, Position, Move, GameState } from '@types/index';

describe('Type Interfaces and Exports', () => {
  it('should export all card types correctly', () => {
    // Test that types can be used
    const suit: Suit = 'hearts';
    const rank: Rank = 7;
    
    expect(suit).toBe('hearts');
    expect(rank).toBe(7);
  });

  it('should export Position interface correctly', () => {
    const position: Position = {
      zone: 'tableau',
      index: 2,
      cardIndex: 1
    };
    
    expect(position.zone).toBe('tableau');
    expect(position.index).toBe(2);
    expect(position.cardIndex).toBe(1);
  });

  it('should export Move interface correctly', () => {
    const card = new Card('hearts', 7);
    const move: Move = {
      from: { zone: 'stock', index: 0 },
      to: { zone: 'tableau', index: 1 },
      cards: [card],
      timestamp: new Date(),
      autoMove: false
    };
    
    expect(move.cards).toHaveLength(1);
    expect(move.autoMove).toBe(false);
  });

  it('should export GameState interface correctly', () => {
    const gameState: GameState = {
      gameType: 'klondike',
      tableau: [[], [], [], [], [], [], []],
      foundation: [[], [], [], []],
      stock: [],
      waste: [],
      moves: [],
      score: 0,
      timeStarted: new Date()
    };
    
    expect(gameState.gameType).toBe('klondike');
    expect(gameState.tableau).toHaveLength(7);
    expect(gameState.foundation).toHaveLength(4);
  });

  it('should export Card and Deck classes correctly', () => {
    const card = new Card('spades', 13);
    const deck = new Deck();
    
    expect(card).toBeInstanceOf(Card);
    expect(deck).toBeInstanceOf(Deck);
    expect(deck.getCount()).toBe(52);
  });
});