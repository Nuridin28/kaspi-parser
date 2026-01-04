import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import ArchiveReports from './pages/ArchiveReports'
import Scheduler from './pages/Scheduler'
import { Toaster } from 'sonner'

function App() {
  return (
    <ErrorBoundary>
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
        <Toaster />
      </Router>
    </ErrorBoundary>
  )
}

export default App

