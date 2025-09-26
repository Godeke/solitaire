import React, { useState } from 'react';
import { Card } from '../utils/Card';
import { Position } from '../types/card';
import CardRenderer from './CardRenderer';
import DropZone from './DropZone';
import DragDropProvider from './DragDropProvider';
import './CardDemo.css';

export const CardDemo: React.FC = () => {
  // Create some demo cards
  const [cards, setCards] = useState<Card[]>(() => {
    const demoCards = [
      new Card('hearts', 1, true), // Ace of Hearts
      new Card('spades', 13, true), // King of Spades
      new Card('diamonds', 12, true), // Queen of Diamonds
      new Card('clubs', 11, true), // Jack of Clubs
      new Card('hearts', 10, false), // 10 of Hearts (face down)
    ];
    
    // Set up positions and draggable state
    demoCards.forEach((card, index) => {
      card.setPosition({ zone: 'tableau', index: 0, cardIndex: index });
      card.setDraggable(card.faceUp);
    });
    
    return demoCards;
  });

  const [dropZones] = useState<Position[]>([
    { zone: 'foundation', index: 0 },
    { zone: 'foundation', index: 1 },
    { zone: 'foundation', index: 2 },
    { zone: 'foundation', index: 3 },
  ]);

  const handleCardMove = (card: Card, from: Position, to: Position): boolean => {
    console.log(`Moving ${card.getRankName()} of ${card.getSuitName()} from`, from, 'to', to);
    
    // Simple validation for demo - only allow moves to foundation
    if (to.zone === 'foundation') {
      // Update card position
      setCards(prevCards => 
        prevCards.map(c => 
          c.id === card.id 
            ? { ...c, position: to }
            : c
        )
      );
      return true;
    }
    
    return false;
  };

  const handleCardClick = (card: Card) => {
    console.log(`Clicked ${card.getRankName()} of ${card.getSuitName()}`);
    
    // Flip face-down cards when clicked
    if (!card.faceUp) {
      setCards(prevCards => 
        prevCards.map(c => {
          if (c.id === card.id) {
            const updatedCard = { ...c };
            updatedCard.flip();
            updatedCard.setDraggable(true);
            return updatedCard;
          }
          return c;
        })
      );
    }
  };

  const isValidDropTarget = (draggedCard: Card, targetPosition: Position): boolean => {
    // Simple validation for demo
    return targetPosition.zone === 'foundation';
  };

  const resetDemo = () => {
    setCards(prevCards => 
      prevCards.map((card, index) => {
        const resetCard = new Card(card.suit, card.rank, index < 4);
        resetCard.setPosition({ zone: 'tableau', index: 0, cardIndex: index });
        resetCard.setDraggable(resetCard.faceUp);
        return resetCard;
      })
    );
  };

  return (
    <DragDropProvider>
      <div className="card-demo">
        <div className="demo-header">
          <h2>Card Rendering & Drag-Drop Demo</h2>
          <button onClick={resetDemo} className="reset-button">
            Reset Demo
          </button>
        </div>
        
        <div className="demo-instructions">
          <p>• Drag face-up cards to the foundation areas below</p>
          <p>• Click face-down cards to flip them</p>
          <p>• Hover over cards to see visual feedback</p>
        </div>

        <div className="demo-content">
          <div className="tableau-section">
            <h3>Tableau (Source Cards)</h3>
            <div className="card-stack">
              {cards.map((card, index) => (
                <CardRenderer
                  key={card.id}
                  card={card}
                  onCardMove={handleCardMove}
                  onCardClick={handleCardClick}
                  style={{
                    position: 'absolute',
                    left: `${index * 20}px`,
                    top: `${index * 5}px`,
                    zIndex: index
                  }}
                />
              ))}
            </div>
          </div>

          <div className="foundation-section">
            <h3>Foundation (Drop Zones)</h3>
            <div className="foundation-piles">
              {dropZones.map((position, index) => {
                const cardsInZone = cards.filter(card => 
                  card.position.zone === 'foundation' && 
                  card.position.index === index
                );
                
                return (
                  <DropZone
                    key={`foundation-${index}`}
                    position={position}
                    onCardDrop={handleCardMove}
                    isValidDropTarget={(card) => isValidDropTarget(card, position)}
                    placeholder={`Foundation ${index + 1}`}
                    className="foundation-pile"
                    showPlaceholder={cardsInZone.length === 0}
                  >
                    {cardsInZone.map(card => (
                      <CardRenderer
                        key={card.id}
                        card={card}
                        onCardMove={handleCardMove}
                        onCardClick={handleCardClick}
                      />
                    ))}
                  </DropZone>
                );
              })}
            </div>
          </div>
        </div>

        <div className="demo-info">
          <h4>Features Demonstrated:</h4>
          <ul>
            <li>✅ Visual card representation with suits and ranks</li>
            <li>✅ Drag-and-drop functionality using react-dnd</li>
            <li>✅ Hover states and visual feedback</li>
            <li>✅ Drop zone highlighting and validation</li>
            <li>✅ Smooth animations using Framer Motion</li>
            <li>✅ Face-up/face-down card states</li>
            <li>✅ Click interactions for card flipping</li>
          </ul>
        </div>
      </div>
    </DragDropProvider>
  );
};

export default CardDemo;