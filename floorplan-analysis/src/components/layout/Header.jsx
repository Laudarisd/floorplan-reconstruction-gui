// Codex Note: components/layout/Header.jsx - Main logic for this module/task.
import React from 'react';
import '../../style/tasks/header.css';

const HEADER_COPY = {
  title: 'Floorplan Reconstruction',
  backgroundImage: 'linear-gradient(rgba(139, 165, 114, 0.85), rgba(107, 122, 90, 0.85)), url(/img/1.png)',
};

const Header = () => {
  // Hero banner at top of the page
  return (
    <div className="header-section" style={{ backgroundImage: HEADER_COPY.backgroundImage }}>
      <h1>{HEADER_COPY.title}</h1>
    </div>
  );
};

export default Header;
