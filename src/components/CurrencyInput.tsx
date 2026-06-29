"use client";

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
  className?: string;
};

// Text input styled as a currency field: shows a leading "$", uses
// inputMode="decimal" (mobile shows a number pad), and never renders the
// browser's up/down spinner since it's a text input under the hood.
// Accepts pasted "$12.99" or "12.99" — non-numeric chars are stripped on
// input.
export function CurrencyInput({
  id,
  value,
  onChange,
  placeholder = "0.00",
  autoFocus,
  required = false,
  className = "",
}: Props) {
  return (
    <div className={"relative " + className}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500"
      >
        $
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(sanitizeMoney(e.target.value))}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
        className="input pl-7 tabular-nums"
      />
    </div>
  );
}

// Keep only digits and a single decimal point. Allows the user to type "$"
// or commas without them sticking around in the stored value.
function sanitizeMoney(v: string): string {
  const cleaned = v.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}
