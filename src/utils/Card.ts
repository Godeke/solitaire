import { Card as ICard, Suit, Rank, Position } from '../types/card';

/**
 * Card class implementation with state management methods
 */
export class Card implements ICard {
  public suit: Suit;
  public rank: Rank;
  public faceUp: boolean;
  public id: string;
  public position: Position;
  public draggable: boolean;

  constructor(suit: Suit, rank: Rank, faceUp: boolean = false) {
    this.suit = suit;
    this.rank = rank;
    this.faceUp = faceUp;
    this.id = `${suit}-${rank}-${Date.now()}-${Math.random()}`;
    this.position = { zone: 'stock', index: 0 };
    this.draggable = false;
  }

  /**
   * Flip the card face up or face down
   */
  flip(): void {
    this.faceUp = !this.faceUp;
  }

  /**
   * Check if this card can be stacked on another card according to general solitaire rules
   * @param otherCard The card to check stacking against
   * @returns true if this card can be placed on the other card
   */
  canStackOn(otherCard: Card): boolean {
    // General rule: alternating colors and descending rank
    const isAlternatingColor = this.isRed() !== otherCard.isRed();
    const isDescendingRank = this.rank === otherCard.rank - 1;
    
    return isAlternatingColor && isDescendingRank;
  }

  /**
   * Check if this card is red (hearts or diamonds)
   */
  isRed(): boolean {
    return this.suit === 'hearts' || this.suit === 'diamonds';
  }

  /**
   * Check if this card is black (clubs or spades)
   */
  isBlack(): boolean {
    return this.suit === 'clubs' || this.suit === 'spades';
  }

  /**
   * Get the image path for this card
   */
  getImagePath(): string {
    if (!this.faceUp) {
      return 'assets/cards/back.png';
    }
    return `assets/cards/${this.suit}-${this.rank}.png`;
  }

  /**
   * Get the display name for the rank
   */
  getRankName(): string {
    switch (this.rank) {
      case 1: return 'Ace';
      case 11: return 'Jack';
      case 12: return 'Queen';
      case 13: return 'King';
      default: return this.rank.toString();
    }
  }

  /**
   * Get the display name for the suit
   */
  getSuitName(): string {
    return this.suit.charAt(0).toUpperCase() + this.suit.slice(1);
  }

  /**
   * Create a copy of this card
   */
  clone(): Card {
    const cloned = new Card(this.suit, this.rank, this.faceUp);
    cloned.id = this.id;
    cloned.position = { ...this.position };
    cloned.draggable = this.draggable;
    return cloned;
  }

  /**
   * Update the card's position
   */
  setPosition(position: Position): void {
    this.position = { ...position };
  }

  /**
   * Set whether the card is draggable
   */
  setDraggable(draggable: boolean): void {
    this.draggable = draggable;
  }
}