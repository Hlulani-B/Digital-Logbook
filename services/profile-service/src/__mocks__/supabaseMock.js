/**
 * Creates a mock Supabase client that mimics the chainable query builder pattern.
 * Each chain method returns the chain object so calls can be chained
 * (e.g. .from().insert().select()).
 *
 * @param {object} options
 * @param {object} options.error  - The error object to return from the final operation
 * @param {Array}  options.data   - The data array to return from the final operation
 * @returns {object} mock chain
 */
export function createMockChain({ error = null, data = [] } = {}) {
  const chain = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    then: jest.fn((resolve) => resolve({ data, error })),
  };

  // Make the chain itself awaitable (thenable) so `await` resolves to { data, error }.
  // Real Supabase always resolves – errors come back in the resolved value, not as rejections.
  chain.then = jest.fn((resolve) => {
    return resolve({ data, error });
  });

  return chain;
}

/**
 * Build a mock Supabase client from a map of table names to chain options.
 *
 * @param {object} tableResponses - e.g. { users: { data: [...], error: null } }
 * @returns {object} mock client with a `from` method
 */
export function createMockSupabaseClient(tableResponses = {}) {
  return {
    from: jest.fn((tableName) => {
      const response = tableResponses[tableName] || { data: [], error: null };
      return createMockChain(response);
    }),
  };
}

/**
 * Shared default mock for the `../supabase.js` module.
 */
export const supabase = {
  from: jest.fn(() => createMockChain()),
};
