Site is live at - https://gigachad-suryansh.github.io/Physics-ground/

# Physics Playground — Interactive Physics Lab

An interactive digital physics laboratory built for real-time scientific experimentation, conceptual intuition, and rigorous numerical modeling.

## 🌟 Highlights

- **Pure In-Browser Numerical Engine**: Decoupled 120 Hz fixed-step simulation engine (`SimulationEngine.ts`) with step-forward, time scaling (0.5x – 5x), pause/play, and state restoration.
- **Scientific Rigor**: Implements Velocity Verlet symplectic integration for orbital bodies and Euler-Cromer for kinematics, validated against analytical solutions.
- **Live Scientific Telemetry**: Real-time plotting using Recharts with multi-series kinematic traces, energy conservation graphs, and **CSV export**.
- **Formatted KaTeX Notation**: Clear, formatted mathematical equations on every module alongside live benchmarks.
- **Sleek Cyber-Lab Aesthetic**: Deep navy/charcoal theme (`#030712`), subtle coordinate grids, electric-blue/violet accents, accessible controls, and vector overlays.

---

## 🔬 Simulation Modules

### 1. Projectile Motion (`/sim/projectile`)
- **Physics**: 2D kinematics with initial launch angle, velocity, elevation, and optional quadratic air resistance drag ($F_d = -k v^2$).
- **Features**: Simultaneous comparison between ideal analytical path (dashed cyan) and simulated trajectory (glowing magenta), live resultant and component velocity vectors ($v_x, v_y$), telemetry curves ($y$ vs $x$, speed vs $t$).

### 2. Newton's Laws & Friction (`/sim/forces`)
- **Physics**: $F_{\text{net}} = m a$ dynamic simulation. Distinguishes static friction ($\mu_s N$) from kinetic friction ($\mu_k N$).
- **Features**: Live interactive free-body diagram with labeled vector arrows (Applied, Friction, Normal, Gravity/Weight), displacement and acceleration tracking.

### 3. Gravity & Orbital Mechanics (`/sim/orbital`)
- **Physics**: Two-body gravitational dynamics integrated with **Symplectic Velocity Verlet** ($F = G \frac{M m}{r^2}$).
- **Features**: Real-time energy conservation tracking ($E = K + U = \text{const}$), angular momentum conservation ($L$), animated celestial trails, collision detection, and circular orbit speed presets ($v = \sqrt{GM/r}$).

### 4. Electric Circuits Lab (`/sim/circuits`)
- **Physics**: Solves series, parallel, and series-parallel DC networks using Ohm's Law ($V = IR$) and Kirchhoff's Laws.
- **Features**: Dynamic calculation of equivalent resistance ($R_{\text{eq}}$), branch currents, component voltage drops ($\Delta V$), dissipated power ($P = I^2 R$), and interactive switches.

### 5. Waves & Oscillations (`/sim/waves`)
- **Physics**: Transverse traveling waves ($y = A \sin(kx - \omega t)$), standing waves ($y = 2A \sin(kx)\cos(\omega t)$), and simple harmonic motion (SHM) spring-mass system with harmonic energy exchange.
- **Features**: Particle displacement markers, spring coil rendering, period ($T$), wave speed ($v = f\lambda$), and angular frequency calculations.

### 6. Geometric Optics Lab (`/sim/optics`)
- **Physics**: Thin lens and mirror equations ($\frac{1}{f} = \frac{1}{v} - \frac{1}{u}$) with standard Cartesian and Real-Is-Positive conventions.
- **Features**: Interactive principal ray tracing (parallel, central, and focal rays), focal points ($F, 2F$), magnification ($m = v/u$), real vs. virtual image distinctions, and erect vs. inverted orientations.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4
- **Math & Plots**: KaTeX, Recharts, Lucide Icons
- **Simulation**: Custom HTML5 Canvas renderer + `SimulationEngine`
- **Testing**: Vitest (`8/8 physics calculation tests passing`)

---

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Run Tests
```bash
npm run test
```
