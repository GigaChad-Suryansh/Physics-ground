/**
 * Panel, ReadoutBar and FormulaList — the building blocks every lab page uses
 * so cards, readouts and equation boxes look and behave the same everywhere.
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ACCENTS } from './theme';
import type { Accent } from './theme';
import { MathFormula } from './MathFormula';

interface PanelProps {
  title?: React.ReactNode;
  icon?: LucideIcon;
  accent?: Accent;
  /** Content aligned to the right of the header (badges, buttons). */
  right?: React.ReactNode;
  /** Rendered under the body, separated by a rule (usually a ReadoutBar). */
  footer?: React.ReactNode;
  /** Remove body padding — for canvases that should touch the card edges. */
  flush?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  icon: Icon,
  accent = 'sky',
  right,
  footer,
  flush = false,
  className = '',
  children,
}) => {
  const style = ACCENTS[accent];
  const hasHeader = Boolean(title || right);

  return (
    <section
      className={`animate-fade-up overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/70 shadow-xl shadow-black/20 backdrop-blur-sm ${className}`}
    >
      {hasHeader && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/40 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && <Icon className={`h-4 w-4 shrink-0 ${style.text}`} />}
            <h3 className="truncate text-xs font-bold uppercase tracking-wider text-slate-200">
              {title}
            </h3>
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={flush ? '' : 'space-y-4 p-4 sm:p-5'}>{children}</div>
      {footer && <div className="border-t border-slate-800/80 bg-slate-950/60">{footer}</div>}
    </section>
  );
};

export interface Readout {
  label: string;
  value: React.ReactNode;
  accent?: Accent;
}

/** A compact grid of live numbers (label above, mono value below). */
export const ReadoutBar: React.FC<{ items: Readout[]; className?: string }> = ({
  items,
  className = '',
}) => (
  <div className={`grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-4 ${className}`}>
    {items.map((item) => (
      <div key={item.label} className="min-w-0">
        <div className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {item.label}
        </div>
        <div
          className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums ${
            item.accent ? ACCENTS[item.accent].text : 'text-slate-200'
          }`}
        >
          {item.value}
        </div>
      </div>
    ))}
  </div>
);

/** LaTeX equations, one per tinted box. */
export const FormulaList: React.FC<{ formulas: string[] }> = ({ formulas }) => (
  <div className="space-y-2">
    {formulas.map((formula) => (
      <div
        key={formula}
        className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-200"
      >
        <MathFormula formula={formula} />
      </div>
    ))}
  </div>
);

/** Small coloured pill, e.g. "KINETIC", "Real image". */
export const Badge: React.FC<{
  accent?: Accent;
  children: React.ReactNode;
  className?: string;
}> = ({ accent = 'sky', children, className = '' }) => {
  const style = ACCENTS[accent];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${style.bgSoft} ${style.border} ${style.text} ${className}`}
    >
      {children}
    </span>
  );
};
