#!/usr/bin/env node
/**
 * Agent Log Analyzer
 * 
 * Analyzes agent logs to identify patterns, errors, and improvement opportunities.
 * 
 * Usage: node scripts/analyze-agent-logs.mjs [session-folder]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.join(__dirname, '..', 'agent-logs');

async function getLatestSession() {
  const entries = await fs.readdir(LOGS_DIR);
  const sessions = entries.filter(e => e.startsWith('session-'));
  sessions.sort().reverse();
  return sessions[0];
}

async function loadTurnLogs(sessionDir) {
  const files = await fs.readdir(sessionDir);
  const turnFiles = files.filter(f => f.startsWith('turn-') && f.endsWith('.json'));
  turnFiles.sort();
  
  const logs = [];
  for (const file of turnFiles) {
    const content = await fs.readFile(path.join(sessionDir, file), 'utf-8');
    logs.push(JSON.parse(content));
  }
  return logs;
}

function analyzeErrors(logs) {
  const errorsByType = {};
  const errorsByPlayer = {};
  
  for (const log of logs) {
    for (const error of log.errors) {
      // Extract error type
      const match = error.match(/^([^:]+):/);
      const errorType = match ? match[1] : 'unknown';
      
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      errorsByPlayer[log.playerName] = (errorsByPlayer[log.playerName] || 0) + 1;
    }
  }
  
  return { errorsByType, errorsByPlayer };
}

function analyzeToolUsage(logs) {
  const toolUsage = {};
  const toolSuccessRate = {};
  
  for (const log of logs) {
    for (const tc of log.toolCalls) {
      toolUsage[tc.name] = (toolUsage[tc.name] || 0) + 1;
      
      if (!toolSuccessRate[tc.name]) {
        toolSuccessRate[tc.name] = { success: 0, total: 0 };
      }
      toolSuccessRate[tc.name].total++;
      if (tc.success) toolSuccessRate[tc.name].success++;
    }
  }
  
  return { toolUsage, toolSuccessRate };
}

function analyzePerformance(logs) {
  const responseTimesMs = logs.map(l => l.output.responseTimeMs);
  const avgResponseTime = responseTimesMs.reduce((a, b) => a + b, 0) / responseTimesMs.length;
  const maxResponseTime = Math.max(...responseTimesMs);
  const minResponseTime = Math.min(...responseTimesMs);
  
  const iterations = logs.map(l => l.output.iterations);
  const avgIterations = iterations.reduce((a, b) => a + b, 0) / iterations.length;
  
  return { avgResponseTime, maxResponseTime, minResponseTime, avgIterations };
}

function findCommonMistakes(logs) {
  const mistakes = [];
  
  for (const log of logs) {
    // Check for repeated failed actions
    const failedTools = log.toolCalls.filter(tc => !tc.success);
    for (const ft of failedTools) {
      if (ft.result.includes('Not enough')) {
        mistakes.push({
          type: 'resource_check',
          player: log.playerName,
          tick: log.tick,
          detail: `Tried ${ft.name} without resources`,
        });
      }
      if (ft.result.includes('Population cap')) {
        mistakes.push({
          type: 'pop_cap',
          player: log.playerName,
          tick: log.tick,
          detail: 'Tried to train while pop capped',
        });
      }
      if (ft.result.includes("doesn't fit")) {
        mistakes.push({
          type: 'bad_placement',
          player: log.playerName,
          tick: log.tick,
          detail: 'Invalid building placement',
        });
      }
    }
  }
  
  // Group by type
  const grouped = {};
  for (const m of mistakes) {
    grouped[m.type] = (grouped[m.type] || 0) + 1;
  }
  
  return grouped;
}

async function main() {
  const sessionArg = process.argv[2];
  let sessionId;
  
  if (sessionArg) {
    sessionId = sessionArg;
  } else {
    sessionId = await getLatestSession();
    if (!sessionId) {
      console.log('No sessions found in agent-logs/');
      process.exit(1);
    }
  }
  
  const sessionDir = path.join(LOGS_DIR, sessionId);
  console.log(`\n📊 Analyzing session: ${sessionId}\n`);
  
  // Load session summary
  try {
    const summaryPath = path.join(sessionDir, 'session-summary.json');
    const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
    console.log('Session Summary:');
    console.log(`  Start: ${summary.startTime}`);
    console.log(`  Last tick: ${summary.lastTick}`);
    console.log(`  Players: ${summary.players.join(', ')}`);
    console.log(`  Total turns: ${summary.turnCount}`);
    console.log(`  Total errors: ${summary.errors}`);
    console.log();
  } catch {
    console.log('(No session summary found)\n');
  }
  
  // Load all turn logs
  const logs = await loadTurnLogs(sessionDir);
  console.log(`Loaded ${logs.length} turn logs\n`);
  
  if (logs.length === 0) {
    console.log('No turn logs found');
    process.exit(0);
  }
  
  // Analyze
  console.log('═'.repeat(50));
  console.log('TOOL USAGE');
  console.log('═'.repeat(50));
  const { toolUsage, toolSuccessRate } = analyzeToolUsage(logs);
  for (const [tool, count] of Object.entries(toolUsage).sort((a, b) => b[1] - a[1])) {
    const rate = toolSuccessRate[tool];
    const pct = ((rate.success / rate.total) * 100).toFixed(0);
    console.log(`  ${tool}: ${count} calls (${pct}% success)`);
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('ERRORS');
  console.log('═'.repeat(50));
  const { errorsByType, errorsByPlayer } = analyzeErrors(logs);
  console.log('By type:');
  for (const [type, count] of Object.entries(errorsByType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
  console.log('By player:');
  for (const [player, count] of Object.entries(errorsByPlayer).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${player}: ${count} errors`);
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('COMMON MISTAKES');
  console.log('═'.repeat(50));
  const mistakes = findCommonMistakes(logs);
  for (const [type, count] of Object.entries(mistakes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count} occurrences`);
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('PERFORMANCE');
  console.log('═'.repeat(50));
  const perf = analyzePerformance(logs);
  console.log(`  Avg response time: ${(perf.avgResponseTime / 1000).toFixed(2)}s`);
  console.log(`  Max response time: ${(perf.maxResponseTime / 1000).toFixed(2)}s`);
  console.log(`  Min response time: ${(perf.minResponseTime / 1000).toFixed(2)}s`);
  console.log(`  Avg iterations per turn: ${perf.avgIterations.toFixed(1)}`);
  
  console.log('\n' + '═'.repeat(50));
  console.log('RECOMMENDATIONS');
  console.log('═'.repeat(50));
  
  if (mistakes.resource_check > 5) {
    console.log('  ⚠️  AI frequently tries actions without checking resources first');
    console.log('     → Consider adding resource check to system prompt');
  }
  if (mistakes.pop_cap > 5) {
    console.log('  ⚠️  AI frequently tries to train while pop capped');
    console.log('     → Emphasize pop cap rules in prompt');
  }
  if (mistakes.bad_placement > 5) {
    console.log('  ⚠️  AI frequently uses invalid building placements');
    console.log('     → Ensure buildable tiles list is clear in game state');
  }
  if (perf.avgResponseTime > 10000) {
    console.log('  ⚠️  Average response time is slow (>10s)');
    console.log('     → Consider reducing max iterations or simplifying prompts');
  }
  
  const sendUnitsRate = toolSuccessRate['send_units'];
  if (sendUnitsRate && (sendUnitsRate.success / sendUnitsRate.total) < 0.8) {
    console.log('  ⚠️  send_units has low success rate');
    console.log('     → Check unit ID format and availability');
  }
  
  console.log('\n');
}

main().catch(console.error);
