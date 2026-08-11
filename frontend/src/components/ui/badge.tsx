import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-slate-500/10 text-slate-300 border-slate-500/20",
        secondary:
          "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        destructive:
          "bg-rose-500/10 text-rose-400 border-rose-500/20",
        outline: "border-border text-foreground bg-transparent",
        success:
          "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        warning:
          "bg-amber-500/10 text-amber-400 border-amber-500/20",
        info:
          "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
