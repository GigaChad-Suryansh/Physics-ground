import React, { useState } from 'react';
import { Menu, X, Sparkles, HelpCircle } from 'lucide-react';
import { Sidebar } from './Sidebar';

interface LabLayoutProps {
  children: React.ReactNode;
  title?: string;
  category?: string;
}

export const LabLayout: React.FC<LabLayoutProps> = ({
  children,
  title = 'Physics Laboratory',
  category = 'Simulation Module',
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content wrapper shifted on desktop */}
      <div className="lg:pl-72 flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              aria-label="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                {category}
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-100">{title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Engine Active (120 Hz)</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
