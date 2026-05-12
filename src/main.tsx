import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fix for ReferenceError: stopVoiceSession is not defined
// Adding a global shim with a trace to find the source of the mystery call
if (typeof window !== 'undefined') {
  (window as any).stopVoiceSession = () => {
    console.log('stopVoiceSession called (dummy shim)');
    console.trace('Trace for stopVoiceSession call:');
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
