/**
 * Rise of Nations - AI Agents Sidebar
 * 
 * Right sidebar displaying AI conversation history with collapsible tool calls.
 */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AIPlayerConversation, AIConversationEntry } from '../hooks/useAgenticAI';
import { ChevronRight } from 'lucide-react';
import { RoNPlayer } from '../types/game';
import { AGE_INFO, AGE_ORDER } from '../types/ages';

interface AIAgentsSidebarProps {
  conversations: AIPlayerConversation[];
  players: RoNPlayer[];
  onClear: () => void;
  onWidthChange?: (width: number) => void;
}

const MIN_WIDTH = 300;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 410;

export const AI_SIDEBAR_DEFAULT_WIDTH = DEFAULT_WIDTH;

// Fixed-width resource formatting to prevent flickering
function formatResource(val: number, width: number = 5): string {
  let str: string;
  if (val >= 10000) {
    str = `${(val / 1000).toFixed(0)}k`;
  } else if (val >= 1000) {
    str = `${(val / 1000).toFixed(1)}k`;
  } else {
    str = Math.floor(val).toString();
  }
  return str.padStart(width, '\u2007'); // Use figure space for fixed width
}

// Combined tool call + result entry
function ToolInvocationEntry({ 
  toolCall, 
  toolResult 
}: { 
  toolCall: AIConversationEntry; 
  toolResult?: AIConversationEntry;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasArgs = toolCall.toolArgs && Object.keys(toolCall.toolArgs).length > 0;
  
  // Detect success from result
  const isSuccess = toolResult ? (
    toolResult.content.includes('success') || toolResult.content.includes('Success') || 
    toolResult.content.includes('Built') || toolResult.content.includes('Queued') ||
    toolResult.content.includes('Assigned') || toolResult.content.includes('Reassigned') ||
    toolResult.content.includes('Sent') || toolResult.content.includes('Trained') ||
    toolResult.content.startsWith('##') || toolResult.content.includes('## ')
  ) : undefined;
  
  const getStatusStyles = () => {
    if (!toolResult) {
      return {
        bg: 'bg-slate-800/80',
        border: 'border-slate-600/30',
        icon: 'text-amber-400',
        glow: '',
      };
    }
    if (isSuccess) {
      return {
        bg: 'bg-emerald-950/40',
        border: 'border-emerald-500/20',
        icon: 'text-emerald-400',
        glow: 'shadow-[inset_0_1px_0_0_rgba(16,185,129,0.1)]',
      };
    }
    return {
      bg: 'bg-rose-950/30',
      border: 'border-rose-500/20',
      icon: 'text-rose-400',
      glow: 'shadow-[inset_0_1px_0_0_rgba(244,63,94,0.1)]',
    };
  };
  
  const styles = getStatusStyles();
  
  return (
    <div className={`rounded-lg border ${styles.border} ${styles.glow} overflow-hidden transition-all duration-150`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 px-3 py-2 ${styles.bg} hover:brightness-110 transition-all text-left group`}
      >
        <div className={`flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>
          <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-slate-400" />
        </div>
        <span className="text-[11px] text-slate-300 font-mono truncate flex-1">
          {toolCall.toolName}
        </span>
        {!toolResult && (
          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
        )}
      </button>
      
      {isExpanded && (
        <div className="border-t border-slate-700/50 bg-slate-900/60">
          {/* Arguments section */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
              <span>Arguments</span>
            </div>
            {hasArgs ? (
              <div className="space-y-1 max-h-[120px] overflow-y-auto scrollbar-thin">
                {Object.entries(toolCall.toolArgs!).map(([key, value]) => (
                  <div key={key} className="text-[11px] font-mono">
                    <span className="text-slate-500">{key}:</span>{' '}
                    <span className="text-slate-300">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-slate-600 italic">No arguments</span>
            )}
          </div>
          
          {/* Result section */}
          {toolResult && (
            <div className={`px-3 py-2.5 border-t border-slate-700/50 ${isSuccess ? 'bg-emerald-950/20' : 'bg-rose-950/20'}`}>
              <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider mb-1.5 ${isSuccess ? 'text-emerald-500' : 'text-rose-400'}`}>
                <span>{isSuccess ? 'Success' : 'Error'}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto scrollbar-thin leading-relaxed">
                {toolResult.content}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PromptEntry({ entry }: { entry: AIConversationEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Truncate for preview
  const preview = entry.content.length > 60 ? entry.content.slice(0, 60) + '...' : entry.content;
  
  return (
    <div className="rounded-lg border border-violet-500/20 overflow-hidden bg-violet-950/20 shadow-[inset_0_1px_0_0_rgba(139,92,246,0.1)]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-violet-900/20 transition-colors text-left group"
      >
        <div className={`flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>
          <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-slate-400" />
        </div>
        <span className="text-[11px] text-slate-400 font-mono">prompt</span>
        {!isExpanded && (
          <span className="text-[10px] text-slate-500 truncate flex-1 ml-1">
            {preview}
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="px-3 py-2.5 border-t border-violet-500/10 bg-slate-900/40 text-[11px] text-slate-400 whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto scrollbar-thin leading-relaxed">
          {entry.content}
        </div>
      )}
    </div>
  );
}

// Group entries to pair tool_call with tool_result
interface GroupedEntry {
  type: 'single' | 'tool_pair';
  entry?: AIConversationEntry;
  toolCall?: AIConversationEntry;
  toolResult?: AIConversationEntry;
}

function groupEntries(entries: AIConversationEntry[]): GroupedEntry[] {
  const grouped: GroupedEntry[] = [];
  let i = 0;
  
  while (i < entries.length) {
    const current = entries[i];
    
    if (current.type === 'tool_call') {
      const next = entries[i + 1];
      if (next && next.type === 'tool_result') {
        grouped.push({
          type: 'tool_pair',
          toolCall: current,
          toolResult: next,
        });
        i += 2;
      } else {
        grouped.push({
          type: 'tool_pair',
          toolCall: current,
        });
        i += 1;
      }
    } else if (current.type === 'tool_result') {
      grouped.push({
        type: 'single',
        entry: current,
      });
      i += 1;
    } else {
      grouped.push({
        type: 'single',
        entry: current,
      });
      i += 1;
    }
  }
  
  return grouped;
}

function SingleEntry({ entry }: { entry: AIConversationEntry }) {
  switch (entry.type) {
    case 'prompt':
      return <PromptEntry entry={entry} />;
    
    case 'thinking':
      return (
        <div className="flex gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/30">
          <div className="w-0.5 bg-gradient-to-b from-violet-500 to-violet-700 rounded-full flex-shrink-0" />
          <p className="text-[11px] text-slate-400 italic leading-relaxed">
            {entry.content}
          </p>
        </div>
      );
    
    case 'tool_result':
      return (
        <div className="rounded-lg border border-slate-700/30 bg-slate-800/40 px-3 py-2">
          <p className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto">
            {entry.content}
          </p>
        </div>
      );
    
    case 'message':
      return (
        <div className="rounded-lg border border-slate-700/30 bg-slate-800/40 px-3 py-2">
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {entry.content}
          </p>
        </div>
      );
    
    default:
      return null;
  }
}

function GroupedConversationEntry({ grouped }: { grouped: GroupedEntry }) {
  if (grouped.type === 'tool_pair' && grouped.toolCall) {
    return (
      <ToolInvocationEntry 
        toolCall={grouped.toolCall} 
        toolResult={grouped.toolResult} 
      />
    );
  }
  
  if (grouped.entry) {
    return <SingleEntry entry={grouped.entry} />;
  }
  
  return null;
}

// Resource bar component with fixed-width values
function ResourceBar({ player }: { player: RoNPlayer }) {
  const resources = [
    { key: 'food', icon: '🌾', value: player.resources.food, color: 'text-green-400' },
    { key: 'wood', icon: '🪵', value: player.resources.wood, color: 'text-amber-500' },
    { key: 'metal', icon: '⛏️', value: player.resources.metal, color: 'text-slate-300' },
    { key: 'gold', icon: '💰', value: player.resources.gold, color: 'text-yellow-400' },
  ];
  
  const popColor = player.population >= player.populationCap ? 'text-rose-400' : 'text-sky-400';
  
  // Age info
  const ageInfo = AGE_INFO[player.age];
  const ageIndex = AGE_ORDER.indexOf(player.age);
  const ageAbbrev = ageInfo?.name?.slice(0, 3) || player.age.slice(0, 3);
  
  return (
    <div className="flex items-center gap-0.5 text-[10px] tabular-nums font-mono bg-slate-900/60 rounded px-1.5 py-0.5">
      {/* Age badge */}
      <span 
        className="px-1 rounded text-[9px] font-semibold mr-1"
        style={{ 
          backgroundColor: ageInfo?.color ? `${ageInfo.color}33` : 'rgba(100,116,139,0.2)',
          color: ageInfo?.color || '#94a3b8',
        }}
        title={`Age: ${ageInfo?.name || player.age} (${ageIndex + 1}/${AGE_ORDER.length})`}
      >
        {ageAbbrev}
      </span>
      {resources.map((r) => (
        <span key={r.key} className={`${r.color} whitespace-pre`} title={r.key}>
          {r.icon}{formatResource(r.value, 4)}
        </span>
      ))}
      <span className={`${popColor} whitespace-pre ml-0.5`} title="Population">
        {String(player.population).padStart(2, '\u2007')}/{player.populationCap}
      </span>
    </div>
  );
}

function PlayerConversation({ conversation, player, isExpanded, onToggle }: { 
  conversation: AIPlayerConversation; 
  player?: RoNPlayer;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation.entries.length, isExpanded]);
  
  const recentEntries = conversation.entries.slice(-30);
  const groupedEntries = groupEntries(recentEntries);
  
  return (
    <div className={`flex flex-col min-h-0 ${isExpanded ? 'flex-1' : 'flex-shrink-0'}`}>
      {/* Player Header */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2.5 px-3 py-2.5 bg-gradient-to-r from-slate-800 to-slate-800/80 border-b border-slate-700/50 hover:from-slate-750 hover:to-slate-800/90 transition-all flex-shrink-0 group"
      >
        {/* Expand/Collapse */}
        <div className={`flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-400" />
        </div>
        
        {/* Player name */}
        <span className="text-sm font-medium text-slate-200">
          {conversation.playerName}
        </span>
        
        {/* Resources */}
        {player && <ResourceBar player={player} />}
        
        <div className="flex-1" />
        
        {/* Status indicators */}
        <div className="flex items-center gap-2">
          {conversation.isThinking && (
            <span className="text-[10px] text-amber-400">•</span>
          )}
          <span className="text-[10px] text-slate-500">
            {conversation.entries.length}
          </span>
        </div>
      </button>
      
      {/* Conversation entries */}
      {isExpanded && (
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-2 min-h-0 bg-slate-900 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
        >
          {groupedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-slate-600 text-xs">
                Waiting for AI activity...
              </p>
            </div>
          ) : (
            groupedEntries.map((grouped, idx) => (
              <GroupedConversationEntry 
                key={grouped.toolCall?.id ?? grouped.entry?.id ?? idx} 
                grouped={grouped} 
              />
            ))
          )}
          
          {/* Thinking indicator */}
          {conversation.isThinking && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/20 border border-amber-500/20 rounded-lg">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div 
                    key={i}
                    className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
              <span className="text-[11px] text-amber-300 font-medium">Processing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AIAgentsSidebar({ conversations, players, onClear, onWidthChange }: AIAgentsSidebarProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const aiConversations = conversations.filter(c => 
    c.playerName.toLowerCase().includes('ai') || 
    c.playerName.toLowerCase().includes('red') || 
    c.playerName.toLowerCase().includes('green')
  );
  
  useEffect(() => {
    if (aiConversations.length > 0 && expandedPlayers.size === 0) {
      setExpandedPlayers(new Set([aiConversations[0].playerId]));
    }
  }, [aiConversations.length]);
  
  const playerMap = new Map(players.map(p => [p.id, p]));
  
  const toggleExpanded = useCallback((playerId: string) => {
    setExpandedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }, []);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);
  
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
      setWidth(clampedWidth);
      onWidthChange?.(clampedWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);
  
  // Empty state
  if (aiConversations.length === 0) {
    return (
      <div 
        ref={sidebarRef}
        className="fixed right-0 top-0 h-screen bg-slate-900 border-l border-slate-700/50 flex flex-col z-40"
        style={{ width: `${width}px`, minWidth: `${width}px` }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-sky-500/50 active:bg-sky-500 transition-colors z-10"
        />
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
          <h2 className="text-sm font-medium text-slate-200">AI Agents</h2>
        </div>
        
        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <p className="text-slate-600 text-xs text-center">
            AI history appears here when enabled
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={sidebarRef}
      className="fixed right-0 top-0 h-screen bg-slate-900 border-l border-slate-700/50 flex flex-col overflow-hidden z-40"
      style={{ width: `${width}px`, minWidth: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize transition-colors z-10 ${
          isResizing ? 'bg-sky-500' : 'hover:bg-sky-500/50'
        }`}
      />
      
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700/50 bg-slate-800/50 flex items-center justify-between flex-shrink-0">
        <h2 className="text-xs font-medium text-slate-400">AI Agents</h2>
        <button
          onClick={onClear}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          clear
        </button>
      </div>
      
      {/* Conversations */}
      <div className="flex-1 flex flex-col min-h-0 divide-y divide-slate-700/30 overflow-hidden bg-slate-900">
        {aiConversations.map((conv) => (
          <PlayerConversation 
            key={conv.playerId} 
            conversation={conv} 
            player={playerMap.get(conv.playerId)}
            isExpanded={expandedPlayers.has(conv.playerId)}
            onToggle={() => toggleExpanded(conv.playerId)}
          />
        ))}
      </div>
    </div>
  );
}

export default AIAgentsSidebar;
