// Legacy file kept for reference (new Vite entry uses src/main.jsx)
import React, { useEffect, useState } from 'react';
import GifPlaceholder from './GifPlaceholder.jsx';
import { useZipExtraction } from '../hooks/useZipExtraction';

const DataContent = ({ zipBlob, loading, setLoading, onFileSelected, setZipData }) => {
  const [files, setFiles] = useState([]);
  const [scaleInfo, setScaleInfo] = useState(null);
  const [zip, setZip] = useState(null);
  const { extract } = useZipExtraction();

  useEffect(() => {
    if (zipBlob) {
      extractZip();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipBlob]);

  const extractZip = async () => {
    try {
      const result = await extract(zipBlob);
      setFiles(result.files);
      setScaleInfo(result.scaleInfo);
      setZip(result.zip);
      setZipData(result);
      
      // Hide GIF, show content
      setLoading(prev => ({ ...prev, dataContent: false, visualization: false }));
    } catch (error) {
      console.error('Error extracting ZIP:', error);
    }
  };

  const handleFileClick = async (fileName) => {
    if (!zip) return;
    
    try {
      let fileData = { fileName };
      
      if (fileName.endsWith('.json')) {
        const content = await zip.files[fileName].async('string');
        fileData.type = 'json';
        fileData.content = JSON.parse(content);
      } else if (fileName.match(/\.(png|jpg|jpeg)$/)) {
        const blob = await zip.files[fileName].async('blob');
        fileData.type = 'image';
        fileData.url = URL.createObjectURL(blob);
      } else {
        const content = await zip.files[fileName].async('string');
        fileData.type = 'text';
        fileData.content = content;
      }
      
      onFileSelected(fileData);
      
      // Hide Data Check GIF
      setLoading(prev => ({ ...prev, dataCheck: false }));
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  const getFileIcon = (fileName) => {
    if (fileName.endsWith('.json')) return '📄';
    if (fileName.match(/\.(png|jpg|jpeg)$/)) return '🖼️';
    return '📎';
  };

  const sortFiles = (fileList) => {
    // Define priority order for JSON files
    const jsonPriority = {
      'crop': 0,
      'segment': 1,
      'wall_oob': 2,
      'normal_oob': 3,
      'symbol_ocr': 4,
      'dim_ocr': 5,
      'space_ocr': 6,
    };

    return fileList.sort((a, b) => {
      // Get priority (use 999 for files not in priority list)
      const getPriority = (fileName) => {
        const lower = fileName.toLowerCase();
        for (const [key, priority] of Object.entries(jsonPriority)) {
          if (lower.includes(key)) return priority;
        }
        return 999;
      };

      const priorityA = getPriority(a);
      const priorityB = getPriority(b);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      // If same priority, sort alphabetically
      return a.localeCompare(b);
    });
  };

  return (
    <div className="column">
      <h3>📦 ZIP Contents</h3>
      {loading ? (
        <div id="dataContentGif" className="gif-placeholder">
          <GifPlaceholder 
            gifSrc="/assets/man and robot working.gif"
            caption="Processing your floorplan data..."
          />
        </div>
      ) : (
        <div id="dataContentBody" className="gif-content">
          {scaleInfo && (
            <div id="scaleInfo" className="scale-info" style={{ display: 'block', marginBottom: '15px' }}>
              <strong>📐 Scale Info:</strong><br />
              Original: {scaleInfo.originalWidth}×{scaleInfo.originalHeight}px<br />
              Crop: {scaleInfo.cropWidth}×{scaleInfo.cropHeight}px<br />
              Offset: ({scaleInfo.cropXMin}, {scaleInfo.cropYMin})px
            </div>
          )}
          
          <div id="fileList" className="file-list" style={{ marginTop: '15px' }}>
            {files.length === 0 ? (
              <p>No files found in ZIP</p>
            ) : (
              <>
                <p style={{ marginBottom: '10px', fontWeight: '500', color: '#6B7A5A' }}>
                  {files.length} file{files.length !== 1 ? 's' : ''} found
                </p>
                {sortFiles(files).map((fileName, index) => (
                <div
                  key={index}
                  className="file-item"
                  onClick={() => handleFileClick(fileName)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="file-icon">{getFileIcon(fileName)}</span>
                  <span style={{ flex: 1 }}>{fileName}</span>
                </div>
              ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataContent;
