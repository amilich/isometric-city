// Global Market API functions

import { getSupabase, isMultiplayerAvailable } from './supabase';
import type { Database } from '@/types/supabase';
import type {
  MarketPrice,
  TradeOrder,
  TradeHistory,
  CityMarketSettings,
  ResourceType,
  OrderType,
} from '@/types/market';

type MarketPriceRow = Database['public']['Tables']['market_prices']['Row'];
type TradeOrderRow = Database['public']['Tables']['trade_orders']['Row'];
type TradeHistoryRow = Database['public']['Tables']['trade_history']['Row'];
type CityMarketSettingsRow = Database['public']['Tables']['city_market_settings']['Row'];

function mapMarketPrice(row: MarketPriceRow): MarketPrice {
  return {
    id: row.id,
    resourceType: row.resource_type as ResourceType,
    basePrice: Number(row.base_price),
    currentPrice: Number(row.current_price),
    totalSupply: row.total_supply,
    totalDemand: row.total_demand,
    priceChange24h: Number(row.price_change_24h),
    high24h: row.high_24h ? Number(row.high_24h) : null,
    low24h: row.low_24h ? Number(row.low_24h) : null,
    updatedAt: row.updated_at,
  };
}

function mapTradeOrder(row: TradeOrderRow): TradeOrder {
  return {
    id: row.id,
    cityId: row.city_id,
    cityName: row.city_name,
    resourceType: row.resource_type as ResourceType,
    orderType: row.order_type as OrderType,
    quantity: row.quantity,
    pricePerUnit: Number(row.price_per_unit),
    filledQuantity: row.filled_quantity,
    status: row.status as TradeOrder['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

function mapTradeHistory(row: TradeHistoryRow): TradeHistory {
  return {
    id: row.id,
    buyerCityId: row.buyer_city_id,
    sellerCityId: row.seller_city_id,
    buyerCityName: row.buyer_city_name,
    sellerCityName: row.seller_city_name,
    resourceType: row.resource_type as ResourceType,
    quantity: row.quantity,
    pricePerUnit: Number(row.price_per_unit),
    totalAmount: Number(row.total_amount),
    createdAt: row.created_at,
  };
}

function mapCityMarketSettings(row: CityMarketSettingsRow): CityMarketSettings {
  return {
    id: row.id,
    cityId: row.city_id,
    resourceType: row.resource_type as ResourceType,
    autoSellEnabled: row.auto_sell_enabled,
    autoSellThreshold: row.auto_sell_threshold,
    autoSellMinPrice: row.auto_sell_min_price ? Number(row.auto_sell_min_price) : null,
    autoBuyEnabled: row.auto_buy_enabled,
    autoBuyThreshold: row.auto_buy_threshold,
    autoBuyMaxPrice: row.auto_buy_max_price ? Number(row.auto_buy_max_price) : null,
    updatedAt: row.updated_at,
  };
}

// Fetch current market prices for all resources
export async function fetchMarketPrices(): Promise<MarketPrice[]> {
  if (!isMultiplayerAvailable()) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('market_prices')
    .select('*')
    .order('resource_type');

  if (error) {
    console.error('Failed to fetch market prices:', error);
    return [];
  }

  return ((data || []) as MarketPriceRow[]).map(mapMarketPrice);
}

// Fetch open orders for a resource
export async function fetchOpenOrders(resourceType?: ResourceType): Promise<TradeOrder[]> {
  if (!isMultiplayerAvailable()) return [];

  const supabase = getSupabase();
  let query = supabase
    .from('trade_orders')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (resourceType) {
    query = query.eq('resource_type', resourceType);
  }

  const { data, error } = await query.limit(100);

  if (error) {
    console.error('Failed to fetch orders:', error);
    return [];
  }

  return ((data || []) as TradeOrderRow[]).map(mapTradeOrder);
}

// Fetch orders for a specific city
export async function fetchCityOrders(cityId: string): Promise<TradeOrder[]> {
  if (!isMultiplayerAvailable()) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trade_orders')
    .select('*')
    .eq('city_id', cityId)
    .in('status', ['open', 'partial'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch city orders:', error);
    return [];
  }

  return ((data || []) as TradeOrderRow[]).map(mapTradeOrder);
}

// Create a new trade order
export async function createOrder(
  cityId: string,
  cityName: string,
  resourceType: ResourceType,
  orderType: OrderType,
  quantity: number,
  pricePerUnit: number
): Promise<TradeOrder | null> {
  if (!isMultiplayerAvailable()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trade_orders')
    .insert({
      city_id: cityId,
      city_name: cityName,
      resource_type: resourceType,
      order_type: orderType,
      quantity,
      price_per_unit: pricePerUnit,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create order:', error);
    return null;
  }

  return mapTradeOrder(data as TradeOrderRow);
}

// Cancel an order
export async function cancelOrder(orderId: string, cityId: string): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;

  const supabase = getSupabase();
  const { error } = await supabase
    .from('trade_orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('city_id', cityId);

  if (error) {
    console.error('Failed to cancel order:', error);
    return false;
  }

  return true;
}

// Execute a trade (fill an order)
export async function executeTrade(
  orderId: string,
  buyerCityId: string,
  buyerCityName: string,
  quantity: number
): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;

  const supabase = getSupabase();

  // First, get the order details
  const { data, error: orderError } = await supabase
    .from('trade_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !data) {
    console.error('Order not found:', orderError);
    return false;
  }

  const order = data as TradeOrderRow;
  const remainingQuantity = order.quantity - order.filled_quantity;
  const fillQuantity = Math.min(quantity, remainingQuantity);

  if (fillQuantity <= 0) {
    console.error('No quantity to fill');
    return false;
  }

  // Update the order
  const newFilledQuantity = order.filled_quantity + fillQuantity;
  const newStatus = newFilledQuantity >= order.quantity ? 'filled' : 'partial';

  const { error: updateError } = await supabase
    .from('trade_orders')
    .update({
      filled_quantity: newFilledQuantity,
      status: newStatus,
    })
    .eq('id', orderId);

  if (updateError) {
    console.error('Failed to update order:', updateError);
    return false;
  }

  // Record the trade in history
  const isBuyOrder = order.order_type === 'buy';
  const { error: historyError } = await supabase
    .from('trade_history')
    .insert({
      buyer_city_id: isBuyOrder ? order.city_id : buyerCityId,
      seller_city_id: isBuyOrder ? buyerCityId : order.city_id,
      buyer_city_name: isBuyOrder ? order.city_name : buyerCityName,
      seller_city_name: isBuyOrder ? buyerCityName : order.city_name,
      resource_type: order.resource_type,
      quantity: fillQuantity,
      price_per_unit: order.price_per_unit,
      total_amount: fillQuantity * Number(order.price_per_unit),
    });

  if (historyError) {
    console.error('Failed to record trade history:', historyError);
  }

  return true;
}

// Fetch recent trade history
export async function fetchTradeHistory(
  resourceType?: ResourceType,
  limit: number = 50
): Promise<TradeHistory[]> {
  if (!isMultiplayerAvailable()) return [];

  const supabase = getSupabase();
  let query = supabase
    .from('trade_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (resourceType) {
    query = query.eq('resource_type', resourceType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch trade history:', error);
    return [];
  }

  return ((data || []) as TradeHistoryRow[]).map(mapTradeHistory);
}

// Fetch city market settings
export async function fetchCityMarketSettings(cityId: string): Promise<CityMarketSettings[]> {
  if (!isMultiplayerAvailable()) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('city_market_settings')
    .select('*')
    .eq('city_id', cityId);

  if (error) {
    console.error('Failed to fetch market settings:', error);
    return [];
  }

  return ((data || []) as CityMarketSettingsRow[]).map(mapCityMarketSettings);
}

// Update city market settings for a resource
export async function updateCityMarketSettings(
  cityId: string,
  resourceType: ResourceType,
  settings: Partial<{
    autoSellEnabled: boolean;
    autoSellThreshold: number;
    autoSellMinPrice: number | null;
    autoBuyEnabled: boolean;
    autoBuyThreshold: number;
    autoBuyMaxPrice: number | null;
  }>
): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;

  const supabase = getSupabase();
  const updateData: Record<string, unknown> = {};
  if (settings.autoSellEnabled !== undefined) updateData.auto_sell_enabled = settings.autoSellEnabled;
  if (settings.autoSellThreshold !== undefined) updateData.auto_sell_threshold = settings.autoSellThreshold;
  if (settings.autoSellMinPrice !== undefined) updateData.auto_sell_min_price = settings.autoSellMinPrice;
  if (settings.autoBuyEnabled !== undefined) updateData.auto_buy_enabled = settings.autoBuyEnabled;
  if (settings.autoBuyThreshold !== undefined) updateData.auto_buy_threshold = settings.autoBuyThreshold;
  if (settings.autoBuyMaxPrice !== undefined) updateData.auto_buy_max_price = settings.autoBuyMaxPrice;

  const { error } = await supabase
    .from('city_market_settings')
    .upsert({
      city_id: cityId,
      resource_type: resourceType,
      ...updateData,
    }, {
      onConflict: 'city_id,resource_type',
    });

  if (error) {
    console.error('Failed to update market settings:', error);
    return false;
  }

  return true;
}

// Subscribe to market price updates
export function subscribeToMarketPrices(
  onUpdate: (prices: MarketPrice[]) => void
): (() => void) | null {
  if (!isMultiplayerAvailable()) return null;

  const supabase = getSupabase();
  const channel = supabase
    .channel('market_prices')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'market_prices',
      },
      async () => {
        const prices = await fetchMarketPrices();
        onUpdate(prices);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Subscribe to order updates
export function subscribeToOrders(
  resourceType: ResourceType,
  onUpdate: (orders: TradeOrder[]) => void
): (() => void) | null {
  if (!isMultiplayerAvailable()) return null;

  const supabase = getSupabase();
  const channel = supabase
    .channel(`orders:${resourceType}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'trade_orders',
        filter: `resource_type=eq.${resourceType}`,
      },
      async () => {
        const orders = await fetchOpenOrders(resourceType);
        onUpdate(orders);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
