/**
 * Network Status Hook
 * 
 * Provides real-time network status (online/offline) to React components.
 * Listens to browser online/offline events and updates state accordingly.
 */

import { useState, useEffect } from 'react';

/**
 * Hook to track network connectivity status.
 * @returns {boolean} True if online, false if offline
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network] Online');
      setIsOnline(true);
    };
    
    const handleOffline = () => {
      console.log('[Network] Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
