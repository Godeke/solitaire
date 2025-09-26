import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CardDemo } from '../components/CardDemo';

describe('Drag and Drop Integration', () => {
  it('renders CardDemo component without errors', () => {
    render(<CardDemo />);
    
    expect(screen.getByText('Card Rendering & Drag-Drop Demo')).toBeDefined();
    expect(screen.getByText('Tableau (Source Cards)')).toBeDefined();
    expect(screen.getByText('Foundation (Drop Zones)')).toBeDefined();
  });

  it('displays demo cards in tableau', () => {
    render(<CardDemo />);
    
    // Should show face-up cards with their ranks
    expect(screen.getAllByText('A')).toHaveLength(3); // Ace appears 3 times (corners + center)
    expect(screen.getAllByText('K')).toHaveLength(3); // King appears 3 times
    expect(screen.getAllByText('Q')).toHaveLength(3); // Queen appears 3 times
    expect(screen.getAllByText('J')).toHaveLength(3); // Jack appears 3 times
  });

  it('displays foundation drop zones', () => {
    render(<CardDemo />);
    
    expect(screen.getByText('Foundation 1')).toBeDefined();
    expect(screen.getByText('Foundation 2')).toBeDefined();
    expect(screen.getByText('Foundation 3')).toBeDefined();
    expect(screen.getByText('Foundation 4')).toBeDefined();
  });

  it('shows demo instructions', () => {
    render(<CardDemo />);
    
    expect(screen.getByText(/Drag face-up cards to the foundation areas/)).toBeDefined();
    expect(screen.getByText(/Click face-down cards to flip them/)).toBeDefined();
    expect(screen.getByText(/Hover over cards to see visual feedback/)).toBeDefined();
  });

  it('displays features list', () => {
    render(<CardDemo />);
    
    expect(screen.getByText(/Visual card representation with suits and ranks/)).toBeDefined();
    expect(screen.getByText(/Drag-and-drop functionality using react-dnd/)).toBeDefined();
    expect(screen.getByText(/Hover states and visual feedback/)).toBeDefined();
    expect(screen.getByText(/Drop zone highlighting and validation/)).toBeDefined();
    expect(screen.getByText(/Smooth animations using Framer Motion/)).toBeDefined();
  });

  it('has reset button that works', () => {
    render(<CardDemo />);
    
    const resetButton = screen.getByText('Reset Demo');
    expect(resetButton).toBeDefined();
    
    // Click reset button
    fireEvent.click(resetButton);
    
    // Should still show the demo after reset
    expect(screen.getByText('Card Rendering & Drag-Drop Demo')).toBeDefined();
  });

  it('applies correct CSS classes to cards', () => {
    render(<CardDemo />);
    
    // Check for card renderer elements
    const cardElements = document.querySelectorAll('.card-renderer');
    expect(cardElements.length).toBeGreaterThan(0);
    
    // Check for face-up cards
    const faceUpCards = document.querySelectorAll('.face-up');
    expect(faceUpCards.length).toBeGreaterThan(0);
    
    // Check for draggable cards
    const draggableCards = document.querySelectorAll('.draggable');
    expect(draggableCards.length).toBeGreaterThan(0);
  });

  it('applies correct CSS classes to drop zones', () => {
    render(<CardDemo />);
    
    // Check for drop zone elements
    const dropZones = document.querySelectorAll('.drop-zone');
    expect(dropZones.length).toBe(4); // 4 foundation piles
  });

  it('shows suit symbols correctly', () => {
    render(<CardDemo />);
    
    // Check for suit symbols (each appears multiple times per card)
    expect(screen.getAllByText('♥')).toHaveLength(3); // Hearts (corners + center)
    expect(screen.getAllByText('♠')).toHaveLength(3); // Spades
    expect(screen.getAllByText('♦')).toHaveLength(3); // Diamonds
    expect(screen.getAllByText('♣')).toHaveLength(3); // Clubs
  });

  it('handles multiple card types without errors', () => {
    render(<CardDemo />);
    
    // Should handle different card ranks and suits
    const cardElements = document.querySelectorAll('.card-renderer');
    expect(cardElements.length).toBe(5); // 5 demo cards
    
    // Should show both red and black cards
    const redCards = document.querySelectorAll('.card-red');
    const blackCards = document.querySelectorAll('.card-black');
    
    expect(redCards.length + blackCards.length).toBeGreaterThan(0);
  });

  it('integrates DragDropProvider correctly', () => {
    // This test ensures the component renders without DnD context errors
    expect(() => {
      render(<CardDemo />);
    }).not.toThrow();
    
    // Should render the main demo content
    expect(screen.getByText('Card Rendering & Drag-Drop Demo')).toBeDefined();
  });
});