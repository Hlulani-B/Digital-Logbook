/**
 * Offline Sync Toast Notifications
 * 
 * Displays toast notifications when the offline queue is being processed.
 * Shows progress as actions are synced to the server.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { processQueue, getPendingCount } from '../CacheFunctions/queueProcessor';
import { syncAllData } from '../CacheFunctions/syncService';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ProgressUpdate {
  type: 'start' | 'success' | 'failed' | 'retry' | 'complete';
  total?: number;
  action?: string;
  message?: string;
  succeeded?: number;
  failed?: number;
}

export function OfflineSyncToasts() {
  const isOnline = useNetworkStatus();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Track actual offline→online transitions
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
  }, [isOnline]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (isOnline && !isProcessing && wasOffline) {
      // Only process queue after a real offline→online transition
      getPendingCount().then((count) => {
        if (count > 0) {
          setIsProcessing(true);
          addToast(`Back online! Syncing ${count} pending action${count > 1 ? 's' : ''}...`, 'info');
          
          processQueue((progress: ProgressUpdate) => {
            switch (progress.type) {
              case 'success':
                addToast(progress.message || 'Action synced', 'success');
                break;
              case 'failed':
                addToast(progress.message || 'Action failed', 'error');
                break;
              case 'retry':
                addToast(progress.message || 'Retrying action...', 'warning');
                break;
              case 'complete':
                const { succeeded = 0, failed = 0 } = progress;
                if (failed === 0) {
                  addToast(`All ${succeeded} action${succeeded !== 1 ? 's' : ''} synced successfully!`, 'success');
                } else {
                  addToast(`Sync complete: ${succeeded} succeeded, ${failed} failed`, 'warning');
                }
                // Refresh all cached data from server after successful sync
                if (succeeded > 0) {
                  (async () => {
                    try {
                      const { getSupabase } = await import('../lib/supabase');
                      const { data: { session } } = await getSupabase().auth.getSession();
                      const userEmail = session?.user?.email;
                      if (userEmail) {
                        syncAllData(userEmail, { force: true }).catch((err) => {
                          console.warn('[OfflineSyncToasts] Post-sync refresh failed:', err);
                        });
                      }
                    } catch (err) {
                      console.warn('[OfflineSyncToasts] Failed to get user email for refresh:', err);
                    }
                  })();
                }
                setIsProcessing(false);
                setWasOffline(false);
                break;
            }
          });
        } else {
          // No pending actions, reset the flag
          setWasOffline(false);
        }
      });
    }
  }, [isOnline, isProcessing, wasOffline, addToast]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '400px',
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: toast.type === 'success' ? '#10b981' :
                           toast.type === 'error' ? '#ef4444' :
                           toast.type === 'warning' ? '#f59e0b' : '#3b82f6',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            cursor: 'pointer',
            fontSize: '14px',
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
