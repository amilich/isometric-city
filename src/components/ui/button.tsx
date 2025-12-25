import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority" // UI variants

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-primary/40 bg-transparent hover:bg-primary/10 text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent/20 text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        gold: "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold",
        game: "relative rounded-xl border-2 border-amber-400 bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0_4px_0_0_#1e3a8a] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#1e3a8a] active:translate-y-[4px] active:shadow-none font-bold uppercase tracking-wider transition-all",
        "game-secondary": "relative rounded-xl border-2 border-slate-600 bg-slate-800 text-slate-200 shadow-[0_4px_0_0_#334155] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#334155] active:translate-y-[4px] active:shadow-none font-bold uppercase tracking-wider transition-all",
        "game-danger": "relative rounded-xl border-2 border-red-400 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_4px_0_0_#7f1d1d] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#7f1d1d] active:translate-y-[4px] active:shadow-none font-bold uppercase tracking-wider transition-all",
        "game-success": "relative rounded-xl border-2 border-green-400 bg-gradient-to-b from-green-500 to-green-700 text-white shadow-[0_4px_0_0_#14532d] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#14532d] active:translate-y-[4px] active:shadow-none font-bold uppercase tracking-wider transition-all",
        "game-tool": "relative justify-start rounded-xl border-2 border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700/80 hover:border-slate-500 hover:text-white hover:-translate-y-0.5 transition-all",
        "game-tool-selected": "relative justify-start rounded-xl border-2 border-amber-400 bg-blue-600 text-white shadow-[0_2px_0_0_#1e3a8a] transition-all hover:bg-blue-500",
        "game-icon": "relative h-9 w-9 p-0 rounded-xl border-2 border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700/80 hover:border-slate-500 hover:text-white hover:-translate-y-0.5 transition-all",
        "game-icon-selected": "relative h-9 w-9 p-0 rounded-xl border-2 border-amber-400 bg-blue-600 text-white shadow-[0_2px_0_0_#1e3a8a] transition-all hover:bg-blue-500",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "gold" | "game" | "game-secondary" | "game-danger" | "game-success" | "game-tool" | "game-tool-selected" | "game-icon" | "game-icon-selected" | null | undefined
  size?: "default" | "sm" | "lg" | "xl" | "icon" | "icon-sm" | null | undefined
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
