// Legacy file kept for reference (new Vite entry uses src/main.jsx)
import React from 'react';
import GifPlaceholder from './GifPlaceholder.jsx';

const DataCheck = ({ selectedFile, zipData, loading, setLoading, uploadedImage }) => {

  const renderContent = () => {
    if (!selectedFile) {
      return <p className="data-placeholder">Select a file from ZIP Contents to view</p>;
    }

    if (selectedFile.type === 'json') {
      const objCount = selectedFile.content?.data?.objects?.length || 
                      selectedFile.content?.objects?.length || 0;
      
      return (
        <>
          <h4 style={{ color: '#6B7A5A', marginBottom: '10px' }}>{selectedFile.fileName}</h4>
          <p style={{ marginBottom: '10px' }}><strong>Objects:</strong> {objCount}</p>
          <pre style={{ 
            background: '#f8f9fa', 
            padding: '15px', 
            borderRadius: '6px', 
            height: '500px', 
            overflow: 'auto', 
            fontSize: '11px', 
            border: '1px solid #e9ecef' 
          }}>
            {JSON.stringify(selectedFile.content, null, 2)}
          </pre>
        </>
      );
    } else if (selectedFile.type === 'image') {
      return (
        <>
          <h4 style={{ color: '#6B7A5A', marginBottom: '10px' }}>{selectedFile.fileName}</h4>
          <img 
            src={selectedFile.url} 
            alt={selectedFile.fileName}
            style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain', borderRadius: '6px' }} 
          />
        </>
      );
    } else {
      return (
        <>
          <h4 style={{ color: '#6B7A5A', marginBottom: '10px' }}>{selectedFile.fileName}</h4>
          <pre style={{ 
            background: '#f8f9fa', 
            padding: '15px', 
            borderRadius: '6px', 
            height: '500px', 
            overflow: 'auto', 
            fontSize: '11px', 
            border: '1px solid #e9ecef' 
          }}>
            {selectedFile.content}
          </pre>
        </>
      );
    }
  };

  return (
    <div className="column">
      <h3>🔍 Data Check</h3>
      {loading ? (
        <div id="dataCheckGif" className="gif-placeholder">
          <GifPlaceholder 
            gifSrc="/assets/Live chatbot.gif"
            caption="Analyzing data structure..."
          />
        </div>
      ) : (
        <div id="dataCheckBody" className="gif-content" style={{ height: '550px', overflow: 'auto' }}>
          <div id="dataCheckContent" style={{ display: 'block' }}>
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataCheck;
