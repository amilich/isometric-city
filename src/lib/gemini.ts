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

// ============================================================================
// ADVISOR CHAT
// ============================================================================

const ADVISOR_SYSTEM_PROMPT = `You are the Chief City Planner. Experienced, direct, occasionally wry.
Keep responses SHORT (2-4 sentences). One key insight per response. Be direct, not verbose.
Translate data naturally (say "strong residential demand" not "R+100").`;

export interface AdvisorMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CityState {
  cityName: string;
  year: number;
  month: number;
  population: number;
  money: number;
  income: number;
  expenses: number;
  happiness: number;
  health: number;
  education: number;
  safety: number;
  environment: number;
  demand: { residential: number; commercial: number; industrial: number };
  issues: { unpowered: number; unwatered: number; abandoned: number };
}

// Format city state as compact text
function formatCityState(s: CityState): string {
  const net = s.income - s.expenses;
  const avg = (s.happiness + s.health + s.education + s.safety + s.environment) / 5;
  const grade = avg >= 90 ? 'A+' : avg >= 80 ? 'A' : avg >= 70 ? 'B' : avg >= 60 ? 'C' : avg >= 50 ? 'D' : 'F';
  const fmt = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n);

  let text = `${s.cityName} Y${s.year}M${s.month}: Pop ${fmt(s.population)}, $${fmt(s.money)} (${net >= 0 ? '+' : ''}${fmt(net)}/mo), Grade ${grade}\n`;
  text += `Ratings: Happy ${s.happiness}, Health ${s.health}, Edu ${s.education}, Safety ${s.safety}, Env ${s.environment}\n`;
  text += `Demand: R${s.demand.residential >= 0 ? '+' : ''}${s.demand.residential} C${s.demand.commercial >= 0 ? '+' : ''}${s.demand.commercial} I${s.demand.industrial >= 0 ? '+' : ''}${s.demand.industrial}`;

  const issues = [];
  if (s.issues.unpowered > 0) issues.push(`${s.issues.unpowered} unpowered`);
  if (s.issues.unwatered > 0) issues.push(`${s.issues.unwatered} unwatered`);
  if (s.issues.abandoned > 0) issues.push(`${s.issues.abandoned} abandoned`);
  if (issues.length > 0) text += `\nIssues: ${issues.join(', ')}`;

  return text;
}

// Get advisor response
export async function getAdvisorResponse(
  cityState: CityState,
  userMessage: string | undefined,
  history: AdvisorMessage[]
): Promise<string> {
  const ai = createGeminiClient();
  const stateText = formatCityState(cityState);

  const historyText = history.slice(-6).map(m =>
    `${m.role === 'user' ? 'Player' : 'Advisor'}: ${m.content}`
  ).join('\n');

  const prompt = `${ADVISOR_SYSTEM_PROMPT}

${historyText ? `Previous conversation:\n${historyText}\n\n` : ''}Current city state:
${stateText}

${userMessage ? `Player question: ${userMessage}` : 'Give brief advice on the current situation.'}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response.text || 'Unable to generate response.';
}
