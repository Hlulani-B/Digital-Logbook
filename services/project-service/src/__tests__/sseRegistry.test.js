import {
  registerConnection,
  removeConnection,
  sendToUser,
  getConnectionCount,
  getTotalConnections,
  _resetRegistry,
} from '../functions/sseRegistry.js';

describe('SSE Registry', () => {
  let mockRes;

  beforeEach(() => {
    _resetRegistry();
    mockRes = {
      write: jest.fn(),
    };
  });

  describe('registerConnection', () => {
    it('should register a connection for a user', () => {
      registerConnection('test@example.com', mockRes);
      expect(getConnectionCount('test@example.com')).toBe(1);
    });

    it('should support multiple connections for the same user', () => {
      const mockRes2 = { write: jest.fn() };
      registerConnection('test@example.com', mockRes);
      registerConnection('test@example.com', mockRes2);
      expect(getConnectionCount('test@example.com')).toBe(2);
    });

    it('should track connections for different users separately', () => {
      const mockRes2 = { write: jest.fn() };
      registerConnection('user1@example.com', mockRes);
      registerConnection('user2@example.com', mockRes2);
      expect(getConnectionCount('user1@example.com')).toBe(1);
      expect(getConnectionCount('user2@example.com')).toBe(1);
    });
  });

  describe('removeConnection', () => {
    it('should remove a connection for a user', () => {
      registerConnection('test@example.com', mockRes);
      expect(getConnectionCount('test@example.com')).toBe(1);
      removeConnection('test@example.com', mockRes);
      expect(getConnectionCount('test@example.com')).toBe(0);
    });

    it('should handle removing non-existent connection gracefully', () => {
      expect(() => removeConnection('nobody@example.com', mockRes)).not.toThrow();
    });

    it('should only remove the specific connection, not all', () => {
      const mockRes2 = { write: jest.fn() };
      registerConnection('test@example.com', mockRes);
      registerConnection('test@example.com', mockRes2);
      removeConnection('test@example.com', mockRes);
      expect(getConnectionCount('test@example.com')).toBe(1);
    });
  });

  describe('sendToUser', () => {
    it('should send an SSE event to all connections for a user', () => {
      registerConnection('test@example.com', mockRes);
      const data = { project: 'TestProject', fields: { task: 'Test task' } };
      const sent = sendToUser('test@example.com', 'entry_parsed', data);
      expect(sent).toBe(1);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('event: entry_parsed')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(data))
      );
    });

    it('should return 0 when no connections exist', () => {
      const sent = sendToUser('nobody@example.com', 'entry_parsed', {});
      expect(sent).toBe(0);
    });

    it('should send to all connections for a user', () => {
      const mockRes2 = { write: jest.fn() };
      registerConnection('test@example.com', mockRes);
      registerConnection('test@example.com', mockRes2);
      const sent = sendToUser('test@example.com', 'entry_parsed', { test: true });
      expect(sent).toBe(2);
      expect(mockRes.write).toHaveBeenCalled();
      expect(mockRes2.write).toHaveBeenCalled();
    });

    it('should remove dead connections on write failure', () => {
      mockRes.write.mockImplementation(() => {
        throw new Error('Connection closed');
      });
      registerConnection('test@example.com', mockRes);
      const sent = sendToUser('test@example.com', 'entry_parsed', {});
      expect(sent).toBe(0);
      expect(getConnectionCount('test@example.com')).toBe(0);
    });

    it('should format SSE payload correctly', () => {
      registerConnection('test@example.com', mockRes);
      const data = { project: 'WebApp', comment: 'Hello' };
      sendToUser('test@example.com', 'entry_parsed', data);
      const expectedPayload = `event: entry_parsed\ndata: ${JSON.stringify(data)}\n\n`;
      expect(mockRes.write).toHaveBeenCalledWith(expectedPayload);
    });
  });

  describe('getConnectionCount', () => {
    it('should return 0 for unknown user', () => {
      expect(getConnectionCount('unknown@example.com')).toBe(0);
    });
  });

  describe('getTotalConnections', () => {
    it('should return total across all users', () => {
      const mockRes2 = { write: jest.fn() };
      registerConnection('user1@example.com', mockRes);
      registerConnection('user2@example.com', mockRes2);
      expect(getTotalConnections()).toBe(2);
    });

    it('should return 0 when no connections', () => {
      expect(getTotalConnections()).toBe(0);
    });
  });
});
