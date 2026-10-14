import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass,
  Zap,
  Activity,
  Orbit,
  Cpu,
  Eye,
  SlidersHorizontal,
  Home,
  BookOpen
} from 'lucide-react';

export const SIMULATION_MODULES = [
  {
    id: 'projectile',
    name: 'Projectile Motion',
    category: 'Mechanics',
    path: '/sim/projectile',
    icon: Compass,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    description: 'Kinematics, 2D trajectory trails, launch velocity vectors, and quadratic air drag.',
    badge: 'Core Mechanics',
  },
  {
    id: 'forces',
    name: "Newton's Laws & Friction",
    category: 'Dynamics',
    path: '/sim/forces',
    icon: Activity,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    description: 'F = ma, static vs kinetic friction, free-body force breakdown, and angled pushes.',
    badge: 'Newtonian',
  },
  {
    id: 'orbital',
    name: 'Gravity & Orbital Mechanics',
    category: 'Astrophysics',
    path: '/sim/orbital',
    icon: Orbit,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    description: 'Two-body gravitational integration, Keplerian orbits, energy and momentum conservation.',
    badge: 'Celestial',
  },
  {
    id: 'circuits',
    name: 'Electric Circuits Lab',
    category: 'Electromagnetism',
    path: '/sim/circuits',
    icon: Cpu,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    description: "DC resistor networks, Ohm's and Kirchhoff's laws, live current flow and voltage drops.",
    badge: 'Circuit Solver',
  },
  {
    id: 'waves',
    name: 'Waves & Oscillations',
    category: 'Wave Mechanics',
    path: '/sim/waves',
    icon: Zap,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    description: 'Transverse/longitudinal waves, superposition, standing waves, and damped harmonic oscillator.',
    badge: 'Oscillations',
  },
  {
    id: 'optics',
    name: 'Geometric Optics Lab',
    category: 'Optics',
    path: '/sim/optics',
    icon: Eye,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    description: 'Lenses and mirrors, ray tracing, sign conventions, real vs virtual image formation.',
    badge: 'Ray Optics',
  },
  {
    id: 'position-displacement',
    name: 'Position & Reference Frames',
    category: 'Classical Mechanics',
    path: '/sim/position-displacement',
    icon: Compass,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    description: 'Position vectors, coordinate transformations, and frame-independent displacement.',
    badge: 'Introductory',
  },
  {
    id: 'distance-versus-displacement',
    name: 'Distance vs. Displacement',
    category: 'Classical Mechanics',
    path: '/sim/distance-versus-displacement',
    icon: Activity,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    description: 'Path length vs straight-line change. Observe how distance always exceeds or equals displacement.',
    badge: 'Introductory',
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900/95 border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Orbit className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wider uppercase text-slate-100 flex items-center gap-1.5">
              <span>Physics</span>
              <span className="text-sky-400">Playground</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">Interactive Laboratory v1.0</p>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-500 font-mono">
              Main Hub
            </div>
            <nav className="space-y-1">
              <NavLink
                to="/"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Home className="w-4 h-4" />
                <span>Overview & Portal</span>
              </NavLink>
            </nav>
          </div>

          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-500 font-mono">
              Simulation Modules
            </div>
            <nav className="space-y-1.5">
              {SIMULATION_MODULES.map((mod) => {
                const Icon = mod.icon;
                return (
                  <NavLink
                    key={mod.id}
                    to={mod.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                        isActive
                          ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${mod.bgColor} ${mod.color}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{mod.name}</span>
                    </div>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Footer info card */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-medium mb-1">
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>Scientific Rigor</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Real-time Euler and Velocity Verlet numerical integrators with analytical validation.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
