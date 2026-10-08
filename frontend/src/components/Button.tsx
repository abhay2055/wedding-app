import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300",
  secondary: "bg-white text-brand-700 border border-brand-300 hover:bg-brand-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};

export function Button({ variant = "primary", isLoading, disabled, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? "Please wait..." : children}
    </button>
  );
}
