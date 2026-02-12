import React from 'react';
import GifPlaceholder from '../shared/GifPlaceholder';
import '../../style/tasks/json-preview.css';

const JSON_COPY = {
  title: '🔍 Data Check',
  placeholder: 'Select a file from ZIP Contents to view',
  analyzingCaption: 'Analyzing data structure...',
};

const JSON_CLASSNAMES = {
  column: 'column',
  placeholder: 'data-placeholder',
  previewContainer: 'data-preview',
};

const JsonPreviewPanel = ({ selectedFile, loading }) => {
  // Render JSON/image/text preview for selected ZIP entry
  const renderContent = () => {
    if (!selectedFile) {
      return <p className={JSON_CLASSNAMES.placeholder}>{JSON_COPY.placeholder}</p>;
    }

    if (selectedFile.type === 'json') {
      const objCount =
        selectedFile.content?.data?.objects?.length || selectedFile.content?.objects?.length || 0;

      return (
        <>
          <h4 className="data-title">{selectedFile.fileName}</h4>
          <p className="data-meta">
            <strong>Objects:</strong> {objCount}
          </p>
          <pre className="data-json">{JSON.stringify(selectedFile.content, null, 2)}</pre>
        </>
      );
    }

    if (selectedFile.type === 'image') {
      return (
        <>
          <h4 className="data-title">{selectedFile.fileName}</h4>
          <img className="data-image" src={selectedFile.url} alt={selectedFile.fileName} />
        </>
      );
    }

    return (
      <>
        <h4 className="data-title">{selectedFile.fileName}</h4>
        <pre className="data-json">{selectedFile.content}</pre>
      </>
    );
  };

  return (
    <div className={JSON_CLASSNAMES.column}>
      <h3>{JSON_COPY.title}</h3>
      {loading ? (
        <div id="dataCheckGif" className="gif-placeholder">
          <GifPlaceholder gifSrc="/assets/Live chatbot.gif" caption={JSON_COPY.analyzingCaption} />
        </div>
      ) : (
        <div id="dataCheckBody" className={JSON_CLASSNAMES.previewContainer}>
          <div id="dataCheckContent">{renderContent()}</div>
        </div>
      )}
    </div>
  );
};

export default JsonPreviewPanel;
