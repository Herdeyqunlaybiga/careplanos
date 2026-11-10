import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './live';
import './index.css';

createRoot(document.getElementById('root') as HTMLElement).render(<StrictMode><Root /></StrictMode>);
