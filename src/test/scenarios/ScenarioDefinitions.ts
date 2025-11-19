import { TestScenario, ScenarioRunner } from '../../utils/testing/ScenarioRunner';
import { Card } from '../../utils/Card';
import { Position } from '../../types/card';

export const scenarios: TestScenario[] = [
    // ---------------------------------------------------------------------------
    // KLONDIKE SCENARIOS
    // ---------------------------------------------------------------------------
    {
        name: 'Klondike: King to Empty Tableau',
        variant: 'klondike',
        setup: (engine) => {
            const gameState = engine.getGameState();
            // Clear tableau column 0
            gameState.tableau[0] = [];
            // Place a King in column 1
            const king = ScenarioRunner.createCard('hearts', 13, true);
            gameState.tableau[1] = [king];
            engine.setGameState(gameState);
        },
        actions: [
            {
                type: 'move',
                from: { zone: 'tableau', index: 1 },
                to: { zone: 'tableau', index: 0 },
                description: 'Move King to empty column'
            }
        ],
        assertions: [
            {
                type: 'state-check',
                description: 'King should be in column 0',
                check: (state) => state.tableau[0].length === 1 && state.tableau[0][0].rank === 13
            }
        ]
    },
    {
        name: 'Klondike: Invalid Non-King to Empty Tableau',
        variant: 'klondike',
        setup: (engine) => {
            const gameState = engine.getGameState();
            gameState.tableau[0] = [];
            const queen = ScenarioRunner.createCard('hearts', 12, true);
            gameState.tableau[1] = [queen];
            engine.setGameState(gameState);
        },
        actions: [
            {
                type: 'move',
                from: { zone: 'tableau', index: 1 },
                to: { zone: 'tableau', index: 0 },
                description: 'Attempt to move Queen to empty column'
            }
        ],
        assertions: [
            {
                type: 'state-check',
                description: 'Queen should remain in column 1',
                check: (state) => state.tableau[0].length === 0 && state.tableau[1].length === 1
            }
        ]
    },
    {
        name: 'Klondike: Foundation Move (Ace)',
        variant: 'klondike',
        setup: (engine) => {
            const gameState = engine.getGameState();
            const ace = ScenarioRunner.createCard('spades', 1, true);
            gameState.tableau[0] = [ace];
            engine.setGameState(gameState);
        },
        actions: [
            {
                type: 'move',
                from: { zone: 'tableau', index: 0 },
                to: { zone: 'foundation', index: 3 }, // Spades foundation
                description: 'Move Ace of Spades to foundation'
            }
        ],
        assertions: [
            {
                type: 'state-check',
                description: 'Ace should be in foundation',
                check: (state) => state.foundation[3].length === 1 && state.foundation[3][0].rank === 1
            }
        ]
    },

    // ---------------------------------------------------------------------------
    // SPIDER SCENARIOS
    // ---------------------------------------------------------------------------
    {
        name: 'Spider: Move Same-Suit Sequence',
        variant: 'spider',
        setup: (engine) => {
            const gameState = engine.getGameState();
            // Col 0: King, Queen, Jack (Hearts)
            gameState.tableau[0] = [
                ScenarioRunner.createCard('hearts', 13, true),
                ScenarioRunner.createCard('hearts', 12, true),
                ScenarioRunner.createCard('hearts', 11, true)
            ];
            gameState.tableau[1] = [];
            engine.setGameState(gameState);
        },
        actions: [
            {
                type: 'move',
                from: { zone: 'tableau', index: 0 },
                to: { zone: 'tableau', index: 1 },
                cardIndex: 0, // Move from the King (bottom of sequence)
                description: 'Move sequence to empty column'
            }
        ],
        assertions: [
            {
                type: 'state-check',
                description: 'Entire sequence should move',
                check: (state) => state.tableau[1].length === 3 && state.tableau[0].length === 0
            }
        ]
    },
    {
        name: 'Spider: Mixed-Suit Stacking (Valid Move, Invalid Sequence Move)',
        variant: 'spider',
        setup: (engine) => {
            const gameState = engine.getGameState();
            // Col 0: Hearts 5
            gameState.tableau[0] = [ScenarioRunner.createCard('hearts', 5, true)];
            // Col 1: Spades 6
            gameState.tableau[1] = [ScenarioRunner.createCard('spades', 6, true)];
            engine.setGameState(gameState);
        },
        actions: [
            {
                type: 'move',
                from: { zone: 'tableau', index: 0 },
                to: { zone: 'tableau', index: 1 },
                description: 'Move Hearts 5 onto Spades 6'
            }
        ],
        assertions: [
            {
                type: 'state-check',
                description: 'Move should be valid (rank 5 on 6)',
                check: (state) => state.tableau[1].length === 2
            }
        ]
    },

    // ---------------------------------------------------------------------------
    // FREECELL SCENARIOS
    // ---------------------------------------------------------------------------
    {
        name: 'FreeCell: Use Free Cell',
        variant: 'freecell',
        setup: (engine) => {
            const gameState = engine.getGameState();
            const card = ScenarioRunner.createCard('diamonds', 10, true);
            gameState.tableau[0] = [card];
            engine.setGameState(gameState);
        },
        actions: [
            {
                type: 'move',
                from: { zone: 'tableau', index: 0 },
                to: { zone: 'freecell', index: 0 },
                description: 'Move card to first free cell'
            }
        ],
        assertions: [
            {
                type: 'state-check',
                description: 'Card should be in free cell',
                check: (state) => !!state.freeCells && state.freeCells[0]?.rank === 10
            }
        ]
    },
    {
        name: 'FreeCell: Super-Move Validation (Not Enough Space)',
        variant: 'freecell',
        setup: (engine) => {
            const gameState = engine.getGameState();
            // Create a sequence of 5 cards
            const sequence = [
                ScenarioRunner.createCard('hearts', 10, true),
                ScenarioRunner.createCard('spades', 9, true),
                ScenarioRunner.createCard('hearts', 8, true),
                ScenarioRunner.createCard('spades', 7, true),
                ScenarioRunner.createCard('hearts', 6, true)
            ];
            gameState.tableau[0] = sequence;

            // Fill all free cells so max move is 1
            gameState.freeCells = [
                ScenarioRunner.createCard('clubs', 1, true),
                ScenarioRunner.createCard('clubs', 2, true),
                ScenarioRunner.createCard('clubs', 3, true),
                ScenarioRunner.createCard('clubs', 4, true)
            ];

            // Target column with Jack
            gameState.tableau[1] = [ScenarioRunner.createCard('spades', 11, true)];

            engine.setGameState(gameState);
        },
        actions: [
            {
                type: 'move',
                from: { zone: 'tableau', index: 0 },
                to: { zone: 'tableau', index: 1 },
                description: 'Attempt to move 5-card sequence with no free cells'
            }
        ],
        assertions: [
            {
                type: 'state-check',
                description: 'Move should fail (only single card might move if logic allows, but sequence fails)',
                // In this specific implementation, if sequence move fails, it falls back to moving single card?
                // Let's check if the whole sequence moved. It should NOT.
                check: (state) => state.tableau[0].length > 0
            }
        ]
    }
];
