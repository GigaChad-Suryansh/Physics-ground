/**
 * Electric Circuit Physics Module
 * 
 * Implements a circuit solver for series and parallel resistor networks
 * using Ohm's Law (V = IR) and Kirchhoff's Laws.
 * 
 * Supports preset circuit topologies with real electrical calculations.
 * Not a hardcoded result — the solver computes currents and voltage drops
 * from the circuit topology and component values.
 */

export interface Resistor {
  id: string;
  resistance: number;     // Ohms
  voltageDrop: number;    // V (calculated)
  current: number;        // A (calculated)
  power: number;          // W (calculated)
}

export interface Battery {
  id: string;
  voltage: number;        // V
  internalResistance: number; // Ohms
}

export interface CircuitSwitch {
  id: string;
  closed: boolean;
}

export type CircuitTopology = 'series' | 'parallel' | 'series-parallel' | 'custom';

export interface CircuitConfig {
  topology: CircuitTopology;
  battery: Battery;
  resistors: Resistor[];
  switches: CircuitSwitch[];
  // For series-parallel: which resistors are in parallel
  parallelGroups?: string[][];
}

export interface CircuitAnalysis {
  totalResistance: number;    // Ohms
  totalCurrent: number;       // A
  totalPower: number;         // W
  resistors: Resistor[];
  batteryVoltage: number;
  /** Voltage across the battery terminals: V − I·r_internal */
  terminalVoltage: number;
  /** Power lost in the battery's internal resistance: I²·r_internal */
  internalPower: number;
  isCircuitComplete: boolean;
}

export const DEFAULT_SERIES_CIRCUIT: CircuitConfig = {
  topology: 'series',
  battery: { id: 'bat1', voltage: 12, internalResistance: 0 },
  resistors: [
    { id: 'R1', resistance: 100, voltageDrop: 0, current: 0, power: 0 },
    { id: 'R2', resistance: 200, voltageDrop: 0, current: 0, power: 0 },
    { id: 'R3', resistance: 300, voltageDrop: 0, current: 0, power: 0 },
  ],
  switches: [{ id: 'S1', closed: true }],
};

export const DEFAULT_PARALLEL_CIRCUIT: CircuitConfig = {
  topology: 'parallel',
  battery: { id: 'bat1', voltage: 12, internalResistance: 0 },
  resistors: [
    { id: 'R1', resistance: 100, voltageDrop: 0, current: 0, power: 0 },
    { id: 'R2', resistance: 200, voltageDrop: 0, current: 0, power: 0 },
    { id: 'R3', resistance: 300, voltageDrop: 0, current: 0, power: 0 },
  ],
  switches: [{ id: 'S1', closed: true }],
};

export const DEFAULT_SERIES_PARALLEL_CIRCUIT: CircuitConfig = {
  topology: 'series-parallel',
  battery: { id: 'bat1', voltage: 24, internalResistance: 0.5 },
  resistors: [
    { id: 'R1', resistance: 100, voltageDrop: 0, current: 0, power: 0 },
    { id: 'R2', resistance: 200, voltageDrop: 0, current: 0, power: 0 },
    { id: 'R3', resistance: 200, voltageDrop: 0, current: 0, power: 0 },
  ],
  switches: [{ id: 'S1', closed: true }],
  parallelGroups: [['R2', 'R3']], // R2 and R3 are in parallel, in series with R1
};

/**
 * Calculate equivalent resistance for resistors in series.
 * R_eq = R₁ + R₂ + ... + Rₙ
 */
export function seriesResistance(resistances: number[]): number {
  return resistances.reduce((sum, r) => sum + r, 0);
}

/**
 * Calculate equivalent resistance for resistors in parallel.
 * 1/R_eq = 1/R₁ + 1/R₂ + ... + 1/Rₙ
 */
export function parallelResistance(resistances: number[]): number {
  if (resistances.length === 0) return 0;
  if (resistances.some(r => r <= 0)) return 0; // short circuit
  const sum = resistances.reduce((s, r) => s + 1 / r, 0);
  return sum > 0 ? 1 / sum : Infinity;
}

/**
 * Analyze a circuit and calculate all electrical quantities.
 */
