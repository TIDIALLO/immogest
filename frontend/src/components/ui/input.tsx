import * as React from 'react'

import { cn } from '@/lib/utils'

const fieldClass =
  'flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn(fieldClass, 'h-10', className)} ref={ref} {...props} />
  ),
)
Input.displayName = 'Input'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea className={cn(fieldClass, 'min-h-[80px]', className)} ref={ref} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

/** Liste déroulante native (accessible, fluide sur mobile), stylée comme les autres champs. */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select className={cn(fieldClass, 'h-10', className)} ref={ref} {...props}>
      {children}
    </select>
  ),
)
Select.displayName = 'Select'

export { Input, Select, Textarea }
