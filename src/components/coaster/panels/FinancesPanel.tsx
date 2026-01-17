'use client';

import React from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';
import { T } from 'gt-next';

export function FinancesPanel() {
  const { state, setActivePanel, takeLoan, repayLoan } = useCoaster();
  const { finances } = state;

  const formatMoney = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const record = finances.currentMonthRecord;

  return (
    <Card className="fixed top-16 right-4 w-80 max-h-[calc(100vh-5rem)] bg-slate-900/95 border-white/10 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-white font-bold"><T>Finances</T></h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActivePanel('none')}
          className="h-6 w-6 text-white/50 hover:text-white hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {/* Cash & Loan */}
        <div className="space-y-3">
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-white/60"><T>Cash</T></span>
              <span className={`font-mono font-bold ${finances.cash < 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatMoney(finances.cash)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-white/5 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white/60"><T>Loan</T></span>
              <span className="font-mono text-orange-400">
                {formatMoney(finances.loan)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => takeLoan(5000)}
                disabled={finances.loan >= finances.maxLoan}
                className="flex-1 text-xs h-7 border-white/20"
              >
                <T>Borrow $5K</T>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => repayLoan(5000)}
                disabled={finances.loan === 0 || finances.cash < 5000}
                className="flex-1 text-xs h-7 border-white/20"
              >
                <T>Repay $5K</T>
              </Button>
            </div>
          </div>
        </div>

        {/* This Month */}
        <div className="mt-6">
          <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3"><T>This Month</T></h3>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60"><T>Park Entrance</T></span>
              <span className="text-green-400">{formatMoney(record.parkEntranceFees)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60"><T>Ride Tickets</T></span>
              <span className="text-green-400">{formatMoney(record.rideTickets)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60"><T>Shop Sales</T></span>
              <span className="text-green-400">{formatMoney(record.shopSales)}</span>
            </div>

            <div className="h-px bg-white/10 my-2" />

            <div className="flex justify-between text-sm">
              <span className="text-white/60"><T>Staff Wages</T></span>
              <span className="text-red-400">-{formatMoney(record.staffWages)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60"><T>Ride Running</T></span>
              <span className="text-red-400">-{formatMoney(record.rideRunning)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60"><T>Construction</T></span>
              <span className="text-red-400">-{formatMoney(record.construction)}</span>
            </div>
          </div>
        </div>

        {/* Park Value */}
        <div className="mt-6 p-3 bg-white/5 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-white/60"><T>Park Value</T></span>
            <span className="font-mono text-purple-400">
              {formatMoney(finances.parkValue)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-white/60"><T>Company Value</T></span>
            <span className="font-mono text-purple-400">
              {formatMoney(finances.companyValue)}
            </span>
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}
