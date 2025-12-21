// Centralized Gemini API client and utilities

import { GoogleGenAI } from '@google/genai';

export const GEMINI_API_KEY_STORAGE = 'isocity-gemini-api-key';

// Get API key from localStorage
export function getGeminiApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(GEMINI_API_KEY_STORAGE);
}

// Check if API key is configured
export function hasGeminiApiKey(): boolean {
  return !!getGeminiApiKey();
}

// Save API key to localStorage
export function saveGeminiApiKey(key: string): void {
  localStorage.setItem(GEMINI_API_KEY_STORAGE, key);
}

// Clear API key from localStorage
export function clearGeminiApiKey(): void {
  localStorage.removeItem(GEMINI_API_KEY_STORAGE);
}

// Create Gemini client instance
export function createGeminiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  return new GoogleGenAI({ apiKey });
}
