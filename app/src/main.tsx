// TEMPORARY entry — replaced by Task 28 app shell (router).
// Exists only so `npm run dev` can render the Forge screen before the shell lands.
import { createRoot } from 'react-dom/client';
import Forge from './screens/Forge.js';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(<Forge />);
