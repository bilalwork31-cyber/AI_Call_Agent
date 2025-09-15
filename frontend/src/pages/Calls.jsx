import React, { useState, useEffect, useMemo } from 'react'
import { Search, Filter, Phone, ExternalLink, Download, RefreshCw, Calendar, AlertTriangle, CheckCircle, Clock, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'
import { format, isToday, isYesterday, subDays } from 'date-fns'

const Calls = () => {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [scenarioFilter, setScenarioFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')

  useEffect(() => {
    fetchCalls()
    
    // Auto-refresh every 15 seconds to catch delayed webhook updates
    const interval = setInterval(() => {
      refreshCalls()
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  const fetchCalls = async () => {
    try {
      const response = await api.get('/calls')
      setCalls(response.data || [])
    } catch (error) {
      console.error('Failed to fetch calls:', error)
      toast.error('Failed to load calls')
      setCalls([])
    } finally {
      setLoading(false)
    }
  }

  const refreshCalls = async () => {
    setRefreshing(true)
    try {
      const response = await api.get('/calls')
      setCalls(response.data || [])
      toast.success('Calls refreshed')
    } catch (error) {
      toast.error('Failed to refresh calls')
    } finally {
      setRefreshing(false)
    }
  }

  // Filter and sort calls
  const filteredAndSortedCalls = useMemo(() => {
    let filtered = calls.filter(call => {
      const matchesSearch = 
        (call.driver_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (call.load_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (call.agent_config?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || call.status === statusFilter
      
      const matchesScenario = scenarioFilter === 'all' || 
        (call.agent_config?.scenario_type || '') === scenarioFilter
      
      let matchesDate = true
      if (dateFilter !== 'all') {
        const callDate = new Date(call.created_at)
        const now = new Date()
        
        switch (dateFilter) {
          case 'today':
            matchesDate = isToday(callDate)
            break
          case 'yesterday':
            matchesDate = isYesterday(callDate)
            break
          case 'week':
            matchesDate = callDate >= subDays(now, 7)
            break
          case 'month':
            matchesDate = callDate >= subDays(now, 30)
            break
          default:
            matchesDate = true
        }
      }
      
      return matchesSearch && matchesStatus && matchesScenario && matchesDate
    })

    // Sort calls
    filtered.sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'driver_name':
          aValue = (a.driver_name || '').toLowerCase()
          bValue = (b.driver_name || '').toLowerCase()
          break
        case 'load_number':
          aValue = (a.load_number || '').toLowerCase()
          bValue = (b.load_number || '').toLowerCase()
          break
        case 'status':
          aValue = a.status || ''
          bValue = b.status || ''
          break
        case 'created_at':
        default:
          aValue = new Date(a.created_at)
          bValue = new Date(b.created_at)
          break
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [calls, searchTerm, statusFilter, scenarioFilter, dateFilter, sortBy, sortOrder])

  // Statistics
  const stats = useMemo(() => {
    const total = calls.length
    const completed = calls.filter(call => call.status === 'completed').length
    const inProgress = calls.filter(call => call.status === 'in_progress').length
    const failed = calls.filter(call => call.status === 'failed').length
    // Adjust for scenario-specific outcomes (e.g., check_in doesn't use "Emergency Detected")
    const emergencies = calls.filter(call => 
      call.agent_config?.scenario_type === 'emergency' && 
      call.structured_data?.emergency_detected === true
    ).length
    
    return { total, completed, inProgress, failed, emergencies }
  }, [calls])

  const getStatusBadge = (status) => {
    const badges = {
      completed: { class: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
      in_progress: { class: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock },
      failed: { class: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
      pending: { class: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock }
    }
    return badges[status] || { class: 'bg-gray-100 text-gray-800 border-gray-200', icon: Clock }
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

  const getOutcomeBadge = (call) => {
    const structuredData = call.structured_data || {}
    const scenario = call.agent_config?.scenario_type || ''
    
    if (scenario === 'check_in') {
      return structuredData.eta ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-800 border-gray-200'
    } else if (scenario === 'emergency') {
      return structuredData.emergency_detected ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200'
    }
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    if (isToday(date)) {
      return `Today, ${format(date, 'h:mm a')}`
    } else if (isYesterday(date)) {
      return `Yesterday, ${format(date, 'h:mm a')}`
    } else {
      return format(date, 'MMM d, yyyy h:mm a')
    }
  }

  const exportCalls = () => {
    const csvContent = [
      ['Date', 'Driver', 'Load', 'Status', 'Outcome', 'Configuration', 'Scenario', 'Duration'].join(','),
      ...filteredAndSortedCalls.map(call => [
        format(new Date(call.created_at), 'yyyy-MM-dd HH:mm:ss'),
        call.driver_name || '',
        call.load_number || '',
        call.status || '',
        getOutcomeDisplay(call),
        call.agent_config?.name || '',
        call.agent_config?.scenario_type || '',
        call.duration_ms ? `${(call.duration_ms / 1000).toFixed(1)}s` : ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `calls-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success('Calls exported successfully')
  }

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setScenarioFilter('all')
    setDateFilter('all')
    setSortBy('created_at')
    setSortOrder('desc')
    toast.success('Filters cleared')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading calls...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Call History</h1>
            <p className="text-gray-600 mt-2">
              Review all voice agent interactions and their outcomes
              {filteredAndSortedCalls.length !== calls.length && (
                <span className="ml-2 text-sm">
                  ({filteredAndSortedCalls.length} of {calls.length} calls shown)
                </span>
              )}
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={refreshCalls}
              disabled={refreshing}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportCalls}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Phone className="h-6 w-6 text-gray-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Total</p>
              <p className="text-lg font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Completed</p>
              <p className="text-lg font-semibold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Clock className="h-6 w-6 text-blue-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Active</p>
              <p className="text-lg font-semibold text-gray-900">{stats.inProgress}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Failed</p>
              <p className="text-lg font-semibold text-gray-900">{stats.failed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Emergencies</p>
              <p className="text-lg font-semibold text-gray-900">{stats.emergencies}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by driver name, load number, or configuration..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
            <select
              value={scenarioFilter}
              onChange={(e) => setScenarioFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Scenarios</option>
              <option value="check_in">Check-in</option>
              <option value="emergency">Emergency</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field)
                setSortOrder(order)
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="driver_name-asc">Driver A-Z</option>
              <option value="driver_name-desc">Driver Z-A</option>
              <option value="status-asc">Status A-Z</option>
            </select>
            {(searchTerm || statusFilter !== 'all' || scenarioFilter !== 'all' || dateFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Calls Table/Cards */}
      {filteredAndSortedCalls.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Driver & Load
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Configuration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Outcome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedCalls.map((call) => {
                    const statusBadge = getStatusBadge(call.status)
                    const StatusIcon = statusBadge.icon
                    
                    return (
                      <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <User className="h-4 w-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{call.driver_name || 'Unknown'}</div>
                              <div className="text-sm text-gray-500">Load #{call.load_number || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{call.agent_config?.name || 'Unknown'}</div>
                     
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <StatusIcon className="h-4 w-4 mr-2" />
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${statusBadge.class}`}>
                              {formatStatus(call.status)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getOutcomeBadge(call)}`}>
                            {getOutcomeDisplay(call)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(call.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <Link
                            to={`/calls/${call.id}`}
                            className="text-blue-600 hover:text-blue-900 flex items-center transition-colors"
                          >
                            View Details
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {filteredAndSortedCalls.map((call) => {
              const statusBadge = getStatusBadge(call.status)
              const StatusIcon = statusBadge.icon
              
              return (
                <div key={call.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <User className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{call.driver_name || 'Unknown'}</h3>
                        <p className="text-sm text-gray-500">Load #{call.load_number || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <StatusIcon className="h-4 w-4 mr-1" />
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${statusBadge.class}`}>
                        {formatStatus(call.status)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Configuration:</span>
                      <span className="text-gray-900">{call.agent_config?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Scenario:</span>
                      <span className="text-gray-900">
                        {(call.agent_config?.scenario_type || '').replace('_', ' ') || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Outcome:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getOutcomeBadge(call)}`}>
                        {getOutcomeDisplay(call)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Date:</span>
                      <span className="text-gray-900">{formatDate(call.created_at)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Duration:</span>
                      <span className="text-gray-900">
                        {call.duration_ms ? `${(call.duration_ms / 1000).toFixed(1)}s` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  <Link
                    to={`/calls/${call.id}`}
                    className="flex items-center justify-center w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    View Details
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="text-center py-12">
            <Phone className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No calls found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' || scenarioFilter !== 'all' || dateFilter !== 'all'
                ? 'Try adjusting your filters to see more results'
                : 'No calls have been made yet. Trigger your first test call!'
              }
            </p>
            {(searchTerm || statusFilter !== 'all' || scenarioFilter !== 'all' || dateFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Calls