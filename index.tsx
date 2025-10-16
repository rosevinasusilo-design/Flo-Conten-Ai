import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { ApiKeyProvider } from './contexts/ApiKeyContext';
import { AuthProvider } from './contexts/AuthContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <ApiKeyProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ApiKeyProvider>
    </LanguageProvider>
  </React.StrictMode>
);