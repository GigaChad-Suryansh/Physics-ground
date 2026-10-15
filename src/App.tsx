import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { ProjectileMotionPage } from './simulations/projectile/ProjectileMotionPage';
import { PositionDisplacementPage } from './simulations/position-displacement/PositionDisplacementPage';
import { DistanceDisplacementPage } from './simulations/distance-versus-displacement/DistanceDisplacementPage';
import { SpeedVelocityPage } from './simulations/speed-velocity/SpeedVelocityPage';
import { ForcesPage } from './simulations/forces/ForcesPage';
import { OrbitalPage } from './simulations/orbital/OrbitalPage';
import { WavesPage } from './simulations/waves/WavesPage';
import { CircuitsPage } from './simulations/circuits/CircuitsPage';
import { OpticsPage } from './simulations/optics/OpticsPage';

export const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sim/position-displacement" element={<PositionDisplacementPage />} />
        <Route path="/sim/distance-versus-displacement" element={<DistanceDisplacementPage />} />
        <Route path="/sim/speed-and-velocity" element={<SpeedVelocityPage />} />
        <Route path="/sim/projectile" element={<ProjectileMotionPage />} />
        <Route path="/sim/forces" element={<ForcesPage />} />
        <Route path="/sim/orbital" element={<OrbitalPage />} />
        <Route path="/sim/waves" element={<WavesPage />} />
        <Route path="/sim/circuits" element={<CircuitsPage />} />
        <Route path="/sim/optics" element={<OpticsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
