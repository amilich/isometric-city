'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ChatIcon, MarketIcon } from '@/components/ui/Icons';
import { isMultiplayerAvailable } from '@/lib/supabase';
import {
  fetchMessages,
  sendMessage,
  subscribeToMessages,
  formatMessageTime,
} from '@/lib/chat';
import type { ChatMessage, ChannelType } from '@/types/chat';

function MessageBubble({
  message,
  isOwn,
}: {
  message: ChatMessage;
  isOwn: boolean;
}) {
  const isSystem = message.messageType === 'system' || message.messageType === 'announcement';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground">
          {message.message}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-2`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-muted-foreground">
          {isOwn ? 'You' : message.cityName}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
      <div
        className={`
          max-w-[85%] px-3 py-2 rounded-2xl text-sm break-words
          ${isOwn 
            ? 'bg-primary text-primary-foreground rounded-br-md' 
            : 'bg-muted rounded-bl-md'
          }
        `}
      >
        {message.message}
      </div>
    </div>
  );
}

function ChannelTab({
  label,
  icon,
  isActive,
  onClick,
  hasUnread,
  disabled,
}: {
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
  hasUnread?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
        transition-all relative
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${isActive 
          ? 'bg-primary text-primary-foreground shadow-md' 
          : 'bg-muted/50 hover:bg-muted text-muted-foreground'
        }
      `}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {hasUnread && !isActive && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-background animate-pulse" />
      )}
    </button>
  );
}

// Quick Access Buttons (Chat + Market)
export function QuickAccessButtons({ 
  onChatClick, 
  onMarketClick,
  hasChatUnread,
  isMobile = false,
  isTilePanelOpen = false,
  hidden = false,
}: { 
  onChatClick: () => void;
  onMarketClick: () => void;
  hasChatUnread: boolean;
  isMobile?: boolean;
  isTilePanelOpen?: boolean;
  hidden?: boolean;
}) {
  if (hidden) return null;
  
  return (
    <div
      className={`
        z-40 flex flex-col gap-1.5 transition-all duration-200
        ${isMobile 
          ? 'fixed bottom-24 right-3' 
          : `absolute top-[103px] ${isTilePanelOpen ? 'right-[268px]' : 'right-3'}`
        }
      `}
    >
      {/* Chat Button */}
      <Button
        onClick={onChatClick}
        variant="game-tool"
        className="h-9 px-3 gap-2 justify-start relative"
      >
        <ChatIcon size={16} />
        <span className="text-xs font-medium">Chat</span>
        {hasChatUnread && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full 
                           border-2 border-slate-800 animate-pulse" />
        )}
      </Button>
      
      {/* Market Button */}
      <Button
        onClick={onMarketClick}
        variant="game-tool"
        className="h-9 px-3 gap-2 justify-start"
      >
        <MarketIcon size={16} />
        <span className="text-xs font-medium">Global Market</span>
      </Button>
    </div>
  );
}


// Side Panel Chat
export function ChatSidePanel({ 
  isOpen, 
  onClose,
  isMobile = false,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  isMobile?: boolean;
}) {
  const { state, regionInfo } = useGame();
  const [activeChannel, setActiveChannel] = useState<ChannelType>('global');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const multiplayerAvailable = isMultiplayerAvailable();
  const regionId = regionInfo?.regionId || null;
  const canUseRegionChat = !!regionId;

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load messages when channel changes
  useEffect(() => {
    if (!multiplayerAvailable) {
      setIsLoading(false);
      return;
    }

    const loadMessages = async () => {
      setIsLoading(true);
      const channelId = activeChannel === 'region' ? regionId : null;
      const data = await fetchMessages(activeChannel, channelId);
      seenMessageIdsRef.current = new Set(data.map(m => m.id));
      
      setMessages(data);
      setIsLoading(false);
    };

    loadMessages();
  }, [activeChannel, regionId, multiplayerAvailable]);

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!multiplayerAvailable) return;

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    const channelId = activeChannel === 'region' ? regionId : null;
    
    unsubscribeRef.current = subscribeToMessages(
      activeChannel, 
      channelId, 
      (message) => {
        if (!seenMessageIdsRef.current.has(message.id)) {
          seenMessageIdsRef.current.add(message.id);
          setMessages((prev) => [...prev, message]);
        }
      },
      seenMessageIdsRef.current
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [multiplayerAvailable, regionId, activeChannel]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Re-focus input after sending completes
  const justSentRef = useRef(false);

  useEffect(() => {
    if (!isSending && justSentRef.current) {
      justSentRef.current = false;
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isSending]);

  // Handle sending message
  const handleSend = async () => {
    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || isSending) return;

    justSentRef.current = true;
    setIsSending(true);
    const channelId = activeChannel === 'region' ? regionId : null;
    
    const result = await sendMessage(
      activeChannel,
      channelId,
      state.id,
      state.cityName,
      trimmedMessage
    );

    if (result) {
      setInputValue('');
    }

    setIsSending(false);
  };

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const panelWidth = isMobile ? 'w-full' : 'w-[360px]';

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`
          fixed inset-0 bg-black/40 backdrop-blur-sm z-40
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />
      
      {/* Side Panel */}
      <div 
        className={`
          fixed top-0 right-0 h-full ${panelWidth} z-50
          bg-background border-l border-border shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            💬 Chat
          </h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {!multiplayerAvailable ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">🔌</div>
              <p className="text-muted-foreground mb-2">
                Chat is not currently configured.
              </p>
              <p className="text-xs text-muted-foreground">
                Enable by setting Supabase environment variables.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Channel Tabs */}
            <div className="flex gap-2 p-3 border-b border-border">
              <ChannelTab
                label="Global"
                icon="🌍"
                isActive={activeChannel === 'global'}
                onClick={() => setActiveChannel('global')}
              />
              <ChannelTab
                label="Region"
                icon="🏛️"
                isActive={activeChannel === 'region'}
                onClick={() => canUseRegionChat && setActiveChannel('region')}
                disabled={!canUseRegionChat}
              />
            </div>

            {!canUseRegionChat && activeChannel === 'global' && (
              <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground text-center border-b border-border">
                💡 Join a region to use region chat
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <div className="animate-spin text-2xl mb-2">⏳</div>
                    <span>Loading...</span>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  <div className="text-center">
                    <div className="text-4xl mb-3">
                      {activeChannel === 'global' ? '🌍' : '🏛️'}
                    </div>
                    <p>
                      {activeChannel === 'global' 
                        ? 'No messages yet. Be the first to write!' 
                        : 'No messages in region chat yet.'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.cityId === state.id}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <Separator />

            {/* Input Area */}
            <div className="p-3 bg-muted/20">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Write a message to ${activeChannel === 'global' ? 'global' : 'region'} chat...`}
                  disabled={isSending || (activeChannel === 'region' && !canUseRegionChat)}
                  maxLength={500}
                  className="flex-1"
                />
                <Button
                  variant="game"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isSending || (activeChannel === 'region' && !canUseRegionChat)}
                  className="px-4"
                >
                  {isSending ? '...' : '➤'}
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground text-right mt-1">
                {inputValue.length}/500
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

