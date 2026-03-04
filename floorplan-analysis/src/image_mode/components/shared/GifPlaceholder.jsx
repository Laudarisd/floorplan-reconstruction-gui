// Codex Note: components/shared/GifPlaceholder.jsx - Main logic for this module/task.
import React from 'react';
import '../../style/tasks/gif-placeholder.css';

const GIF_PLACEHOLDER_CLASSES = {
  // Base wrapper class for all gif placeholder usages.
  wrapper: 'gif-placeholder',
  // Gif image class (can be overridden by parent-specific CSS selectors).
  image: 'gif-image',
  // Optional caption text class shown under gif.
  caption: 'gif-caption',
};

const GifPlaceholder = ({ gifSrc, caption }) => {
  // Generic loading placeholder used across panels
  return (
    <div className={GIF_PLACEHOLDER_CLASSES.wrapper}>
      <img className={GIF_PLACEHOLDER_CLASSES.image} src={gifSrc} alt={caption || 'Loading'} />
      {caption && <div className={GIF_PLACEHOLDER_CLASSES.caption}>{caption}</div>}
    </div>
  );
};

export default GifPlaceholder;
