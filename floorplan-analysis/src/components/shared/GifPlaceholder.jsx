import React from 'react';
import '../../style/tasks/gif-placeholder.css';

const GIF_PLACEHOLDER_CLASSES = {
  wrapper: 'gif-placeholder',
  image: 'gif-image',
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
