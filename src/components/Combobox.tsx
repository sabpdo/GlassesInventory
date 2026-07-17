"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  onBlur?: () => void;
  /** Max number of suggestions to render in the dropdown. */
  maxOptions?: number;
};

// Single-select autocomplete that accepts free-text input. Filters
// case-insensitively, ranks prefix matches above substring matches, and
// supports keyboard navigation (↑ / ↓ / Enter / Escape).
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  onBlur,
  maxOptions = 50,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, maxOptions);
    return options
      .filter((o) => o.toLowerCase().includes(q))
      .sort((a, b) => {
        const aPrefix = a.toLowerCase().startsWith(q) ? 0 : 1;
        const bPrefix = b.toLowerCase().startsWith(q) ? 0 : 1;
        if (aPrefix !== bPrefix) return aPrefix - bPrefix;
        return a.localeCompare(b, undefined, { sensitivity: "base" });
      })
      .slice(0, maxOptions);
  }, [value, options, maxOptions]);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Keep the highlighted row scrolled into view as you arrow through.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(
      `[data-idx="${highlight}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[highlight]) {
        e.preventDefault();
        onChange(filtered[highlight]);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const showDropdown = open && filtered.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        className="input"
      />
      {showDropdown ? (
        <ul
          ref={listRef}
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-slate-200"
        >
          {filtered.map((opt, i) => (
            <li
              key={opt}
              data-idx={i}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                // Prevent input blur so the click commits the value.
                e.preventDefault();
                onChange(opt);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={
                "cursor-pointer px-3 py-1.5 text-sm " +
                (i === highlight
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-700")
              }
            >
              {opt}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
