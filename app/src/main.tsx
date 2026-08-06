// App shell entry (Task 28). Replaces the TEMPORARY Task 25 entry that rendered
// the Forge screen directly.
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(<App />);
