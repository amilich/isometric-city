'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useSetLocale } from 'gt-next/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// Language configuration with display names
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt-BR', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'tr', name: 'Türkçe' },
] as const;

// Globe icon for language button
function GlobeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

// Check icon for selected language
function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

interface LanguageSelectorProps {
  /** Show only an icon (for compact layouts like mobile) */
  iconOnly?: boolean;
  /** Custom class name for the trigger button */
  className?: string;
  /** Variant for the button */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Size of the icon */
  iconSize?: number;
  /** Use drawer style instead of dropdown (for mobile) */
  useDrawer?: boolean;
}

export function LanguageSelector({ 
  iconOnly = false, 
  className = '',
  variant = 'ghost',
  iconSize = 16,
  useDrawer = false,
}: LanguageSelectorProps) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const [isOpen, setIsOpen] = useState(false);
  
  const currentLanguage = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];

  const handleSelectLanguage = (code: string) => {
    setLocale(code);
    setIsOpen(false);
  };

  // Close drawer on Escape (helps mobile + accessibility)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Drawer mode for mobile
  if (useDrawer) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Change language"
          title="Change language"
          className={`h-6 w-6 p-0 m-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
        >
          <GlobeIcon size={iconSize} />
        </button>

        {isOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            {/* Drawer */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Language selection"
              className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-xl animate-in slide-in-from-bottom duration-200 pb-24"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>
              <div className="p-4 pt-2">
                <div className="text-sm font-medium text-foreground mb-3">
                  Language ({currentLanguage.code})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LANGUAGES.map((language) => (
                    <Button
                      key={language.code}
                      variant={locale === language.code ? 'default' : 'ghost'}
                      size="sm"
                      className="h-11 w-full text-xs justify-center"
                      onClick={() => handleSelectLanguage(language.code)}
                    >
                      {language.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }
  
  // Standard dropdown mode
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {iconOnly ? (
          <button
            type="button"
            className={`h-6 w-6 p-0 m-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
            aria-label="Change language"
            title="Change language"
          >
            <GlobeIcon size={iconSize} />
          </button>
        ) : (
          <Button variant={variant} size="sm" className={`gap-2 ${className}`}>
            <GlobeIcon size={iconSize} />
            <span className="text-xs hidden sm:inline">{currentLanguage.name}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => setLocale(language.code)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <span>{language.name}</span>
            {locale === language.code && (
              <CheckIcon size={14} />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSelector;
