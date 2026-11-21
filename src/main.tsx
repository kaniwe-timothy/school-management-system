import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {installLocalApi} from './localApi.ts';

// No server: answer the app's /api calls from data saved on this device.
installLocalApi();

createRoot(document.getElementById('root')!).render(<App />);
