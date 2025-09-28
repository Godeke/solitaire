/**
 * Integration tests verifying an entire Klondike game can be won using deterministic decks.
 */

import { describe, it, expect } from 'vitest';
import { KlondikeEngine } from '../engines/KlondikeEngine';
import { Card } from '../utils/Card';
import { Deck } from '../utils/Deck';
import { Suit, Rank, Position } from '../types/card';
import { GameEngineConfig } from '../types/game';

type OrderedCard = { suit: Suit; rank: Rank };

const suitToFoundationIndex: Record<Suit, number> = {
  hearts: 0,
  diamonds: 1,
  clubs: 2,
  spades: 3
};

const asRank = (rank: number): Rank => rank as Rank;

const tableauCardOrder: OrderedCard[] = [
  { suit: 'hearts', rank: asRank(1) },
  { suit: 'hearts', rank: asRank(3) },
  { suit: 'hearts', rank: asRank(2) },
  { suit: 'hearts', rank: asRank(6) },
  { suit: 'hearts', rank: asRank(5) },
  { suit: 'hearts', rank: asRank(4) },
  { suit: 'hearts', rank: asRank(10) },
  { suit: 'hearts', rank: asRank(9) },
  { suit: 'hearts', rank: asRank(8) },
  { suit: 'hearts', rank: asRank(7) },
  { suit: 'diamonds', rank: asRank(5) },
  { suit: 'diamonds', rank: asRank(4) },
  { suit: 'diamonds', rank: asRank(3) },
  { suit: 'diamonds', rank: asRank(2) },
  { suit: 'diamonds', rank: asRank(1) },
  { suit: 'clubs', rank: asRank(6) },
  { suit: 'clubs', rank: asRank(5) },
  { suit: 'clubs', rank: asRank(4) },
  { suit: 'clubs', rank: asRank(3) },
  { suit: 'clubs', rank: asRank(2) },
  { suit: 'clubs', rank: asRank(1) },
  { suit: 'spades', rank: asRank(7) },
  { suit: 'spades', rank: asRank(6) },
  { suit: 'spades', rank: asRank(5) },
  { suit: 'spades', rank: asRank(4) },
  { suit: 'spades', rank: asRank(3) },
  { suit: 'spades', rank: asRank(2) },
  { suit: 'spades', rank: asRank(1) }
];

const stockDrawOrder: OrderedCard[] = [
  { suit: 'hearts', rank: asRank(11) },
  { suit: 'hearts', rank: asRank(12) },
  { suit: 'hearts', rank: asRank(13) },
  { suit: 'diamonds', rank: asRank(6) },
  { suit: 'diamonds', rank: asRank(7) },
  { suit: 'diamonds', rank: asRank(8) },
  { suit: 'diamonds', rank: asRank(9) },
  { suit: 'diamonds', rank: asRank(10) },
  { suit: 'diamonds', rank: asRank(11) },
  { suit: 'diamonds', rank: asRank(12) },
  { suit: 'diamonds', rank: asRank(13) },
  { suit: 'clubs', rank: asRank(7) },
  { suit: 'clubs', rank: asRank(8) },
  { suit: 'clubs', rank: asRank(9) },
  { suit: 'clubs', rank: asRank(10) },
  { suit: 'clubs', rank: asRank(11) },
  { suit: 'clubs', rank: asRank(12) },
  { suit: 'clubs', rank: asRank(13) },
  { suit: 'spades', rank: asRank(8) },
  { suit: 'spades', rank: asRank(9) },
  { suit: 'spades', rank: asRank(10) },
  { suit: 'spades', rank: asRank(11) },
  { suit: 'spades', rank: asRank(12) },
  { suit: 'spades', rank: asRank(13) }
];

const deterministicDeckOrder: OrderedCard[] = [
  ...tableauCardOrder,
  ...[...stockDrawOrder].reverse()
];

