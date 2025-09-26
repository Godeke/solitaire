import { describe, it, expect, beforeEach } from 'vitest';
import { Card } from '@utils/Card';
import { Suit, Rank } from '@types/card';

describe('Card', () => {
  let card: Card;

  beforeEach(() => {
    card = new Card('hearts', 7, false);
  });

  describe('constructor', () => {
    it('should create a card with correct properties', () => {
      expect(card.suit).toBe('hearts');
      expect(card.rank).toBe(7);
      expect(card.faceUp).toBe(false);
      expect(card.id).toBeDefined();
      expect(card.position).toEqual({ zone: 'stock', index: 0 });
      expect(card.draggable).toBe(false);
    });

    it('should create a face-up card when specified', () => {
      const faceUpCard = new Card('spades', 1, true);
      expect(faceUpCard.faceUp).toBe(true);
    });

    it('should generate unique IDs for different cards', () => {
      const card1 = new Card('hearts', 7);
      const card2 = new Card('hearts', 7);
      expect(card1.id).not.toBe(card2.id);
    });
  });

  describe('flip', () => {
    it('should flip card from face down to face up', () => {
      expect(card.faceUp).toBe(false);
      card.flip();
      expect(card.faceUp).toBe(true);
    });

    it('should flip card from face up to face down', () => {
      card.faceUp = true;
      card.flip();
      expect(card.faceUp).toBe(false);
    });
  });

  describe('canStackOn', () => {
    it('should allow red card on black card with descending rank', () => {
      const blackCard = new Card('spades', 8);
      const redCard = new Card('hearts', 7);
      expect(redCard.canStackOn(blackCard)).toBe(true);
    });

    it('should allow black card on red card with descending rank', () => {
      const redCard = new Card('diamonds', 10);
      const blackCard = new Card('clubs', 9);
      expect(blackCard.canStackOn(redCard)).toBe(true);
    });

    it('should not allow same color cards', () => {
      const redCard1 = new Card('hearts', 8);
      const redCard2 = new Card('diamonds', 7);
      expect(redCard2.canStackOn(redCard1)).toBe(false);
    });

    it('should not allow non-descending ranks', () => {
      const blackCard = new Card('spades', 8);
      const redCard = new Card('hearts', 8);
      expect(redCard.canStackOn(blackCard)).toBe(false);
    });

    it('should not allow ascending ranks', () => {
      const blackCard = new Card('spades', 8);
      const redCard = new Card('hearts', 9);
      expect(redCard.canStackOn(blackCard)).toBe(false);
    });
  });

  describe('color methods', () => {
    it('should identify red cards correctly', () => {
      const heartsCard = new Card('hearts', 5);
      const diamondsCard = new Card('diamonds', 10);
      expect(heartsCard.isRed()).toBe(true);
      expect(diamondsCard.isRed()).toBe(true);
    });

    it('should identify black cards correctly', () => {
      const clubsCard = new Card('clubs', 5);
      const spadesCard = new Card('spades', 10);
      expect(clubsCard.isBlack()).toBe(true);
      expect(spadesCard.isBlack()).toBe(true);
    });

    it('should have opposite color methods', () => {
      const redCard = new Card('hearts', 5);
      const blackCard = new Card('spades', 5);
      expect(redCard.isRed()).toBe(!redCard.isBlack());
      expect(blackCard.isBlack()).toBe(!blackCard.isRed());
    });
  });

  describe('getImagePath', () => {
    it('should return back image path for face-down cards', () => {
      card.faceUp = false;
      expect(card.getImagePath()).toBe('assets/cards/back.png');
    });

    it('should return specific card image path for face-up cards', () => {
      card.faceUp = true;
      expect(card.getImagePath()).toBe('assets/cards/hearts-7.png');
    });
  });

  describe('getRankName', () => {
    it('should return "Ace" for rank 1', () => {
      const aceCard = new Card('hearts', 1);
      expect(aceCard.getRankName()).toBe('Ace');
    });

    it('should return "Jack" for rank 11', () => {
      const jackCard = new Card('hearts', 11);
      expect(jackCard.getRankName()).toBe('Jack');
    });

    it('should return "Queen" for rank 12', () => {
      const queenCard = new Card('hearts', 12);
      expect(queenCard.getRankName()).toBe('Queen');
    });

    it('should return "King" for rank 13', () => {
      const kingCard = new Card('hearts', 13);
      expect(kingCard.getRankName()).toBe('King');
    });

    it('should return number string for numeric ranks', () => {
      expect(card.getRankName()).toBe('7');
      const twoCard = new Card('hearts', 2);
      expect(twoCard.getRankName()).toBe('2');
    });
  });

  describe('getSuitName', () => {
    it('should return capitalized suit names', () => {
      const heartsCard = new Card('hearts', 5);
      const diamondsCard = new Card('diamonds', 5);
      const clubsCard = new Card('clubs', 5);
      const spadesCard = new Card('spades', 5);

      expect(heartsCard.getSuitName()).toBe('Hearts');
      expect(diamondsCard.getSuitName()).toBe('Diamonds');
      expect(clubsCard.getSuitName()).toBe('Clubs');
      expect(spadesCard.getSuitName()).toBe('Spades');
    });
  });

  describe('clone', () => {
    it('should create an exact copy of the card', () => {
      card.faceUp = true;
      card.position = { zone: 'tableau', index: 2, cardIndex: 1 };
      card.draggable = true;

      const cloned = card.clone();

      expect(cloned.suit).toBe(card.suit);
      expect(cloned.rank).toBe(card.rank);
      expect(cloned.faceUp).toBe(card.faceUp);
      expect(cloned.id).toBe(card.id);
      expect(cloned.position).toEqual(card.position);
      expect(cloned.draggable).toBe(card.draggable);
    });

    it('should create independent position objects', () => {
      const cloned = card.clone();
      cloned.position.index = 5;
      expect(card.position.index).toBe(0);
    });
  });

  describe('setPosition', () => {
    it('should update the card position', () => {
      const newPosition = { zone: 'foundation' as const, index: 2, cardIndex: 3 };
      card.setPosition(newPosition);
      expect(card.position).toEqual(newPosition);
    });

    it('should create a copy of the position object', () => {
      const newPosition = { zone: 'foundation' as const, index: 2 };
      card.setPosition(newPosition);
      newPosition.index = 5;
      expect(card.position.index).toBe(2);
    });
  });

  describe('setDraggable', () => {
    it('should update the draggable property', () => {
      expect(card.draggable).toBe(false);
      card.setDraggable(true);
      expect(card.draggable).toBe(true);
      card.setDraggable(false);
      expect(card.draggable).toBe(false);
    });
  });
});