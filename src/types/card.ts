/**
 * Core card system interfaces for the solitaire game collection
 */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
  id: string;
  position: Position;
  draggable: boolean;
}

export interface Position {
  zone: 'tableau' | 'foundation' | 'stock' | 'waste' | 'freecell';
  index: number; // Column or pile index
  cardIndex?: number; // Position within stack
}

export interface Move {
  from: Position;
  to: Position;
  cards: Card[];
  timestamp: Date;
  autoMove: boolean;
}

export interface GameState {
  gameType: 'klondike' | 'spider' | 'freecell';
  tableau: Card[][];
  foundation: Card[][];
  stock?: Card[];
  waste?: Card[];
  freeCells?: Card[];
  moves: Move[];
  score: number;
  timeStarted: Date;
}