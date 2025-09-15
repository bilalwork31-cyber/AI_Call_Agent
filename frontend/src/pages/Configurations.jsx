import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Phone, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'

const Configurations = () => {
  const [configurations, setConfigurations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConfigurations()
  }, [])

  const fetchConfigurations = async () => {
    try {
      const response = await api.get('/configurations')
      setConfigurations(response.data)
    } catch (error) {
      toast.error('Failed to load configurations')
    } finally {
      setLoading(false)
    }
  }

  const getScenarioColor = (scenario) => {
    switch (scenario) {
      case 'check_in':
        return 'bg-blue-100 text-blue-800'
      case 'emergency':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatScenario = (scenario) => {
    return scenario.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agent Configurations</h1>
          <p className="text-gray-600 mt-2">Manage your AI voice agent settings and behaviors</p>
        </div>
        <Link
          to="/configurations/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Configuration
        </Link>
      </div>

      {configurations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {configurations.map((config) => (
            <div key={config.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Settings className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
                    
                  </div>
                </div>
              </div>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {config.system_prompt}
              </p>

              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Initial Message:</p>
                <p className="text-sm text-gray-700 line-clamp-2">
                  {config.initial_message}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Voice: {config.voice_settings?.voice_id || 'Default'}
                </div>
                <div className="flex space-x-2">
                  <Link
                    to={`/configurations/${config.id}/edit`}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Settings className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No configurations</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating your first agent configuration.</p>
          <div className="mt-6">
            <Link
              to="/configurations/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Configuration
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default Configurations