import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to declare mock variables before vi.mock hoisting
const { mockCacheGet, mockCacheSet, mockCacheDelete, mockRequest, mockAddToQueue } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockCacheDelete: vi.fn(),
  mockRequest: vi.fn(),
  mockAddToQueue: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
  cacheDelete: mockCacheDelete,
  CACHE_STORES: { PROFILE: 'profile', PROJECTS: 'projects', ALL_ENTRIES: 'all_entries' },
}));

vi.mock('@/lib/api', () => ({
  request: mockRequest,
  PROFILE_URL: 'https://profile-service.test',
}));

vi.mock('@/CacheFunctions/offlineQueue', () => ({
  addToQueue: mockAddToQueue,
}));

// Now import the re-export module — this exercises the re-export lines
import {
  getProfile,
  updateName,
  updateUsername,
  updateAvatar,
  deleteProfile,
  addEmail,
} from '../profileService';

describe('profileService (re-exports)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  it('exports getProfile as a function', () => {
    expect(typeof getProfile).toBe('function');
  });

  it('exports updateName as a function', () => {
    expect(typeof updateName).toBe('function');
  });

  it('exports updateUsername as a function', () => {
    expect(typeof updateUsername).toBe('function');
  });

  it('exports updateAvatar as a function', () => {
    expect(typeof updateAvatar).toBe('function');
  });

  it('exports deleteProfile as a function', () => {
    expect(typeof deleteProfile).toBe('function');
  });

  it('exports addEmail as a function', () => {
    expect(typeof addEmail).toBe('function');
  });

  it('getProfile returns cached data when available', async () => {
    const cached = { data: { username: 'test' }, success: true };
    mockCacheGet.mockResolvedValueOnce(cached);

    const result = await getProfile('test@test.com');
    expect(result).toEqual({ ...cached, _fromCache: true });
  });

  it('getProfile fetches from server when no cache', async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    mockRequest.mockResolvedValueOnce({ success: true, profile: { username: 'new' } });

    const result = await getProfile('test@test.com');
    expect(result.success).toBe(true);
  });

  it('getProfile returns offline flag when no cache and offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false });
    mockCacheGet.mockResolvedValueOnce(null);

    const result = await getProfile('test@test.com');
    expect(result).toEqual({ success: false, offline: true });
  });

  it('updateName calls request and refreshes profile', async () => {
    mockCacheGet.mockResolvedValueOnce({ data: { username: 'old' } });
    mockCacheSet.mockResolvedValueOnce(undefined);
    mockRequest.mockResolvedValueOnce({ success: true });
    mockCacheGet.mockResolvedValueOnce({ data: { username: 'new' } });

    const result = await updateName('test@test.com', 'New Name');
    expect(result.success).toBe(true);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/service/profile'),
      expect.objectContaining({ body: expect.stringContaining('"name"') })
    );
  });

  it('updateUsername queues when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false });
    mockCacheGet.mockResolvedValueOnce({ data: {} });
    mockCacheSet.mockResolvedValueOnce(undefined);
    mockAddToQueue.mockResolvedValueOnce(undefined);

    const result = await updateUsername('test@test.com', 'newuser');
    expect(result).toEqual({ success: true, queued: true });
    expect(mockAddToQueue).toHaveBeenCalled();
  });

  it('deleteProfile clears caches and calls server', async () => {
    mockCacheDelete.mockResolvedValue(undefined);
    mockRequest.mockResolvedValueOnce({ success: true });

    const result = await deleteProfile('test@test.com');
    expect(result.success).toBe(true);
    expect(mockCacheDelete).toHaveBeenCalledTimes(3);
  });

  it('addEmail calls request with email function', async () => {
    mockRequest.mockResolvedValueOnce({ success: true });

    const result = await addEmail('new@test.com');
    expect(result.success).toBe(true);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/service/profile'),
      expect.objectContaining({ body: expect.stringContaining('"email"') })
    );
  });

  it('updateAvatar queues when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false });
    mockCacheGet.mockResolvedValueOnce({ data: {} });
    mockCacheSet.mockResolvedValueOnce(undefined);
    mockAddToQueue.mockResolvedValueOnce(undefined);

    const result = await updateAvatar('test@test.com', 'https://avatar.url/img.png');
    expect(result).toEqual({ success: true, queued: true });
  });
});
