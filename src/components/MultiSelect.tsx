"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  searchPlaceholder?: string;
  width?: string;
  ariaLabel?: string;
};

// A small accessible multi-select rendered as a button with a popover full of
// checkboxes. Closes on outside-click and Escape.
export function MultiSelect({
  options,
  selected,
  onChange,
  emptyLabel = "All",
  searchPlaceholder = "Filter…",
  width = "w-56",
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  const filtered = filter.trim()
    ? options.filter((o) =>
        o.toLowerCase().includes(filter.trim().toLowerCase())
      )
    : options;

  function toggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  return (
    <div ref={ref} className={`relative ${width}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="input flex w-full items-center justify-between gap-2 text-left"
      >
        <span
          className={
            selected.length === 0
              ? "truncate text-slate-500"
              : "truncate text-slate-900"
          }
        >
          {summary}
        </span>
        <span className="text-xs text-slate-400">▾</span>
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-md bg-white p-2 shadow-lg ring-1 ring-slate-200">
          {options.length > 6 ? (
            <input
              type="search"
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="input mb-2 text-sm"
            />
          ) : null}
          <div className="max-h-64 overflow-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-center text-sm text-slate-400">
                No matches
              </div>
            ) : (
              filtered.map((opt) => {
                const checked = selected.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="truncate text-sm text-slate-700">
                      {opt}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {selected.length > 0 ? (
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-slate-500 hover:text-slate-700"
              >
                Clear ({selected.length})
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-medium text-brand-700 hover:text-brand-600"
              >
                Done
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
