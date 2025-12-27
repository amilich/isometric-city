// Chat system API functions

import { getSupabase, isMultiplayerAvailable } from './supabase';
import type { Database } from '@/types/supabase';
import type { ChatMessage, ChannelType, MessageType } from '@/types/chat';
import { SYSTEM_MESSAGES } from '@/types/chat';

type ChatMessageRow = Database['public']['Tables']['chat_messages']['Row'];

function mapChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    channelType: row.channel_type as ChannelType,
    channelId: row.channel_id,
    cityId: row.city_id,
    cityName: row.city_name,
    message: row.message,
    messageType: row.message_type as MessageType,
    createdAt: row.created_at,
  };
}

// Fetch messages for a channel
export async function fetchMessages(
  channelType: ChannelType,
  channelId: string | null = null,
  limit: number = 100
): Promise<ChatMessage[]> {
  if (!isMultiplayerAvailable()) return [];

  const supabase = getSupabase();
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('channel_type', channelType)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (channelType === 'region' && channelId) {
    query = query.eq('channel_id', channelId);
  } else if (channelType === 'global') {
    query = query.is('channel_id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch chat messages:', error);
    return [];
  }

  return ((data || []) as ChatMessageRow[]).map(mapChatMessage);
}

// Send a message to a channel
export async function sendMessage(
  channelType: ChannelType,
  channelId: string | null,
  cityId: string,
  cityName: string,
  message: string,
  messageType: MessageType = 'user'
): Promise<ChatMessage | null> {
  if (!isMultiplayerAvailable()) return null;

  // Validate message length
  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0 || trimmedMessage.length > 500) {
    console.error('Message must be between 1 and 500 characters');
    return null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      channel_type: channelType,
      channel_id: channelType === 'region' ? channelId : null,
      city_id: cityId,
      city_name: cityName,
      message: trimmedMessage,
      message_type: messageType,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to send chat message:', error);
    return null;
  }

  return mapChatMessage(data as ChatMessageRow);
}

// Send a system message (for announcements, events, etc.)
export async function sendSystemMessage(
  channelType: ChannelType,
  channelId: string | null,
  message: string
): Promise<ChatMessage | null> {
  if (!isMultiplayerAvailable()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      channel_type: channelType,
      channel_id: channelType === 'region' ? channelId : null,
      city_id: null,
      city_name: 'System',
      message: message,
      message_type: 'system',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to send system message:', error);
    return null;
  }

  return mapChatMessage(data as ChatMessageRow);
}

// Send join/leave system messages
export async function sendJoinRegionMessage(
  regionId: string,
  cityName: string
): Promise<void> {
  await sendSystemMessage('region', regionId, SYSTEM_MESSAGES.cityJoinedRegion(cityName));
}

export async function sendLeaveRegionMessage(
  regionId: string,
  cityName: string
): Promise<void> {
  await sendSystemMessage('region', regionId, SYSTEM_MESSAGES.cityLeftRegion(cityName));
}

// Subscribe to messages in a channel
export function subscribeToMessages(
  channelType: ChannelType,
  channelId: string | null,
  onMessage: (message: ChatMessage) => void,
  seenMessageIds?: Set<string>
): (() => void) | null {
  if (!isMultiplayerAvailable()) return null;

  const supabase = getSupabase();
  const uniqueId = Math.random().toString(36).substring(7);
  const channelName = channelType === 'global' 
    ? `chat:global:${uniqueId}` 
    : `chat:region:${channelId}:${uniqueId}`;

  // Track seen messages
  const seen = seenMessageIds || new Set<string>();

  const filter = channelType === 'region' && channelId
    ? `channel_id=eq.${channelId}`
    : `channel_type=eq.${channelType}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter,
      },
      (payload) => {
        if (payload.new) {
          const row = payload.new as ChatMessageRow;
          // client-side check to verify it's actually a region message
          if (channelType === 'region' && row.channel_type !== 'region') {
            return;
          }
          const message = mapChatMessage(row);
          if (!seen.has(message.id)) {
            seen.add(message.id);
            onMessage(message);
          }
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Chat subscribed to ${channelName}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Chat subscription error for ${channelName}`);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

// Format timestamp for display
export function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

