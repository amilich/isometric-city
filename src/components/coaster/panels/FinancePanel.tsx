'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { T, Currency, useGT } from 'gt-next';

interface FinancePanelProps {
  cash: number;
  entranceRevenue: number;
  entranceFee: number;
  rideRevenue: number;
  shopRevenue: number;
  income: number;
  expenses: number;
  staffCost: number;
  maintenanceCost: number;
  researchCost: number;
  loanInterestCost: number;
  loan: number;
  onLoanChange: (amount: number, action: 'take' | 'repay') => void;
  onEntranceFeeChange: (fee: number) => void;
  onClose: () => void;
}

export default function FinancePanel({
  cash,
  entranceRevenue,
  entranceFee,
  rideRevenue,
  shopRevenue,
  income,
  expenses,
  staffCost,
  maintenanceCost,
  researchCost,
  loanInterestCost,
  loan,
  onLoanChange,
  onEntranceFeeChange,
  onClose,
}: FinancePanelProps) {
  const gt = useGT();
  const [loanAmount, setLoanAmount] = React.useState(2000);

  const handleLoanAmountChange = (value: number) => {
    setLoanAmount(value);
  };

  return (
    <div className="absolute top-20 right-6 z-50 w-72">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <T>
          <div className="flex items-start justify-between p-4 border-b border-border/60">
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Finance</div>
              <div className="text-lg font-semibold">Park Ledger</div>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={gt('Close finance panel')}>
              ✕
            </Button>
          </div>
        </T>
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
              <div className="flex items-center justify-between">
                <span>Admissions</span>
                <span><Currency currency="USD">{entranceRevenue}</Currency></span>
              </div>
            </T>
            <div className="space-y-1">
              <T>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Entrance Fee</span>
                  <span><Currency currency="USD">{entranceFee}</Currency></span>
                </div>
              </T>
              <Slider
                value={[entranceFee]}
                min={0}
                max={20}
                step={1}
                onValueChange={(value) => onEntranceFeeChange(value[0])}
              />
            </div>
            <T>
              <div className="flex items-center justify-between">
                <span>Ride Tickets</span>
                <span><Currency currency="USD">{rideRevenue}</Currency></span>
              </div>
              <div className="flex items-center justify-between">
                <span>Shops & Stalls</span>
                <span><Currency currency="USD">{shopRevenue}</Currency></span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Total Income</span>
                <span><Currency currency="USD">{income}</Currency></span>
              </div>
            </T>
          </div>
          <T>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expenses</div>
              <div className="flex items-center justify-between">
                <span>Staff Wages</span>
                <span><Currency currency="USD">{staffCost}</Currency></span>
              </div>
              <div className="flex items-center justify-between">
                <span>Maintenance</span>
                <span><Currency currency="USD">{maintenanceCost}</Currency></span>
              </div>
              <div className="flex items-center justify-between">
                <span>Research</span>
                <span><Currency currency="USD">{researchCost}</Currency></span>
              </div>
              <div className="flex items-center justify-between">
                <span>Loan Interest</span>
                <span><Currency currency="USD">{loanInterestCost}</Currency></span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Total Expenses</span>
                <span><Currency currency="USD">{expenses}</Currency></span>
              </div>
            </div>
          </T>
          <T>
            <div className="flex items-center justify-between">
              <span>Outstanding Loan</span>
              <span><Currency currency="USD">{loan}</Currency></span>
            </div>
          </T>
          <div className="space-y-2">
            <T>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Loans</div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Loan Amount</span>
                <span><Currency currency="USD">{loanAmount}</Currency></span>
              </div>
            </T>
            <Slider
              value={[loanAmount]}
              min={500}
              max={10000}
              step={500}
              onValueChange={(value) => handleLoanAmountChange(value[0])}
            />
            <T>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => onLoanChange(loanAmount, 'take')}
                >
                  Take Loan
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={loan === 0}
                  onClick={() => onLoanChange(loanAmount, 'repay')}
                >
                  Repay
                </Button>
              </div>
            </T>
          </div>
        </div>
      </Card>
    </div>
  );
}
