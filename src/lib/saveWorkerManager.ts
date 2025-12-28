// Save Worker Manager
// Manages a Web Worker for off-main-thread serialization, compression, and decompression
// Uses Next.js built-in worker bundling (bundles lz-string with the worker)

import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<number, PendingRequest>();

/**
 * Initialize the save worker using Next.js worker bundling
 * @returns true if worker was created, false if workers not supported
 */
function initWorker(): boolean {
  if (typeof window === 'undefined') return false;
  if (worker) return true;
  
  try {
    // Next.js/Webpack bundles the worker file and its dependencies (lz-string)
    // when using new URL() with import.meta.url
    worker = new Worker(new URL('./saveWorker.ts', import.meta.url));
    
    worker.onmessage = (event) => {
      const { type, id, compressed, state, error } = event.data;
      
      const pending = pendingRequests.get(id);
      if (!pending) return;
      
      clearTimeout(pending.timeoutId);
      pendingRequests.delete(id);
      
      if (error) {
        pending.reject(new Error(error));
      } else if (type === 'serialized-compressed') {
        pending.resolve(compressed);
      } else if (type === 'decompressed-parsed') {
        pending.resolve(state);
      }
    };
    
    worker.onerror = (error) => {
      console.error('Save worker error:', error);
      // Reject all pending requests
      pendingRequests.forEach((pending) => {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Worker error'));
      });
      pendingRequests.clear();
      // Terminate and clear worker so we fall back to main thread
      worker?.terminate();
      worker = null;
    };
    
    return true;
  } catch (error) {
    console.warn('Failed to create save worker, falling back to main thread:', error);
    return false;
  }
}

/**
 * Serialize and compress a game state using the worker (off main thread)
 * Both JSON.stringify and LZ-string compression happen in the worker
 * Falls back to main thread if worker is not available
 */
export async function serializeAndCompressAsync(state: unknown): Promise<string> {
  // Try to initialize worker if not already done
  if (!worker && !initWorker()) {
    // Fallback: serialize and compress on main thread
    return compressToUTF16(JSON.stringify(state));
  }
  
  const id = ++requestId;
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const pending = pendingRequests.get(id);
      if (pending) {
        pendingRequests.delete(id);
        console.warn('Save worker timeout, falling back to main thread');
        try {
          const compressed = compressToUTF16(JSON.stringify(state));
          resolve(compressed);
        } catch (error) {
          reject(error);
        }
      }
    }, 15000); // 15 second timeout for larger states
    
    pendingRequests.set(id, { resolve, reject, timeoutId });
    
    try {
      worker!.postMessage({ type: 'serialize-compress', id, state });
    } catch (error) {
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      try {
        const compressed = compressToUTF16(JSON.stringify(state));
        resolve(compressed);
      } catch (fallbackError) {
        reject(fallbackError);
      }
    }
  });
}

/**
 * Decompress and parse a game state using the worker (off main thread)
 * Both LZ-string decompression and JSON.parse happen in the worker
 * Falls back to main thread if worker is not available
 */
export async function decompressAndParseAsync<T = unknown>(compressed: string): Promise<T | null> {
  // Try to initialize worker if not already done
  if (!worker && !initWorker()) {
    // Fallback: decompress and parse on main thread
    try {
      let jsonString = decompressFromUTF16(compressed);
      if (!jsonString || !jsonString.startsWith('{')) {
        if (compressed.startsWith('{')) {
          jsonString = compressed;
        } else {
          return null;
        }
      }
      return JSON.parse(jsonString) as T;
    } catch {
      return null;
    }
  }
  
  const id = ++requestId;
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const pending = pendingRequests.get(id);
      if (pending) {
        pendingRequests.delete(id);
        console.warn('Save worker timeout, falling back to main thread');
        try {
          let jsonString = decompressFromUTF16(compressed);
          if (!jsonString || !jsonString.startsWith('{')) {
            if (compressed.startsWith('{')) {
              jsonString = compressed;
            } else {
              resolve(null);
              return;
            }
          }
          resolve(JSON.parse(jsonString) as T);
        } catch {
          resolve(null);
        }
      }
    }, 15000);
    
    pendingRequests.set(id, { resolve, reject, timeoutId });
    
    try {
      worker!.postMessage({ type: 'decompress-parse', id, compressed });
    } catch (error) {
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      try {
        let jsonString = decompressFromUTF16(compressed);
        if (!jsonString || !jsonString.startsWith('{')) {
          if (compressed.startsWith('{')) {
            jsonString = compressed;
          } else {
            resolve(null);
            return;
          }
        }
        resolve(JSON.parse(jsonString) as T);
      } catch {
        resolve(null);
      }
    }
  });
}

// Legacy export for backward compatibility
export const compressAsync = (data: string): Promise<string> => {
  return serializeAndCompressAsync(data);
};

/**
 * Terminate the worker and clean up resources
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pendingRequests.forEach((pending) => {
    clearTimeout(pending.timeoutId);
  });
  pendingRequests.clear();
}
