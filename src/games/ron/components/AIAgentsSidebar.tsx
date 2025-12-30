/**
 * Rise of Nations - AI Agents Sidebar
 * 
 * Right sidebar displaying AI conversation history with collapsible tool calls.
 */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AIPlayerConversation, AIConversationEntry } from '../hooks/useAgenticAI';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { RoNPlayer } from '../types/game';

interface AIAgentsSidebarProps {
  conversations: AIPlayerConversation[];
  players: RoNPlayer[];
  onClear: () => void;
  onWidthChange?: (width: number) => void;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

export const AI_SIDEBAR_DEFAULT_WIDTH = DEFAULT_WIDTH;

function ToolCallEntry({ entry, isExpanded, onToggle }: { 
  entry: AIConversationEntry; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const hasArgs = entry.toolArgs && Object.keys(entry.toolArgs).length > 0;
  
  return (
    <div className="border border-slate-700 rounded overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        )}
        <span className="text-xs text-blue-400 font-mono">{entry.toolName}</span>
        {!hasArgs && (
          <span className="text-xs text-slate-600 font-mono">()</span>
        )}
      </button>
      {isExpanded && (
        <div className="px-2 py-2 bg-slate-900 text-xs font-mono text-slate-500 border-t border-slate-700 max-h-[300px] overflow-y-auto">
          {hasArgs ? (
            Object.entries(entry.toolArgs!).map(([key, value]) => (
              <div key={key} className="whitespace-pre-wrap break-all">
                <span className="text-slate-600">{key}:</span>{' '}
                <span className="text-slate-400">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </span>
              </div>
            ))
          ) : (
            <span className="text-slate-600">no arguments</span>
          )}
        </div>
      )}
    </div>
  );
}

function ToolResultEntry({ entry }: { entry: AIConversationEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSuccess = entry.content.includes('success') || entry.content.includes('Success') || 
                   entry.content.includes('Built') || entry.content.includes('Queued') ||
                   entry.content.includes('Assigned');
  
  return (
    <div className={`border rounded overflow-hidden ${isSuccess ? 'border-green-800/50' : 'border-amber-800/50'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 ${isSuccess ? 'bg-green-950/30' : 'bg-amber-950/30'} hover:bg-opacity-50 transition-colors text-left`}
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        )}
        <span className={`text-xs font-mono flex-shrink-0 ${isSuccess ? 'text-green-500' : 'text-amber-500'}`}>
          {isSuccess ? 'ok' : 'err'}
        </span>
        <span className="text-xs text-slate-400 flex-1 font-mono whitespace-pre-wrap break-words">
          {entry.content}
        </span>
      </button>
      {isExpanded && (
        <div className="px-2 py-2 bg-slate-900 text-xs text-slate-400 border-t border-slate-700 whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
          {entry.content}
        </div>
      )}
    </div>
  );
}

function PromptEntry({ entry }: { entry: AIConversationEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="border border-purple-800/50 rounded overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 bg-purple-950/30 hover:bg-purple-900/30 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        )}
        <span className="text-xs text-purple-400 font-mono flex-shrink-0">prompt</span>
        <span className="text-xs text-slate-400 flex-1 font-mono whitespace-pre-wrap break-words">
          {entry.content}
        </span>
      </button>
      {isExpanded && (
        <div className="px-2 py-2 bg-slate-900 text-xs text-slate-400 border-t border-slate-700 whitespace-pre-wrap font-mono max-h-[500px] overflow-y-auto">
          {entry.content}
        </div>
      )}
    </div>
  );
}

function ConversationEntry({ entry }: { entry: AIConversationEntry }) {
  const [isToolExpanded, setIsToolExpanded] = useState(false);
  
  switch (entry.type) {
    case 'prompt':
      return <PromptEntry entry={entry} />;
    
    case 'thinking':
      return (
        <div className="text-xs text-slate-500 italic py-1.5 border-l-2 border-purple-700/50 pl-2 font-mono whitespace-pre-wrap break-words">
          {entry.content}
        </div>
      );
    
    case 'tool_call':
      return (
        <ToolCallEntry 
          entry={entry} 
          isExpanded={isToolExpanded} 
          onToggle={() => setIsToolExpanded(!isToolExpanded)} 
        />
      );
    
    case 'tool_result':
      return <ToolResultEntry entry={entry} />;
    
    case 'message':
      return (
        <div className="bg-blue-950/30 border border-blue-800/50 rounded px-2 py-1.5 text-xs text-blue-300 font-mono">
          {entry.content}
        </div>
      );
    
    default:
      return null;
  }
}

function PlayerConversation({ conversation, player, isExpanded, onToggle }: { 
  conversation: AIPlayerConversation; 
  player?: RoNPlayer;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation.entries.length, isExpanded]);
  
