/**
 * Shared accent palette. Each accent maps to a hex value (for canvas / CSS
 * variables) and to the Tailwind classes used for text and tinted surfaces,
 * so a module can carry one colour identity through its sliders, panels,
 * badges and canvas drawing.
 *
 * Tailwind needs complete class names at build time — keep them literal.
 */
export type Accent = 'sky' | 'emerald' | 'purple' | 'amber' | 'rose' | 'cyan' | 'indigo' | 'pink';

export interface AccentStyle {
  hex: string;
  text: string;
  bgSoft: string;
  border: string;
  glow: string;
}

export const ACCENTS: Record<Accent, AccentStyle> = {
  sky: { hex: '#38bdf8', text: 'text-sky-400', bgSoft: 'bg-sky-500/10', border: 'border-sky-500/30', glow: 'glow-sky' },
  emerald: { hex: '#34d399', text: 'text-emerald-400', bgSoft: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: 'glow-emerald' },
  purple: { hex: '#c084fc', text: 'text-purple-400', bgSoft: 'bg-purple-500/10', border: 'border-purple-500/30', glow: 'glow-violet' },
  amber: { hex: '#fbbf24', text: 'text-amber-400', bgSoft: 'bg-amber-500/10', border: 'border-amber-500/30', glow: 'glow-amber' },
  rose: { hex: '#fb7185', text: 'text-rose-400', bgSoft: 'bg-rose-500/10', border: 'border-rose-500/30', glow: 'glow-rose' },
  cyan: { hex: '#22d3ee', text: 'text-cyan-400', bgSoft: 'bg-cyan-500/10', border: 'border-cyan-500/30', glow: 'glow-cyan' },
  indigo: { hex: '#818cf8', text: 'text-indigo-400', bgSoft: 'bg-indigo-500/10', border: 'border-indigo-500/30', glow: 'glow-violet' },
  pink: { hex: '#f472b6', text: 'text-pink-400', bgSoft: 'bg-pink-500/10', border: 'border-pink-500/30', glow: 'glow-rose' },
};

/** Canvas-friendly colour tokens shared by every simulation scene. */
export const CANVAS_COLORS = {
  bg: '#070b14',
  bgDeep: '#04060d',
  grid: '#1b2536',
  gridStrong: '#2a3750',
  axis: '#475569',
  text: '#94a3b8',
  textBright: '#e2e8f0',
};
