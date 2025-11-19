import { describe, it, expect } from 'vitest';
import { ScenarioRunner } from '../utils/testing/ScenarioRunner';
import { scenarios } from './scenarios/ScenarioDefinitions';

describe('Solitaire Variant Rules Scenarios', () => {
    scenarios.forEach((scenario) => {
        it(`should pass scenario: ${scenario.name}`, () => {
            const runner = new ScenarioRunner(scenario.variant);
            const result = runner.run(scenario);

            if (!result.success) {
                console.error(`Scenario failed: ${scenario.name}`);
                result.errors.forEach(err => console.error(`  - ${err}`));
            }

            expect(result.success, `Scenario failed with errors: ${result.errors.join(', ')}`).toBe(true);
        });
    });
});
