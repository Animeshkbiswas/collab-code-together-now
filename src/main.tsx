import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import Summarizer from './pages/Summarizer'
import { Route } from 'react-router-dom'

createRoot(document.getElementById("root")!).render(<App />);
