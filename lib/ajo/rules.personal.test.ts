import { describe, it } from 'node:test';
import assert from 'node:assert';
import { executePersonalRule } from './rules';
import { PersonalAllocation } from './types';

describe('Personal Rules Engine', () => {
  it('calculates the default template correctly', () => {
    const allocations: PersonalAllocation[] = [
      { destination: 'Savings', type: 'percentage', value: '20' },
      { destination: 'Giving', type: 'fixed', value: '10' },
      { destination: 'Spending', type: 'remainder' },
    ];
    
    const result = executePersonalRule('100', allocations);
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.destinations.length, 3);
    assert.strictEqual(result.destinations[0].amount, '20');
    assert.strictEqual(result.destinations[0].destination, 'Savings');
    assert.strictEqual(result.destinations[1].amount, '10');
    assert.strictEqual(result.destinations[1].destination, 'Giving');
    assert.strictEqual(result.destinations[2].amount, '70');
    assert.strictEqual(result.destinations[2].destination, 'Spending');
  });

  it('fails safely when balance is insufficient for fixed rules', () => {
    const allocations: PersonalAllocation[] = [
      { destination: 'Savings', type: 'percentage', value: '20' }, // 20 XLM
      { destination: 'Giving', type: 'fixed', value: '90' },       // 90 XLM
      { destination: 'Spending', type: 'remainder' },
    ];
    
    const result = executePersonalRule('100', allocations);
    assert.strictEqual(result.destinations.length, 0);
    assert.strictEqual(result.error, 'Insufficient balance for fixed allocations');
  });

  it('fails safely when percentage exceeds 100', () => {
    const allocations: PersonalAllocation[] = [
      { destination: 'Savings', type: 'percentage', value: '60' },
      { destination: 'Giving', type: 'percentage', value: '50' },
    ];
    
    const result = executePersonalRule('100', allocations);
    assert.strictEqual(result.destinations.length, 0);
    assert.strictEqual(result.error, 'Total percentage exceeds 100%');
  });

  it('fails safely with invalid balance string', () => {
    const allocations: PersonalAllocation[] = [
      { destination: 'Savings', type: 'percentage', value: '20' },
    ];
    
    const result = executePersonalRule('notanumber', allocations);
    assert.strictEqual(result.destinations.length, 0);
    assert.strictEqual(result.error, 'Invalid monetary amount: "notanumber"');
  });
});
