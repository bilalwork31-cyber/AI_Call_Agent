import React, { useState, useRef, useEffect } from 'react'
import { X, Phone, CheckCircle } from 'lucide-react'
import { RetellWebClient } from 'retell-client-js-sdk'
import api from '../services/api'
import toast from 'react-hot-toast'

const TriggerCallModal = ({ configurations, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    agent_config_id: '',
    driver_name: '',
    load_number: ''
  })
  const [loading, setLoading] = useState(false)
  const [callResult, setCallResult] = useState(null)
  const [error, setError] = useState(null)
  const [callActive, setCallActive] = useState(false)
  const retellWebClientRef = useRef(null)

  // Initialize RetellWebClient and set up event listeners
  useEffect(() => {
    retellWebClientRef.current = new RetellWebClient()
    const client = retellWebClientRef.current

    client.on('call_started', () => {
      console.log('Call started')
      toast.success('Call connected!')
      setCallActive(true)
    })

    client.on('call_ended', () => {
      console.log('Call ended')
      toast.info('Call ended')
      setCallActive(false)
      if (onSuccess) {
        onSuccess()
      }
    })

    client.on('error', (error) => {
      console.error('Call error:', error)
      toast.error(`Call failed: ${error.message}`)
      setCallActive(false)
    })

    // Cleanup on component unmount or modal close
    return () => {
      if (client && callActive) {
        client.stopCall()
      }
      client.removeAllListeners()
    }
  }, [callActive, onSuccess])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await api.post('/calls/trigger', formData)
      const callData = response.data
      console.log('API Response:', callData)
      setCallResult(callData)
      toast.success('Call initiated successfully! Click to start the test call.')
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      const errorMessage = 
        error.response?.data?.detail || 
        error.response?.data?.message || 
        error.message || 
        'Failed to trigger call'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleWebCall = async () => {
    if (!callResult?.access_token) {
      toast.error('Access token is not available')
      console.error('Missing access_token in callResult:', callResult)
      return
    }

    if (callActive) {
      toast.info('Call is already active')
      return
    }

    try {
      const selectedConfig = getSelectedConfig()
      const sampleRate = selectedConfig?.voice_settings?.sample_rate || 24000
      await retellWebClientRef.current.startCall({
        accessToken: callResult.access_token,
        sampleRate
      })
    } catch (error) {
      console.error('Failed to start web call:', error)
      toast.error(`Failed to start web call: ${error.message}`)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const getSelectedConfig = () => {
    return configurations.find(config => config.id === formData.agent_config_id) || null
  }

  const formatStatus = (status) => {
    return status ? status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Ready'
  }

  const handleReset = () => {
    if (callActive && retellWebClientRef.current) {
      retellWebClientRef.current.stopCall()
    }
    setCallResult(null)
    setError(null)
    setFormData({
      agent_config_id: '',
      driver_name: '',
      load_number: ''
    })
    setCallActive(false)
  }

  const handleClose = () => {
    if (callActive && retellWebClientRef.current) {
      retellWebClientRef.current.stopCall()
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {callResult ? 'Call Ready' : 'Trigger Test Call'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="m-6 mb-0 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        )}

        {/* Form or Success State */}
        {!callResult ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Agent Configuration Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent Configuration <span className="text-red-500">*</span>
              </label>
              <select
                name="agent_config_id"
                value={formData.agent_config_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a configuration...</option>
                {configurations.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
              {formData.agent_config_id && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-xs text-blue-700">
                    <strong>Selected:</strong> {getSelectedConfig()?.name || 'Unknown'}
                  </div>
                </div>
              )}
            </div>

            {/* Driver Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Driver Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="driver_name"
                value={formData.driver_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Bilal Ahmed"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                The driver's name that will be used in the call
              </p>
            </div>

            {/* Load Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Load Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="load_number"
                value={formData.load_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 4556-B"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                The load reference number for this call
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.agent_config_id || !formData.driver_name || !formData.load_number}
                className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Setting up...
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-4 w-4" />
                    Start Call
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Success State - Call Ready */
          <div className="p-6">
            {/* Success Icon and Message */}
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mt-2 text-lg font-medium text-gray-900">Call Ready!</h3>
              <p className="mt-1 text-sm text-gray-500">
                Your test call has been set up successfully. Click the button below to start the web call.
              </p>
            </div>

            {/* Call Details */}
            <div className="bg-gray-50 rounded-md p-4 mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Call Details</h4>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Driver:</span>
                  <span className="font-medium">{formData.driver_name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Load:</span>
                  <span className="font-medium">#{formData.load_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Configuration:</span>
                  <span className="font-medium">{getSelectedConfig()?.name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Call ID:</span>
                  <span className="font-medium text-xs">{callResult.call_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {formatStatus(callResult.status)}
                  </span>
                </div>
                {process.env.NODE_ENV === 'development' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Access Token:</span>
                    <span className="font-medium text-xs text-blue-600 break-all">
                      {callResult.access_token ? `${callResult.access_token.substring(0, 20)}...` : 'Not provided'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleWebCall}
                disabled={callActive || !callResult?.access_token}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Phone className="mr-2 h-4 w-4" />
                {callActive ? 'Call Active' : 'Start Web Call'}
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  New Call
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-xs text-blue-700">
                <strong>Instructions:</strong>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  <li>Click "Start Web Call" to begin the call</li>
                  <li>Allow microphone access when prompted</li>
                  <li>The AI agent will initiate the conversation</li>
                  <li>Test different scenarios (e.g., check-in, emergency)</li>
                  <li>Click "New Call" to reset or "Close" to exit</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TriggerCallModal