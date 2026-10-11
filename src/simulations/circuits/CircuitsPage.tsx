import React, { useState } from 'react';
import { LabLayout } from '../../components/layout/LabLayout';
import { MathFormula } from '../../components/ui/MathFormula';
import {
  CircuitConfig,
  DEFAULT_SERIES_CIRCUIT,
  DEFAULT_PARALLEL_CIRCUIT,
  DEFAULT_SERIES_PARALLEL_CIRCUIT,
  analyzeCircuit,
} from '../../physics/electricity/circuits';
import { Sliders, Cpu, Zap, ToggleLeft, ToggleRight, Info } from 'lucide-react';

export const CircuitsPage: React.FC = () => {
  const [config, setConfig] = useState<CircuitConfig>(DEFAULT_SERIES_CIRCUIT);

  // Compute live electrical solution using Ohm's & Kirchhoff's laws
  const analysis = analyzeCircuit(config);

  const handleTopologyChange = (top: 'series' | 'parallel' | 'series-parallel') => {
    if (top === 'series') setConfig(DEFAULT_SERIES_CIRCUIT);
    else if (top === 'parallel') setConfig(DEFAULT_PARALLEL_CIRCUIT);
    else setConfig(DEFAULT_SERIES_PARALLEL_CIRCUIT);
  };

  const handleVoltageChange = (voltage: number) => {
    setConfig((prev) => ({
      ...prev,
      battery: { ...prev.battery, voltage },
    }));
  };

  const handleResistorChange = (id: string, resistance: number) => {
    setConfig((prev) => ({
      ...prev,
      resistors: prev.resistors.map((r) => (r.id === id ? { ...r, resistance } : r)),
    }));
  };

  const toggleSwitch = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      switches: prev.switches.map((s) => (s.id === id ? { ...s, closed: !s.closed } : s)),
    }));
  };

  return (
    <LabLayout title="Electric Circuits Laboratory" category="Electromagnetism">
      <div className="space-y-6">
        {/* Top Preset Buttons */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
          <span className="text-xs font-mono uppercase text-slate-500 font-semibold pl-2">
            Topology Preset:
          </span>
          {(['series', 'parallel', 'series-parallel'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTopologyChange(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                config.topology === t
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t.replace('-', ' & ')}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => toggleSwitch(config.switches[0].id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all text-slate-200"
            >
              {config.switches[0].closed ? (
                <ToggleRight className="w-4 h-4 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-rose-400" />
              )}
              <span>Switch {config.switches[0].closed ? 'Closed (ON)' : 'Open (OFF)'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Schematic Diagram & Live Visualizer */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Interactive Circuit Schematic ({config.topology.toUpperCase()})
                  </h3>
                </div>
                <span className="text-xs font-mono text-emerald-400">
                  {analysis.isCircuitComplete ? 'Current Flow Active' : 'Open Circuit'}
                </span>
              </div>

              {/* Schematic Canvas Representation */}
              <div className="h-64 rounded-xl bg-slate-950 border border-slate-800/80 p-4 relative flex flex-col justify-between overflow-hidden">
                {/* Visual circuit components wire layout */}
                <div className="flex items-center justify-between border-b-2 border-amber-500/40 pb-6 px-8 relative">
                  {/* Battery */}
                  <div className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 glow-amber">
                    <span className="text-[10px] font-mono text-slate-400">DC Source</span>
                    <span className="text-sm font-bold font-mono text-amber-400">
                      {config.battery.voltage} V
                    </span>
                  </div>

                  {/* Electron current animated arrow indicator */}
                  {analysis.isCircuitComplete && analysis.totalCurrent > 0 && (
                    <div className="flex items-center gap-1 text-xs font-mono text-sky-400 animate-pulse">
                      <span>I = {analysis.totalCurrent.toFixed(3)} A →</span>
                    </div>
                  )}

                  {/* Switch */}
                  <div
                    onClick={() => toggleSwitch(config.switches[0].id)}
                    className="cursor-pointer p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] font-mono text-slate-400">Switch S1</span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        config.switches[0].closed ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {config.switches[0].closed ? '[ CLOSED ]' : '[ OPEN ]'}
                    </span>
                  </div>
                </div>

                {/* Resistor Component Cards */}
                <div className="flex items-center justify-around gap-3 pt-4 px-2">
                  {analysis.resistors.map((r) => (
                    <div
                      key={r.id}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col items-center gap-1.5 shadow-md relative group hover:border-slate-700 transition-all"
                    >
                      <div className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>{r.id}</span>
                      </div>
                      <div className="text-xs font-mono font-bold text-sky-400">{r.resistance} Ω</div>
                      <div className="w-full border-t border-slate-800/80 pt-2 space-y-0.5 text-[10px] font-mono text-slate-400">
                        <div className="flex justify-between">
                          <span>ΔV:</span>
                          <span className="text-slate-200">{r.voltageDrop.toFixed(2)} V</span>
                        </div>
                        <div className="flex justify-between">
                          <span>I:</span>
                          <span className="text-emerald-400">{r.current.toFixed(3)} A</span>
                        </div>
                        <div className="flex justify-between">
                          <span>P:</span>
                          <span className="text-purple-400">{r.power.toFixed(2)} W</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-500">
                    Equivalent Resistance (R_eq)
                  </span>
                  <div className="text-lg font-mono font-bold text-sky-400 mt-0.5">
                    {isFinite(analysis.totalResistance) ? `${analysis.totalResistance.toFixed(2)} Ω` : '∞ (Open)'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-500">
                    Total Circuit Current (I)
                  </span>
                  <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5">
                    {analysis.totalCurrent.toFixed(3)} A
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-500">
                    Total Dissipated Power (P)
                  </span>
                  <div className="text-lg font-mono font-bold text-amber-400 mt-0.5">
                    {analysis.totalPower.toFixed(2)} W
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls & Math Panel */}
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Component Values
                </h3>
              </div>

              {/* DC Battery Voltage */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Battery Voltage (V)</span>
                  <span className="font-mono text-amber-400 font-semibold">{config.battery.voltage} V</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="48"
                  step="1"
                  value={config.battery.voltage}
                  onChange={(e) => handleVoltageChange(Number(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Resistors Sliders */}
              {config.resistors.map((r) => (
                <div key={r.id} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">{r.id} Resistance</span>
                    <span className="font-mono text-sky-400 font-semibold">{r.resistance} Ω</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={r.resistance}
                    onChange={(e) => handleResistorChange(r.id, Number(e.target.value))}
                    className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              ))}
            </div>

            {/* Circuit Formulas */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Info className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Circuit Laws
                </h3>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="V = I R \quad (\text{Ohm's Law})" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="R_{\text{series}} = R_1 + R_2 + R_3" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="\frac{1}{R_{\text{parallel}}} = \frac{1}{R_1} + \frac{1}{R_2} + \frac{1}{R_3}" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="P = V I = I^2 R = \frac{V^2}{R}" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};
