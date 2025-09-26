import { Card } from './Card';
import { Suit, Rank } from '../types/card';

/**
 * Deck class for managing a collection of cards with shuffle, deal, and reset functionality
 */
export class Deck {
  public cards: Card[];
  public shuffled: boolean;
  private originalCards: Card[];

  constructor() {
    this.cards = [];
    this.shuffled = false;
    this.originalCards = [];
    this.initializeStandardDeck();
  }

  /**
   * Initialize a standard 52-card deck
   */
  private initializeStandardDeck(): void {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

    this.cards = [];
    
    for (const suit of suits) {
      for (const rank of ranks) {
        this.cards.push(new Card(suit, rank));
      }
    }

    // Store original order for reset functionality
    this.originalCards = this.cards.map(card => card.clone());
    this.shuffled = false;
  }

  /**
   * Shuffle the deck using Fisher-Yates algorithm
   */
  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    this.shuffled = true;
  }

  /**
   * Deal a specified number of cards from the top of the deck
   * @param count Number of cards to deal
   * @returns Array of dealt cards
   */
  deal(count: number): Card[] {
    if (count > this.cards.length) {
      throw new Error(`Cannot deal ${count} cards, only ${this.cards.length} cards remaining`);
    }

    const dealtCards = this.cards.splice(0, count);
    return dealtCards;
  }

  /**
   * Deal a single card from the top of the deck
   * @returns The dealt card or null if deck is empty
   */
  dealOne(): Card | null {
    if (this.cards.length === 0) {
      return null;
    }
    return this.cards.shift() || null;
  }

  /**
   * Reset the deck to its original state (unshuffled, all cards present)
   */
  reset(): void {
    this.cards = this.originalCards.map(card => card.clone());
    this.shuffled = false;
  }

  /**
   * Get the number of cards remaining in the deck
   */
  getCount(): number {
    return this.cards.length;
  }

  /**
   * Check if the deck is empty
   */
  isEmpty(): boolean {
    return this.cards.length === 0;
  }

  /**
   * Peek at the top card without removing it
   */
  peek(): Card | null {
    return this.cards.length > 0 ? this.cards[0] : null;
  }

  /**
   * Add a card to the bottom of the deck
   */
  addCard(card: Card): void {
    this.cards.push(card);
  }

  /**
   * Add multiple cards to the bottom of the deck
   */
  addCards(cards: Card[]): void {
    this.cards.push(...cards);
  }

  /**
   * Remove a specific card from the deck
   */
  removeCard(cardId: string): Card | null {
    const index = this.cards.findIndex(card => card.id === cardId);
    if (index !== -1) {
      return this.cards.splice(index, 1)[0];
    }
    return null;
  }

  /**
   * Find a card in the deck by its ID
   */
  findCard(cardId: string): Card | null {
    return this.cards.find(card => card.id === cardId) || null;
  }

  /**
   * Get all cards of a specific suit
   */
  getCardsBySuit(suit: Suit): Card[] {
    return this.cards.filter(card => card.suit === suit);
  }

  /**
   * Get all cards of a specific rank
   */
  getCardsByRank(rank: Rank): Card[] {
    return this.cards.filter(card => card.rank === rank);
  }
}