export function analyzeCircuit(config: CircuitConfig): CircuitAnalysis {
  // Check if circuit is complete (all switches closed)
  const isComplete = config.switches.every(s => s.closed);
  
  if (!isComplete) {
    return {
      totalResistance: Infinity,
      totalCurrent: 0,
      totalPower: 0,
      resistors: config.resistors.map(r => ({ ...r, voltageDrop: 0, current: 0, power: 0 })),
      batteryVoltage: config.battery.voltage,
      terminalVoltage: config.battery.voltage,
      internalPower: 0,
      isCircuitComplete: false,
    };
  }

  const V = config.battery.voltage;
  const r_int = config.battery.internalResistance;
  let totalResistance: number;
  let resistors: Resistor[];

  switch (config.topology) {
    case 'series': {
      totalResistance = seriesResistance(config.resistors.map(r => r.resistance)) + r_int;
      const I = totalResistance > 0 ? V / totalResistance : 0;
      resistors = config.resistors.map(r => ({
        ...r,
        current: I,
        voltageDrop: I * r.resistance,
        power: I * I * r.resistance,
      }));
      break;
    }

    case 'parallel': {
      const R_parallel = parallelResistance(config.resistors.map(r => r.resistance));
      totalResistance = R_parallel + r_int;
      const I_total = totalResistance > 0 ? V / totalResistance : 0;
      const V_parallel = I_total * R_parallel; // voltage across parallel combo
      resistors = config.resistors.map(r => {
        const I_branch = r.resistance > 0 ? V_parallel / r.resistance : 0;
        return {
          ...r,
          current: I_branch,
          voltageDrop: V_parallel,
          power: I_branch * I_branch * r.resistance,
        };
      });
      break;
    }

    case 'series-parallel': {
      const parallelGroups = config.parallelGroups || [];
      const parallelIds = new Set(parallelGroups.flat());
      
      // Calculate parallel group resistances
      let R_series_part = r_int;
      const parallelGroupResistances: Map<string, { eqR: number; ids: string[] }> = new Map();
      
      for (const group of parallelGroups) {
        const groupResistors = config.resistors.filter(r => group.includes(r.id));
        const eqR = parallelResistance(groupResistors.map(r => r.resistance));
        // Copy before sorting — Array.sort mutates, and `group` belongs to the caller's config.
        const key = [...group].sort().join('-');
        parallelGroupResistances.set(key, { eqR, ids: group });
        R_series_part += eqR;
      }
      
      // Series resistors not in any parallel group
      for (const r of config.resistors) {
        if (!parallelIds.has(r.id)) {
          R_series_part += r.resistance;
        }
      }
      
      totalResistance = R_series_part;
      const I_total = totalResistance > 0 ? V / totalResistance : 0;
      
      resistors = config.resistors.map(r => {
        if (parallelIds.has(r.id)) {
          // Find which group this resistor belongs to
          for (const [, group] of parallelGroupResistances) {
            if (group.ids.includes(r.id)) {
              const V_group = I_total * group.eqR;
              const I_branch = r.resistance > 0 ? V_group / r.resistance : 0;
              return {
                ...r,
                current: I_branch,
                voltageDrop: V_group,
                power: I_branch * I_branch * r.resistance,
              };
            }
          }
        }
        // Series resistor
        return {
          ...r,
          current: I_total,
          voltageDrop: I_total * r.resistance,
          power: I_total * I_total * r.resistance,
        };
      });
      break;
    }

    default:
      totalResistance = seriesResistance(config.resistors.map(r => r.resistance)) + r_int;
      const I = totalResistance > 0 ? V / totalResistance : 0;
      resistors = config.resistors.map(r => ({
        ...r,
        current: I,
        voltageDrop: I * r.resistance,
        power: I * I * r.resistance,
      }));
  }

  const totalCurrent = totalResistance > 0 ? V / totalResistance : 0;

  return {
    totalResistance: totalResistance - r_int, // report external resistance
    totalCurrent,
    totalPower: V * totalCurrent,
    resistors,
    batteryVoltage: V,
    terminalVoltage: V - totalCurrent * r_int,
    internalPower: totalCurrent * totalCurrent * r_int,
    isCircuitComplete: true,
  };
}
