import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { CoasterBuildingType } from '@/games/coaster/types';
import { T, Var, Num, Currency, Branch } from 'gt-next';

type ShopEntry = {
  id: string;
  name: string;
  type: CoasterBuildingType;
  price: number;
  open: boolean;
  position: {
    x: number;
    y: number;
  };
};

interface ShopPanelProps {
  shops: ShopEntry[];
  onClose: () => void;
  onPriceChange: (position: { x: number; y: number }, price: number) => void;
  onToggleOpen: (position: { x: number; y: number }) => void;
}

const PRICE_RANGE = [0, 20];

export default function ShopPanel({ shops, onClose, onPriceChange, onToggleOpen }: ShopPanelProps) {
  return (
    <div className="absolute top-20 right-6 z-50 w-96">
      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <T>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Shop Ops</div>
              <h2 className="text-lg font-semibold">Stall Pricing</h2>
            </T>
          </div>
          <T><Button variant="ghost" size="sm" onClick={onClose}>Close</Button></T>
        </div>

        <ScrollArea className="h-64 pr-3">
          {shops.length === 0 && (
            <T>
              <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                No shops built yet. Place a stall to set its pricing.
              </div>
            </T>
          )}
          <div className="space-y-4">
            {shops.map((shop) => (
              <div key={shop.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <T><div className="font-medium"><Var>{shop.name}</Var></div></T>
                    <T>
                      <div className="text-xs text-muted-foreground capitalize">
                        <Var>{shop.type.replaceAll('_', ' ')}</Var> · (<Num>{shop.position.x}</Num>, <Num>{shop.position.y}</Num>)
                      </div>
                    </T>
                  </div>
                  <T>
                    <Branch
                      branch={shop.open.toString()}
                      true={<div className="text-xs font-semibold text-emerald-200">Open</div>}
                      false={<div className="text-xs font-semibold text-rose-200">Closed</div>}
                    />
                  </T>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold"><Currency currency="USD">{shop.price}</Currency></div>
                  <T>
                    <Branch
                      branch={shop.open.toString()}
                      true={
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onToggleOpen(shop.position)}
                        >
                          Close
                        </Button>
                      }
                      false={
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => onToggleOpen(shop.position)}
                        >
                          Open
                        </Button>
                      }
                    />
                  </T>
                </div>
                <div className="mt-3 space-y-2">
                  <Slider
                    min={PRICE_RANGE[0]}
                    max={PRICE_RANGE[1]}
                    step={1}
                    value={[shop.price]}
                    onValueChange={(value) => onPriceChange(shop.position, value[0] ?? shop.price)}
                  />
                  <T>
                    <div className="text-xs text-muted-foreground">
                      Adjust pricing between <Currency currency="USD">{PRICE_RANGE[0]}</Currency> and <Currency currency="USD">{PRICE_RANGE[1]}</Currency>.
                    </div>
                  </T>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
