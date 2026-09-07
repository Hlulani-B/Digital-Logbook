/**
 * Integration tests for the SSE real-time entry flow.
 *
 * These tests verify that multiple components work together correctly:
 * - SSE registry + sendToUser → correct SSE payload format
 * - Registry lifecycle → register, send, remove, cleanup
 * - Multi-user isolation → events don't leak between users
 * - Error resilience → dead connections are cleaned up
 */

import {
  registerConnection,
  removeConnection,
  sendToUser,
  getConnectionCount,
  getTotalConnections,
  _resetRegistry,
} from '../functions/sseRegistry.js';

describe('SSE Integration Tests', () => {
  beforeEach(() => {
    _resetRegistry();
  });

  describe('Full SSE lifecycle', () => {
    it('should handle complete connection → event → disconnection flow', () => {
      const mockRes = { write: jest.fn() };

      // 1. Client connects
      registerConnection('user@test.com', mockRes);
      expect(getConnectionCount('user@test.com')).toBe(1);
      expect(getTotalConnections()).toBe(1);

      // 2. Backend sends parsed entry via SSE
      const entryData = {
        success: true,
        project: 'WebApp',
        fields: { task: 'Fixed login bug' },
        priority: null,
        due_date: '2026-09-03',
        comment: 'Added to WebApp — nice bug fix!',
        multi: false,
        created_new_project: false,
        project_only: false,
      };

      const sent = sendToUser('user@test.com', 'entry_parsed', entryData);
      expect(sent).toBe(1);

      // 3. Verify the SSE payload is correctly formatted
      expect(mockRes.write).toHaveBeenCalledTimes(1);
      const payload = mockRes.write.mock.calls[0][0];
      expect(payload).toMatch(/^event: entry_parsed\ndata: .+\n\n$/);

      // 4. Verify the data is valid JSON
      const dataLine = payload.split('\n')[1]; // "data: {...}"
      const jsonStr = dataLine.replace('data: ', '');
      const parsed = JSON.parse(jsonStr);
      expect(parsed.project).toBe('WebApp');
      expect(parsed.fields.task).toBe('Fixed login bug');
      expect(parsed.due_date).toBe('2026-09-03');

      // 5. Client disconnects
      removeConnection('user@test.com', mockRes);
      expect(getConnectionCount('user@test.com')).toBe(0);
      expect(getTotalConnections()).toBe(0);
    });

    it('should handle multi-entry (matched=3) SSE events', () => {
      const mockRes = { write: jest.fn() };
      registerConnection('user@test.com', mockRes);

      const multiData = {
        success: true,
        multi: true,
        results: {
          old: [
            { project_name: 'WebApp', fields: { task: 'Fixed login bug' } },
            { project_name: 'Gym', fields: { activity: 'Ran 5km' } },
          ],
          new: [
            {
              project_name: 'Cooking',
              fields: { recipe: 'Made pasta' },
              new_fields: [{ field_name: 'recipe', data_type: 'text', is_required: false }],
            },
          ],
        },
        priority: null,
        due_date: null,
        comment: 'Added 3 entries across 3 projects!',
        created_new_project: true,
        project_only: false,
      };

      sendToUser('user@test.com', 'entry_parsed', multiData);

      const payload = mockRes.write.mock.calls[0][0];
      const jsonStr = payload.split('\n')[1].replace('data: ', '');
      const parsed = JSON.parse(jsonStr);

      expect(parsed.multi).toBe(true);
      expect(parsed.results.old).toHaveLength(2);
      expect(parsed.results.new).toHaveLength(1);
      expect(parsed.results.new[0].project_name).toBe('Cooking');
    });
  });

  describe('Multi-user isolation', () => {
    it('should never send User A events to User B', () => {
      const resA = { write: jest.fn() };
      const resB = { write: jest.fn() };

      registerConnection('userA@test.com', resA);
      registerConnection('userB@test.com', resB);

      // Send event for User A
      sendToUser('userA@test.com', 'entry_parsed', { project: 'UserA Project' });

      // User A should receive it
      expect(resA.write).toHaveBeenCalledTimes(1);
      // User B should NOT receive it
      expect(resB.write).not.toHaveBeenCalled();

      // Send event for User B
      sendToUser('userB@test.com', 'entry_parsed', { project: 'UserB Project' });

      // Now User B should have received exactly 1
      expect(resB.write).toHaveBeenCalledTimes(1);
      // User A should still have only 1
      expect(resA.write).toHaveBeenCalledTimes(1);

      // Verify payload content isolation
      const payloadA = resA.write.mock.calls[0][0];
      const payloadB = resB.write.mock.calls[0][0];
      expect(payloadA).toContain('UserA Project');
      expect(payloadB).toContain('UserB Project');
      expect(payloadA).not.toContain('UserB Project');
      expect(payloadB).not.toContain('UserA Project');
    });

    it('should handle multiple tabs for the same user', () => {
      const tab1 = { write: jest.fn() };
      const tab2 = { write: jest.fn() };
      const tab3 = { write: jest.fn() };

      registerConnection('user@test.com', tab1);
      registerConnection('user@test.com', tab2);
      registerConnection('user@test.com', tab3);

      expect(getConnectionCount('user@test.com')).toBe(3);

      // All tabs should receive the event
      sendToUser('user@test.com', 'entry_parsed', { project: 'TestProject' });

      expect(tab1.write).toHaveBeenCalledTimes(1);
      expect(tab2.write).toHaveBeenCalledTimes(1);
      expect(tab3.write).toHaveBeenCalledTimes(1);

      // Close one tab
      removeConnection('user@test.com', tab2);
      expect(getConnectionCount('user@test.com')).toBe(2);

      // Send another event — only 2 tabs should receive it
      sendToUser('user@test.com', 'entry_parsed', { project: 'TestProject2' });

      expect(tab1.write).toHaveBeenCalledTimes(2);
      expect(tab2.write).toHaveBeenCalledTimes(1); // Still 1 — was removed
      expect(tab3.write).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error resilience', () => {
    it('should clean up dead connections and continue sending to live ones', () => {
      const liveRes = { write: jest.fn() };
      const deadRes = {
        write: jest.fn().mockImplementation(() => {
          throw new Error('Stream closed');
        }),
      };

      registerConnection('user@test.com', liveRes);
      registerConnection('user@test.com', deadRes);
      expect(getConnectionCount('user@test.com')).toBe(2);

      // Send event — dead connection should be removed, live one should work
      const sent = sendToUser('user@test.com', 'entry_parsed', { test: true });

      expect(sent).toBe(1); // Only live connection received
      expect(liveRes.write).toHaveBeenCalledTimes(1);
      expect(getConnectionCount('user@test.com')).toBe(1); // Dead one removed

      // Next send should only go to the live connection
      sendToUser('user@test.com', 'entry_parsed', { test: true });
      expect(liveRes.write).toHaveBeenCalledTimes(2);
    });

    it('should handle all connections dying simultaneously', () => {
      const dead1 = { write: jest.fn().mockImplementation(() => { throw new Error('closed'); }) };
      const dead2 = { write: jest.fn().mockImplementation(() => { throw new Error('closed'); }) };

      registerConnection('user@test.com', dead1);
      registerConnection('user@test.com', dead2);

      const sent = sendToUser('user@test.com', 'entry_parsed', { test: true });
      expect(sent).toBe(0);
      expect(getConnectionCount('user@test.com')).toBe(0);
    });

    it('should handle rapid connect/disconnect cycles', () => {
      const connections = Array.from({ length: 20 }, () => ({ write: jest.fn() }));

      // Rapid connect
      for (const res of connections) {
        registerConnection('user@test.com', res);
      }
      expect(getConnectionCount('user@test.com')).toBe(20);

      // Rapid disconnect of half
      for (let i = 0; i < 10; i++) {
        removeConnection('user@test.com', connections[i]);
      }
      expect(getConnectionCount('user@test.com')).toBe(10);

      // Send should reach remaining 10
      const sent = sendToUser('user@test.com', 'entry_parsed', { test: true });
      expect(sent).toBe(10);
    });
  });

  describe('SSE event types', () => {
    it('should format entry_parsed event correctly', () => {
      const mockRes = { write: jest.fn() };
      registerConnection('user@test.com', mockRes);

      sendToUser('user@test.com', 'entry_parsed', {
        success: true,
        project: 'WebApp',
        fields: { task: 'Fixed bug' },
      });

      const payload = mockRes.write.mock.calls[0][0];
      expect(payload).toContain('event: entry_parsed');
      expect(payload).toContain('"success":true');
      expect(payload).toContain('"project":"WebApp"');
    });

    it('should format entry_error event correctly', () => {
      const mockRes = { write: jest.fn() };
      registerConnection('user@test.com', mockRes);

      sendToUser('user@test.com', 'entry_error', {
        success: false,
        error: 'AI returned invalid JSON',
      });

      const payload = mockRes.write.mock.calls[0][0];
      expect(payload).toContain('event: entry_error');
      expect(payload).toContain('"success":false');
      expect(payload).toContain('"error":"AI returned invalid JSON"');
    });

    it('should handle project_only events', () => {
      const mockRes = { write: jest.fn() };
      registerConnection('user@test.com', mockRes);

      sendToUser('user@test.com', 'entry_parsed', {
        success: true,
        project: 'NewProject',
        project_only: true,
        fields: {},
        created_new_project: true,
      });

      const payload = mockRes.write.mock.calls[0][0];
      const jsonStr = payload.split('\n')[1].replace('data: ', '');
      const parsed = JSON.parse(jsonStr);
      expect(parsed.project_only).toBe(true);
      expect(parsed.created_new_project).toBe(true);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle sends to different users concurrently', () => {
      const resA = { write: jest.fn() };
      const resB = { write: jest.fn() };
      const resC = { write: jest.fn() };

      registerConnection('a@test.com', resA);
      registerConnection('b@test.com', resB);
      registerConnection('c@test.com', resC);

      // Send to all three concurrently (simulated)
      sendToUser('a@test.com', 'entry_parsed', { project: 'A' });
      sendToUser('b@test.com', 'entry_parsed', { project: 'B' });
      sendToUser('c@test.com', 'entry_parsed', { project: 'C' });

      expect(resA.write).toHaveBeenCalledTimes(1);
      expect(resB.write).toHaveBeenCalledTimes(1);
      expect(resC.write).toHaveBeenCalledTimes(1);

      // Each should only have their own data
      expect(resA.write.mock.calls[0][0]).toContain('"project":"A"');
      expect(resB.write.mock.calls[0][0]).toContain('"project":"B"');
      expect(resC.write.mock.calls[0][0]).toContain('"project":"C"');
    });

    it('should handle rapid sequential sends to same user', () => {
      const mockRes = { write: jest.fn() };
      registerConnection('user@test.com', mockRes);

      for (let i = 0; i < 100; i++) {
        sendToUser('user@test.com', 'entry_parsed', { index: i });
      }

      expect(mockRes.write).toHaveBeenCalledTimes(100);
      // Verify last event has correct data
      const lastPayload = mockRes.write.mock.calls[99][0];
      const jsonStr = lastPayload.split('\n')[1].replace('data: ', '');
      expect(JSON.parse(jsonStr).index).toBe(99);
    });
  });
});
