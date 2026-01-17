'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { T, Currency, useGT } from 'gt-next';

interface FinancePanelProps {
  cash: number;
  rideRevenue: number;
  shopRevenue: number;
  income: number;
  expenses: number;
  loan: number;
  onClose: () => void;
}

export default function FinancePanel({
  cash,
  rideRevenue,
  shopRevenue,
  income,
  expenses,
  loan,
  onClose,
}: FinancePanelProps) {
  const gt = useGT();

  return (
    <div className="absolute top-20 right-6 z-50 w-72">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <T>
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Finance</div>
              <div className="text-lg font-semibold">Park Ledger</div>
            </div>
          </T>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={gt('Close finance panel')}>
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <T>
            <div className="flex items-center justify-between">
              <span>Cash on Hand</span>
              <span className="font-semibold"><Currency currency="USD">{cash}</Currency></span>
            </div>
          </T>
          <div className="space-y-2">
            <T>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Income</div>
            </T>
            <T>
              <div className="flex items-center justify-between">
                <span>Ride Tickets</span>
                <span><Currency currency="USD">{rideRevenue}</Currency></span>
              </div>
            </T>
            <T>
              <div className="flex items-center justify-between">
                <span>Shops & Stalls</span>
                <span><Currency currency="USD">{shopRevenue}</Currency></span>
              </div>
            </T>
            <T>
              <div className="flex items-center justify-between font-semibold">
                <span>Total Income</span>
                <span><Currency currency="USD">{income}</Currency></span>
              </div>
            </T>
          </div>
          <div className="space-y-2">
            <T>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expenses</div>
            </T>
            <T>
              <div className="flex items-center justify-between font-semibold">
                <span>Total Expenses</span>
                <span><Currency currency="USD">{expenses}</Currency></span>
              </div>
            </T>
          </div>
          <T>
            <div className="flex items-center justify-between">
              <span>Outstanding Loan</span>
              <span><Currency currency="USD">{loan}</Currency></span>
            </div>
          </T>
        </div>
      </Card>
    </div>
  );
}
