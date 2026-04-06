import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './routes/Home'
import { Camera } from './routes/Camera'
import { Review } from './routes/Review'
import { Summary } from './routes/Summary'

export default function App() {
  return (
    <BrowserRouter>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#111',
          color: '#FFF',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/session/camera" element={<Camera />} />
          <Route path="/session/review" element={<Review />} />
          <Route path="/session/summary" element={<Summary />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
