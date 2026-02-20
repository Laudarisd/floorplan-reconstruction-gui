import React, { useState } from 'react';
import { useDwgFolderUpload } from '../../hooks/useDwgFolderUpload.jsx';
import '../../../image_mode/style/tasks/file-upload.css';

const DWG_UPLOAD_COPY = {
  title: 'Upload DWG Folder',
  folderLabel: 'Select Folder:',
  processLabel: 'Load DWG Folder',
  processingLabel: 'Reading folder...',
  hint: 'Folder must contain original_img (one image) and layers (multiple images).',
};

const DWG_UPLOAD_CLASSNAMES = {
  column: 'column',
  formGroup: 'form-group',
  btn: 'btn',
  statusMessage: 'status-message',
  imagePreview: 'image-preview',
};

const DwgFileUploadPanel = ({ onDwgDataReady }) => {
  const [folderFiles, setFolderFiles] = useState([]);
  const [originalPreview, setOriginalPreview] = useState(null);
  const [folderLabel, setFolderLabel] = useState('');
  const { isProcessing, status, parseFolderFiles } = useDwgFolderUpload();

  const handleFolderChange = (e) => {
    const files = Array.from(e.target.files || []);
    setFolderFiles(files);

    if (files.length > 0) {
      const rootFolder = (files[0].webkitRelativePath || files[0].name).split('/')[0] || 'DWG Folder';
      setFolderLabel(rootFolder);
    } else {
      setFolderLabel('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = await parseFolderFiles(folderFiles);
    if (!payload) return;

    setOriginalPreview(payload.originalImage.dataUrl);
    onDwgDataReady(payload);
  };

  return (
    <div className={DWG_UPLOAD_CLASSNAMES.column}>
      <h3>{DWG_UPLOAD_COPY.title}</h3>
      <form onSubmit={handleSubmit}>
        <div className={DWG_UPLOAD_CLASSNAMES.formGroup}>
          <label>{DWG_UPLOAD_COPY.folderLabel}</label>
          <input
            type="file"
            multiple
            webkitdirectory="true"
            directory="true"
            onChange={handleFolderChange}
            required
          />
          <small>{DWG_UPLOAD_COPY.hint}</small>
          {folderLabel && <div className="image-filename">{folderLabel}</div>}
        </div>

        <button type="submit" className={DWG_UPLOAD_CLASSNAMES.btn} disabled={isProcessing}>
          {isProcessing ? DWG_UPLOAD_COPY.processingLabel : DWG_UPLOAD_COPY.processLabel}
        </button>
      </form>

      {originalPreview && (
        <div className={DWG_UPLOAD_CLASSNAMES.imagePreview}>
          <img src={originalPreview} alt="DWG Original Preview" />
          <div className="image-filename">Original image preview</div>
        </div>
      )}

      {status.message && (
        <div className={`${DWG_UPLOAD_CLASSNAMES.statusMessage} ${status.type}`}>{status.message}</div>
      )}
    </div>
  );
};

export default DwgFileUploadPanel;
