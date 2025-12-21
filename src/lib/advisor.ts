// Advisor chat functionality

import { createGeminiClient } from './gemini';

// Maximum number of messages to include in advisor chat history
const MAX_CHAT_HISTORY = 6;

const GAME_MECHANICS_GUIDE = `
GAME MECHANICS GUIDE:

ZONES: Place zones and buildings will grow automatically when conditions are met.
- Residential (R): Houses people. Needs road access, power, water. Grows when there's demand and jobs nearby.
- Commercial (C): Shops and offices. Provides jobs. Needs road access, power, water, and nearby population.
- Industrial (I): Factories. Provides jobs, causes pollution. Keep away from residential. Needs road access, power, water.

SERVICES (place buildings from toolbar):
- Power Plant: Provides electricity in radius. Buildings need power to function.
- Water Tower: Provides water in radius. Buildings need water to function.
- Police Station: Reduces crime, improves safety rating in radius.
- Fire Station: Reduces fire risk in radius.
- Hospital: Improves health rating in radius.
- School: Improves education rating in radius.

ROADS: All zones need road access to develop. Connect zones to each other and to services.

DEMAND (RCI bars):
- Positive demand = that zone type will grow if you place more of it
- Negative demand = too much of that zone, won't grow until balance improves
- Residential demand increases with jobs, decreases with high taxes
- Commercial/Industrial demand increases with population

TAXES: Higher taxes = more income but reduces demand and happiness. 7-10% is balanced.

TIPS FOR GROWTH:
1. Start small: power plant, water tower, roads, then zones
2. Balance RCI - check demand bars before zoning
3. Provide services as you grow (safety, health, education)
4. Keep industry away from residential (pollution lowers land value)
5. Parks and trees improve environment and land value
`;

const ADVISOR_SYSTEM_PROMPT = `You are the Chief City Planner. Experienced, direct, occasionally wry.
Keep responses SHORT (2-4 sentences). One key insight per response. Be direct, not verbose.
Translate data naturally (say "strong residential demand" not "R+100").

${GAME_MECHANICS_GUIDE}
When players ask how to do something, reference the game mechanics above.`;

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

  const historyText = history.slice(-MAX_CHAT_HISTORY).map(m =>
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
