'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isMultiplayerAvailable } from '@/lib/supabase';
import {
  fetchMarketPrices,
  fetchOpenOrders,
  fetchCityOrders,
  createOrder,
  cancelOrder,
  executeTrade,
  subscribeToMarketPrices,
} from '@/lib/market';
import {
  RESOURCE_INFO,
  RESOURCE_TYPES,
  type MarketPrice,
  type TradeOrder,
  type ResourceType,
  type OrderType,
} from '@/types/market';

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

function formatChange(change: number): { text: string; color: string; bg: string } {
  if (change > 0) return { text: `+${change.toFixed(1)}%`, color: 'text-green-400', bg: 'bg-green-500/10' };
  if (change < 0) return { text: `${change.toFixed(1)}%`, color: 'text-red-400', bg: 'bg-red-500/10' };
  return { text: '0%', color: 'text-muted-foreground', bg: 'bg-muted/30' };
}

// ============================================================================
// ORDER ROW
// ============================================================================
function OrderRow({
  order,
  currentCityId,
  onCancel,
  onFill,
  compact = false,
}: {
  order: TradeOrder;
  currentCityId: string;
  onCancel: (id: string) => void;
  onFill: (order: TradeOrder) => void;
  compact?: boolean;
}) {
  const isOwn = order.cityId === currentCityId;
  const remaining = order.quantity - order.filledQuantity;
  const info = RESOURCE_INFO[order.resourceType];

  if (compact) {
    return (
      <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/20 hover:bg-muted/30 transition-colors text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
            order.orderType === 'buy' 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {order.orderType === 'buy' ? 'B' : 'S'}
          </span>
          <span>{info.icon}</span>
          <span className="font-medium">{remaining.toLocaleString()}</span>
          <span className="font-bold">{formatPrice(order.pricePerUnit)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground truncate max-w-[60px]">
            {order.cityName}
          </span>
          {isOwn ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => onCancel(order.id)}
            >
              ✕
            </Button>
          ) : (
            <Button
              variant="game"
              size="sm"
              className="h-5 px-2 text-[10px]"
              onClick={() => onFill(order)}
            >
              Fill
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors text-sm">
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          order.orderType === 'buy' 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-red-500/20 text-red-400'
        }`}>
          {order.orderType === 'buy' ? 'BUY' : 'SELL'}
        </span>
        <span>{info.icon}</span>
        <span className="font-medium">{remaining.toLocaleString()}</span>
        <span className="text-muted-foreground">@</span>
        <span className="font-bold">{formatPrice(order.pricePerUnit)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground truncate max-w-[80px]">
          {order.cityName}
        </span>
        {isOwn ? (
          <Button
            variant="game-danger"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onCancel(order.id)}
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="game"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onFill(order)}
          >
            Fill
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CREATE ORDER FORM
// ============================================================================
function CreateOrderForm({
  resourceType,
  cityId,
  cityName,
  currentPrice,
  onOrderCreated,
}: {
  resourceType: ResourceType;
  cityId: string;
  cityName: string;
  currentPrice: number;
  onOrderCreated: () => void;
}) {
  const [orderType, setOrderType] = useState<OrderType>('buy');
  const [quantity, setQuantity] = useState('100');
  const [price, setPrice] = useState(currentPrice.toFixed(2));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const qty = parseInt(quantity);
    const prc = parseFloat(price);

    if (isNaN(qty) || qty <= 0 || isNaN(prc) || prc <= 0) return;

    setIsSubmitting(true);
    const result = await createOrder(cityId, cityName, resourceType, orderType, qty, prc);
    setIsSubmitting(false);

    if (result) {
      setQuantity('100');
      onOrderCreated();
    }
  };

  const info = RESOURCE_INFO[resourceType];
  const total = parseFloat(quantity || '0') * parseFloat(price || '0');

  return (
    <div className="space-y-3 p-3 bg-card rounded-xl border border-border">
      {/* Buy/Sell Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={orderType === 'buy' ? 'game' : 'game-secondary'}
          size="sm"
          className="h-9"
          onClick={() => setOrderType('buy')}
        >
          BUY
        </Button>
        <Button
          variant={orderType === 'sell' ? 'game-danger' : 'game-secondary'}
          size="sm"
          className="h-9"
          onClick={() => setOrderType('sell')}
        >
          SELL
        </Button>
      </div>

      {/* Quantity & Price */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Quantity ({info.unit})</Label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-9 bg-muted/30 border-muted"
            min="1"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Price ($)</Label>
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-9 bg-muted/30 border-muted"
            min="0.01"
            step="0.01"
          />
        </div>
      </div>

      {/* Total */}
      <div className="text-sm font-medium">
        Total: <span className={orderType === 'buy' ? 'text-green-400' : 'text-red-400'}>{formatPrice(total)}</span>
      </div>

      {/* Submit Button */}
      <Button
        variant={orderType === 'buy' ? 'game' : 'game-danger'}
        className="w-full h-10"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Processing...' : `Place ${orderType === 'buy' ? 'Buy' : 'Sell'} Order`}
      </Button>
    </div>
  );
}

// ============================================================================
// RESOURCE MARKET VIEW (Detail View)
// ============================================================================
function ResourceMarketView({
  resourceType,
  prices,
  cityId,
  cityName,
  onBack,
}: {
  resourceType: ResourceType;
  prices: MarketPrice[];
  cityId: string;
  cityName: string;
  onBack: () => void;
}) {
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const price = prices.find(p => p.resourceType === resourceType);
  const info = RESOURCE_INFO[resourceType];
  const change = price ? formatChange(price.priceChange24h) : { text: '-', color: 'text-muted-foreground', bg: 'bg-muted/30' };

  const loadOrders = useCallback(async () => {
    const data = await fetchOpenOrders(resourceType);
    setOrders(data);
    setIsLoading(false);
  }, [resourceType]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleCancel = async (orderId: string) => {
    await cancelOrder(orderId, cityId);
    loadOrders();
  };

  const handleFill = async (order: TradeOrder) => {
    const quantity = order.quantity - order.filledQuantity;
    await executeTrade(order.id, cityId, cityName, quantity);
    loadOrders();
  };

  const buyOrders = orders.filter(o => o.orderType === 'buy').sort((a, b) => b.pricePerUnit - a.pricePerUnit);
  const sellOrders = orders.filter(o => o.orderType === 'sell').sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-sidebar border-b border-sidebar-border p-3 flex items-center gap-3">
        <Button 
          variant="game-secondary" 
          size="sm" 
          onClick={onBack} 
          className="h-8 px-3 gap-1.5"
        >
          ← Back
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xl">{info.icon}</span>
          <h3 className="font-bold text-sm">{info.name} Market</h3>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Price Display */}
          {price && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{formatPrice(price.currentPrice)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    24h: {price.low24h ? formatPrice(price.low24h) : '-'} – {price.high24h ? formatPrice(price.high24h) : '-'}
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg ${change.bg}`}>
                  <span className={`text-lg font-bold ${change.color}`}>{change.text}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span>Supply: <span className="text-foreground font-medium">{price.totalSupply.toLocaleString()}</span></span>
                <span>Demand: <span className="text-foreground font-medium">{price.totalDemand.toLocaleString()}</span></span>
              </div>
            </div>
          )}

          {/* Order Form */}
          <CreateOrderForm
            resourceType={resourceType}
            cityId={cityId}
            cityName={cityName}
            currentPrice={price?.currentPrice || 10}
            onOrderCreated={loadOrders}
          />

          {/* Order Book */}
          <div className="grid grid-cols-2 gap-3">
            {/* Buy Orders */}
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Buy Orders</span>
                <span className="text-green-400 font-medium">({buyOrders.length})</span>
              </div>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {isLoading ? (
                  <div className="text-xs text-muted-foreground text-center py-4">Loading...</div>
                ) : buyOrders.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">No orders</div>
                ) : (
                  buyOrders.slice(0, 10).map(order => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      currentCityId={cityId}
                      onCancel={handleCancel}
                      onFill={handleFill}
                      compact
                    />
                  ))
                )}
              </div>
            </div>

            {/* Sell Orders */}
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Sell Orders</span>
                <span className="text-red-400 font-medium">({sellOrders.length})</span>
              </div>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {isLoading ? (
                  <div className="text-xs text-muted-foreground text-center py-4">Loading...</div>
                ) : sellOrders.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">No orders</div>
                ) : (
                  sellOrders.slice(0, 10).map(order => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      currentCityId={cityId}
                      onCancel={handleCancel}
                      onFill={handleFill}
                      compact
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// MARKET OVERVIEW (Main View)
// ============================================================================
function MarketOverview({
  prices,
  myOrders,
  onSelectResource,
  onCancelOrder,
}: {
  prices: MarketPrice[];
  myOrders: TradeOrder[];
  onSelectResource: (type: ResourceType) => void;
  onCancelOrder: (orderId: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-sidebar border-b border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📈</span>
          <h2 className="font-bold text-sm">Global Market</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Trade resources with other cities worldwide
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Resource Cards */}
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Market Prices
            </div>
            <div className="grid grid-cols-2 gap-2">
              {RESOURCE_TYPES.map(type => {
                const price = prices.find(p => p.resourceType === type);
                const info = RESOURCE_INFO[type];
                const change = price ? formatChange(price.priceChange24h) : { text: '-', color: 'text-muted-foreground', bg: 'bg-muted/30' };

                return (
                  <button
                    key={type}
                    onClick={() => onSelectResource(type)}
                    className="p-3 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg group-hover:scale-110 transition-transform">{info.icon}</span>
                        <span className="text-sm font-medium">{info.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-bold">
                        {price ? formatPrice(price.currentPrice) : '-'}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${change.bg} ${change.color}`}>
                        {change.text}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* My Orders */}
          {myOrders.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Your Active Orders</span>
                <span className="text-foreground font-medium">({myOrders.length})</span>
              </div>
              <div className="space-y-1.5 bg-card border border-border rounded-xl p-2">
                {myOrders.map(order => {
                  const info = RESOURCE_INFO[order.resourceType];
                  const remaining = order.quantity - order.filledQuantity;

                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-muted/20 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                          order.orderType === 'buy'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {order.orderType === 'buy' ? 'B' : 'S'}
                        </span>
                        <span>{info.icon}</span>
                        <span className="font-medium">{remaining.toLocaleString()}</span>
                        <span className="text-muted-foreground">@</span>
                        <span className="font-bold">{formatPrice(order.pricePerUnit)}</span>
                      </div>
                      <Button
                        variant="game-danger"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => onCancelOrder(order.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="text-xs text-muted-foreground text-center py-2 bg-muted/20 rounded-lg">
            💡 Prices fluctuate based on global supply and demand
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// MAIN MARKET PANEL
// ============================================================================
export function MarketPanel() {
  const { state, setActivePanel } = useGame();
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [myOrders, setMyOrders] = useState<TradeOrder[]>([]);
  const [selectedResource, setSelectedResource] = useState<ResourceType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const multiplayerAvailable = isMultiplayerAvailable();
  const onClose = () => setActivePanel('none');

  useEffect(() => {
    if (!multiplayerAvailable) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      const [pricesData, ordersData] = await Promise.all([
        fetchMarketPrices(),
        fetchCityOrders(state.id),
      ]);
      setPrices(pricesData);
      setMyOrders(ordersData);
      setIsLoading(false);
    };

    loadData();

    const unsubscribe = subscribeToMarketPrices((newPrices) => {
      setPrices(newPrices);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [multiplayerAvailable, state.id]);

  const handleCancelOrder = async (orderId: string) => {
    await cancelOrder(orderId, state.id);
    const ordersData = await fetchCityOrders(state.id);
    setMyOrders(ordersData);
  };

  // Offline message
  if (!multiplayerAvailable) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-[400px]">
          <DialogTitle className="sr-only">Global Market</DialogTitle>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="font-bold mb-2">Global Market Offline</h3>
            <p className="text-muted-foreground text-sm mb-4">
              The global market is not currently configured.
            </p>
            <p className="text-xs text-muted-foreground">
              Enable by setting Supabase environment variables.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[480px] h-[600px] p-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">Global Market</DialogTitle>
        
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-4xl mb-3 animate-pulse">📈</div>
              <p>Loading market data...</p>
            </div>
          </div>
        ) : selectedResource ? (
          <ResourceMarketView
            resourceType={selectedResource}
            prices={prices}
            cityId={state.id}
            cityName={state.cityName}
            onBack={() => setSelectedResource(null)}
          />
        ) : (
          <MarketOverview
            prices={prices}
            myOrders={myOrders}
            onSelectResource={setSelectedResource}
            onCancelOrder={handleCancelOrder}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
