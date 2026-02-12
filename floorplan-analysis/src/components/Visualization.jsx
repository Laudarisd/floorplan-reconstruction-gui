// Legacy file kept for reference (new Vite entry uses src/main.jsx)
import React, { useEffect, useCallback } from 'react';
import { useVisualization } from '../hooks/useVisualization';
import GifPlaceholder from './GifPlaceholder.jsx';
import '../style/common.css';

const Visualization = ({ zipData, selectedFile, uploadedImage, loading, setLoading }) => {
  const viz = useVisualization(uploadedImage);

  // Visualize JSON when file is selected
  useEffect(() => {
    if (!selectedFile || selectedFile.type !== 'json' || !uploadedImage) return;

    try {
      let jsonData;
      if (typeof selectedFile.content === 'string') {
        jsonData = JSON.parse(selectedFile.content);
      } else {
        jsonData = selectedFile.content;
      }

      // Visualize the JSON on the canvas
      viz.visualizeJson(selectedFile.fileName, jsonData);
      
      // Trigger redraw after a brief delay to ensure DOM and state are ready
      setTimeout(() => {
        viz.updateView();
      }, 100);
    } catch (error) {
      console.error('Error visualizing JSON:', error);
      setLoading(prev => ({ ...prev, visualization: false }));
    }
    // Only depend on selectedFile and uploadedImage changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, uploadedImage]);

  // Redraw when toggles change
  useEffect(() => {
    viz.redrawAnnotations();
    // redrawAnnotations is stable and depends on viz state already tracked below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viz.showAnnotationText, viz.showKeyPoints, viz.hiddenDimensionIndices]);

  // Update view when zoom or dimensions change
  useEffect(() => {
    viz.updateView();
    // updateView is stable and depends on viz state already tracked below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viz.zoom, viz.originalWidth, viz.originalHeight]);

  const handleClassToggle = useCallback((e) => {
    viz.redrawAnnotations();
  }, [viz]);

  const handleDimensionToggle = useCallback((e, idx) => {
    viz.toggleDimensionIndex(parseInt(idx));
  }, [viz]);

  const renderClassControls = () => {
    const classMap = viz.classMapRef.current;
    if (!classMap || Object.keys(classMap).length === 0) return null;

    const dimensionIndices = new Set();
    Object.values(classMap).forEach(objs => {
      objs.forEach(o => {
        if (o.kind === 'ocr_text' && o.cropIdx !== undefined) {
          dimensionIndices.add(o.cropIdx);
        }
      });
    });

    return (
      <div id="annotationControls" className="annotation-controls">
        {Object.keys(classMap)
          .sort()
          .map((cls) => (
            <label key={`class-${cls}`} style={{ marginRight: '15px', display: 'inline-block' }}>
              <input
                type="checkbox"
                defaultChecked
                id={`class-toggle-${cls.replace(/\s/g, '-').replace(/:/g, '-')}`}
                onChange={handleClassToggle}
              />
              {` ${cls} (${classMap[cls].length})`}
            </label>
          ))}

        {dimensionIndices.size > 0 && (
          <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>📍 Dimension Areas:</div>
            {Array.from(dimensionIndices)
              .sort((a, b) => a - b)
              .map((idx) => (
                <label
                  key={`dimension-${idx}`}
                  style={{ marginRight: '15px', display: 'inline-block' }}
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    id={`dimension-toggle-${idx}`}
                    onChange={(e) => handleDimensionToggle(e, idx)}
                  />
                  {` Dimension [${idx}]`}
                </label>
              ))}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (!uploadedImage) {
      return <p>Upload an image to see visualization</p>;
    }

    return (
      <div id="vizContent" className="gif-content">
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => viz.setShowAnnotationText(!viz.showAnnotationText)}
            className="btn"
            style={{ marginRight: '10px' }}
          >
            {viz.showAnnotationText ? '👁️ Hide' : '👁️ Show'} Annotation Text
          </button>
          <button
            onClick={() => viz.setShowKeyPoints(!viz.showKeyPoints)}
            className="btn"
            style={{ marginRight: '10px' }}
          >
            {viz.showKeyPoints ? '◯ Hide' : '◯ Show'} Key Points
          </button>
          <button onClick={viz.zoomIn} className="btn" style={{ marginRight: '10px' }}>
            🔍+ Zoom In
          </button>
          <button onClick={viz.zoomOut} className="btn" style={{ marginRight: '10px' }}>
            🔍- Zoom Out
          </button>
          <button onClick={viz.resetZoom} className="btn">
            ↺ Reset Zoom
          </button>
          <span style={{ marginLeft: '15px', fontWeight: 'bold' }}>
            Zoom: {viz.getZoomPercentage()}%
          </span>
        </div>

        {renderClassControls()}

        <div
          id="viewer"
          ref={viz.viewerRef}
          style={{
            display: 'block',
            maxHeight: '800px',
            overflow: 'auto',
            border: '1px solid #ccc',
            marginTop: '20px',
            position: 'relative',
            backgroundColor: '#f5f5f5',
          }}
        >
          <div id="zoomContainer" style={{ position: 'relative', display: 'inline-block' }}>
            <img
              id="mainImage"
              src={uploadedImage}
              alt="Floorplan"
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
              onLoad={() => viz.handleImageLoad()}
            />
            <canvas
              id="mainCanvas"
              ref={viz.canvasRef}
              style={{
                display: 'block',
                position: 'absolute',
                top: 0,
                left: 0,
                cursor: 'crosshair',
              }}
            />
          </div>
        </div>

        {/* Additional visualization items for extra images from ZIP */}
        <div className="viz-grid" style={{ marginTop: '30px' }}>
          {[1, 2, 3, 4, 5].map((idx) => (
            <div
              key={`viz${idx}`}
              id={`viz${idx}`}
              className="viz-item"
              style={{ display: 'none', marginTop: '20px' }}
            >
              <label id={`vizLabel${idx}`} style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
                Image {idx}
              </label>
              <img
                id={`vizImg${idx}`}
                src=""
                alt={`Visualization ${idx}`}
                style={{ maxWidth: '100%', border: '1px solid #ddd' }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="visualization-section" id="visualizationSection" style={{ display: 'block' }}>
      {loading ? (
        <div id="vizGif" className="gif-placeholder">
          <GifPlaceholder
            gifSrc="/assets/Loader cat.gif"
            caption="Preparing visualization..."
          />
        </div>
      ) : (
        renderContent()
      )}
    </div>
  );
};

export default Visualization;
