/**
 * Slider — labelled range input with a filled track and glowing thumb.
 *
 * The visuals live in index.css (`.pg-slider`); the fill colour and progress
 * are passed in as CSS variables so one stylesheet serves every accent.
 */
import React, { useId } from 'react';
import { ACCENTS } from './theme';
import type { Accent } from './theme';

interface SliderProps {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Unit appended to the displayed value, e.g. "m/s". */
  unit?: string;
  /** Custom value text (overrides value + unit), e.g. v => v.toExponential(1). */
  format?: (value: number) => string;
  accent?: Accent;
  disabled?: boolean;
  /** Small helper line under the slider. */
  hint?: React.ReactNode;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
  format,
  accent = 'sky',
  disabled = false,
  hint,
}) => {
  const id = useId();
  const style = ACCENTS[accent];
  const span = max - min;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0;
  const shown = format ? format(value) : unit ? `${value} ${unit}` : String(value);

  return (
    <div className={`space-y-2 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <label htmlFor={id} className="text-slate-400">
          {label}
        </label>
        <span className={`font-mono font-semibold tabular-nums ${style.text}`}>{shown}</span>
      </div>
      <input
        id={id}
        type="range"
        className="pg-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': style.hex, '--pct': `${pct}%` } as React.CSSProperties}
      />
      {hint && <div className="text-[11px] leading-snug text-slate-500">{hint}</div>}
    </div>
  );
};
