// Codex Note: App.jsx - Main logic for this module/task.
import React, { useRef, useState } from 'react';
import './App.css';
import './style/base.css';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ServerConnectionPanel from './components/server/ServerConnectionPanel';
import FileUploadPanel from './image_mode/components/upload/FileUploadPanel';
import ZipContentsPanel from './image_mode/components/zip/ZipContentsPanel';
import JsonPreviewPanel from './image_mode/components/json/JsonPreviewPanel';
import VisualizationPanel from './image_mode/components/visualization/VisualizationPanel';
import HistoryPanel from './image_mode/components/history/HistoryPanel';
import DwgVisualizationPanel from './dwg_mode/components/DwgVisualizationPanel';
import DwgFileUploadPanel from './dwg_mode/components/upload/DwgFileUploadPanel';

function App() {
  // App-level UI state (server config, current selection, and history)
  const [serverConfig, setServerConfig] = useState({
    ip: '',
    port: '',
  });
  const [selectedMode, setSelectedMode] = useState('image');
  const [zipBlob, setZipBlob] = useState(null);
  const [zipData, setZipData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [currentImageName, setCurrentImageName] = useState('');
  const [historyEntries, setHistoryEntries] = useState([]);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const isRestoringRef = useRef(false);
  const [loading, setLoading] = useState({
    dataContent: true,
    dataCheck: true,
    visualization: true,
  });
  const [dwgUploadData, setDwgUploadData] = useState(null);
  const [dwgHistoryEntries, setDwgHistoryEntries] = useState([]);
  const [activeDwgHistoryId, setActiveDwgHistoryId] = useState(null);

  // Handle upload completion (ZIP blob + preview image)
  const handleZipReceived = async (blob, imageDataUrl, imageName = '') => {
    setZipBlob(blob);
    setUploadedImage(imageDataUrl);
    setCurrentImageName(imageName || 'Uploaded Image');
  };

  // Push a new history entry (keeps all items in memory)
  const handleHistoryUpdate = (payload) => {
    setHistoryEntries((prev) => {
      const filtered = prev.filter((entry) => entry.id !== payload.id);
      return [payload, ...filtered];
    });
    setActiveHistoryId(payload.id);
  };

  // Persist ZIP data into history when extraction finishes
  const handleZipDataReady = (zipPayload) => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }
    if (!uploadedImage) return;
    const id = `${currentImageName || 'image'}-${Date.now()}`;
    handleHistoryUpdate({
      id,
      imageName: currentImageName || 'Uploaded Image',
      uploadedImage,
      zipBlob: zipPayload?.zipBlob || zipBlob,
      zipData: zipPayload,
      selectedFile: null,
    });
  };

  // Single-click JSON selection (forces redraw via nonce)
  const handleFileSelected = (fileData) => {
    const nextFile = { ...fileData, _nonce: Date.now() };
    setSelectedFile(nextFile);
    setLoading((prev) => ({ ...prev, dataCheck: false, visualization: false }));
    setHistoryEntries((prev) =>
      prev.map((entry) =>
        entry.id === activeHistoryId ? { ...entry, selectedFile: nextFile } : entry
      )
    );
  };

  // Restore a previous history entry (image + zip + selection)
  const handleHistorySelect = (entry) => {
    isRestoringRef.current = true;
    setZipBlob(entry.zipBlob);
    setZipData(entry.zipData);
    setUploadedImage(entry.uploadedImage);
    setSelectedFile(entry.selectedFile || null);
    setCurrentImageName(entry.imageName || 'Uploaded Image');
    setActiveHistoryId(entry.id);
    setLoading({
      dataContent: false,
      dataCheck: false,
      visualization: false,
    });
  };

  // Persist DWG folder payload in memory (and history) for later processing.
  const handleDwgDataReady = (payload) => {
    if (!payload) return;

    setDwgUploadData(payload);
    const nextId = `${payload.folderName || 'dwg-folder'}-${Date.now()}`;
    const entry = {
      id: nextId,
      imageName: payload.folderName || 'DWG Folder',
      dwgData: payload,
    };

    setDwgHistoryEntries((prev) => {
      const filtered = prev.filter((item) => item.id !== nextId);
      return [entry, ...filtered];
    });
    setActiveDwgHistoryId(nextId);
  };

  // Restore a previously loaded DWG folder payload from in-memory history.
  const handleDwgHistorySelect = (entry) => {
    if (!entry?.dwgData) return;
    setDwgUploadData(entry.dwgData);
    setActiveDwgHistoryId(entry.id);
  };

  return (
    <div className="App">
      <ServerConnectionPanel
        serverConfig={serverConfig}
        setServerConfig={setServerConfig}
        selectedMode={selectedMode}
        setSelectedMode={setSelectedMode}
      />
      <Header />

      <div className="container">
        <div className="three-columns">
          {selectedMode === 'dwg' ? (
            <DwgFileUploadPanel onDwgDataReady={handleDwgDataReady} />
          ) : (
            <FileUploadPanel
              serverConfig={serverConfig}
              onZipReceived={handleZipReceived}
              setLoading={setLoading}
            />
          )}
          <ZipContentsPanel
            zipBlob={zipBlob}
            loading={loading.dataContent}
            setLoading={setLoading}
            onFileSelected={handleFileSelected}
            setZipData={setZipData}
            onZipDataReady={handleZipDataReady}
          />
          <JsonPreviewPanel selectedFile={selectedFile} loading={loading.dataCheck} />
        </div>

        <div className="visualization-row">
          {selectedMode === 'dwg' ? (
            <DwgVisualizationPanel dwgUploadData={dwgUploadData} />
          ) : (
            <VisualizationPanel
              zipData={zipData}
              selectedFile={selectedFile}
              uploadedImage={uploadedImage}
              loading={loading.visualization}
              setLoading={setLoading}
            />
          )}
          {selectedMode === 'dwg' ? (
            <HistoryPanel
              entries={dwgHistoryEntries}
              activeId={activeDwgHistoryId}
              onSelect={handleDwgHistorySelect}
            />
          ) : (
            <HistoryPanel
              entries={historyEntries}
              activeId={activeHistoryId}
              onSelect={handleHistorySelect}
            />
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default App;
