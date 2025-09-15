import React, { useState, useEffect } from 'react'
import { Plus, Phone, Settings, TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'
import TriggerCallModal from '../components/TriggerCallModal'

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalCalls: 0,
    activeCalls: 0,
    completedCalls: 0,
    emergencies: 0
  })
  const [recentCalls, setRecentCalls] = useState([])
  const [configurations, setConfigurations] = useState([])
  const [showTriggerModal, setShowTriggerModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
    
    // Auto-refresh every 15 seconds to catch delayed webhook updates
    const interval = setInterval(() => {
      fetchDashboardData()
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [callsRes, configsRes] = await Promise.all([
        api.get('/calls'),
        api.get('/configurations') // Updated endpoint
      ])
      
      const calls = callsRes.data || []
      setRecentCalls(calls.slice(0, 5))
      setConfigurations(configsRes.data || [])
      
      // Calculate stats
      const totalCalls = calls.length
      const activeCalls = calls.filter(call => call.status === 'in_progress').length
      const completedCalls = calls.filter(call => call.status === 'completed').length
      const emergencies = calls.filter(call => 
        call.agent_config?.scenario_type === 'emergency' && 
        call.structured_data?.emergency_detected === true
      ).length
      
      setStats({ totalCalls, activeCalls, completedCalls, emergencies })
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-500" />
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const formatStatus = (status) => {
    return status ? status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown'
  }

  const getOutcomeDisplay = (call) => {
    const structuredData = call.structured_data || {}
    const scenario = call.agent_config?.scenario_type || ''
    
    if (scenario === 'check_in') {
      const eta = structuredData.eta
      const status = structuredData.status
      return eta ? `ETA: ${eta}${status ? ` (${status})` : ''}` : 'N/A'
    } else if (scenario === 'emergency') {
      return structuredData.emergency_detected ? 'Emergency Detected' : 'No Emergency'
    }
    return structuredData.outcome || 'N/A'
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Monitor and manage your AI voice agents</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Phone className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Calls</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalCalls}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Calls</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeCalls}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.completedCalls}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Emergencies</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.emergencies}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-6 space-y-4">
            <button
              onClick={() => setShowTriggerModal(true)}
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Phone className="mr-2 h-4 w-4" />
              Trigger Test Call
            </button>
            
            <Link
              to="/configurations/new"
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Agent Config
            </Link>
            
            <Link
              to="/configurations"
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Settings className="mr-2 h-4 w-4" />
              Manage Configs
            </Link>
          </div>
        </div>

        {/* Recent Calls */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Recent Calls</h2>
              <Link 
                to="/calls"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {recentCalls.length > 0 ? recentCalls.map((call) => (
              <Link
                key={call.id}
                to={`/calls/${call.id}`}
                className="p-6 hover:bg-gray-50 transition-colors block"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{call.driver_name || 'Unknown'}</p>
                    <p className="text-sm text-gray-600">Load #{call.load_number || 'N/A'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(call.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Outcome: {getOutcomeDisplay(call)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(call.status)}
                    <span className="text-sm text-gray-600">
                      {formatStatus(call.status)}
                    </span>
                  </div>
                </div>
              </Link>
            )) : (
              <div className="p-6 text-center text-gray-500">
                No calls yet. Trigger your first test call!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trigger Call Modal */}
      {showTriggerModal && (
        <TriggerCallModal
          configurations={configurations}
          onClose={() => setShowTriggerModal(false)}
          onSuccess={fetchDashboardData}
        />
      )}
    </div>
  )
}

export default Dashboard