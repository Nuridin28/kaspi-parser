import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import ArchiveReports from './pages/ArchiveReports'
import Scheduler from './pages/Scheduler'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/archive" element={<ArchiveReports />} />
          <Route path="/scheduler" element={<Scheduler />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App

