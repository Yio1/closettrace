import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

afterEach(cleanup);

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
  URL.revokeObjectURL = () => {};
}

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
