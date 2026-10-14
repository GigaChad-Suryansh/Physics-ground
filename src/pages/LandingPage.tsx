import React from 'react';
import { Link } from 'react-router-dom';
import { SIMULATION_MODULES } from '../components/layout/Sidebar';
import { Orbit, Compass, ArrowRight, Sparkles, BookOpen, Layers, CheckCircle } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white relative overflow-hidden">
      {/* Subtle cosmic grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

      {/* Hero ambient glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-indigo-500/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Orbit className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wider uppercase flex items-center gap-1.5">
              <span>PHYSICS</span>
              <span className="text-sky-400">PLAYGROUND</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-mono">Interactive Laboratory</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/sim/projectile"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-all shadow-sm"
          >
            Launch Lab
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-16 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Pure In-Browser Physics Engine • 120 Hz Fixed Timesteps</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100 max-w-3xl mx-auto leading-tight">
          Don't just learn physics.{' '}
          <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Experiment with it.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          An interactive digital laboratory with rigorous numerical calculations, live vector
          fields, dynamic charts, and KaTeX mathematical notation.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            to="/sim/projectile"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm bg-sky-500 text-slate-950 hover:bg-sky-400 transition-all shadow-lg shadow-sky-500/20"
          >
            <span>Enter the Lab</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#modules"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all"
          >
            <span>Explore Experiments</span>
          </a>
        </div>
      </section>

      {/* Features Overview */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-12 border-t border-slate-900">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-200 text-sm">Real Numerical Solvers</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Runge–Kutta (RK4) and symplectic Velocity Verlet integrators, plus closed-form solutions to check them against.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-200 text-sm">Scientific Data & Export</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time Recharts kinematic telemetry, conservation of energy plots, and single-click CSV data export.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-200 text-sm">Mathematical Formulations</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every experiment connects directly to LaTeX mathematical formulas with live theoretical benchmark comparisons.
            </p>
          </div>
        </div>
      </section>

      {/* Simulation Modules Grid */}
      <section id="modules" className="relative z-10 max-w-7xl mx-auto px-6 py-16 space-y-8">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-sky-400 font-semibold">
            Laboratory Modules
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
            Explore {SIMULATION_MODULES.length} Interactive Physics Environments
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SIMULATION_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.id}
                to={mod.path}
                className="group p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition-all shadow-xl flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center ${mod.bgColor} ${mod.color}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                      {mod.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-200 text-base group-hover:text-sky-300 transition-colors">
                      {mod.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </div>

                <div className="pt-6 flex items-center text-xs font-semibold text-sky-400 group-hover:text-sky-300 transition-colors gap-1.5">
                  <span>Enter Experiment</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 py-8 px-6 text-center text-xs text-slate-500 font-mono">
        Physics Playground — Scientific Educational Suite • Designed for Curious Minds
      </footer>
    </div>
  );
};
