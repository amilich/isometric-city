// Chat system types

export type ChannelType = 'global' | 'region';

export type MessageType = 'user' | 'system' | 'announcement';

export interface ChatMessage {
  id: string;
  channelType: ChannelType;
  channelId: string | null;
  cityId: string | null;
  cityName: string;
  message: string;
  messageType: MessageType;
  createdAt: string;
}

export interface ChatChannel {
  type: ChannelType;
  id: string | null;  // region_id for region, null for global
  name: string;
}

// System message templates
export const SYSTEM_MESSAGES = {
  cityJoinedRegion: (cityName: string) => `🎉 ${cityName} joined the region!`,
  cityLeftRegion: (cityName: string) => `👋 ${cityName} left the region`,
  greatWorkProposed: (cityName: string, workName: string) => `📢 ${cityName} proposed "${workName}" project. Vote now!`,
  greatWorkCompleted: (workName: string) => `🏆 "${workName}" project completed!`,
  tradeOffer: (cityName: string, amount: number, resource: string) => `💰 ${cityName} offering ${amount} ${resource} for sale`,
} as const;

