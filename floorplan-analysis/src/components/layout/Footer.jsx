// Codex Note: components/layout/Footer.jsx - Main logic for this module/task.
import React from 'react';
import '../../style/tasks/footer.css';

const FOOTER_COPY = {
  project: 'Personal Project',
  contactLabel: 'Contact for Development:',
  email: 'personal@INc.com',
};

const Footer = () => {
  // Footer with contact info
  return (
    <footer className="footer-bar">
      <div className="footer-content">
        <p className="footer-text">{FOOTER_COPY.project}</p>
        <p className="footer-text">
          {FOOTER_COPY.contactLabel}{' '}
          <a href={`mailto:${FOOTER_COPY.email}`} className="footer-link">
            {FOOTER_COPY.email}
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
