import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Phone input with a fixed +91 prefix.
 * Only accepts up to 10 numeric digits; the +91 prefix is display-only.
 */
const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, placeholder = '9876543210', className, disabled }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
      onChange(digits);
    };

    return (
      <div
        className={cn(
          'flex items-center rounded-md border border-input bg-background text-sm ring-offset-background',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          className,
        )}
      >
        <span className="select-none border-r border-input bg-muted px-3 py-2 text-muted-foreground">
          +91
        </span>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent px-3 py-2 placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    );
  },
);
PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
