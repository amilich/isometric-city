'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter, routing } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  variant?: 'default' | 'game' | 'minimal';
  className?: string;
}

export function LanguageSelector({ variant = 'default', className }: LanguageSelectorProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className={cn("flex gap-2", className)}>
      {routing.locales.map((l) => (
        <Button
          key={l}
          variant={variant === 'game' ? (locale === l ? 'game' : 'game-secondary') : (locale === l ? 'default' : 'outline')}
          size={variant === 'minimal' ? 'sm' : 'default'}
          className={cn(
            "font-bold transition-all",
            variant === 'minimal' && "h-8 px-2 text-xs",
            variant === 'game' && "min-w-[40px]"
          )}
          onClick={() => handleLanguageChange(l)}
        >
          {l.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}