class DeterministicKlondikeEngine extends KlondikeEngine {
  constructor(
    private readonly orderedCards: OrderedCard[],
    config: Partial<GameEngineConfig> = {}
  ) {
    super({ ...config, dealCount: config.dealCount ?? 1 });
  }

  protected createShuffledDeck(): Deck {
    const deck = new Deck();
    deck.cards = this.orderedCards.map(({ suit, rank }) => new Card(suit, rank));
    deck.shuffled = true;
    return deck;
  }
}

const playTableauToFoundation = (
  engine: KlondikeEngine,
  sequence: Array<{ column: number; suit: Suit; rank: Rank }>
) => {
  sequence.forEach(({ column, suit, rank }) => {
    const state = engine.getGameState();
    const columnCards = state.tableau[column];
    expect(columnCards.length).toBeGreaterThan(0);

    const card = columnCards[columnCards.length - 1];
    expect(card.suit).toBe(suit);
    expect(card.rank).toBe(rank);

    const from: Position = { zone: 'tableau', index: column, cardIndex: columnCards.length - 1 };
    const foundationIndex = suitToFoundationIndex[suit];
    const to: Position = { zone: 'foundation', index: foundationIndex, cardIndex: state.foundation[foundationIndex].length };

    expect(engine.validateMove(from, to, card)).toBe(true);
    engine.executeMove(from, to, card);

    const updatedColumn = engine.getGameState().tableau[column];
    if (updatedColumn.length > 0) {
      const topCard = updatedColumn[updatedColumn.length - 1];
      expect(topCard.faceUp).toBe(true);
    }
  });
};

const drawFromStock = (engine: KlondikeEngine) => {
  const state = engine.getGameState();
  expect(state.stock && state.stock.length > 0).toBe(true);

  const card = state.stock![state.stock!.length - 1];
  const from: Position = { zone: 'stock', index: 0, cardIndex: state.stock!.length - 1 };
  const to: Position = { zone: 'waste', index: 0, cardIndex: state.waste ? state.waste.length : 0 };

  expect(engine.validateMove(from, to, card)).toBe(true);
  engine.executeMove(from, to, card);
};

const moveWasteTopToFoundation = (engine: KlondikeEngine, expected: OrderedCard) => {
  const state = engine.getGameState();
  expect(state.waste && state.waste.length > 0).toBe(true);

  const wasteCard = state.waste![state.waste!.length - 1];
  expect(wasteCard.suit).toBe(expected.suit);
  expect(wasteCard.rank).toBe(expected.rank);

  const from: Position = { zone: 'waste', index: 0, cardIndex: state.waste!.length - 1 };
  const foundationIndex = suitToFoundationIndex[wasteCard.suit];
  const to: Position = { zone: 'foundation', index: foundationIndex, cardIndex: state.foundation[foundationIndex].length };

  expect(engine.validateMove(from, to, wasteCard)).toBe(true);
  engine.executeMove(from, to, wasteCard);
};

const triggerStockRecycle = (engine: KlondikeEngine) => {
  const state = engine.getGameState();
  expect(state.stock?.length ?? 0).toBe(0);
  expect(state.waste?.length ?? 0).toBeGreaterThan(0);

  const placeholderCard = state.waste![state.waste!.length - 1];
  const from: Position = { zone: 'stock', index: 0 };
  const to: Position = { zone: 'waste', index: 0 };

  expect(engine.validateMove(from, to, placeholderCard)).toBe(true);
  engine.executeMove(from, to, placeholderCard);
};

