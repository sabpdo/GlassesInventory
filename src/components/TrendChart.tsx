"use client";

type Series = {
  label: string;
  values: number[];
  color: string;
};

type Props = {
  title: string;
  dates: string[];
  series: Series[];
  height?: number;
  valueFormat?: (n: number) => string;
};

function niceMax(values: number[]): number {
  const max = Math.max(...values, 0);
  if (max <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / magnitude) * magnitude;
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function TrendChart({
  title,
  dates,
  series,
  height = 200,
  valueFormat = (n) => String(n),
}: Props) {
  if (dates.length === 0) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-4 text-sm text-slate-400">No data for this range.</p>
      </div>
    );
  }

  const width = 640;
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const allValues = series.flatMap((s) => s.values);
  const yMax = niceMax(allValues);
  const xStep = dates.length > 1 ? innerW / (dates.length - 1) : 0;

  function xAt(i: number) {
    return pad.left + i * xStep;
  }
  function yAt(v: number) {
    return pad.top + innerH - (v / yMax) * innerH;
  }

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((yMax * i) / tickCount)
  );

  const labelEvery = Math.max(1, Math.ceil(dates.length / 6));

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-4 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 w-full"
        role="img"
        aria-label={title}
      >
        {yTicks.map((tick) => {
          const y = yAt(tick);
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text
                x={pad.left - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px]"
              >
                {valueFormat(tick)}
              </text>
            </g>
          );
        })}

        {series.map((s) => {
          const points = s.values
            .map((v, i) => `${xAt(i)},${yAt(v)}`)
            .join(" ");
          return (
            <polyline
              key={s.label}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points}
            />
          );
        })}

        {dates.map((d, i) =>
          i % labelEvery === 0 || i === dates.length - 1 ? (
            <text
              key={d}
              x={xAt(i)}
              y={height - 6}
              textAnchor="middle"
              className="fill-slate-400 text-[10px]"
            >
              {formatShortDate(d)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}
