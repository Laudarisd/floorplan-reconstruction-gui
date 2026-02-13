// Codex Note: App.test.js - Main logic for this module/task.
// Legacy file kept for reference (new Vite entry uses src/main.jsx)
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
