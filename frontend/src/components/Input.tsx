import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className = "", ...rest }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={inputId}
        className={`rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-400 ${
          error ? "border-red-400" : "border-neutral-300"
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
