import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Phone, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  MapPin, 
  User, 
  Settings,
  ExternalLink,
  Copy,
  Download,
  RefreshCw,
  Calendar,
  Timer,
  MessageSquare,
  Activity
} from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const CallDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [call, setCall] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchCallDetails()
    
    // Auto-refresh every 15 seconds to catch delayed webhook updates
    const interval = setInterval(() => {
      refreshCallDetails()
    }, 15000)

    return () => clearInterval(interval)
  }, [id])

  const fetchCallDetails = async () => {
    try {
      const response = await api.get(`/calls/${id}`)
      setCall(response.data)
    } catch (error) {
      console.error('Failed to fetch call details:', error)
      toast.error('Failed to load call details')
      navigate('/calls')
    } finally {
      setLoading(false)
    }
  }

  const refreshCallDetails = async () => {
    setRefreshing(true)
    try {
      const response = await api.get(`/calls/${id}`)
      setCall(response.data)
    } catch (error) {
      console.error('Failed to refresh call details:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-100' }
      case 'in_progress':
        return { icon: Clock, color: 'text-blue-500', bgColor: 'bg-blue-100' }
      case 'failed':
        return { icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-100' }
      case 'pending':
        return { icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-100' }
      default:
        return { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-100' }
    }
  }

  const formatStatus = (status) => {
    return status ? status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown'
  }

  const getOutcomeDisplay = (call) => {
    const structuredData = call.structured_data || {}
    const callOutcome = structuredData.call_outcome || 'N/A'
    
    if (callOutcome === 'Check-in Complete' && structuredData.eta) {
      return `ETA: ${structuredData.eta}${structuredData.status ? ` (${structuredData.status})` : ''}`
    }
    return callOutcome
  }

  const getOutcomeBadge = (call) => {
    const structuredData = call.structured_data || {}
    const callOutcome = structuredData.call_outcome || 'N/A'
    
    if (callOutcome === 'Check-in Complete') {
      return structuredData.eta ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-800 border-gray-200'
    } else if (callOutcome === 'Emergency Detected') {
      return 'bg-red-100 text-red-800 border-red-200'
    }
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getCallDuration = (durationMs) => {
    if (!durationMs) return 'N/A'
    const duration = Math.round(durationMs / 1000) // Convert ms to seconds
    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard`)
    }).catch(() => {
      toast.error('Failed to copy to clipboard')
    })
  }

  const downloadTranscript = () => {
    if (!call.transcript) {
      toast.error('No transcript available')
      return
    }

    const content = `Call Transcript
Driver: ${call.driver_name || 'Unknown'}
Load: ${call.load_number || 'N/A'}
Date: ${format(new Date(call.created_at), 'PPpp')}
Status: ${formatStatus(call.status)}
Configuration: ${call.agent_config?.name || 'Unknown'}
Outcome: ${getOutcomeDisplay(call)}

${call.transcript}`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `call-transcript-${call.id}-${format(new Date(call.created_at), 'yyyy-MM-dd')}.txt`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success('Transcript downloaded')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading call details...</p>
        </div>
      </div>
    )
  }

  if (!call) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Call not found</h3>
          <p className="mt-1 text-sm text-gray-500">The requested call details could not be loaded.</p>
          <button
            onClick={() => navigate('/calls')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back to Calls
          </button>
        </div>
      </div>
    )
  }

  const statusInfo = getStatusIcon(call.status)
  const StatusIcon = statusInfo.icon
  const isEmergency = call.structured_data?.call_outcome === 'Emergency Detected'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/calls')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Call History
        </button>
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-full ${statusInfo.bgColor}`}>
              <Phone className={`h-8 w-8 ${statusInfo.color}`} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Call Details</h1>
              <div className="flex items-center space-x-4 mt-2">
                <p className="text-gray-600">
                  <span className="font-medium">{call.driver_name || 'Unknown'}</span> • Load #{call.load_number || 'N/A'}
                </p>
                {isEmergency && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Emergency
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 mt-4 lg:mt-0">
            <button
              onClick={refreshCallDetails}
              disabled={refreshing}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            {call.transcript && (
              <button
                onClick={downloadTranscript}
                className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Call Overview - Left Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Call Status</h2>
            
            <div className="flex items-center justify-center mb-6">
              <div className={`p-4 rounded-full ${statusInfo.bgColor}`}>
                <StatusIcon className={`h-8 w-8 ${statusInfo.color}`} />
              </div>
            </div>
            
            <div className="text-center mb-4">
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full border ${
                call.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                call.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                call.status === 'failed' ? 'bg-red-100 text-red-800 border-red-200' :
                'bg-yellow-100 text-yellow-800 border-yellow-200'
              }`}>
                {formatStatus(call.status)}
              </span>
            </div>

            {call.status === 'in_progress' && (
              <div className="text-center text-sm text-gray-600">
                <Activity className="h-4 w-4 inline mr-1 animate-pulse" />
                Call in progress...
              </div>
            )}
          </div>

          {/* Call Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Call Information</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  Started
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {format(new Date(call.created_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>

              {call.updated_at && call.status === 'completed' && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    Ended
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {format(new Date(call.updated_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center text-sm text-gray-600">
                  <Timer className="h-4 w-4 mr-2" />
                  Duration
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {getCallDuration(call.duration_ms)}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center text-sm text-gray-600">
                  <Settings className="h-4 w-4 mr-2" />
                  Configuration
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {call.agent_config?.name || 'Unknown'}
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center text-sm text-gray-600">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Call ID
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900 font-mono">
                    {call.id.slice(0, 8)}...
                  </span>
                  <button
                    onClick={() => copyToClipboard(call.id, 'Call ID')}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Extracted Data */}
          {call.structured_data && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Extracted Data</h2>
              
              {isEmergency ? (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-r-md">
                    <div className="flex items-center mb-2">
                      <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
                      <span className="font-medium text-red-800">Emergency Situation Detected</span>
                    </div>
                    <p className="text-red-700 text-sm">
                      This call has been flagged as an emergency. Immediate human intervention may be required.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {call.structured_data.emergency_type && (
                      <div className="bg-gray-50 p-4 rounded-md">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Emergency Type</span>
                          <span className="text-sm font-semibold text-red-600">
                            {call.structured_data.emergency_type}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {call.structured_data.emergency_location && call.structured_data.emergency_location !== 'Location not specified' && (
                      <div className="bg-gray-50 p-4 rounded-md">
                        <div className="flex items-start justify-between">
                          <span className="text-sm font-medium text-gray-600">Emergency Location</span>
                          <div className="text-right">
                            <div className="flex items-center text-sm font-semibold text-gray-900">
                              <MapPin className="h-4 w-4 mr-1 text-red-500" />
                              {call.structured_data.emergency_location}
                            </div>
                            <button
                              onClick={() => copyToClipboard(call.structured_data.emergency_location, 'Location')}
                              className="text-xs text-gray-500 hover:text-gray-700 mt-1 transition-colors"
                            >
                              Copy location
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {call.structured_data.escalation_status && (
                      <div className="bg-gray-50 p-4 rounded-md md:col-span-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Escalation Status</span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            {call.structured_data.escalation_status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {call.structured_data.status && (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">Driver Status</span>
                        <div className="flex items-center text-sm font-semibold text-gray-900">
                          <User className="h-4 w-4 mr-1 text-blue-500" />
                          {call.structured_data.status}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {call.structured_data.current_location && call.structured_data.current_location !== 'Not specified' && (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-medium text-gray-600">Current Location</span>
                        <div className="text-right">
                          <div className="flex items-center text-sm font-semibold text-gray-900">
                            <MapPin className="h-4 w-4 mr-1 text-green-500" />
                            {call.structured_data.current_location}
                          </div>
                          <button
                            onClick={() => copyToClipboard(call.structured_data.current_location, 'Location')}
                            className="text-xs text-gray-500 hover:text-gray-700 mt-1 transition-colors"
                          >
                            Copy location
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {call.structured_data.eta && call.structured_data.eta !== 'Not specified' && (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">Estimated Arrival</span>
                        <div className="flex items-center text-sm font-semibold text-gray-900">
                          <Clock className="h-4 w-4 mr-1 text-orange-500" />
                          {call.structured_data.eta}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Call Outcome</span>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${getOutcomeBadge(call)}`}>
                        {getOutcomeDisplay(call)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Call Transcript */}
          {call.transcript ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Call Transcript
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => copyToClipboard(call.transcript, 'Transcript')}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={downloadTranscript}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
                  {call.transcript}
                </pre>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center py-8">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No transcript available</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {call.status === 'in_progress' 
                    ? 'The transcript will appear here once the call is completed.'
                    : 'No transcript was recorded for this call.'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent Configuration Details */}
      {call.agent_config && (
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Configuration Used</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">System Prompt</h3>
              <div className="bg-gray-50 rounded-md p-3 max-h-48 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-xs text-gray-700 font-mono">
                  {call.agent_config.system_prompt || 'Not available'}
                </pre>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Initial Message Template</h3>
              <div className="bg-gray-50 rounded-md p-3">
                <pre className="whitespace-pre-wrap text-xs text-gray-700 font-mono">
                  {call.agent_config.initial_message || 'Not available'}
                </pre>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Voice Settings</h3>
                <div className="bg-gray-50 rounded-md p-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                <div><strong>Voice:</strong> {call.agent_config.voice_settings?.voice_id || 'Default'}</div>
                <div><strong>Responsiveness:</strong> {call.agent_config.voice_settings?.responsiveness ?? 1}</div>
                <div><strong>Interruption:</strong> {call.agent_config.voice_settings?.interruption_sensitivity ?? 1}</div>
                <div><strong>Backchannel:</strong> {call.agent_config.voice_settings?.enable_backchannel ? 'Enabled' : 'Disabled'}</div>
              </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CallDetails