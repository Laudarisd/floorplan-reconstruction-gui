// Codex Note: components/history/HistoryPanel.jsx - Main logic for this module/task.
import React from 'react';
import '../../style/tasks/history-panel.css';

const HISTORY_COPY = {
  title: 'History',
  empty: 'No history yet',
};

const HISTORY_CLASSNAMES = {
  panel: 'history-panel',
  title: 'history-title',
  list: 'history-list',
  item: 'history-item',
  empty: 'history-empty',
  active: 'is-active',
};

const HistoryPanel = ({ entries, activeId, onSelect }) => {
  // History list (most recent first)
  return (
    <aside className={HISTORY_CLASSNAMES.panel}>
      <h4 className={HISTORY_CLASSNAMES.title}>{HISTORY_COPY.title}</h4>
      {entries.length === 0 ? (
        <p className={HISTORY_CLASSNAMES.empty}>{HISTORY_COPY.empty}</p>
      ) : (
        <ol className={HISTORY_CLASSNAMES.list}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={`${HISTORY_CLASSNAMES.item} ${
                  activeId === entry.id ? HISTORY_CLASSNAMES.active : ''
                }`}
                onClick={() => onSelect(entry)}
              >
                {entry.imageName || 'Untitled Image'}
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
};

export default HistoryPanel;
