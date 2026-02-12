// Legacy file kept for reference (new Vite entry uses src/main.jsx)
import React from 'react';

const GifPlaceholder = ({ gifSrc, caption }) => {
  return (
    <div className="gif-placeholder">
      <div className="gif-wrapper">
        <img src={gifSrc} alt={caption} />
        <p className="gif-caption">{caption}</p>
      </div>
    </div>
  );
};

export default GifPlaceholder;
