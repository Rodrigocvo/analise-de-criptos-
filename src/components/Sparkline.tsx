import React from "react";

interface SparklineProps {
  prices: number[];
  isPositive: boolean;
  id: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  prices,
  isPositive,
  id,
}) => {
  if (!prices || prices.length < 2) {
    return (
      <div className="w-[124px] h-[38px] flex items-center justify-end text-xs font-mono text-slate-600">
        --
      </div>
    );
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const w = 124;
  const h = 38;

  const coords = prices.map((p, idx) => {
    const x = (idx / (prices.length - 1)) * w;
    const y = h - ((p - min) / span) * (h - 8) - 4;
    return { x, y };
  });

  const linePoints = coords
    .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(" ");

  const areaPoints = `0,${h} ${linePoints} ${w},${h}`;
  const stroke = isPositive ? "#10B981" : "#F43F5E";
  const gradId = `spark-grad-${id}`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={linePoints}
      />
    </svg>
  );
};
