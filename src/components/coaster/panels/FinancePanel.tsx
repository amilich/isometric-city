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
          <div>
            <T><div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Finance</div></T>
            <T><div className="text-lg font-semibold">Park Ledger</div></T>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={gt('Close finance panel')}>
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <T><span>Cash on Hand</span></T>
            <span className="font-semibold"><Currency currency="USD">{cash}</Currency></span>
          </div>
          <div className="space-y-2">
            <T><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Income</div></T>
            <div className="flex items-center justify-between">
              <T><span>Ride Tickets</span></T>
              <span><Currency currency="USD">{rideRevenue}</Currency></span>
            </div>
            <div className="flex items-center justify-between">
              <T><span>Shops & Stalls</span></T>
              <span><Currency currency="USD">{shopRevenue}</Currency></span>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <T><span>Total Income</span></T>
              <span><Currency currency="USD">{income}</Currency></span>
            </div>
          </div>
          <div className="space-y-2">
            <T><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expenses</div></T>
            <div className="flex items-center justify-between font-semibold">
              <T><span>Total Expenses</span></T>
              <span><Currency currency="USD">{expenses}</Currency></span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <T><span>Outstanding Loan</span></T>
            <span><Currency currency="USD">{loan}</Currency></span>
          </div>
        </div>
      </Card>
    </div>
  );
}
