// Web Worker for game save/load operations
// Handles expensive JSON serialization and LZ-string compression off the main thread
// This file is bundled separately by Next.js/Webpack

import { compressToUTF16, decompressFromUTF16, compressToEncodedURIComponent } from 'lz-string';

export type SaveWorkerMessage = 
  | { type: 'serialize-compress'; id: number; state: unknown }
  | { type: 'decompress-parse'; id: number; compressed: string }
  | { type: 'serialize-compress-uri'; id: number; state: unknown }
  // PERF: Transferable buffer variants - no structuredClone overhead!
  | { type: 'compress-transferred'; id: number; buffer: ArrayBuffer }
  | { type: 'compress-transferred-uri'; id: number; buffer: ArrayBuffer };

export type SaveWorkerResponse = 
  | { type: 'serialized-compressed'; id: number; compressed: string; error?: string }
  | { type: 'decompressed-parsed'; id: number; state: unknown; error?: string }
  | { type: 'serialized-compressed-uri'; id: number; compressed: string; error?: string }
  | { type: 'compressed-transferred'; id: number; compressed: string; error?: string }
  | { type: 'compressed-transferred-uri'; id: number; compressed: string; error?: string };

// Worker message handler
self.onmessage = (event: MessageEvent<SaveWorkerMessage>) => {
  const { type, id } = event.data;
  
  // Serialize game state to JSON and compress
  if (type === 'serialize-compress') {
    try {
      const { state } = event.data as { type: 'serialize-compress'; id: number; state: unknown };
      // Both operations happen in the worker - no main thread blocking!
      const serialized = JSON.stringify(state);
      const compressed = compressToUTF16(serialized);
      
      self.postMessage({
        type: 'serialized-compressed',
        id,
        compressed,
      });
    } catch (error) {
      self.postMessage({
        type: 'serialized-compressed',
        id,
        compressed: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  // Serialize and compress for Supabase (URI-safe encoding)
  if (type === 'serialize-compress-uri') {
    try {
      const { state } = event.data as { type: 'serialize-compress-uri'; id: number; state: unknown };
      const serialized = JSON.stringify(state);
      const compressed = compressToEncodedURIComponent(serialized);
      
      self.postMessage({
        type: 'serialized-compressed-uri',
        id,
        compressed,
      });
    } catch (error) {
      self.postMessage({
        type: 'serialized-compressed-uri',
        id,
        compressed: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  // PERF: Compress pre-serialized data from transferred ArrayBuffer (zero-copy transfer!)
  // Main thread serializes to JSON string, encodes to ArrayBuffer, transfers ownership
  // This avoids the expensive structuredClone of complex nested objects
  if (type === 'compress-transferred') {
    try {
      const { buffer } = event.data as { type: 'compress-transferred'; id: number; buffer: ArrayBuffer };
      // Decode the transferred buffer back to string
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(buffer);
      // Compress the JSON string
      const compressed = compressToUTF16(jsonString);
      
      self.postMessage({
        type: 'compressed-transferred',
        id,
        compressed,
      });
    } catch (error) {
      self.postMessage({
        type: 'compressed-transferred',
        id,
        compressed: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  // PERF: Same as above but with URI-safe encoding for Supabase
  if (type === 'compress-transferred-uri') {
    try {
      const { buffer } = event.data as { type: 'compress-transferred-uri'; id: number; buffer: ArrayBuffer };
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(buffer);
      const compressed = compressToEncodedURIComponent(jsonString);
      
      self.postMessage({
        type: 'compressed-transferred-uri',
        id,
        compressed,
      });
    } catch (error) {
      self.postMessage({
        type: 'compressed-transferred-uri',
        id,
        compressed: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  // Decompress and parse JSON back to game state
  if (type === 'decompress-parse') {
    try {
      const { compressed } = event.data as { type: 'decompress-parse'; id: number; compressed: string };
      
      // Try to decompress (might be legacy uncompressed format)
      let jsonString = decompressFromUTF16(compressed);
      if (!jsonString || !jsonString.startsWith('{')) {
        // Legacy format - already JSON
        if (compressed.startsWith('{')) {
          jsonString = compressed;
        } else {
          throw new Error('Invalid compressed data');
        }
      }
      
      const state = JSON.parse(jsonString);
      
      self.postMessage({
        type: 'decompressed-parsed',
        id,
        state,
      });
    } catch (error) {
      self.postMessage({
        type: 'decompressed-parsed',
        id,
        state: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};
