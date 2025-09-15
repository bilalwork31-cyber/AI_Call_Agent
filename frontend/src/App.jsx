import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Configurations from './pages/Configurations'
import ConfigurationEditor from './pages/ConfigurationEditor'
import Calls from './pages/Calls'
import CallDetails from './pages/CallDetails'
import './index.css'
function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/configurations" element={<Configurations />} />
            <Route path="/configurations/new" element={<ConfigurationEditor />} />
            <Route path="/configurations/:id/edit" element={<ConfigurationEditor />} />
            <Route path="/calls" element={<Calls />} />
            <Route path="/calls/:id" element={<CallDetails />} />
          </Routes>
        </Layout>
        <Toaster position="top-right" />
      </div>
    </Router>
  )
}

export default App
