import { describe, it, expect, beforeEach } from 'vitest';
import { Deck } from '@utils/Deck';
import { Card } from '@utils/Card';
import { Suit, Rank } from '@types/card';

describe('Deck', () => {
  let deck: Deck;

  beforeEach(() => {
    deck = new Deck();
  });

  describe('constructor', () => {
    it('should create a standard 52-card deck', () => {
      expect(deck.cards).toHaveLength(52);
      expect(deck.shuffled).toBe(false);
    });

    it('should contain all suits and ranks', () => {
      const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
      const ranks: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

      for (const suit of suits) {
        for (const rank of ranks) {
          const card = deck.cards.find(c => c.suit === suit && c.rank === rank);
          expect(card).toBeDefined();
        }
      }
    });

    it('should have all cards face down initially', () => {
      const allFaceDown = deck.cards.every(card => !card.faceUp);
      expect(allFaceDown).toBe(true);
    });
  });

  describe('shuffle', () => {
    it('should mark deck as shuffled', () => {
      deck.shuffle();
      expect(deck.shuffled).toBe(true);
    });

    it('should change the order of cards', () => {
      const originalOrder = deck.cards.map(card => card.id);
      deck.shuffle();
      const shuffledOrder = deck.cards.map(card => card.id);
      
      // It's extremely unlikely that shuffle produces the same order
      expect(shuffledOrder).not.toEqual(originalOrder);
    });

    it('should maintain the same number of cards', () => {
      deck.shuffle();
      expect(deck.cards).toHaveLength(52);
    });

    it('should maintain all unique cards', () => {
      deck.shuffle();
      const cardIds = deck.cards.map(card => card.id);
      const uniqueIds = new Set(cardIds);
      expect(uniqueIds.size).toBe(52);
    });
  });

  describe('deal', () => {
    it('should deal the specified number of cards', () => {
      const dealtCards = deck.deal(5);
      expect(dealtCards).toHaveLength(5);
      expect(deck.cards).toHaveLength(47);
    });

    it('should deal cards from the top of the deck', () => {
      const topCard = deck.cards[0];
      const dealtCards = deck.deal(1);
      expect(dealtCards[0]).toBe(topCard);
    });

    it('should throw error when dealing more cards than available', () => {
      expect(() => deck.deal(53)).toThrow('Cannot deal 53 cards, only 52 cards remaining');
    });

    it('should deal all remaining cards when count equals deck size', () => {
      const dealtCards = deck.deal(52);
      expect(dealtCards).toHaveLength(52);
      expect(deck.cards).toHaveLength(0);
    });
  });

  describe('dealOne', () => {
    it('should deal one card from the top', () => {
      const topCard = deck.cards[0];
      const dealtCard = deck.dealOne();
      expect(dealtCard).toBe(topCard);
      expect(deck.cards).toHaveLength(51);
    });

    it('should return null when deck is empty', () => {
      deck.deal(52); // Empty the deck
      const dealtCard = deck.dealOne();
      expect(dealtCard).toBeNull();
    });
  });

  describe('reset', () => {
    it('should restore deck to original state', () => {
      deck.shuffle();
      deck.deal(10);
      
      deck.reset();
      
      expect(deck.cards).toHaveLength(52);
      expect(deck.shuffled).toBe(false);
    });

    it('should restore original card order', () => {
      const originalFirstCard = deck.cards[0];
      deck.shuffle();
      deck.reset();
      expect(deck.cards[0].suit).toBe(originalFirstCard.suit);
      expect(deck.cards[0].rank).toBe(originalFirstCard.rank);
    });

    it('should create new card instances', () => {
      const originalCard = deck.cards[0];
      deck.reset();
      const resetCard = deck.cards[0];
      
      expect(resetCard.suit).toBe(originalCard.suit);
      expect(resetCard.rank).toBe(originalCard.rank);
      expect(resetCard).not.toBe(originalCard); // Different instances
    });
  });

  describe('getCount', () => {
    it('should return the number of cards in deck', () => {
      expect(deck.getCount()).toBe(52);
      deck.deal(10);
      expect(deck.getCount()).toBe(42);
    });
  });

  describe('isEmpty', () => {
    it('should return false for non-empty deck', () => {
      expect(deck.isEmpty()).toBe(false);
    });

    it('should return true for empty deck', () => {
      deck.deal(52);
      expect(deck.isEmpty()).toBe(true);
    });
  });

  describe('peek', () => {
    it('should return the top card without removing it', () => {
      const topCard = deck.cards[0];
      const peekedCard = deck.peek();
      
      expect(peekedCard).toBe(topCard);
      expect(deck.cards).toHaveLength(52);
    });

    it('should return null for empty deck', () => {
      deck.deal(52);
      expect(deck.peek()).toBeNull();
    });
  });

  describe('addCard', () => {
    it('should add a card to the bottom of the deck', () => {
      const newCard = new Card('hearts', 1);
      deck.addCard(newCard);
      
      expect(deck.cards).toHaveLength(53);
      expect(deck.cards[deck.cards.length - 1]).toBe(newCard);
    });
  });

  describe('addCards', () => {
    it('should add multiple cards to the bottom of the deck', () => {
      const newCards = [
        new Card('hearts', 1),
        new Card('spades', 2)
      ];
      
      deck.addCards(newCards);
      
      expect(deck.cards).toHaveLength(54);
      expect(deck.cards[deck.cards.length - 2]).toBe(newCards[0]);
      expect(deck.cards[deck.cards.length - 1]).toBe(newCards[1]);
    });
  });

  describe('removeCard', () => {
    it('should remove and return the specified card', () => {
      const targetCard = deck.cards[10];
      const removedCard = deck.removeCard(targetCard.id);
      
      expect(removedCard).toBe(targetCard);
      expect(deck.cards).toHaveLength(51);
      expect(deck.cards.includes(targetCard)).toBe(false);
    });

    it('should return null if card not found', () => {
      const removedCard = deck.removeCard('non-existent-id');
      expect(removedCard).toBeNull();
      expect(deck.cards).toHaveLength(52);
    });
  });

  describe('findCard', () => {
    it('should find and return the card with specified ID', () => {
      const targetCard = deck.cards[15];
      const foundCard = deck.findCard(targetCard.id);
      
      expect(foundCard).toBe(targetCard);
    });

    it('should return null if card not found', () => {
      const foundCard = deck.findCard('non-existent-id');
      expect(foundCard).toBeNull();
    });
  });

  describe('getCardsBySuit', () => {
    it('should return all cards of the specified suit', () => {
      const heartsCards = deck.getCardsBySuit('hearts');
      
      expect(heartsCards).toHaveLength(13);
      heartsCards.forEach(card => {
        expect(card.suit).toBe('hearts');
      });
    });

    it('should return empty array for non-existent suit after removal', () => {
      // Remove all hearts cards
      const heartsCards = deck.getCardsBySuit('hearts');
      heartsCards.forEach(card => deck.removeCard(card.id));
      
      const remainingHearts = deck.getCardsBySuit('hearts');
      expect(remainingHearts).toHaveLength(0);
    });
  });

  describe('getCardsByRank', () => {
    it('should return all cards of the specified rank', () => {
      const aces = deck.getCardsByRank(1);
      
      expect(aces).toHaveLength(4);
      aces.forEach(card => {
        expect(card.rank).toBe(1);
      });
    });

    it('should return cards of all suits for the rank', () => {
      const kings = deck.getCardsByRank(13);
      const suits = kings.map(card => card.suit).sort();
      
      expect(suits).toEqual(['clubs', 'diamonds', 'hearts', 'spades']);
    });
  });
});