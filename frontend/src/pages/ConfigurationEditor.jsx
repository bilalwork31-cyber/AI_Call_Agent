import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, RotateCcw, Info } from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'

class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-red-600">
          <h2>Error: {this.state.error.message}</h2>
          <pre>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

const ConfigurationEditor = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = !!id

  const [formData, setFormData] = useState({
    name: '',
    system_prompt: '',
    initial_message: '',
    voice_settings: {
      voice_id: '11labs-Adrian',
      responsiveness: 1.0,
      interruption_sensitivity: 1.0,
      enable_backchannel: true,
      backchannel_frequency: 0.8,
      backchannel_words: ['yeah', 'uh-huh', 'okay', 'got it', 'I see'],
      reminder_trigger_ms: 10000,
      reminder_max_count: 2,
      normalize_for_speech: true,
      end_call_after_silence_ms: 10000,
      max_call_duration_ms: 600000
    }
  })
  
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(isEditing)
  const [errors, setErrors] = useState({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const presetPrompt = {
    name: 'Driver Dispatch Agent',
    system_prompt: `You are an AI dispatch assistant for truck drivers. Your goals:

1. Determine driver status (e.g., driving, delayed, arrived) and gather details like location and ETA.
2. Detect emergencies (e.g., accident, breakdown, medical issue) and escalate immediately if present.
3. Handle routine check-ins professionally and confirm delivery status if arrived.
4. End call if driver is uncooperative after multiple attempts.

Guidelines:
- Be professional, friendly, and concise.
- Ask open-ended questions first, then follow up for specifics.
- If driver gives short answers, probe for more information.
- EMERGENCY OVERRIDE: If driver mentions emergency-related words (e.g., accident, crash, blowout, emergency, hurt, injured, breakdown, broke down, fire, medical, help, 911, issue), switch to emergency protocol immediately.

Emergency Protocol:
1. Ask for exact location (e.g., mile markers, exits, landmarks).
2. Gather emergency type and severity.
3. End call with "I've logged your emergency at [location]. A human dispatcher will call you back immediately. Stay safe."
4. Do not provide advice beyond ensuring safety and confirming escalation.`,
    initial_message: `Hi {driver_name}, this is Dispatch calling with a check-in on load {load_number}. Can you give me an update on your current status?`
  }

  const voiceOptions = [
    { value: '11labs-Adrian', label: 'Adrian (Professional Male)', description: 'Clear, authoritative voice ideal for dispatch calls' },
    { value: '11labs-Sarah', label: 'Sarah (Professional Female)', description: 'Warm, professional tone with excellent clarity' },
    { value: '11labs-Michael', label: 'Michael (Friendly Male)', description: 'Approachable voice good for routine check-ins' },
    { value: '11labs-Emma', label: 'Emma (Friendly Female)', description: 'Calm, reassuring voice suitable for all scenarios' },
    { value: '11labs-James', label: 'James (Deep Male)', description: 'Deep, confident voice for authority situations' },
    { value: '11labs-Lisa', label: 'Lisa (Soft Female)', description: 'Gentle voice ideal for sensitive conversations' }
  ]

  useEffect(() => {
    if (isEditing) {
      fetchConfiguration()
    }
  }, [id])

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const fetchConfiguration = async () => {
    try {
      const response = await api.get('/configurations')
      const config = response.data.find(c => c.id === id)
      if (config) {
        setFormData({
          ...config,
          voice_settings: {
            voice_id: config.voice_settings?.voice_id || '11labs-Adrian',
            responsiveness: parseFloat(config.voice_settings?.responsiveness) || 1.0,
            interruption_sensitivity: parseFloat(config.voice_settings?.interruption_sensitivity) || 1.0,
            enable_backchannel: config.voice_settings?.enable_backchannel ?? true,
            backchannel_frequency: parseFloat(config.voice_settings?.backchannel_frequency) || 0.8,
            backchannel_words: config.voice_settings?.backchannel_words || ['yeah', 'uh-huh', 'okay', 'got it', 'I see'],
            reminder_trigger_ms: parseInt(config.voice_settings?.reminder_trigger_ms) || 10000,
            reminder_max_count: parseInt(config.voice_settings?.reminder_max_count) || 2,
            normalize_for_speech: config.voice_settings?.normalize_for_speech ?? true,
            end_call_after_silence_ms: parseInt(config.voice_settings?.end_call_after_silence_ms) || 10000,
            max_call_duration_ms: parseInt(config.voice_settings?.max_call_duration_ms) || 600000
          }
        })
      } else {
        toast.error('Configuration not found')
        navigate('/configurations')
      }
    } catch (error) {
      toast.error('Failed to load configuration')
      navigate('/configurations')
    } finally {
      setFetchLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Configuration name is required'
    } else if (formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters'
    }

    if (!formData.system_prompt.trim()) {
      newErrors.system_prompt = 'System prompt is required'
    } else if (formData.system_prompt.length < 50) {
      newErrors.system_prompt = 'System prompt must be at least 50 characters'
    }

    if (!formData.initial_message.trim()) {
      newErrors.initial_message = 'Initial message is required'
    } else if (!formData.initial_message.includes('{driver_name}')) {
      newErrors.initial_message = 'Initial message must include {driver_name} placeholder'
    }

    if (!formData.voice_settings.voice_id) {
      newErrors['voice_settings.voice_id'] = 'Voice selection is required'
    }

    if (formData.voice_settings.backchannel_words.length === 0 && formData.voice_settings.enable_backchannel) {
      newErrors['voice_settings.backchannel_words'] = 'At least one backchannel word is required when backchannel is enabled'
    }

    if (formData.voice_settings.reminder_trigger_ms < 5000) {
      newErrors['voice_settings.reminder_trigger_ms'] = 'Reminder trigger must be at least 5000ms'
    }

    if (formData.voice_settings.reminder_max_count < 1) {
      newErrors['voice_settings.reminder_max_count'] = 'Max reminders must be at least 1'
    }

    if (formData.voice_settings.end_call_after_silence_ms < 5000) {
      newErrors['voice_settings.end_call_after_silence_ms'] = 'End call after silence must be at least 5000ms'
    }

    if (formData.voice_settings.max_call_duration_ms < 60000) {
      newErrors['voice_settings.max_call_duration_ms'] = 'Max call duration must be at least 60000ms'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please fix the errors below')
      return
    }

    setLoading(true)

    try {
      if (isEditing) {
        await api.put(`/configurations/${id}`, formData)
        toast.success('Configuration updated successfully')
      } else {
        await api.post('/configurations', formData)
        toast.success('Configuration created successfully')
      }
      setHasUnsavedChanges(false)
      navigate('/configurations')
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 
        (isEditing ? 'Failed to update configuration' : 'Failed to create configuration')
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    if (name.includes('voice_settings.')) {
      const voiceSetting = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        voice_settings: {
          ...prev.voice_settings,
          [voiceSetting]: type === 'checkbox' ? checked :
                         voiceSetting === 'responsiveness' || voiceSetting === 'interruption_sensitivity' || voiceSetting === 'backchannel_frequency' ? parseFloat(value) || 0 :
                         voiceSetting === 'backchannel_words' ? value.split(',').map(w => w.trim()).filter(w => w) :
                         voiceSetting === 'reminder_trigger_ms' || voiceSetting === 'reminder_max_count' || voiceSetting === 'end_call_after_silence_ms' || voiceSetting === 'max_call_duration_ms' ? parseInt(value) || 0 :
                         value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }))
    }
    
    setHasUnsavedChanges(true)
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }))
    }
  }

  const loadPreset = () => {
    setFormData(prev => ({
      ...prev,
      name: presetPrompt.name,
      system_prompt: presetPrompt.system_prompt,
      initial_message: presetPrompt.initial_message
    }))
    setHasUnsavedChanges(true)
    toast.success('Preset loaded')
  }

  const resetForm = () => {
    if (isEditing) {
      fetchConfiguration()
    } else {
      setFormData({
        name: '',
        system_prompt: '',
        initial_message: '',
        voice_settings: {
          voice_id: '11labs-Adrian',
          responsiveness: 1.0,
          interruption_sensitivity: 1.0,
          enable_backchannel: true,
          backchannel_frequency: 0.8,
          backchannel_words: ['yeah', 'uh-huh', 'okay', 'got it', 'I see'],
          reminder_trigger_ms: 10000,
          reminder_max_count: 2,
          normalize_for_speech: true,
          end_call_after_silence_ms: 10000,
          max_call_duration_ms: 600000
        }
      })
    }
    setErrors({})
    setHasUnsavedChanges(false)
    toast.success('Form reset')
  }

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?')
                if (!confirmed) return
              }
              navigate('/configurations')
            }}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Configurations
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isEditing ? 'Edit Configuration' : 'New Configuration'}
              </h1>
              <p className="text-gray-600 mt-2">
                {isEditing ? 'Update your agent configuration settings' : 'Create a new AI voice agent configuration'}
              </p>
            </div>
            {hasUnsavedChanges && (
              <div className="flex items-center text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <span className="text-sm">Unsaved changes</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Driver Dispatch Agent"
                  required
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>
            </div>
          </div>

          {/* Agent Behavior */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Agent Behavior</h2>
              <button
                type="button"
                onClick={loadPreset}
                className="flex items-center text-blue-600 hover:text-blue-500 text-sm transition-colors"
              >
                <Info className="h-4 w-4 mr-1" />
                Load Default Preset
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Prompt <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="system_prompt"
                  value={formData.system_prompt}
                  onChange={handleChange}
                  rows={12}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                    errors.system_prompt ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Define how the agent should behave, including routine check-ins and emergency handling..."
                  required
                />
                {errors.system_prompt && (
                  <p className="mt-1 text-sm text-red-600">{errors.system_prompt}</p>
                )}
                <div className="mt-2 flex items-start space-x-4 text-xs text-gray-500">
                  <div>Characters: {formData.system_prompt.length}</div>
                  <div>
                    <strong>Tips:</strong> Be specific about conversation flow, emergency detection (e.g., accident, breakdown, medical), and when to end calls
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="initial_message"
                  value={formData.initial_message}
                  onChange={handleChange}
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.initial_message ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Hi {driver_name}, this is dispatch calling about load {load_number}..."
                  required
                />
                {errors.initial_message && (
                  <p className="mt-1 text-sm text-red-600">{errors.initial_message}</p>
                )}
                <div className="mt-2 text-xs text-gray-500">
                  <div className="mb-1">
                    <strong>Available placeholders:</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><code className="bg-gray-100 px-1 rounded">{'{driver_name}'}</code> - Driver's name</div>
                    <div><code className="bg-gray-100 px-1 rounded">{'{load_number}'}</code> - Load reference</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Voice Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Voice Settings</h2>
            
            <div className="space-y-6">
              {/* Voice Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice Selection <span className="text-red-500">*</span>
                </label>
                <select
                  name="voice_settings.voice_id"
                  value={formData.voice_settings.voice_id}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors['voice_settings.voice_id'] ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  {voiceOptions.map((voice) => (
                    <option key={voice.value} value={voice.value}>
                      {voice.label}
                    </option>
                  ))}
                </select>
                {errors['voice_settings.voice_id'] && (
                  <p className="mt-1 text-sm text-red-600">{errors['voice_settings.voice_id']}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {voiceOptions.find(v => v.value === formData.voice_settings.voice_id)?.description}
                </p>
              </div>

              {/* Voice Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Responsiveness: {Number(formData.voice_settings.responsiveness).toFixed(1)}
                  </label>
                  <input
                    type="range"
                    name="voice_settings.responsiveness"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.voice_settings.responsiveness}
                    onChange={handleChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Slow & Deliberate</span>
                    <span>Quick & Snappy</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interruption Sensitivity: {Number(formData.voice_settings.interruption_sensitivity).toFixed(1)}
                  </label>
                  <input
                    type="range"
                    name="voice_settings.interruption_sensitivity"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.voice_settings.interruption_sensitivity}
                    onChange={handleChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Hard to Interrupt</span>
                    <span>Easily Interrupted</span>
                  </div>
                </div>
              </div>

              {/* Backchannel Settings */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enable_backchannel"
                    name="voice_settings.enable_backchannel"
                    checked={formData.voice_settings.enable_backchannel}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="enable_backchannel" className="ml-2 text-sm text-gray-700">
                    Enable backchannel responses (uh-huh, okay, I see)
                  </label>
                </div>
                
                {formData.voice_settings.enable_backchannel && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Backchannel Frequency: {Number(formData.voice_settings.backchannel_frequency).toFixed(1)}
                      </label>
                      <input
                        type="range"
                        name="voice_settings.backchannel_frequency"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.voice_settings.backchannel_frequency}
                        onChange={handleChange}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Rare</span>
                        <span>Frequent</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Backchannel Words <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="voice_settings.backchannel_words"
                        value={formData.voice_settings.backchannel_words.join(', ')}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors['voice_settings.backchannel_words'] ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="e.g., yeah, uh-huh, okay, got it, I see"
                      />
                      {errors['voice_settings.backchannel_words'] && (
                        <p className="mt-1 text-sm text-red-600">{errors['voice_settings.backchannel_words']}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Enter comma-separated words or phrases for backchannel responses
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Call Management Settings */}
              <div className="space-y-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="normalize_for_speech"
                    name="voice_settings.normalize_for_speech"
                    checked={formData.voice_settings.normalize_for_speech}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="normalize_for_speech" className="ml-2 text-sm text-gray-700">
                    Normalize text for speech (improves pronunciation)
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reminder Trigger (ms) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="voice_settings.reminder_trigger_ms"
                    value={formData.voice_settings.reminder_trigger_ms}
                    onChange={handleChange}
                    min="5000"
                    step="1000"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors['voice_settings.reminder_trigger_ms'] ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="10000"
                  />
                  {errors['voice_settings.reminder_trigger_ms'] && (
                    <p className="mt-1 text-sm text-red-600">{errors['voice_settings.reminder_trigger_ms']}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Time before reminding user if no response (minimum 5000ms)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Reminder Count <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="voice_settings.reminder_max_count"
                    value={formData.voice_settings.reminder_max_count}
                    onChange={handleChange}
                    min="1"
                    step="1"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors['voice_settings.reminder_max_count'] ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="2"
                  />
                  {errors['voice_settings.reminder_max_count'] && (
                    <p className="mt-1 text-sm text-red-600">{errors['voice_settings.reminder_max_count']}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum number of reminders before ending call
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Call After Silence (ms) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="voice_settings.end_call_after_silence_ms"
                    value={formData.voice_settings.end_call_after_silence_ms}
                    onChange={handleChange}
                    min="5000"
                    step="1000"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors['voice_settings.end_call_after_silence_ms'] ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="10000"
                  />
                  {errors['voice_settings.end_call_after_silence_ms'] && (
                    <p className="mt-1 text-sm text-red-600">{errors['voice_settings.end_call_after_silence_ms']}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    End call after this duration of silence (minimum 5000ms)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Call Duration (ms) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="voice_settings.max_call_duration_ms"
                    value={formData.voice_settings.max_call_duration_ms}
                    onChange={handleChange}
                    min="60000"
                    step="1000"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors['voice_settings.max_call_duration_ms'] ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="600000"
                  />
                  {errors['voice_settings.max_call_duration_ms'] && (
                    <p className="mt-1 text-sm text-red-600">{errors['voice_settings.max_call_duration_ms']}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum call duration before automatic termination (minimum 60000ms)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {hasUnsavedChanges ? 'You have unsaved changes' : 'All changes saved'}
            </div>
            
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => {
                  if (hasUnsavedChanges) {
                    const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?')
                    if (!confirmed) return
                  }
                  navigate('/configurations')
                }}
                className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || Object.keys(errors).length > 0}
                className="flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isEditing ? 'Update Configuration' : 'Create Configuration'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        <style jsx>{`
          input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          
          input[type=range]::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

export default ConfigurationEditor