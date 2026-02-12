// Legacy file kept for reference (new Vite entry uses src/main.jsx)
import React, { useState } from 'react';
import { useFileUpload } from '../hooks/useFileUpload';

const UploadForm = ({ serverConfig, onZipReceived, setLoading, onFileSelected }) => {
  const [formData, setFormData] = useState({
    userId: '',
    projectNumber: '',
    floorNumber: ''
  });
  
  const [selectedFile, setSelectedFile] = useState(null);
  const { progress, status, isUploading, previewImage, handleImageSelect, upload } = useFileUpload();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      handleImageSelect(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate server config is not default
    if (serverConfig.ip === '127.0.0.1' || serverConfig.ip === 'localhost') {
      alert('⚠️ Please set the correct server IP address in Settings.\n127.0.0.1 is only a placeholder example.');
      return;
    }
    
    // Reset loading states
    setLoading({
      dataContent: true,
      dataCheck: true,
      visualization: true
    });

    const zipBlob = await upload(selectedFile, formData, serverConfig);
    
    if (zipBlob) {
      onZipReceived(zipBlob, previewImage);
    }
  };

  return (
    <div className="column">
      <h3>📤 Upload Floorplan</h3>
      <form onSubmit={handleSubmit} id="uploadForm">
        <div className="form-group">
          <label>User ID:</label>
          <input
            type="text"
            value={formData.userId}
            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
            required
            placeholder="e.g., sd_test"
          />
        </div>

        <div className="form-group">
          <label>Project Number:</label>
          <input
            type="text"
            value={formData.projectNumber}
            onChange={(e) => setFormData({ ...formData, projectNumber: e.target.value })}
            required
            placeholder="e.g., PRJ-1"
          />
        </div>

        <div className="form-group">
          <label>Floor Number:</label>
          <input
            type="text"
            value={formData.floorNumber}
            onChange={(e) => setFormData({ ...formData, floorNumber: e.target.value })}
            required
            placeholder="e.g., floor_1"
          />
        </div>

        <div className="form-group">
          <label>Select Image:</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            required
          />
          {previewImage && (
            <div className="image-preview">
              <img 
                src={previewImage} 
                alt="Preview" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100px', 
                  borderRadius: '6px',
                  marginTop: '10px' 
                }} 
              />
              <div style={{ fontSize: '12px', color: '#555', marginTop: '5px' }}>
                {selectedFile?.name}
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="btn" id="submitBtn" disabled={isUploading}>
          <span id="submitText">
            {isUploading ? `Processing... ${progress}%` : '🚀 Send to Server'}
          </span>
        </button>

        {progress > 0 && progress < 100 && (
          <div className="progress-bar" id="progressBar" style={{ display: 'block' }}>
            <div className="progress-fill" id="progressFill" style={{ width: `${progress}%` }}></div>
          </div>
        )}
      </form>

      <div id="uploadStatus">
        {status.message && (
          <div className={`status-message ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadForm;
