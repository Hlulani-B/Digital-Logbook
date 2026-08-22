/**
 * Mock for the pg Pool used by db.js.
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
