'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { T, Var, useGT } from 'gt-next';

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
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <div>
            <T>
              <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Finance</div>
              <div className="text-lg font-semibold">Park Ledger</div>
            </T>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={gt('Close finance panel')}>
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <T>
            <div className="flex items-center justify-between">
              <span>Cash on Hand</span>
              <span className="font-semibold">$<Var>{cash.toLocaleString()}</Var></span>
            </div>
          </T>
          <div className="space-y-2">
            <T><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Income</div></T>
            <T>
              <div className="flex items-center justify-between">
                <span>Admissions</span>
                <span>$<Var>{entranceRevenue.toLocaleString()}</Var></span>
              </div>
            </T>
            <div className="space-y-1">
              <T>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Entrance Fee</span>
                  <span>$<Var>{entranceFee}</Var></span>
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
                <span>$<Var>{rideRevenue.toLocaleString()}</Var></span>
              </div>
            </T>
            <T>
              <div className="flex items-center justify-between">
                <span>Shops & Stalls</span>
                <span>$<Var>{shopRevenue.toLocaleString()}</Var></span>
              </div>
            </T>
            <T>
              <div className="flex items-center justify-between font-semibold">
                <span>Total Income</span>
                <span>$<Var>{income.toLocaleString()}</Var></span>
              </div>
            </T>
          </div>
          <div className="space-y-2">
            <T><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expenses</div></T>
            <T>
              <div className="flex items-center justify-between">
                <span>Staff Wages</span>
                <span>$<Var>{staffCost.toLocaleString()}</Var></span>
              </div>
            </T>
            <T>
              <div className="flex items-center justify-between">
                <span>Maintenance</span>
                <span>$<Var>{maintenanceCost.toLocaleString()}</Var></span>
              </div>
            </T>
            <T>
              <div className="flex items-center justify-between">
                <span>Research</span>
                <span>$<Var>{researchCost.toLocaleString()}</Var></span>
              </div>
            </T>
            <T>
              <div className="flex items-center justify-between">
                <span>Loan Interest</span>
                <span>$<Var>{loanInterestCost.toLocaleString()}</Var></span>
              </div>
            </T>
            <T>
              <div className="flex items-center justify-between font-semibold">
                <span>Total Expenses</span>
                <span>$<Var>{expenses.toLocaleString()}</Var></span>
              </div>
            </T>
          </div>
          <T>
            <div className="flex items-center justify-between">
              <span>Outstanding Loan</span>
              <span>$<Var>{loan.toLocaleString()}</Var></span>
            </div>
          </T>
          <div className="space-y-2">
            <T><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Loans</div></T>
            <T>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Loan Amount</span>
                <span>$<Var>{loanAmount}</Var></span>
              </div>
            </T>
            <Slider
              value={[loanAmount]}
              min={500}
              max={10000}
              step={500}
              onValueChange={(value) => handleLoanAmountChange(value[0])}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => onLoanChange(loanAmount, 'take')}
              >
                <T>Take Loan</T>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={loan === 0}
                onClick={() => onLoanChange(loanAmount, 'repay')}
              >
                <T>Repay</T>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
