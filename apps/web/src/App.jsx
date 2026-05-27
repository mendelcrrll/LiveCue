import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import BuilderSchema from './pages/BuilderSchema'
import FeedbackPage from './pages/Feedback'
import Home from './pages/Home'
import PresentationSchemaPage from './pages/PresentationSchema'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/builder/:deckId" element={<BuilderSchema />} />
        <Route path="/presentation-schema" element={<PresentationSchemaPage />} />
        <Route path="/presentation-schema/:deckId" element={<PresentationSchemaPage />} />
        <Route path="/feedback-page" element={<FeedbackPage />} />
        <Route path="/feedback-page/:deckId" element={<FeedbackPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  )
}

export default App
