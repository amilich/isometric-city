'use client';

import React, { FormEvent, useState } from 'react';
import { MessageSquare, Mic, MicOff, Send, Volume2, VolumeX, X } from 'lucide-react';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';

interface MultiplayerCommsPanelProps {
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  showButtonLabel?: boolean;
}

export function MultiplayerCommsPanel({
  className = '',
  buttonClassName,
  panelClassName,
  showButtonLabel = false,
}: MultiplayerCommsPanelProps) {
  const multiplayer = useMultiplayerOptional();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  if (!multiplayer || multiplayer.connectionState !== 'connected') return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    multiplayer.sendChatMessage(trimmed);
    setMessage('');
  };

  const voiceConnected = multiplayer.voiceState.status === 'connected'
    || multiplayer.voiceState.status === 'muted'
    || multiplayer.voiceState.status === 'deafened';

  return (
    <div className={className}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={buttonClassName || 'h-10 w-10 inline-flex items-center justify-center rounded bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-lg'}
          aria-label="Open multiplayer chat"
          title="Open multiplayer chat"
        >
          <MessageSquare className="h-4 w-4" />
          {showButtonLabel && <span className="ml-1.5 text-xs">Chat</span>}
        </button>
      ) : (
        <div className={panelClassName || 'w-80 max-w-[calc(100vw-1rem)] bg-slate-950/95 border border-slate-700 text-white shadow-xl'}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              <span className="font-mono tracking-wider">{multiplayer.roomCode}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-7 w-7 inline-flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
              aria-label="Close multiplayer chat"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
            <button
              type="button"
              onClick={() => {
                if (voiceConnected) {
                  multiplayer.stopVoiceChat();
                } else {
                  multiplayer.startVoiceChat();
                }
              }}
              className="h-8 w-8 inline-flex items-center justify-center border border-slate-700 text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-50"
              disabled={multiplayer.voiceState.status === 'joining'}
              aria-label={voiceConnected ? 'Leave voice chat' : 'Join voice chat'}
              title={voiceConnected ? 'Leave voice chat' : 'Join voice chat'}
            >
              {voiceConnected ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => multiplayer.setVoiceMuted(!multiplayer.voiceState.muted)}
              className="h-8 w-8 inline-flex items-center justify-center border border-slate-700 text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-50"
              disabled={!voiceConnected}
              aria-label={multiplayer.voiceState.muted ? 'Unmute microphone' : 'Mute microphone'}
              title={multiplayer.voiceState.muted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {multiplayer.voiceState.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => multiplayer.setVoiceDeafened(!multiplayer.voiceState.deafened)}
              className="h-8 w-8 inline-flex items-center justify-center border border-slate-700 text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-50"
              disabled={!voiceConnected}
              aria-label={multiplayer.voiceState.deafened ? 'Undeafen voice chat' : 'Deafen voice chat'}
              title={multiplayer.voiceState.deafened ? 'Undeafen voice chat' : 'Deafen voice chat'}
            >
              {multiplayer.voiceState.deafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <span className="min-w-0 truncate text-xs text-slate-400">
              {multiplayer.voiceState.error || multiplayer.voiceState.status}
            </span>
          </div>

          <div className="h-48 overflow-y-auto px-3 py-2 space-y-2">
            {multiplayer.chatMessages.length === 0 ? (
              <div className="text-xs text-slate-500">No messages yet</div>
            ) : (
              multiplayer.chatMessages.map((chat) => (
                <div key={chat.id} className="text-sm">
                  <span className={chat.isLocal ? 'text-emerald-300' : 'text-sky-300'}>
                    {chat.playerName}
                  </span>
                  <span className="text-slate-500">: </span>
                  <span className="text-slate-200 break-words">{chat.text}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 border-t border-slate-800">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 500))}
              className="min-w-0 flex-1 bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-slate-500"
              placeholder="Message"
              maxLength={500}
            />
            <button
              type="submit"
              className="h-8 w-8 inline-flex items-center justify-center bg-white/10 hover:bg-white/20 text-white border border-white/20 disabled:opacity-40"
              disabled={!message.trim()}
              aria-label="Send message"
              title="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
