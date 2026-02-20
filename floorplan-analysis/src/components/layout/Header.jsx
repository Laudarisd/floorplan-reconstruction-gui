// Codex Note: components/layout/Header.jsx - Main logic for this module/task.
import React from 'react';
import '../../style/tasks/header.css';

const HEADER_COPY = {
  title: 'Floorplan Reconstruction',
};

const Header = () => {
  // Ordered list of hero images used by the sliding banner.
  const bannerImages = ['/img/1.png', '/img/2.PNG', '/img/3.PNG', '/img/4.PNG'];
  // Duplicate once so CSS can translate half the track and loop seamlessly.
  const loopedImages = [...bannerImages, ...bannerImages];

  // Hero banner at top of the page
  return (
    <div className="header-section">
      <div
        className="header-slider"
        // Track width is proportional to the number of panels rendered.
        style={{ width: `${loopedImages.length * 100}%` }}
      >
        {loopedImages.map((imagePath, idx) => (
          <div
            key={`${imagePath}-${idx}`}
            className="header-slide"
            style={{
              backgroundImage:
                `linear-gradient(rgba(139, 165, 114, 0.85), rgba(107, 122, 90, 0.85)), url(${imagePath})`,
            }}
          />
        ))}
      </div>
      <h1>{HEADER_COPY.title}</h1>
    </div>
  );
};

export default Header;
