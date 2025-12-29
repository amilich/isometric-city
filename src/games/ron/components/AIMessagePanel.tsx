/**
 * Rise of Nations - AI Message Panel
 * 
 * Displays messages from the agentic AI opponent.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AgenticAIMessage } from '../hooks/useAgenticAI';

interface AIMessagePanelProps {
  messages: AgenticAIMessage[];
  isThinking: boolean;
  onMarkRead: (messageId: string) => void;
  onClear: () => void;
}

export function AIMessagePanel({
  messages,
  isThinking,
  onMarkRead,
  onClear,
}: AIMessagePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLatest, setShowLatest] = useState<AgenticAIMessage | null>(null);
  
  const unreadCount = messages.filter(m => !m.isRead).length;

  // Show latest unread message briefly
  useEffect(() => {
    const latestUnread = messages.find(m => !m.isRead);
    if (latestUnread) {
      const showFrame = requestAnimationFrame(() => setShowLatest(latestUnread));
      const timer = setTimeout(() => {
        requestAnimationFrame(() => setShowLatest(null));
        onMarkRead(latestUnread.id);
      }, 5000);
      return () => {
        cancelAnimationFrame(showFrame);
        clearTimeout(timer);
      };
    }
  }, [messages, onMarkRead]);

  return (
    <>
      {/* Floating notification for latest message - positioned left of minimap */}
      {showLatest && !isExpanded && (
        <div 
          className="absolute bottom-4 right-44 w-48 bg-red-900 border border-red-600 rounded p-2 shadow-lg z-30 cursor-pointer hover:bg-red-800 transition-colors"
          onClick={() => {
            setShowLatest(null);
            setIsExpanded(true);
          }}
        >
          <div className="flex items-start gap-1.5">
            <div className="flex-shrink-0 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">AI</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-red-200 text-xs line-clamp-3">{showLatest.message}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLatest(null);
              }}
              className="text-red-400 hover:text-red-200 text-sm leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Toggle button - positioned left of minimap, hidden when notification is showing */}
      {!showLatest && !isExpanded && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute bottom-4 right-44 z-30 flex items-center gap-1.5 px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded shadow-lg transition-colors"
        >
          {isThinking && (
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          )}
          <span className="text-white text-xs">AI</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Expanded panel - positioned left of minimap, compact */}
      {isExpanded && (
        <div className="absolute bottom-12 right-44 w-52 max-h-48 bg-gray-900 border border-gray-700 rounded shadow-xl z-30 flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-700">
            <h3 className="text-white text-xs font-semibold">AI Messages</h3>
            <div className="flex gap-1.5 items-center">
              {isThinking && (
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" title="Thinking..." />
              )}
              <button
                onClick={onClear}
                className="text-gray-400 hover:text-white text-[10px]"
              >
                Clear
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-white text-sm leading-none"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-[10px] text-center py-2">
                No messages yet
              </p>
            ) : (
              messages.slice().reverse().map((msg) => (
                <div
                  key={msg.id}
                  className={`p-1.5 rounded ${
                    msg.isRead ? 'bg-gray-800' : 'bg-red-900 border border-red-600/50'
                  }`}
                  onClick={() => !msg.isRead && onMarkRead(msg.id)}
                >
                  <p className="text-gray-200 text-[11px] leading-tight">{msg.message}</p>
                  <p className="text-gray-500 text-[9px] mt-0.5">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default AIMessagePanel;
