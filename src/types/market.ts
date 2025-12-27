// Global Market types

export type ResourceType = 'power' | 'water' | 'workers' | 'materials';

export type OrderType = 'buy' | 'sell';

export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled';

export interface MarketPrice {
  id: string;
  resourceType: ResourceType;
  basePrice: number;
  currentPrice: number;
  totalSupply: number;
  totalDemand: number;
  priceChange24h: number;
  high24h: number | null;
  low24h: number | null;
  updatedAt: string;
}

export interface TradeOrder {
  id: string;
  cityId: string;
  cityName: string;
  resourceType: ResourceType;
  orderType: OrderType;
  quantity: number;
  pricePerUnit: number;
  filledQuantity: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface TradeHistory {
  id: string;
  buyerCityId: string | null;
  sellerCityId: string | null;
  buyerCityName: string;
  sellerCityName: string;
  resourceType: ResourceType;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  createdAt: string;
}

export interface CityMarketSettings {
  id: string;
  cityId: string;
  resourceType: ResourceType;
  autoSellEnabled: boolean;
  autoSellThreshold: number;
  autoSellMinPrice: number | null;
  autoBuyEnabled: boolean;
  autoBuyThreshold: number;
  autoBuyMaxPrice: number | null;
  updatedAt: string;
}

export interface ResourceInfo {
  type: ResourceType;
  icon: string;
  name: string;
  unit: string;
}

export const RESOURCE_INFO: Record<ResourceType, ResourceInfo> = {
  power: { type: 'power', icon: '⚡', name: 'Power', unit: 'kW' },
  water: { type: 'water', icon: '💧', name: 'Water', unit: 'm³' },
  workers: { type: 'workers', icon: '👷', name: 'Workers', unit: 'people' },
  materials: { type: 'materials', icon: '🏗️', name: 'Materials', unit: 'ton' },
};

export const RESOURCE_TYPES: ResourceType[] = ['power', 'water', 'workers', 'materials'];

