import React from 'react';
import '../../style/tasks/json-parsing.css';

const JSON_PARSING_COPY = {
  title: '📄 JSON Parsing',
  placeholder: 'Select a JSON file to parse and inspect data points.',
};

const JSON_PARSING_CLASSNAMES = {
  column: 'column',
  info: 'json-info',
  stats: 'json-stats',
};

const JsonParsingPanel = ({ selectedFile }) => {
  const isJson = selectedFile && selectedFile.type === 'json';
  const objects = isJson
    ? selectedFile.content?.data?.objects || selectedFile.content?.objects || []
    : [];

  return (
    <div className={JSON_PARSING_CLASSNAMES.column}>
      <h3>{JSON_PARSING_COPY.title}</h3>
      {!isJson ? (
        <p className={JSON_PARSING_CLASSNAMES.info}>{JSON_PARSING_COPY.placeholder}</p>
      ) : (
        <div className={JSON_PARSING_CLASSNAMES.stats}>
          <p>
            <strong>File:</strong> {selectedFile.fileName}
          </p>
          <p>
            <strong>Objects:</strong> {objects.length}
          </p>
          <p>
            <strong>Keys:</strong> {Object.keys(selectedFile.content || {}).join(', ') || 'None'}
          </p>
        </div>
      )}
    </div>
  );
};

export default JsonParsingPanel;
