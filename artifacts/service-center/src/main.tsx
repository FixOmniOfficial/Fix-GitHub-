import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// Point the generated API client at the correct backend.
// In Vercel production: set VITE_API_BASE_URL to the deployed API server URL.
// In Replit dev:        BASE_URL already routes /api through the workspace proxy.
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
setBaseUrl(apiBase || null);

createRoot(document.getElementById('root')!).render(<App />);
