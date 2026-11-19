import '@fontsource-variable/inter-tight';
import '@fontsource-variable/jetbrains-mono';
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BriefingApp } from './app/BriefingApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BriefingApp />
  </StrictMode>,
);
