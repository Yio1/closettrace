import { useState } from 'react';

export function useRegisterSW() {
  const [needRefresh, setNeedRefresh] = useState(false);
  return {
    needRefresh: [needRefresh, setNeedRefresh] as const,
    offlineReady: [false, () => undefined] as const,
    updateServiceWorker: async () => undefined,
  };
}
