/**
 * Mock for the pg Pool used by db.js.
 * Tests can set `mockPool.query.mockResolvedValueOnce({ rows: [...] })`
 * or `mockPool.query.mockRejectedValueOnce(error)` to control responses.
 */

const mockClient = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
  release: jest.fn(),
};

export const mockPool = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
  connect: jest.fn().mockResolvedValue(mockClient),
};

export { mockClient };

export default mockPool;