const tableauPlaySequence: Array<{ column: number; suit: Suit; rank: Rank }> = [
  { column: 0, suit: 'hearts', rank: asRank(1) },
  { column: 1, suit: 'hearts', rank: asRank(2) },
  { column: 1, suit: 'hearts', rank: asRank(3) },
  { column: 2, suit: 'hearts', rank: asRank(4) },
  { column: 2, suit: 'hearts', rank: asRank(5) },
  { column: 2, suit: 'hearts', rank: asRank(6) },
  { column: 3, suit: 'hearts', rank: asRank(7) },
  { column: 3, suit: 'hearts', rank: asRank(8) },
  { column: 3, suit: 'hearts', rank: asRank(9) },
  { column: 3, suit: 'hearts', rank: asRank(10) },
  { column: 4, suit: 'diamonds', rank: asRank(1) },
  { column: 4, suit: 'diamonds', rank: asRank(2) },
  { column: 4, suit: 'diamonds', rank: asRank(3) },
  { column: 4, suit: 'diamonds', rank: asRank(4) },
  { column: 4, suit: 'diamonds', rank: asRank(5) },
  { column: 5, suit: 'clubs', rank: asRank(1) },
  { column: 5, suit: 'clubs', rank: asRank(2) },
  { column: 5, suit: 'clubs', rank: asRank(3) },
  { column: 5, suit: 'clubs', rank: asRank(4) },
  { column: 5, suit: 'clubs', rank: asRank(5) },
  { column: 5, suit: 'clubs', rank: asRank(6) },
  { column: 6, suit: 'spades', rank: asRank(1) },
  { column: 6, suit: 'spades', rank: asRank(2) },
  { column: 6, suit: 'spades', rank: asRank(3) },
  { column: 6, suit: 'spades', rank: asRank(4) },
  { column: 6, suit: 'spades', rank: asRank(5) },
  { column: 6, suit: 'spades', rank: asRank(6) },
  { column: 6, suit: 'spades', rank: asRank(7) }
];

const verifyWinState = (engine: KlondikeEngine) => {
  const finalState = engine.getGameState();
  (Object.entries(suitToFoundationIndex) as Array<[Suit, number]>).forEach(([suitKey, foundationIndex]) => {
    expect(finalState.foundation[foundationIndex]).toHaveLength(13);
    const topCard = finalState.foundation[foundationIndex][12];
    expect(topCard.rank).toBe(asRank(13));
    expect(topCard.suit).toBe(suitKey);
  });
  expect(finalState.stock?.length ?? 0).toBe(0);
  expect(finalState.waste?.length ?? 0).toBe(0);
  expect(engine.checkWinCondition()).toBe(true);
};

const createEngine = () => new DeterministicKlondikeEngine(deterministicDeckOrder);

describe('KlondikeEngine full game simulations', () => {
  it('completes a deterministic game without recycling the stock', () => {
    const uniqueness = new Set(deterministicDeckOrder.map(card => `${card.suit}-${card.rank}`));
    expect(uniqueness.size).toBe(52);

    const engine = createEngine();
    engine.initializeGame();

    playTableauToFoundation(engine, tableauPlaySequence);
    const stateAfterTableau = engine.getGameState();
    stateAfterTableau.tableau.forEach(column => expect(column).toHaveLength(0));

    stockDrawOrder.forEach(expected => {
      drawFromStock(engine);
      moveWasteTopToFoundation(engine, expected);
    });

    verifyWinState(engine);
  });

  it('completes a deterministic game after recycling the stock once', () => {
    const engine = createEngine();
    engine.initializeGame();

    stockDrawOrder.forEach(expected => {
      drawFromStock(engine);
      const wasteTop = engine.getGameState().waste!;
      const drawnCard = wasteTop[wasteTop.length - 1];
      expect(drawnCard.suit).toBe(expected.suit);
      expect(drawnCard.rank).toBe(expected.rank);
    });

    let state = engine.getGameState();
    expect(state.stock?.length ?? 0).toBe(0);
    expect(state.waste?.length ?? 0).toBe(stockDrawOrder.length);

    triggerStockRecycle(engine);

    state = engine.getGameState();
    expect(state.stock?.length ?? 0).toBe(stockDrawOrder.length);
    expect(state.waste?.length ?? 0).toBe(0);

    playTableauToFoundation(engine, tableauPlaySequence);

    stockDrawOrder.forEach(expected => {
      drawFromStock(engine);
      moveWasteTopToFoundation(engine, expected);
    });

    verifyWinState(engine);
  });
});
