// Codex Note: components/server/ServerConnectionPanel.jsx - Main logic for this module/task.
import React, { useEffect, useState } from 'react';
import { testConnection } from '../../services/api.jsx';
import '../../style/tasks/server-connection.css';

const SERVER_PANEL_COPY = {
  title: 'Mode',
  imageModeLabel: 'IMAGE MODE',
  dwgModeLabel: 'DWG MODE',
  settingsButton: 'Settings',
  modalTitle: 'Server Settings',
  testLabel: 'Test Connection',
  testingLabel: 'Testing...',
  saveLabel: 'Save',
  ipLabel: 'Server IP:',
  portLabel: 'Port:',
};

const SERVER_CLASSNAMES = {
  menuBar: 'menu-bar',
  menuTitle: 'menu-title',
  menuBtn: 'menu-btn',
  modal: 'modal',
  modalContent: 'modal-content',
  close: 'close',
  btn: 'btn',
};

const ServerConnectionPanel = ({ serverConfig, setServerConfig, selectedMode, setSelectedMode }) => {
  // Connection settings modal + test action
  const [showModal, setShowModal] = useState(false);
  const [tempConfig, setTempConfig] = useState(serverConfig);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');

  useEffect(() => {
    setTempConfig(serverConfig);
  }, [serverConfig]);

  const handleModeChange = (e) => {
    const nextMode = e.target.value;
    setSelectedMode(nextMode);

    // Force fresh server entry on every mode switch.
    const emptyConfig = { ip: '', port: '' };
    setServerConfig(emptyConfig);
    setTempConfig(emptyConfig);
    setConnectionStatus('');
    setShowModal(true);
    alert('Mode changed. Please set Server IP and Port before continuing.');
  };

  const handleTestConnection = async () => {
    if (!tempConfig.ip || !tempConfig.port) {
      setConnectionStatus('Please enter both IP and port first.');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus('Testing connection...');

    const isConnected = await testConnection(tempConfig.ip, tempConfig.port);

    if (isConnected) {
      setConnectionStatus('Connection successful!');
    } else {
      setConnectionStatus(`Cannot connect to http://${tempConfig.ip}:${tempConfig.port}`);
    }

    setTestingConnection(false);
  };

  const handleSave = () => {
    if (!tempConfig.ip || !tempConfig.port) {
      alert('Please enter both IP and port before saving.');
      return;
    }

    if (tempConfig.ip === '127.0.0.1' || tempConfig.ip === 'localhost') {
      const confirm = window.confirm(
        'Warning: You are using localhost (127.0.0.1).\nThis will only work if you have a server running on your local machine.\n\nDo you want to continue?'
      );
      if (!confirm) return;
    }

    setServerConfig(tempConfig);
    setShowModal(false);
    alert(`Server URL set to: http://${tempConfig.ip}:${tempConfig.port}/receive_data`);
  };

  return (
    <>
      <div className={SERVER_CLASSNAMES.menuBar}>
        <span className={SERVER_CLASSNAMES.menuTitle}>{SERVER_PANEL_COPY.title}</span>
        <select className="mode-select" value={selectedMode} onChange={handleModeChange}>
          <option value="image">{SERVER_PANEL_COPY.imageModeLabel}</option>
          <option value="dwg">{SERVER_PANEL_COPY.dwgModeLabel}</option>
        </select>
        <span className="menu-subtitle">Server: {serverConfig.ip}:{serverConfig.port}</span>
        <button onClick={() => setShowModal(true)} className={SERVER_CLASSNAMES.menuBtn}>
          {SERVER_PANEL_COPY.settingsButton}
        </button>
      </div>

      {showModal && (
        <div className={SERVER_CLASSNAMES.modal}>
          <div className={SERVER_CLASSNAMES.modalContent}>
            <span className={SERVER_CLASSNAMES.close} onClick={() => setShowModal(false)}>
              &times;
            </span>
            <h2>{SERVER_PANEL_COPY.modalTitle}</h2>

            <label htmlFor="serverIp">{SERVER_PANEL_COPY.ipLabel}</label>
            <input
              type="text"
              id="serverIp"
              value={tempConfig.ip}
              onChange={(e) => setTempConfig({ ...tempConfig, ip: e.target.value })}
            />

            <label htmlFor="serverPort">{SERVER_PANEL_COPY.portLabel}</label>
            <input
              type="text"
              id="serverPort"
              value={tempConfig.port}
              onChange={(e) => setTempConfig({ ...tempConfig, port: e.target.value })}
            />

            <div className="modal-actions">
              <button
                onClick={handleTestConnection}
                className={SERVER_CLASSNAMES.btn}
                disabled={testingConnection}
              >
                {testingConnection ? SERVER_PANEL_COPY.testingLabel : SERVER_PANEL_COPY.testLabel}
              </button>
              <button onClick={handleSave} className={SERVER_CLASSNAMES.btn}>
                {SERVER_PANEL_COPY.saveLabel}
              </button>
            </div>

            {connectionStatus && (
              <div
                className={
                  connectionStatus.toLowerCase().includes('successful')
                    ? 'connection-status success'
                    : 'connection-status error'
                }
              >
                {connectionStatus}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ServerConnectionPanel;
