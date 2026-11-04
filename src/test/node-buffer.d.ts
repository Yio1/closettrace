// Test-only shim: tsconfig.app has no Node type environment, but backup tests need
// Node's Blob because jsdom Blobs do not survive fake-indexeddb's structuredClone.
declare module 'node:buffer' {
  export const Blob: typeof globalThis.Blob;
}
