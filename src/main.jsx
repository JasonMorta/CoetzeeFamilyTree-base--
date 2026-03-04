import React from 'react';
import ReactDOM from 'react-dom/client';
import 'rsuite/dist/rsuite.min.css';
import './styles/variables.css';
import App from './App';
import { AppStateProvider } from './context/AppStateContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </React.StrictMode>
);