  const recentEntries = conversation.entries.slice(-30); // Show last 30 entries
  
  // Format resource value compactly
  const formatRes = (val: number) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.floor(val).toString();
  
  return (
    <div className={`flex flex-col min-h-0 ${isExpanded ? 'flex-1' : 'flex-shrink-0'}`}>
      {/* Header - name and resources inline */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 border-b border-slate-700 hover:bg-slate-700/50 transition-colors flex-shrink-0"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
        )}
        <div 
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: conversation.color }}
        />
        <span className="text-sm font-medium text-slate-300 font-mono flex-shrink-0">
          {conversation.playerName}
        </span>
        {/* Resources inline */}
        {player && (
          <div className="flex items-center gap-1 text-[10px] font-mono flex-shrink-0">
            <span className="text-green-400" title="Food">🌾{formatRes(player.resources.food)}</span>
            <span className="text-amber-600" title="Wood">🪵{formatRes(player.resources.wood)}</span>
            <span className="text-slate-400" title="Metal">⛏️{formatRes(player.resources.metal)}</span>
            <span className="text-yellow-400" title="Gold">💰{formatRes(player.resources.gold)}</span>
            <span className={player.population >= player.populationCap ? 'text-red-400' : 'text-blue-400'} title="Population">
              👥{player.population}/{player.populationCap}
            </span>
          </div>
        )}
        <div className="flex-1" />
        {conversation.isThinking && (
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse flex-shrink-0" />
        )}
        <span className="text-xs text-slate-500 font-mono flex-shrink-0">
          {conversation.entries.length}
        </span>
      </button>
      
      {/* Entries - only show when expanded, takes remaining space */}
      {isExpanded && (
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-0"
        >
          {recentEntries.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-4 font-mono">
              waiting...
            </p>
          ) : (
            recentEntries.map((entry) => (
              <ConversationEntry key={entry.id} entry={entry} />
            ))
          )}
          {conversation.isThinking && (
            <div className="flex items-center gap-2 text-xs text-yellow-500 py-1 font-mono">
              <div className="flex gap-0.5">
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>thinking</span>
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
  
  // Get AI players' conversations (filter out human players)
  const aiConversations = conversations.filter(c => 
    c.playerName.toLowerCase().includes('ai') || 
    c.playerName.toLowerCase().includes('red') || 
    c.playerName.toLowerCase().includes('green')
  );
  
  // Initialize expanded state for new AI players (expand first one by default)
  useEffect(() => {
    if (aiConversations.length > 0 && expandedPlayers.size === 0) {
      const t = setTimeout(() => {
        setExpandedPlayers(new Set([aiConversations[0].playerId]));
      }, 0);
      return () => clearTimeout(t);
    }
  }, [aiConversations.length]);
  
  // Map player ID to player data for quick lookup
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
  
  if (aiConversations.length === 0) {
    // Show placeholder when no AI conversations yet
    return (
      <div 
        ref={sidebarRef}
        className="bg-slate-900 border-l border-slate-700 flex flex-col h-full relative"
        style={{ width }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500/50 transition-colors"
        />
        <div className="px-3 py-1.5 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-medium text-slate-400 font-mono">AI Agents</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-600 text-[10px] text-center px-4 font-mono">
            AI history appears here when enabled
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={sidebarRef}
      className="bg-slate-900 border-l border-slate-700 flex flex-col h-full overflow-hidden relative"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize transition-colors ${isResizing ? 'bg-blue-500' : 'hover:bg-blue-500/50'}`}
      />
      
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-slate-700 bg-slate-800 flex items-center justify-between flex-shrink-0">
        <h2 className="text-xs font-medium text-slate-400 font-mono">AI Agents</h2>
        <button
          onClick={onClear}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors font-mono"
        >
          clear
        </button>
      </div>
      
      {/* Conversations - expanded ones take available space, collapsed ones shrink */}
      <div className="flex-1 flex flex-col min-h-0 divide-y divide-slate-700 overflow-hidden">
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
