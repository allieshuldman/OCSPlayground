import { useState, useEffect, useCallback, useMemo } from 'react'
import { graphConfig } from './authConfig'
import JsonView from '@uiw/react-json-view'
import { fetchMessageDetails, parseErrorResponse as parseErrorResponseUtil } from './messageUtils'
import './Playground.css'

// Helper function to auto-resize a textarea element to fit content
const autoResizeTextarea = (textarea) => {
  if (textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    // Set height to scrollHeight, but minimum 1 line
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20
    const paddingTop = parseInt(getComputedStyle(textarea).paddingTop) || 0
    const paddingBottom = parseInt(getComputedStyle(textarea).paddingBottom) || 0
    const minHeight = lineHeight + paddingTop + paddingBottom
    textarea.style.height = Math.max(minHeight, textarea.scrollHeight) + 'px'
  }
}

// Helper function to auto-resize a textarea element with a maximum of 10 lines
const autoResizeTextareaMaxLines = (textarea, maxLines = 10) => {
  if (textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    // Set height to scrollHeight, but minimum 1 line and maximum maxLines
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20
    const paddingTop = parseInt(getComputedStyle(textarea).paddingTop) || 0
    const paddingBottom = parseInt(getComputedStyle(textarea).paddingBottom) || 0
    const minHeight = lineHeight + paddingTop + paddingBottom
    const maxHeight = (lineHeight * maxLines) + paddingTop + paddingBottom
    const calculatedHeight = Math.max(minHeight, textarea.scrollHeight)
    textarea.style.height = Math.min(calculatedHeight, maxHeight) + 'px'
    // Ensure overflow is set for scrolling when content exceeds max height
    if (textarea.scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto'
    } else {
      textarea.style.overflowY = 'hidden'
    }
  }
}

function Playground({ bearerToken, ocsToken, dashboardProfile, dashboardFavorites, onOcsTokenError }) {
  const [showTemplate, setShowTemplate] = useState(true)
  const [showOutput, setShowOutput] = useState(true)
  const [showCallOCS, setShowCallOCS] = useState(true)
  const [experimentApiResponse, setExperimentApiResponse] = useState(() => {
    // Load saved output from localStorage if available
    try {
      const saved = localStorage.getItem('playgroundApiResponse')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [experimentApiLoading, setExperimentApiLoading] = useState(false)
  const [experimentApiError, setExperimentApiError] = useState(null)
  const [copiedCurl, setCopiedCurl] = useState(false)
  const [conditionFlags, setConditionFlags] = useState([])
  const [parametersValues, setParametersValues] = useState({})
  const [customScenarioTag, setCustomScenarioTag] = useState('OCSPlayground')
  const [objectKey, setObjectKey] = useState('ConversationId')
  const [objectValue, setObjectValue] = useState('')
  const [model, setModel] = useState('')
  const [stopSequences, setStopSequences] = useState([])
  const [templates, setTemplates] = useState(() => {
    try {
      const stored = localStorage.getItem('playgroundTemplates')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })
  const [selectedTemplateName, setSelectedTemplateName] = useState('')
  const [templateText, setTemplateText] = useState('')
  const [subTemplates, setSubTemplates] = useState(() => {
    try {
      const stored = localStorage.getItem('playgroundSubTemplates')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })
  const [selectedSubTemplateName, setSelectedSubTemplateName] = useState('')
  const [subTemplateName, setSubTemplateName] = useState('')
  const [subTemplateSortOrder, setSubTemplateSortOrder] = useState('Asc')
  const [subTemplateInputType, setSubTemplateInputType] = useState('Conversation')
  const [subTemplateSegments, setSubTemplateSegments] = useState('')
  const [subTemplateConditions, setSubTemplateConditions] = useState([])
  const [isAddingTemplateManually, setIsAddingTemplateManually] = useState(false)
  const [favoriteMessages, setFavoriteMessages] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [isFetchingFavorites, setIsFetchingFavorites] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState(null)
  const [placeholderValues, setPlaceholderValues] = useState({})
  const [usedMessage, setUsedMessage] = useState(null)
  const [usedMessageDetails, setUsedMessageDetails] = useState(null)
  const [usedMessageDetailsLoading, setUsedMessageDetailsLoading] = useState(false)
  const [usedMessageDetailsError, setUsedMessageDetailsError] = useState(null)
  const [showUsedMessageDetails, setShowUsedMessageDetails] = useState(false)
  const [showTemplateConstants, setShowTemplateConstants] = useState(false)
  const [showSavedTemplates, setShowSavedTemplates] = useState(false)
  const [showManualSubTemplateInput, setShowManualSubTemplateInput] = useState(false)
  const [manualSubTemplateName, setManualSubTemplateName] = useState('')
  const [manualSubTemplateSortOrder, setManualSubTemplateSortOrder] = useState('Asc')
  const [manualSubTemplateInputType, setManualSubTemplateInputType] = useState('Conversation')
  const [manualSubTemplateSegments, setManualSubTemplateSegments] = useState('')
  const [manualSubTemplateConditions, setManualSubTemplateConditions] = useState([])
  const [showSavedSubTemplates, setShowSavedSubTemplates] = useState(false)
  const [showSavePopup, setShowSavePopup] = useState(false)
  const [saveRunName, setSaveRunName] = useState('')
  
  // Load favorite message IDs from localStorage
  const getFavoriteIds = () => {
    try {
      const stored = localStorage.getItem('favoriteMessageIds')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }
  
  const fetchFavoriteMessages = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isFetchingFavorites) return
    
    const favoriteIds = getFavoriteIds()
    if (favoriteIds.length === 0) {
      setFavoriteMessages([])
      return
    }

    if (!bearerToken) return

    setIsFetchingFavorites(true)
    setFavoritesLoading(true)

    try {
      // Fetch all favorite messages in parallel with timeout
      const messagePromises = favoriteIds.map(async (messageId) => {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
          
          const encodedMessageId = encodeURIComponent(messageId)
          const response = await fetch(
            `${graphConfig.graphMeMailEndpoint}/${encodedMessageId}?$select=id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments,conversationId`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${bearerToken}`,
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
            }
          )
          clearTimeout(timeoutId)
          
          if (response.ok) {
            return await response.json()
          }
          return null
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Error fetching favorite message:', err)
          }
          return null
        }
      })

      const messages = await Promise.all(messagePromises)
      // Filter out null values and sort by receivedDateTime desc
      const validMessages = messages
        .filter(msg => msg !== null)
        .sort((a, b) => {
          const dateA = new Date(a.receivedDateTime || 0)
          const dateB = new Date(b.receivedDateTime || 0)
          return dateB - dateA
        })
      
      setFavoriteMessages(validMessages)
    } catch (err) {
      console.error('Error fetching favorite messages:', err)
    } finally {
      setFavoritesLoading(false)
      setIsFetchingFavorites(false)
    }
  }, [bearerToken, isFetchingFavorites])

  useEffect(() => {
    if (bearerToken && ocsToken) {
      fetchFavoriteMessages()
    }
  }, [bearerToken, ocsToken])

  // Listen for storage changes to refresh favorites
  useEffect(() => {
    if (!bearerToken || !ocsToken) return
    
    const handleStorageChange = () => {
      fetchFavoriteMessages()
    }
    
    window.addEventListener('storage', handleStorageChange)
    // Also check periodically for localStorage changes (since storage event only fires in other tabs)
    // Only check if favorites might have changed (check favorite IDs, not fetch every time)
    const interval = setInterval(() => {
      const currentFavoriteIds = getFavoriteIds()
      const currentIdsString = JSON.stringify(currentFavoriteIds.sort())
      const lastIdsString = localStorage.getItem('lastFavoriteIdsString')
      
      // Only fetch if the favorite IDs have actually changed
      if (currentIdsString !== lastIdsString) {
        localStorage.setItem('lastFavoriteIdsString', currentIdsString)
        fetchFavoriteMessages()
      }
    }, 5000) // Increased interval to 5 seconds to reduce unnecessary checks
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [bearerToken, ocsToken, fetchFavoriteMessages])

  const copyIdsToClipboard = async (messageId, conversationId, e) => {
    e.stopPropagation()
    
    const jsonData = {
      conversationId: conversationId || null,
      messageId: messageId || null
    }
    
    const jsonString = JSON.stringify(jsonData, null, 2)
    
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopiedMessageId(messageId)
      setTimeout(() => {
        setCopiedMessageId(null)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      return 'Today'
    } else if (diffDays === 2) {
      return 'Yesterday'
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      })
    }
  }

  // Helper function to check if a value is a JSON object or parseable JSON string
  const isJsonValue = (value) => {
    if (value === null || value === undefined) return false
    // If it's already an object (but not null), it's JSON
    if (typeof value === 'object' && !Array.isArray(value) && value.constructor === Object) {
      return true
    }
    // If it's an array, it's JSON
    if (Array.isArray(value)) {
      return true
    }
    // If it's a string, try to parse it as JSON
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          JSON.parse(value)
          return true
        } catch {
          return false
        }
      }
    }
    return false
  }

  // Helper function to get the JSON object from a value (parse if string, return if object)
  const getJsonValue = (value) => {
    if (typeof value === 'object') {
      return value
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }
    return value
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const fetchUsedMessageDetails = async (messageId) => {
    if (!bearerToken || !messageId || usedMessageDetailsLoading) return

    setUsedMessageDetailsLoading(true)
    setUsedMessageDetailsError(null)

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 30000) // 30-second timeout

    try {
      const emailData = await fetchMessageDetails(bearerToken, messageId, abortController.signal)
      clearTimeout(timeoutId)
      setUsedMessageDetails(emailData)
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        setUsedMessageDetailsError('Request timed out. Please try again.')
      } else {
        console.error('Error fetching used message details:', err)
        setUsedMessageDetailsError(err.message || 'Failed to fetch message details. Please try again.')
      }
    } finally {
      setUsedMessageDetailsLoading(false)
    }
  }

  const handleUseMessage = (message, e) => {
    e.stopPropagation() // Prevent any parent click handlers
    
    // If clicking the same message that's already in use, reset it
    if (usedMessage?.id === message.id) {
      handleClearUsedMessage()
      return
    }
    
    setUsedMessage(message)
    setUsedMessageDetails(null)
    setUsedMessageDetailsError(null)
    fetchUsedMessageDetails(message.id)
    
    // Auto-populate Object field with ConversationId if message has conversationId
    if (message.conversationId) {
      setObjectKey('ConversationId')
      setObjectValue(message.conversationId)
    }
  }

  // Auto-populate Object field when usedMessageDetails is loaded (in case conversationId comes from details)
  useEffect(() => {
    if (usedMessageDetails?.conversationId && usedMessage) {
      setObjectKey('ConversationId')
      setObjectValue(usedMessageDetails.conversationId)
    }
  }, [usedMessageDetails, usedMessage])

  const handleClearUsedMessage = () => {
    setUsedMessage(null)
    setUsedMessageDetails(null)
    setUsedMessageDetailsError(null)
    setPlaceholderValues({}) // Clear all placeholder values (both regular and SubTemplate placeholders) when resetting used message
    setObjectValue('') // Clear the Object field value when resetting used message
  }

  // Extract text between {{{ }}}, ignoring those containing #message or /message
  const extractPlaceholders = (text) => {
    console.log(`text: ${text}`)
    const regex = /\{\{\{([^}]+)\}\}\}/g
    const matches = []
    let match
    
    while ((match = regex.exec(text)) !== null) {
      const placeholder = match[1].trim()
      // Ignore placeholders that contain #message or /message
      if (!placeholder.includes('#message') && !placeholder.includes('/message')) {
        matches.push(placeholder)
      }
    }
    
    return matches
  }

  const extractPlaceholdersFromSubTemplate = (text) => {
    console.log(`text: ${text}`)
    const regex = /\{\{([^}]+)\}\}/g
    const matches = []
    let match
    
    while ((match = regex.exec(text)) !== null) {
      const placeholder = match[1].trim()
      // Ignore placeholders that contain #message or /message
      if (!placeholder.includes('#message') && !placeholder.includes('/message')) {
        matches.push(placeholder)
      }
    }
    
    return matches
  }

  // Extract SubTemplate placeholders (format: {{{SubTemplates:Name}}})
  const extractSubTemplatePlaceholders = (text) => {
    const regex = /\{\{SubTemplates:([^}]+)\}\}/g
    const matches = []
    let match
    
    while ((match = regex.exec(text)) !== null) {
      const subTemplateName = match[1].trim()
      matches.push(subTemplateName)
    }
    
    return matches
  }

  // Regular placeholders (excluding SubTemplate references)
  const allPlaceholders = useMemo(() => extractPlaceholders(templateText), [templateText])
  const subTemplateRefs = useMemo(() => extractSubTemplatePlaceholders(templateText), [templateText])
  
  const placeholders = useMemo(() => {
    return allPlaceholders.filter(placeholder => !placeholder.startsWith('SubTemplates:'))
  }, [allPlaceholders])

  // Map of SubTemplate name to its extracted placeholders
  // Gets placeholders from the saved SubTemplates list (loaded from localStorage)
  const subTemplatePlaceholders = useMemo(() => {
    const subTemplatePlaceholdersMap = {}
    
    // Iterate through all SubTemplate references found in the template (e.g., {{{SubTemplates:EmailTemplate}}})
    subTemplateRefs.forEach(subTemplateName => {
      // Look up the SubTemplate in the saved SubTemplates list (from localStorage)
      const savedSubTemplate = subTemplates[subTemplateName]
      if (savedSubTemplate && savedSubTemplate.segments) {
        const segments = savedSubTemplate.segments
        // Extract placeholders from the SubTemplate's segments field
        if (segments && segments.trim()) {
          const extracted = extractPlaceholdersFromSubTemplate(segments)
          if (extracted.length > 0) {
            subTemplatePlaceholdersMap[subTemplateName] = extracted
          }
        }
      }
    })
    console.log(subTemplatePlaceholdersMap) 
    return subTemplatePlaceholdersMap
  }, [subTemplateRefs, subTemplates])
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // Helper function to find a case-insensitive property key in an object
  const findCaseInsensitiveKey = (obj, targetKey) => {
    if (!obj || typeof obj !== 'object') return null
    const lowerTarget = targetKey.toLowerCase()
    const keys = Object.keys(obj)
    return keys.find(key => key.toLowerCase() === lowerTarget) || null
  }

  // Function to resolve placeholder value from profile, used message, or favorite messages
  // All property matching is case-insensitive
  const resolvePlaceholderValue = useCallback((placeholder) => {
    const lowerPlaceholder = placeholder.toLowerCase()
    
    // Handle special placeholder cases
    // From: extract from.emailAddress.name from message
    if (lowerPlaceholder === 'from') {
      // Try from used message details first
      if (usedMessageDetails?.from?.emailAddress?.name) {
        console.log(`usedMessageDetails.from.emailAddress.name: ${usedMessageDetails.from.emailAddress.name}`)
        return usedMessageDetails.from.emailAddress.name
      }
      // Try from favorite messages
      if (dashboardFavorites && dashboardFavorites.length > 0) {
        const mostRecentMessage = dashboardFavorites[0]
        if (mostRecentMessage.from?.emailAddress?.name) {
          console.log(`mostRecentMessage.from.emailAddress.name: ${mostRecentMessage.from.emailAddress.name}`)
          return mostRecentMessage.from.emailAddress.name
        }
      }
      return ''
    }
    
    // FromEmail: extract from.emailAddress.address from message
    if (lowerPlaceholder === 'fromemail') {
      // Try from used message details first
      if (usedMessageDetails?.from?.emailAddress?.address) {
        console.log(`usedMessageDetails.from.emailAddress.address: ${usedMessageDetails.from.emailAddress.address}`)
        return usedMessageDetails.from.emailAddress.address
      }
      // Try from favorite messages
      if (dashboardFavorites && dashboardFavorites.length > 0) {
        const mostRecentMessage = dashboardFavorites[0]
        console.log(`mostRecentMessage: ${mostRecentMessage}`)
        if (mostRecentMessage.from?.emailAddress?.address) {
          return mostRecentMessage.from.emailAddress.address
        }
      }
      return ''
    }

    if (lowerPlaceholder === 'fromdetails' ||
        lowerPlaceholder === 'recipientdetails' ||
        lowerPlaceholder === 'ccrecipientdetails'
    ) {
      return `${lowerPlaceholder} will be generated on the service in the format:\n\nName1<user1@company.com>(Title: Engineer1)(Reports to: Manager1)`
    }
    
    // IsRecipientToCC: check if user's SMTP is in toRecipients or ccRecipients
    if (lowerPlaceholder === 'isrecipienttocc') {
      // Get user's SMTP from profile (try mail first, then userPrincipalName)
      let userSmtp = null
      if (dashboardProfile) {
        userSmtp = dashboardProfile.mail || dashboardProfile.userPrincipalName || null
      }
      
      if (!userSmtp) {
        console.log(`userSmtp: ${userSmtp}`)
        return 'No' // Can't determine without user SMTP
      }
      
      // Normalize SMTP to lowercase for comparison
      const normalizedUserSmtp = userSmtp.toLowerCase()
      
      // Check in used message details first
      if (usedMessageDetails) {
        // Check toRecipients
        if (usedMessageDetails.toRecipients && Array.isArray(usedMessageDetails.toRecipients)) {
          const inTo = usedMessageDetails.toRecipients.some(recipient => {
            const recipientEmail = recipient.emailAddress?.address?.toLowerCase()
            return recipientEmail === normalizedUserSmtp
          })
          console.log(`inTo: ${inTo}`)
          if (inTo) return 'Yes'
        }
        
        // Check ccRecipients
        if (usedMessageDetails.ccRecipients && Array.isArray(usedMessageDetails.ccRecipients)) {
          const inCc = usedMessageDetails.ccRecipients.some(recipient => {
            const recipientEmail = recipient.emailAddress?.address?.toLowerCase()
            return recipientEmail === normalizedUserSmtp
          })
          console.log(`inCc: ${inCc}`)
          if (inCc) return 'Yes'
        }
      }
      
      // Check in favorite messages
      if (dashboardFavorites && dashboardFavorites.length > 0) {
        const mostRecentMessage = dashboardFavorites[0]
        
        // Check toRecipients
        if (mostRecentMessage.toRecipients && Array.isArray(mostRecentMessage.toRecipients)) {
          const inTo = mostRecentMessage.toRecipients.some(recipient => {
            const recipientEmail = recipient.emailAddress?.address?.toLowerCase()
            return recipientEmail === normalizedUserSmtp
          })
          console.log(`inTo: ${inTo}`)
          if (inTo) return 'Yes'
        }
        
        // Check ccRecipients
        if (mostRecentMessage.ccRecipients && Array.isArray(mostRecentMessage.ccRecipients)) {
          const inCc = mostRecentMessage.ccRecipients.some(recipient => {
            const recipientEmail = recipient.emailAddress?.address?.toLowerCase()
            return recipientEmail === normalizedUserSmtp
          })
          console.log(`inCc: ${inCc}`)
          if (inCc) return 'Yes'
        }
      }
      console.log(`No`)
      return 'No'
    }
    
    // First, try to get from user profile
    if (dashboardProfile) {
      // Direct property access (e.g., officeLocation) - case insensitive
      const profileKey = findCaseInsensitiveKey(dashboardProfile, placeholder)
      if (profileKey && dashboardProfile[profileKey] !== undefined) {
        const value = dashboardProfile[profileKey]
        if (value !== null && value !== undefined) {
          return typeof value === 'object' ? JSON.stringify(value) : String(value)
        }
      }
      
      // Try nested property access (e.g., officeLocation from profile) - case insensitive
      const keys = placeholder.split('.')
      let current = dashboardProfile
      for (const key of keys) {
        if (current && typeof current === 'object') {
          const foundKey = findCaseInsensitiveKey(current, key)
          if (foundKey) {
            current = current[foundKey]
          } else {
            current = null
            break
          }
        } else {
          current = null
          break
        }
      }
      if (current !== null && current !== undefined) {
        return typeof current === 'object' ? JSON.stringify(current) : String(current)
      }
    }

    // Then, try to get from used message details (most specific)
    if (usedMessageDetails) {
      // Direct property access (e.g., uniqueBody, subject) - case insensitive
      const messageKey = findCaseInsensitiveKey(usedMessageDetails, placeholder)
      if (messageKey && usedMessageDetails[messageKey] !== undefined) {
        const value = usedMessageDetails[messageKey]
        if (value !== null && value !== undefined) {
          // Handle special cases for body content - case insensitive
          const lowerPlaceholder = placeholder.toLowerCase()
          if ((lowerPlaceholder === 'uniquebody' || lowerPlaceholder === 'body') && value.content) {
            return value.content
          }
          return typeof value === 'object' ? JSON.stringify(value) : String(value)
        }
      }
      
      // Try nested property access (e.g., from.emailAddress.address, uniqueBody.content) - case insensitive
      const keys = placeholder.split('.')
      let current = usedMessageDetails
      for (const key of keys) {
        if (current && typeof current === 'object') {
          const foundKey = findCaseInsensitiveKey(current, key)
          if (foundKey) {
            current = current[foundKey]
          } else {
            current = null
            break
          }
        } else {
          current = null
          break
        }
      }
      if (current !== null && current !== undefined) {
        // If we're accessing content from body/uniqueBody, return the HTML content directly
        const lastKey = keys[keys.length - 1].toLowerCase()
        if (lastKey === 'content' && typeof current === 'string') {
          return current
        }
        return typeof current === 'object' ? JSON.stringify(current) : String(current)
      }
    }

    // Finally, try to get from favorite messages (use most recent)
    if (dashboardFavorites && dashboardFavorites.length > 0) {
      const mostRecentMessage = dashboardFavorites[0]
      
      // Direct property access (e.g., subject, from) - case insensitive
      const favoriteKey = findCaseInsensitiveKey(mostRecentMessage, placeholder)
      if (favoriteKey && mostRecentMessage[favoriteKey] !== undefined) {
        const value = mostRecentMessage[favoriteKey]
        if (value !== null && value !== undefined) {
          return typeof value === 'object' ? JSON.stringify(value) : String(value)
        }
      }
      
      // Try nested property access (e.g., from.emailAddress.address) - case insensitive
      const keys = placeholder.split('.')
      let current = mostRecentMessage
      for (const key of keys) {
        if (current && typeof current === 'object') {
          const foundKey = findCaseInsensitiveKey(current, key)
          if (foundKey) {
            current = current[foundKey]
          } else {
            current = null
            break
          }
        } else {
          current = null
          break
        }
      }
      if (current !== null && current !== undefined) {
        return typeof current === 'object' ? JSON.stringify(current) : String(current)
      }
    }

    return ''
  }, [dashboardProfile, dashboardFavorites, usedMessageDetails])

  // Auto-resize all placeholder value textareas when values change (max 10 lines)
  useEffect(() => {
    const textareas = document.querySelectorAll('.placeholder-value-input')
    textareas.forEach(textarea => autoResizeTextareaMaxLines(textarea, 10))
  }, [placeholderValues])

  // Auto-populate placeholder values when placeholders, profile, favorites, or used message change
  useEffect(() => {
    const allPlaceholdersToResolve = [...placeholders]
    
    // Add SubTemplate placeholders with their full keys (SubTemplateName.placeholder)
    Object.entries(subTemplatePlaceholders).forEach(([subTemplateName, subPlaceholders]) => {
      subPlaceholders.forEach(placeholder => {
        allPlaceholdersToResolve.push(`${subTemplateName}.${placeholder}`)
      })
    })
    
    if (allPlaceholdersToResolve.length > 0 && (dashboardProfile || dashboardFavorites?.length > 0 || usedMessageDetails)) {
      setPlaceholderValues(prevValues => {
        const newValues = {}
        let hasChanges = false
        
        // Always recalculate all placeholder values to ensure they update when message changes
        allPlaceholdersToResolve.forEach(fullPlaceholder => {
          // Extract the actual placeholder name (remove SubTemplate prefix if present)
          const actualPlaceholder = fullPlaceholder.includes('.') 
            ? fullPlaceholder.split('.').slice(1).join('.')
            : fullPlaceholder
          const resolvedValue = resolvePlaceholderValue(actualPlaceholder)
          // Always set the value, even if it's empty, to ensure updates when message changes
          newValues[fullPlaceholder] = resolvedValue || ''
            if (resolvedValue) {
              hasChanges = true
          }
        })
        
        // Always return new values to ensure updates when dependencies change
        return newValues
      })
    }
  }, [placeholders, subTemplatePlaceholders, dashboardProfile, dashboardFavorites, usedMessageDetails, resolvePlaceholderValue])

  const saveTemplates = (newTemplates) => {
    try {
      localStorage.setItem('playgroundTemplates', JSON.stringify(newTemplates))
      setTemplates(newTemplates)
    } catch (err) {
      console.error('Error saving templates:', err)
    }
  }

  const handleTemplateUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target.result
      const fileName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
      
      const newTemplates = {
        ...templates,
        [fileName]: {
          content: content,
          conditionFlags: [],
          parametersValues: {}
        }
      }
      saveTemplates(newTemplates)
      setSelectedTemplateName(fileName)
      setTemplateText(content)
      setConditionFlags([])
      setParametersValues({})
      
      // Reset file input
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const handleStartManualTemplate = () => {
    setIsAddingTemplateManually(true)
    setSelectedTemplateName('')
    setTemplateText('')
    setConditionFlags([])
    setParametersValues({})
  }

  const handleManualSubTemplateSubmit = (e) => {
    e.preventDefault()
    
    if (!manualSubTemplateName.trim()) {
      alert('Please enter a subtemplate name')
      return
    }
    
    const subTemplateData = {
      name: manualSubTemplateName.trim(),
      sortOrder: manualSubTemplateSortOrder,
      inputType: manualSubTemplateInputType,
      segments: manualSubTemplateSegments.trim(),
      templateConditions: manualSubTemplateConditions
    }

    const newSubTemplates = {
      ...subTemplates,
      [manualSubTemplateName.trim()]: subTemplateData
    }
    saveSubTemplates(newSubTemplates)
    setSelectedSubTemplateName(manualSubTemplateName.trim())
    setSubTemplateName(subTemplateData.name)
    setSubTemplateSortOrder(subTemplateData.sortOrder)
    setSubTemplateInputType(subTemplateData.inputType)
    setSubTemplateSegments(subTemplateData.segments)
    setSubTemplateConditions(subTemplateData.templateConditions || [])
    setManualSubTemplateName('')
    setManualSubTemplateSortOrder('Asc')
    setManualSubTemplateInputType('Conversation')
    setManualSubTemplateSegments('')
    setManualSubTemplateConditions([])
    setShowManualSubTemplateInput(false)
  }

  const handleTemplateSelect = (e) => {
    const templateName = e.target.value
    setSelectedTemplateName(templateName)
    if (templateName && templates[templateName]) {
      const template = templates[templateName]
      setTemplateText(template.content || '')
      setConditionFlags(template.conditionFlags || [])
      setParametersValues(template.parametersValues || {})
    } else {
      setTemplateText('')
      setConditionFlags([])
      setParametersValues({})
    }
  }

  const handleSaveTemplateChanges = () => {
    // Get template name from the name input field
    const templateNameInput = document.querySelector('.selected-template-name-input')
    const templateName = templateNameInput ? templateNameInput.value.trim() : selectedTemplateName

    if (!templateName) {
      alert('Please enter a template name')
      return
    }

    if (!templateText.trim()) {
      alert('Template content cannot be empty')
      return
    }

    const updatedTemplates = {
      ...templates,
      [templateName]: {
        content: templateText.trim(),
        conditionFlags: conditionFlags,
        parametersValues: parametersValues
      }
    }
    saveTemplates(updatedTemplates)
    
    // If we were adding manually, select the new template and exit manual mode
    if (isAddingTemplateManually) {
      setSelectedTemplateName(templateName)
      setIsAddingTemplateManually(false)
    }
    
    alert('Template saved successfully!')
  }

  const handleSaveSubTemplateChanges = () => {
    if (!selectedSubTemplateName) {
      alert('No subtemplate selected')
      return
    }

    const updatedSubTemplate = {
      name: subTemplateName.trim(),
      sortOrder: subTemplateSortOrder,
      inputType: subTemplateInputType,
      segments: subTemplateSegments.trim(),
      templateConditions: subTemplateConditions
    }

    // Validate name
    if (!updatedSubTemplate.name) {
      alert('SubTemplate name cannot be empty')
      return
    }

    // If name changed, update the key in templates object
    const newSubTemplates = { ...subTemplates }
    if (selectedSubTemplateName !== updatedSubTemplate.name) {
      // Name changed - remove old key and add new one
      delete newSubTemplates[selectedSubTemplateName]
      newSubTemplates[updatedSubTemplate.name] = updatedSubTemplate
      setSelectedSubTemplateName(updatedSubTemplate.name)
    } else {
      // Name unchanged - just update the template
      newSubTemplates[selectedSubTemplateName] = updatedSubTemplate
    }

    saveSubTemplates(newSubTemplates)
    alert('SubTemplate saved successfully!')
  }

  const handleDeleteTemplate = (templateName) => {
    if (confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
      const newTemplates = { ...templates }
      delete newTemplates[templateName]
      saveTemplates(newTemplates)
      
      if (selectedTemplateName === templateName) {
        setSelectedTemplateName('')
        setTemplateText('')
      }
    }
  }

  // SubTemplate functions (mirror of template functions)
  const saveSubTemplates = (newSubTemplates) => {
    try {
      localStorage.setItem('playgroundSubTemplates', JSON.stringify(newSubTemplates))
      setSubTemplates(newSubTemplates)
    } catch (err) {
      console.error('Error saving subtemplates:', err)
    }
  }

  const handleSubTemplateUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target.result)
        const fileName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
        
        const subTemplateData = {
          name: content.name || fileName,
          sortOrder: content.sortOrder || 'Asc',
          inputType: content.inputType || 'Conversation',
          segments: content.segments || '',
          templateConditions: content.templateConditions || []
        }
        
        const newSubTemplates = {
          ...subTemplates,
          [fileName]: subTemplateData
        }
        saveSubTemplates(newSubTemplates)
        setSelectedSubTemplateName(fileName)
        setSubTemplateName(subTemplateData.name)
        setSubTemplateSortOrder(subTemplateData.sortOrder)
        setSubTemplateInputType(subTemplateData.inputType)
        setSubTemplateSegments(subTemplateData.segments)
        setSubTemplateConditions(subTemplateData.templateConditions || [])
        
        // Reset file input
        e.target.value = ''
      } catch (err) {
        alert('Error parsing subtemplate file. Please ensure it is valid JSON.')
        console.error('Error parsing subtemplate:', err)
      }
    }
    reader.readAsText(file)
  }

  const handleSubTemplateSelect = (e) => {
    const subTemplateName = e.target.value
    setSelectedSubTemplateName(subTemplateName)
    if (subTemplateName && subTemplates[subTemplateName]) {
      const subTemplate = subTemplates[subTemplateName]
        // New format
        setSubTemplateName(subTemplate.name || subTemplateName)
        setSubTemplateSortOrder(subTemplate.sortOrder || 'Asc')
        setSubTemplateInputType(subTemplate.inputType || 'Conversation')
        setSubTemplateSegments(subTemplate.segments || '')
        setSubTemplateConditions(subTemplate.templateConditions || [])
      
    } else {
      setSubTemplateName('')
      setSubTemplateSortOrder('Asc')
      setSubTemplateInputType('Conversation')
      setSubTemplateSegments('')
    }
  }

  const handleDeleteSubTemplate = (subTemplateName) => {
    if (confirm(`Are you sure you want to delete the subtemplate "${subTemplateName}"?`)) {
      const newSubTemplates = { ...subTemplates }
      delete newSubTemplates[subTemplateName]
      saveSubTemplates(newSubTemplates)
      
      if (selectedSubTemplateName === subTemplateName) {
        setSelectedSubTemplateName('')
        setSubTemplateName('')
        setSubTemplateSortOrder('Asc')
        setSubTemplateInputType('Conversation')
        setSubTemplateSegments('')
        setSubTemplateConditions([])
      }
    }
  }

  const handleSubTemplateFieldChange = (field, value) => {
    if (!selectedSubTemplateName) return

    const updatedSubTemplate = {
      ...(subTemplates[selectedSubTemplateName] || {}),
      [field]: value
    }

    const newSubTemplates = {
      ...subTemplates,
      [selectedSubTemplateName]: updatedSubTemplate
    }
    saveSubTemplates(newSubTemplates)

    // Update local state
    if (field === 'name') setSubTemplateName(value)
    else if (field === 'sortOrder') setSubTemplateSortOrder(value)
    else if (field === 'inputType') setSubTemplateInputType(value)
    else if (field === 'segments') setSubTemplateSegments(value)
    else if (field === 'templateConditions') setSubTemplateConditions(value)
  }

  const handleAddTemplateCondition = () => {
    const newCondition = { name: 'MinMessageBodyLength', value: '' }
    const updatedConditions = [...subTemplateConditions, newCondition]
    handleSubTemplateFieldChange('templateConditions', updatedConditions)
  }

  const handleUpdateTemplateCondition = (index, field, value) => {
    const updatedConditions = [...subTemplateConditions]
    updatedConditions[index] = {
      ...updatedConditions[index],
      [field]: value
    }
    handleSubTemplateFieldChange('templateConditions', updatedConditions)
  }

  const handleRemoveTemplateCondition = (index) => {
    const updatedConditions = subTemplateConditions.filter((_, i) => i !== index)
    handleSubTemplateFieldChange('templateConditions', updatedConditions)
  }

  const handleAddManualTemplateCondition = () => {
    const newCondition = { name: 'MinMessageBodyLength', value: '' }
    setManualSubTemplateConditions([...manualSubTemplateConditions, newCondition])
  }

  const handleUpdateManualTemplateCondition = (index, field, value) => {
    const updatedConditions = [...manualSubTemplateConditions]
    updatedConditions[index] = {
      ...updatedConditions[index],
      [field]: value
    }
    setManualSubTemplateConditions(updatedConditions)
  }

  const handleRemoveManualTemplateCondition = (index) => {
    const updatedConditions = manualSubTemplateConditions.filter((_, i) => i !== index)
    setManualSubTemplateConditions(updatedConditions)
  }


  // Helper function to build the request body (reused for cURL generation)
  const buildExperimentRequestBody = useCallback(() => {
    // Helper function to remove empty fields from an object
    const removeEmptyFields = (obj) => {
      if (obj === null || obj === undefined) {
        return undefined
      }
      
      if (Array.isArray(obj)) {
        const filtered = obj.filter(item => {
          if (item === null || item === undefined) return false
          if (typeof item === 'string' && item.trim() === '') return false
          if (Array.isArray(item) && item.length === 0) return false
          if (typeof item === 'object' && Object.keys(item).length === 0) return false
          return true
        })
        return filtered.length > 0 ? filtered : undefined
      }
      
      if (typeof obj === 'object') {
        const cleaned = {}
        for (const [key, value] of Object.entries(obj)) {
          // Always include CustomScenarioTag (required field)
          if (key === 'CustomScenarioTag') {
            cleaned[key] = value || 'OCSPlayground'
            continue
          }
          
          if (value === null || value === undefined) continue
          if (typeof value === 'string' && value.trim() === '') continue
          if (Array.isArray(value) && value.length === 0) continue
          if (typeof value === 'object' && !Array.isArray(value)) {
            const cleanedValue = removeEmptyFields(value)
            if (cleanedValue !== undefined && Object.keys(cleanedValue).length > 0) {
              cleaned[key] = cleanedValue
            }
          } else {
            cleaned[key] = value
          }
        }
        return Object.keys(cleaned).length > 0 ? cleaned : undefined
      }
      
      return obj
    }

    // Create segments array from template textbox - each line becomes an element with newline
    // Always use current state values (which may have been edited)
    const segments = templateText
      .split('\n')
      .map(line => line + '\n')

    const stopSeqs = stopSequences.map(s => s.trim()).filter(Boolean)

    // Build request body with all fields
    const rawRequestBody = {
      CustomScenarioTag: customScenarioTag || 'OCSPlayground', // Required field with default
      Template: {
        Segments: segments,
        SubTemplates: Object.keys(subTemplates).map((name) => ({
          Name: subTemplates[name].name || name,
          SortOrder: subTemplates[name].sortOrder || "Asc",
          Segments: (subTemplates[name].segments || "")
            .split('\n')
            .map(line => line + '\n'),
        })),
        ConditionFlags: conditionFlags,
        ParametersValues: parametersValues,
      },
      modelConfiguration: {
        ...(model?.trim() ? { model: model.trim() } : {}),
        ...(stopSeqs.length > 0 ? { stopSequences: stopSeqs } : {}),
      },
      ...(objectKey === "ConversationId" && objectValue
        ? { ConversationId: objectValue }
        : objectKey === "MessageId" && objectValue
        ? { MessageId: objectValue }
        : objectKey === "FolderId" && objectValue
        ? { FolderId: objectValue }
        : {}),
    }

    // Remove empty fields from the request body
    return removeEmptyFields(rawRequestBody)
  }, [templateText, subTemplates, conditionFlags, parametersValues, customScenarioTag, model, stopSequences, objectKey, objectValue])

  const handleCallExperimentAPIClicked = async () => {
    if (!ocsToken) {
      setExperimentApiError('OCS Bearer token is required')
      return
    }

    setExperimentApiLoading(true)
    setExperimentApiError(null)
    setExperimentApiResponse(null)
    // Clear saved output from localStorage when a new API call begins
    localStorage.removeItem('playgroundApiResponse')

    try {
      const experimentRequestBody = buildExperimentRequestBody()
      console.log('Experiment API request body:', experimentRequestBody)

      // In Electron, CORS is bypassed via webSecurity: false
      // This fetch call will work without CORS restrictions
      const apiUrl = 'https://outlook-sdf.office.com/outlookcopilot/mailIntelligence/v2.0/experiment'
      console.log('Calling Experiment API:', apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ocsToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(experimentRequestBody),
        // In Electron, mode: 'no-cors' is not needed since webSecurity is disabled
        // but we can explicitly set it for clarity
        mode: 'cors', // Will be bypassed by Electron's webSecurity: false
      })

      if (!response.ok) {
        const statusCode = response.status
        let errorBody = null
        let errorData = {}
        
        try {
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json()
            errorBody = JSON.stringify(errorData, null, 2)
          } else {
            errorBody = await response.text()
            errorData = { message: errorBody }
          }
        } catch (parseError) {
          // If we can't parse the response, use status text
          errorBody = response.statusText || 'Unable to parse error response'
          errorData = { message: errorBody }
        }
        
        // Clear token on authentication/authorization errors
        if (statusCode === 401 || statusCode === 403) {
          if (onOcsTokenError) {
            onOcsTokenError()
          }
        }
        
        // Create detailed error message with status code and response body
        const errorMessage = `HTTP ${statusCode}: ${errorData.error?.message || errorData.message || response.statusText || 'Unknown error'}\n\nResponse Body:\n${errorBody}`
        setExperimentApiError(errorMessage)
        return
      }

      const data = await response.json()
      setExperimentApiResponse(data)
      // Save to localStorage so it persists across page switches
      localStorage.setItem('playgroundApiResponse', JSON.stringify(data))
      console.log('Experiment API response:', data)
    } catch (err) {
      console.error('Error calling Experiment API:', err)
      // For network errors or other exceptions, show the error message
      setExperimentApiError(err.message || 'Failed to call Experiment API')
    } finally {
      setExperimentApiLoading(false)
    }
  }

  const handleCopyCurl = async () => {
    if (!ocsToken) {
      alert('OCS Bearer token is required')
      return
    }

    try {
      const experimentRequestBody = buildExperimentRequestBody()
      const apiUrl = 'https://outlook-sdf.office.com/outlookcopilot/mailIntelligence/v2.0/experiment'
      const bodyJson = JSON.stringify(experimentRequestBody, null, 2)
      
      // Build cURL command with proper JSON escaping
      // Use --data-raw for better JSON handling
      const curlCommand = `curl -X POST '${apiUrl}' \\\n` +
        `  -H 'Authorization: Bearer ${ocsToken}' \\\n` +
        `  -H 'Content-Type: application/json' \\\n` +
        `  --data-raw '${bodyJson.replace(/'/g, "'\\''")}'`

      await navigator.clipboard.writeText(curlCommand)
      setCopiedCurl(true)
      setTimeout(() => setCopiedCurl(false), 2000)
    } catch (err) {
      console.error('Error copying cURL:', err)
      alert('Failed to copy cURL command')
    }
  }

  const handleSaveClick = () => {
    // Set default name based on template name
    const defaultName = selectedTemplateName || 'Untitled Template'
    setSaveRunName(defaultName)
    setShowSavePopup(true)
  }

  const handleSaveConfirm = () => {
    if (!saveRunName.trim()) {
      alert('Please enter a name for this run')
      return
    }

    try {
      const experimentRequestBody = buildExperimentRequestBody()
      
      // Extract SubTemplate references from the template
      const usedSubTemplateRefs = extractSubTemplatePlaceholders(templateText)
      
      // Filter SubTemplates to only include those referenced in the template
      const usedSubTemplates = {}
      usedSubTemplateRefs.forEach(subTemplateName => {
        if (subTemplates[subTemplateName]) {
          usedSubTemplates[subTemplateName] = subTemplates[subTemplateName]
        }
      })
      
      // Build the save data structure
      const saveData = {
        timestamp: new Date().toISOString(),
        name: saveRunName.trim(),
        notes: '',
        template: {
          name: selectedTemplateName || 'Untitled Template',
          content: templateText,
          conditionFlags: conditionFlags,
          parametersValues: parametersValues,
        },
        subTemplates: usedSubTemplates,
        emailDetails: usedMessageDetails || null,
        experimentApiRequest: {
          url: 'https://outlook-sdf.office.com/outlookcopilot/mailIntelligence/v2.0/experiment',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer [REDACTED]',
            'Content-Type': 'application/json',
          },
          body: experimentRequestBody,
        },
        output: experimentApiResponse || null,
      }

      // Save to localStorage for Analysis tab
      try {
        const existingSaves = JSON.parse(localStorage.getItem('playgroundSaves') || '[]')
        existingSaves.push(saveData)
        // Keep only the last 100 saves to avoid localStorage size limits
        const savesToKeep = existingSaves.slice(-100)
        localStorage.setItem('playgroundSaves', JSON.stringify(savesToKeep))
        setShowSavePopup(false)
        setSaveRunName('')
      } catch (storageError) {
        console.error('Error saving to localStorage:', storageError)
        alert('Failed to save to localStorage')
      }
    } catch (err) {
      console.error('Error saving data:', err)
      alert('Failed to save data')
    }
  }

  const handleSaveCancel = () => {
    setShowSavePopup(false)
    setSaveRunName('')
  }

  const handleDownload = () => {
    try {
      const experimentRequestBody = buildExperimentRequestBody()
      
      // Extract SubTemplate references from the template
      const usedSubTemplateRefs = extractSubTemplatePlaceholders(templateText)
      
      // Filter SubTemplates to only include those referenced in the template
      const usedSubTemplates = {}
      usedSubTemplateRefs.forEach(subTemplateName => {
        if (subTemplates[subTemplateName]) {
          usedSubTemplates[subTemplateName] = subTemplates[subTemplateName]
        }
      })
      
      // Build the save data structure
      const saveData = {
        timestamp: new Date().toISOString(),
        notes: '',
        template: {
          name: selectedTemplateName || 'Untitled Template',
          content: templateText,
          conditionFlags: conditionFlags,
          parametersValues: parametersValues,
        },
        subTemplates: usedSubTemplates,
        emailDetails: usedMessageDetails || null,
        experimentApiRequest: {
          url: 'https://outlook-sdf.office.com/outlookcopilot/mailIntelligence/v2.0/experiment',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer [REDACTED]',
            'Content-Type': 'application/json',
          },
          body: experimentRequestBody,
        },
        output: experimentApiResponse || null,
      }

      // Create a JSON blob and download it
      const jsonString = JSON.stringify(saveData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `playground-save-${timestamp}.json`
      link.download = filename
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading data:', err)
      alert('Failed to download data')
    }
  }

  // Update template text when selected template changes
  useEffect(() => {
    if (selectedTemplateName && templates[selectedTemplateName]) {
      const template = templates[selectedTemplateName]
      setTemplateText(template.content || '')
      setConditionFlags(template.conditionFlags || [])
      setParametersValues(template.parametersValues || {})
    } else if (!selectedTemplateName) {
      setTemplateText('')
      setConditionFlags([])
      setParametersValues({})
    }
  }, [selectedTemplateName, templates])

  // Auto-resize output textboxes when response changes
  useEffect(() => {
    if (experimentApiResponse) {
      // Use requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const textareas = document.querySelectorAll('.output-field-textarea')
          textareas.forEach(textarea => autoResizeTextarea(textarea))
        })
      })
    }
  }, [experimentApiResponse])

  // Update subtemplate fields when selected subtemplate changes
  useEffect(() => {
    if (selectedSubTemplateName && subTemplates[selectedSubTemplateName]) {
      const subTemplate = subTemplates[selectedSubTemplateName]
      setSubTemplateName(subTemplate.name || selectedSubTemplateName)
      setSubTemplateSortOrder(subTemplate.sortOrder || 'Asc')
      setSubTemplateInputType(subTemplate.inputType || 'Conversation')
      setSubTemplateSegments(subTemplate.segments || '')
      setSubTemplateConditions(subTemplate.templateConditions || [])
    } else if (!selectedSubTemplateName) {
      setSubTemplateName('')
      setSubTemplateSortOrder('Asc')
      setSubTemplateInputType('Conversation')
      setSubTemplateSegments('')
      setSubTemplateConditions([])
    }
  }, [selectedSubTemplateName, subTemplates])

  return (
    <div className="playground-container">
      {!ocsToken ? (
        <div className="playground-card">
          <div className="no-token-message">
            <p>Please add an OCS Bearer token in the Auth page to access the template features.</p>
          </div>
        </div>
      ) : (
        <div className="playground-card">
        {ocsToken && (
          <>
            {/* Favorite Messages Section */}
            {bearerToken && favoriteMessages.length > 0 && (
              <div className="favorites-section">
                <div className="favorites-header">
                  <h3>⭐ Favorites</h3>
                </div>
                {favoritesLoading && (
                  <div className="loading-message">Loading favorites...</div>
                )}
                {!favoritesLoading && (
                  <div className="mail-list favorites-list">
                    {favoriteMessages.map((message) => {
                      const favoriteIds = getFavoriteIds()
                      const isFavorite = favoriteIds.includes(message.id)
                      const isUsed = usedMessage?.id === message.id
                      return (
                        <div 
                          key={message.id} 
                          className={`mail-item ${!message.isRead ? 'unread' : ''} favorite-item ${isUsed ? 'used' : ''}`}
                        >
                          <div className="mail-item-header">
                            <div className="mail-sender">
                              {message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'Unknown'}
                            </div>
                            <div className="mail-meta">
                              <button
                                className={`use-message-button ${isUsed ? 'used' : ''}`}
                                onClick={(e) => handleUseMessage(message, e)}
                                title={isUsed ? 'Click to reset used message' : 'Use this message'}
                              >
                                {isUsed ? '✓ In Use' : 'Use'}
                              </button>
                              <button
                                className="copy-button"
                                onClick={(e) => copyIdsToClipboard(message.id, message.conversationId, e)}
                                title="Copy conversationId and messageId"
                              >
                                {copiedMessageId === message.id ? '✓' : '📋'}
                              </button>
                              <span className="mail-date">{formatDate(message.receivedDateTime)}</span>
                              {message.hasAttachments && (
                                <span className="attachment-indicator" title="Has attachments">📎</span>
                              )}
                              {!message.isRead && <span className="unread-dot"></span>}
                            </div>
                          </div>
                          <div className="mail-subject">{message.subject || '(No Subject)'}</div>
                          {message.bodyPreview && (
                            <div className="mail-preview">{message.bodyPreview}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Used Message Details Section - Outside Favorites */}
            {usedMessage && (
              <div className="used-message-details-section">
                <div 
                  className="used-message-details-header"
                  onClick={() => setShowUsedMessageDetails(!showUsedMessageDetails)}
                >
                  <h3>Message Details for Selected Message</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="used-message-details-toggle">
                      {showUsedMessageDetails ? '▼' : '▶'}
                    </span>
                  <button 
                    className="clear-used-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleClearUsedMessage()
                      }}
                  >
                    Reset Used Message
                  </button>
                </div>
                </div>
                {showUsedMessageDetails && (
                  <div className="used-message-details-content">
                {usedMessageDetailsLoading && (
                  <div className="loading-message">Loading message details...</div>
                )}
                {usedMessageDetailsError && (
                  <div className="error-message">
                    {usedMessageDetailsError}
                  </div>
                )}
                {usedMessageDetails && (
                  <div className="used-message-data">
                    {Object.entries(usedMessageDetails).map(([key, value]) => {
                          console.log(`usedMessageDetails key: ${key} value: ${value}`)
                      // Skip body and uniqueBody as they're displayed separately
                      if (key === 'body' || key === 'uniqueBody') return null
                          
                          const isJson = isJsonValue(value)
                      
                      return (
                        <div key={key} className="used-message-item">
                          <div className="used-message-key">{key}</div>
                              <div className="used-message-value">
                                {isJson ? (
                                  <JsonView value={getJsonValue(value)} style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px' }} />
                                ) : (
                                  formatValue(value)
                                )}
                              </div>
                        </div>
                      )
                    })}
                    {usedMessageDetails.uniqueBody?.content && (
                      <div className="used-message-item used-message-body-item">
                        <div className="used-message-key">uniqueBody</div>
                        <div 
                          className="used-message-value used-message-body-content"
                          dangerouslySetInnerHTML={{ __html: usedMessageDetails.uniqueBody.content }}
                        />
                      </div>
                    )}
                    {!usedMessageDetails.uniqueBody?.content && usedMessageDetails.body?.content && (
                      <div className="used-message-item used-message-body-item">
                        <div className="used-message-key">body</div>
                        <div 
                          className="used-message-value used-message-body-content"
                          dangerouslySetInnerHTML={{ __html: usedMessageDetails.body.content }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
              </div>
            )}
            {/* Template Section - Collapsible */}
            <div className="template-collapsible-section">
              <div 
                className="template-collapsible-header"
                onClick={() => setShowTemplate(!showTemplate)}
              >
                <h3>Edit Templates</h3>
                <span className="template-collapsible-toggle">
                  {showTemplate ? '▼' : '▶'}
                </span>
              </div>
              {showTemplate && (
                <div className="template-collapsible-content">
          <div className="template-section">
            {/* Template Constants Section */}
            <div className="template-constants-section">
              <div 
                className="template-constants-header"
                onClick={() => setShowTemplateConstants(!showTemplateConstants)}
              >
                <h3>Template Constants</h3>
                <span className="template-constants-toggle">
                  {showTemplateConstants ? '▼' : '▶'}
                </span>
              </div>
              {showTemplateConstants && (
                <div className="template-constants-content">
                  <div className="template-constants-list">
                    <div className="template-constant-item">
                      <div className="template-constant-key">MessageId</div>
                      <div className="template-constant-value">The message Id</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">MessageIndex</div>
                      <div className="template-constant-value">Email message index in a list of messages</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">UserSmtp</div>
                      <div className="template-constant-value">Current user smtp address</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">Body</div>
                      <div className="template-constant-value">Email body</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">Subject</div>
                      <div className="template-constant-value">Email subject</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">ReceivingDateTime</div>
                      <div className="template-constant-value">Email receiving date time</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">From</div>
                      <div className="template-constant-value">Email From name</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">FromEmail</div>
                      <div className="template-constant-value">Email from address</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">ReceipientNames</div>
                      <div className="template-constant-value">Email recipients names</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">ReceipientSmpts</div>
                      <div className="template-constant-value">Email recipients smpt addresses</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">CcReceipientSmpts</div>
                      <div className="template-constant-value">Email CC recipient smpt addresses</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">FromDetails</div>
                      <div className="template-constant-value">Email From recipient details</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">RecipientDetails</div>
                      <div className="template-constant-value">Email To recipient details</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">CcRecipientDetails</div>
                      <div className="template-constant-value">Email CC recipient details</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">BodyPreview</div>
                      <div className="template-constant-value">Email body preview</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">IsRead</div>
                      <div className="template-constant-value">Is the email marked as read</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">Importance</div>
                      <div className="template-constant-value">Email importance key</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">IsRecipientToCc</div>
                      <div className="template-constant-value">Is the recipient in the to or cc list</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">ContentClassName</div>
                      <div className="template-constant-value">Email content class name</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">ItemClassName</div>
                      <div className="template-constant-value">Email item class name</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">ConversationMessageCount</div>
                      <div className="template-constant-value">Count of messages in current conversations</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">PriorityScore</div>
                      <div className="template-constant-value">Inbox prioritization score</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">PriorityReason</div>
                      <div className="template-constant-value">Inbox prioritization reason</div>
                    </div>
                    <div className="template-constant-item">
                      <div className="template-constant-key">PriorityHeadline</div>
                      <div className="template-constant-value">Inbox prioritization headline text</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            
            {/* SubTemplate Section */}
            <div className="subtemplate-section">
              <div className="subtemplate-section-header">
                <h2>SubTemplates</h2>
              </div>

              {/* SubTemplate Management */}
            <div className="template-management">
              <div className="template-controls">
                <label className="upload-template-button">
                  <input
                    type="file"
                    accept=".txt,.text"
                      onChange={handleSubTemplateUpload}
                    style={{ display: 'none' }}
                  />
                    Upload SubTemplate
                </label>
                <button
                  className="manual-template-button"
                    onClick={() => setShowManualSubTemplateInput(true)}
                >
                    Add SubTemplate Manually
                </button>
                </div>

                {/* Saved SubTemplates Section */}
                {Object.keys(subTemplates).length > 0 && (
                  <div className="saved-templates-section">
                    <div 
                      className="saved-templates-header"
                      onClick={() => setShowSavedSubTemplates(!showSavedSubTemplates)}
                    >
                      <h3>Remove Saved SubTemplates ({Object.keys(subTemplates).length})</h3>
                      <span className="saved-templates-toggle">
                        {showSavedSubTemplates ? '▼' : '▶'}
                      </span>
                    </div>
                    {showSavedSubTemplates && (
                      <div className="saved-templates-content">
                        <div className="template-list">
                          {Object.keys(subTemplates).map((name) => (
                            <div key={name} className="template-list-item">
                              <span className="template-list-name">{name}</span>
                              <button
                                className="template-list-delete-button"
                                onClick={() => handleDeleteSubTemplate(name)}
                                title={`Delete "${name}"`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        {Object.keys(subTemplates).length > 1 && (
                          <button
                            className="delete-all-templates-button"
                            onClick={() => {
                            if (confirm(`Are you sure you want to delete all ${Object.keys(subTemplates).length} subtemplate(s)?`)) {
                              saveSubTemplates({})
                              setSelectedSubTemplateName('')
                              setSubTemplateName('')
                              setSubTemplateSortOrder('Asc')
                              setSubTemplateInputType('Conversation')
                              setSubTemplateSegments('')
                            }
                            }}
                            title="Delete all subtemplates"
                          >
                            Delete All SubTemplates
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="template-select-controls">
                <select
                  className="template-selector"
                    value={selectedSubTemplateName}
                    onChange={handleSubTemplateSelect}
                >
                    <option value="">Select a subtemplate to view or edit...</option>
                    {Object.keys(subTemplates).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

                {showManualSubTemplateInput && (
                <div className="manual-template-input-section">
                    <h3>Add SubTemplate Manually</h3>
                    <form onSubmit={handleManualSubTemplateSubmit} className="manual-template-form">
                      <div className="subtemplate-input-group">
                        <label className="subtemplate-label">Name:</label>
                    <input
                      type="text"
                      className="template-name-input"
                          value={manualSubTemplateName}
                          onChange={(e) => setManualSubTemplateName(e.target.value)}
                          placeholder="SubTemplate name..."
                      required
                    />
                      </div>
                      <div className="subtemplate-input-group">
                        <label className="subtemplate-label">SortOrder:</label>
                        <select
                          className="subtemplate-select"
                          value={manualSubTemplateSortOrder}
                          onChange={(e) => setManualSubTemplateSortOrder(e.target.value)}
                        >
                          <option value="Asc">Asc</option>
                          <option value="Desc">Desc</option>
                        </select>
                      </div>
                      <div className="subtemplate-input-group">
                        <label className="subtemplate-label">InputType:</label>
                        <select
                          className="subtemplate-select"
                          value={manualSubTemplateInputType}
                          onChange={(e) => setManualSubTemplateInputType(e.target.value)}
                        >
                          <option value="Conversation">Conversation</option>
                          <option value="Folder">Folder</option>
                          <option value="CalendarEvent">CalendarEvent</option>
                        </select>
                      </div>
                      <div className="subtemplate-input-group">
                        <label className="subtemplate-label">Segments:</label>
                    <textarea
                          className="subtemplate-segments-input"
                          value={manualSubTemplateSegments}
                          onChange={(e) => setManualSubTemplateSegments(e.target.value)}
                          placeholder="Enter segments..."
                      rows={10}
                        />
                      </div>
                      <div className="subtemplate-input-group">
                        <div className="subtemplate-conditions-header">
                          <label className="subtemplate-label">Template Conditions (Optional):</label>
                          <button
                            type="button"
                            className="add-condition-button"
                            onClick={handleAddManualTemplateCondition}
                          >
                            + Add Condition
                          </button>
                        </div>
                        {manualSubTemplateConditions.length > 0 && (
                          <div className="template-conditions-list">
                            {manualSubTemplateConditions.map((condition, index) => (
                              <div key={index} className="template-condition-item">
                                <select
                                  className="template-condition-name-select"
                                  value={condition.name}
                                  onChange={(e) => handleUpdateManualTemplateCondition(index, 'name', e.target.value)}
                                >
                                  <option value="MinMessageBodyLength">MinMessageBodyLength</option>
                                  <option value="FirstNMessages">FirstNMessages</option>
                                  <option value="IsNotRightsManagedContentMessage">IsNotRightsManagedContentMessage</option>
                                  <option value="IsNotMeetingMessage">IsNotMeetingMessage</option>
                                  <option value="IsNotAutomatedMessage">IsNotAutomatedMessage</option>
                                  <option value="ToOrCcRecipient">ToOrCcRecipient</option>
                                </select>
                                <input
                                  type="text"
                                  className="template-condition-value-input"
                                  value={condition.value}
                                  onChange={(e) => handleUpdateManualTemplateCondition(index, 'value', e.target.value)}
                                  placeholder="Value..."
                                />
                                <button
                                  type="button"
                                  className="remove-condition-button"
                                  onClick={() => handleRemoveManualTemplateCondition(index)}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    <div className="manual-template-form-buttons">
                      <button type="submit" className="submit-template-button">
                          Save SubTemplate
                      </button>
                      <button
                        type="button"
                        className="cancel-template-button"
                        onClick={() => {
                            setShowManualSubTemplateInput(false)
                            setManualSubTemplateName('')
                            setManualSubTemplateSortOrder('Asc')
                            setManualSubTemplateInputType('Conversation')
                            setManualSubTemplateSegments('')
                            setManualSubTemplateConditions([])
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

              {/* SubTemplate Input Fields */}
              {selectedSubTemplateName ? (
                <div className="subtemplate-inputs">
                 
                  <div className="subtemplate-input-group">
                    <label className="subtemplate-label">Name:</label>
                    <input
                      type="text"
                      className="subtemplate-input"
                      value={subTemplateName}
                      onChange={(e) => handleSubTemplateFieldChange('name', e.target.value)}
                      placeholder="SubTemplate name..."
                    />
                  </div>
                  <div className="subtemplate-input-group">
                    <label className="subtemplate-label">SortOrder:</label>
                    <select
                      className="subtemplate-select"
                      value={subTemplateSortOrder}
                      onChange={(e) => handleSubTemplateFieldChange('sortOrder', e.target.value)}
                    >
                      <option value="Asc">Asc</option>
                      <option value="Desc">Desc</option>
                    </select>
                  </div>
                  <div className="subtemplate-input-group">
                    <label className="subtemplate-label">InputType:</label>
                    <select
                      className="subtemplate-select"
                      value={subTemplateInputType}
                      onChange={(e) => handleSubTemplateFieldChange('inputType', e.target.value)}
                    >
                      <option value="Conversation">Conversation</option>
                      <option value="Folder">Folder</option>
                      <option value="CalendarEvent">CalendarEvent</option>
                    </select>
                  </div>
                  <div className="subtemplate-input-group">
                    <label className="subtemplate-label">Segments:</label>
                    <textarea
                      className="subtemplate-segments-input"
                      value={subTemplateSegments}
                      onChange={(e) => handleSubTemplateFieldChange('segments', e.target.value)}
                      placeholder="Enter segments..."
                      rows={10}
                    />
                  </div>
                  <div className="subtemplate-input-group">
                    <div className="subtemplate-conditions-header">
                      <label className="subtemplate-label">Template Conditions (Optional):</label>
                      <button
                        type="button"
                        className="add-condition-button"
                        onClick={handleAddTemplateCondition}
                      >
                        + Add Condition
                      </button>
                    </div>
                    {subTemplateConditions.length > 0 && (
                      <div className="template-conditions-list">
                        {subTemplateConditions.map((condition, index) => (
                          <div key={index} className="template-condition-item">
                            <select
                              className="template-condition-name-select"
                              value={condition.name}
                              onChange={(e) => handleUpdateTemplateCondition(index, 'name', e.target.value)}
                            >
                              <option value="MinMessageBodyLength">MinMessageBodyLength</option>
                              <option value="FirstNMessages">FirstNMessages</option>
                              <option value="IsNotRightsManagedContentMessage">IsNotRightsManagedContentMessage</option>
                              <option value="IsNotMeetingMessage">IsNotMeetingMessage</option>
                              <option value="IsNotAutomatedMessage">IsNotAutomatedMessage</option>
                              <option value="ToOrCcRecipient">ToOrCcRecipient</option>
                            </select>
                            <input
                              type="text"
                              className="template-condition-value-input"
                              value={condition.value}
                              onChange={(e) => handleUpdateTemplateCondition(index, 'value', e.target.value)}
                              placeholder="Value..."
                            />
                            <button
                              type="button"
                              className="remove-condition-button"
                              onClick={() => handleRemoveTemplateCondition(index)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="subtemplate-save-button-container">
                    <button
                      type="button"
                      className="save-subtemplate-button"
                      onClick={handleSaveSubTemplateChanges}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="subtemplate-placeholder">
                  <p>Select a subtemplate to edit...</p>
                </div>
              )}
                  </div>
                  {/* Template Header */}
            <div className="template-section-header">
              <h2>Template</h2>
            </div>
            {/* Template Management */}
            <div className="template-management">
              <div className="template-controls">
                <label className="upload-template-button">
                  <input
                    type="file"
                    accept=".txt,.text"
                    onChange={handleTemplateUpload}
                    style={{ display: 'none' }}
                  />
                  Upload Template
                </label>
                <button
                  className="manual-template-button"
                  onClick={handleStartManualTemplate}
                >
                  Add Template Manually
                </button>
              </div>

              {/* Saved Templates Section */}
              {Object.keys(templates).length > 0 && (
                <div className="saved-templates-section">
                  <div 
                    className="saved-templates-header"
                    onClick={() => setShowSavedTemplates(!showSavedTemplates)}
                  >
                    <h3>Remove Saved Templates ({Object.keys(templates).length})</h3>
                    <span className="saved-templates-toggle">
                      {showSavedTemplates ? '▼' : '▶'}
                    </span>
                  </div>
                  {showSavedTemplates && (
                    <div className="saved-templates-content">
                      <div className="template-list">
                        {Object.keys(templates).map((name) => (
                          <div key={name} className="template-list-item">
                            <span className="template-list-name">{name}</span>
                            <button
                              className="template-list-delete-button"
                              onClick={() => handleDeleteTemplate(name)}
                              title={`Delete "${name}"`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      {Object.keys(templates).length > 1 && (
                        <button
                          className="delete-all-templates-button"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete all ${Object.keys(templates).length} template(s)?`)) {
                              saveTemplates({})
                              setSelectedTemplateName('')
                              setTemplateText('')
                            }
                          }}
                          title="Delete all templates"
                        >
                          Delete All Templates
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="template-select-controls">
                <select
                  className="template-selector"
                  value={selectedTemplateName}
                  onChange={handleTemplateSelect}
                >
                  <option value="">Select a template to view or edit...</option>
                  {Object.keys(templates).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                
              </div>

            </div>

            <div className="template-editor-section">
            <input
                  type="text"
                  className="selected-template-name-input"
                  value={selectedTemplateName || ''}
                  readOnly={!isAddingTemplateManually}
                  placeholder={isAddingTemplateManually ? "Enter template name..." : "No template selected"}
                  onChange={(e) => {
                    if (isAddingTemplateManually) {
                      setSelectedTemplateName(e.target.value)
                    }
                  }}
                />
            <textarea
              className="template-input"
              placeholder={isAddingTemplateManually ? "Enter template content here..." : (selectedTemplateName ? `Template: ${selectedTemplateName}` : "Select a template to view...")}
              rows={20}
              value={templateText}
                onChange={(e) => setTemplateText(e.target.value)}
                disabled={!selectedTemplateName && !isAddingTemplateManually}
            />
            </div>

            {/* Condition Flags Section */}
            <div className="condition-flags-section">
              <div className="condition-flags-header">
                <label className="condition-flags-label">Condition Flags (Optional):</label>
                  <button
                  type="button"
                  className="add-condition-flag-button"
                  onClick={() => setConditionFlags([...conditionFlags, ''])}
                >
                  + Add Condition Flag
                  </button>
              </div>
              {conditionFlags.length > 0 && (
                <div className="condition-flags-list">
                  {conditionFlags.map((flag, index) => (
                    <div key={index} className="condition-flag-item">
                      <input
                        type="text"
                        className="condition-flag-input"
                        value={flag}
                        onChange={(e) => {
                          const updated = [...conditionFlags]
                          updated[index] = e.target.value
                          setConditionFlags(updated)
                        }}
                        placeholder="Enter condition flag..."
                      />
                      <button
                        type="button"
                        className="remove-condition-flag-button"
                        onClick={() => setConditionFlags(conditionFlags.filter((_, i) => i !== index))}
                        title="Remove condition flag"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                )}
              </div>

            {/* Parameter Values Section */}
            <div className="parameter-values-section">
              <div className="parameter-values-header">
                <label className="parameter-values-label">Parameter Values (Optional):</label>
                <button
                  type="button"
                  className="add-parameter-button"
                  onClick={() => {
                    const newKey = `param${Object.keys(parametersValues).length + 1}`
                    setParametersValues({ ...parametersValues, [newKey]: '' })
                  }}
                >
                  + Add Parameter
                </button>
              </div>
              {Object.keys(parametersValues).length > 0 && (
                <div className="parameter-values-list">
                  {Object.entries(parametersValues).map(([key, value], index) => (
                    <div key={index} className="parameter-item">
                    <input
                      type="text"
                        className="parameter-key-input"
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value
                          const updated = { ...parametersValues }
                          delete updated[key]
                          if (newKey) {
                            updated[newKey] = value
                          }
                          setParametersValues(updated)
                        }}
                        placeholder="Key..."
                      />
                      <input
                        type="text"
                        className="parameter-value-input"
                        value={value}
                        onChange={(e) => {
                          setParametersValues({ ...parametersValues, [key]: e.target.value })
                        }}
                        placeholder="Value..."
                      />
                      <button
                        type="button"
                        className="remove-parameter-button"
                        onClick={() => {
                          const updated = { ...parametersValues }
                          delete updated[key]
                          setParametersValues(updated)
                        }}
                        title="Remove parameter"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

              <div className="extracted-placeholders">
              {placeholders.length > 0 ? (
                <div className="regular-placeholders-section">
                <h3>Extracted Placeholders:</h3>
                <table className="placeholder-table">
                  <thead>
                    <tr>
                      <th>Placeholder</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placeholders.map((placeholder, index) => (
                      <tr key={index}>
                        <td className="placeholder-name">{placeholder}</td>
                        <td className="placeholder-value-cell">
                          <textarea
                            className="placeholder-value-input"
                            value={placeholderValues[placeholder] || ''}
                            readOnly
                              rows={1}
                            placeholder={usedMessage || usedMessageDetails ? `Value for ${placeholder}` : 'Select message to see placeholder value'}
                              ref={(el) => {
                                if (el) autoResizeTextareaMaxLines(el, 10)
                              }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              ) : (
                <div className="regular-placeholders-section">
                  <h3>Extracted Placeholders:</h3>
                  <p style={{ padding: '16px', color: '#666', fontStyle: 'italic' }}>No extracted placeholders found in the template.</p>
              </div>
            )}
              
              {Object.keys(subTemplatePlaceholders).length > 0 ? (
                <div className="subtemplate-placeholders-section">
                  <h3>Extracted SubTemplate Placeholders:</h3>
                  {Object.entries(subTemplatePlaceholders).map(([subTemplateName, subPlaceholders]) => (
                    <div key={subTemplateName} className="subtemplate-placeholder-group">
                      <h4 className="subtemplate-placeholder-header">{subTemplateName}</h4>
                      <h5 className="subtemplate-placeholder-subheader">Subtemplate</h5>
                      <table className="placeholder-table">
                        <thead>
                          <tr>
                            <th>Placeholder</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subPlaceholders.map((placeholder, index) => {
                            // Create a unique key for SubTemplate placeholders
                            const fullPlaceholderKey = `${subTemplateName}.${placeholder}`
                            return (
                              <tr key={index}>
                                <td className="placeholder-name">{placeholder}</td>
                                <td className="placeholder-value-cell">
                                  <textarea
                                    className="placeholder-value-input"
                                    value={placeholderValues[fullPlaceholderKey] || ''}
                                    readOnly
                                    rows={1}
                                    placeholder={usedMessage || usedMessageDetails ? `Value for ${placeholder}` : 'Select message to see placeholder value'}
                                    ref={(el) => {
                                      if (el) autoResizeTextareaMaxLines(el, 10)
                                    }}
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="subtemplate-placeholders-section">
                  <h3>Extracted SubTemplate Placeholders:</h3>
                  <p style={{ padding: '16px', color: '#666', fontStyle: 'italic' }}>No extracted SubTemplate placeholders found in the template.</p>
          </div>
        )}
            </div>
            {(selectedTemplateName || isAddingTemplateManually) && (
              <div className="template-save-button-container">
                <button
                  type="button"
                  className="save-template-button"
                  onClick={handleSaveTemplateChanges}
                >
                  {isAddingTemplateManually ? 'Save New Template' : 'Save Changes'}
                </button>
                {isAddingTemplateManually && (
                  <button
                    type="button"
                    className="cancel-template-button"
                    onClick={() => {
                      setIsAddingTemplateManually(false)
                      setSelectedTemplateName('')
                      setTemplateText('')
                      setConditionFlags([])
                      setParametersValues({})
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
                </div>
              )}
            </div>
            {/* Call OCS Section - Collapsible */}
            <div className="call-ocs-collapsible-section">
              <div 
                className="call-ocs-collapsible-header"
                onClick={() => setShowCallOCS(!showCallOCS)}
              >
                <h3>Call OCS</h3>
                <span className="call-ocs-collapsible-toggle">
                  {showCallOCS ? '▼' : '▶'}
                </span>
              </div>
              {showCallOCS && (
                <div className="call-ocs-collapsible-content">
                  {/* Template Select Section */}
                  <div className="object-section">
                  <label className="object-label">Select a template to call the Experiment API on:</label>
                <select
                  className="template-selector"
                  value={selectedTemplateName}
                  onChange={handleTemplateSelect}
                >
                  <option value="">Select a template...</option>
                  {Object.keys(templates).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
                  {/* Object Section */}
                  <div className="object-section">
                    <label className="object-label">Select an object to call the Experiment API on:</label>
                    <div className="object-inputs">
                      <select
                        className="object-key-select"
                        value={objectKey}
                        onChange={(e) => {
                          const newKey = e.target.value
                          setObjectKey(newKey)
                          
                          // Auto-populate value based on selected key and used message
                          if (newKey === 'ConversationId' && (usedMessage?.conversationId || usedMessageDetails?.conversationId)) {
                            setObjectValue(usedMessageDetails?.conversationId || usedMessage?.conversationId)
                          } else if (newKey === 'MessageId' && (usedMessage?.id || usedMessageDetails?.id)) {
                            setObjectValue(usedMessageDetails?.id || usedMessage?.id)
                          } else if (newKey === 'FolderId') {
                            // Clear value for FolderId as it's not available from message
                            setObjectValue('')
                          }
                        }}
                      >
                        <option value="ConversationId">ConversationId</option>
                        <option value="FolderId">FolderId</option>
                        <option value="MessageId">MessageId</option>
                      </select>
                      <input
                        type="text"
                        className="object-value-input"
                        value={objectValue}
                        onChange={(e) => setObjectValue(e.target.value)}
                        placeholder="Enter value..."
                      />
                    </div>
                  </div>
                  {/* Model Field */}
                  <div className="model-field-section">
                    <label className="model-field-label">Model (Optional):</label>
                    <input
                      type="text"
                      className="model-field-input"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Enter model name..."
                    />
                  </div>

                  {/* Stop Sequences */}
                  <div className="stop-sequences-section">
                    <div className="stop-sequences-header">
                      <label className="stop-sequences-label">Stop Sequences (Optional):</label>
                      <button
                        type="button"
                        className="add-stop-sequence-button"
                        onClick={() => setStopSequences([...stopSequences, ''])}
                      >
                        + Add Stop Sequence
                      </button>
                    </div>
                    {stopSequences.length > 0 && (
                      <div className="stop-sequences-list">
                        {stopSequences.map((seq, index) => (
                          <div key={index} className="stop-sequence-item">
                            <input
                              type="text"
                              className="stop-sequence-input"
                              value={seq}
                              onChange={(e) => {
                                const updated = [...stopSequences]
                                updated[index] = e.target.value
                                setStopSequences(updated)
                              }}
                              placeholder="Enter stop sequence..."
                            />
                            <button
                              type="button"
                              className="remove-stop-sequence-button"
                              onClick={() => setStopSequences(stopSequences.filter((_, i) => i !== index))}
                              title="Remove stop sequence"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Custom Scenario Tag Section */}
                  <div className="custom-scenario-tag-section">
                    <label className="custom-scenario-tag-label">Custom Scenario Tag (Required, default: OCSPlayground):</label>
                    <input
                      type="text"
                      className="custom-scenario-tag-input"
                      value={customScenarioTag}
                      onChange={(e) => setCustomScenarioTag(e.target.value)}
                      placeholder="OCSPlayground (default)"
                    />
                  </div>

                  {/* Call Experiment API Button */}
                  <div className="experiment-api-button-container">
                    <button 
                      className="call-experiment-api-button"
                      onClick={handleCallExperimentAPIClicked}
                      disabled={experimentApiLoading}
                    >
                      Call Experiment API
                    </button>
                    <button 
                      className="copy-curl-button"
                      onClick={handleCopyCurl}
                      disabled={experimentApiLoading || !ocsToken}
                      title="Copy cURL command"
                    >
                      {copiedCurl ? '✓ Copied!' : 'Copy cURL'}
                    </button>
                  </div>

                  {/* Output Section - Collapsible */}
                  <div className="output-collapsible-section">
                    <div 
                      className="output-collapsible-header"
                      onClick={() => setShowOutput(!showOutput)}
                    >
                      <h3>Output</h3>
                      <span className="output-collapsible-toggle">
                        {showOutput ? '▼' : '▶'}
                      </span>
                    </div>
                    {showOutput && (
                      <div className="output-collapsible-content">
              <div className="output-section">
                    {experimentApiLoading && (
                      <div className="loading-message">Calling Experiment API...</div>
                    )}
                    {experimentApiError && (
                      <div className="error-message">
                        <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{experimentApiError}</pre>
              </div>
            )}
                    {experimentApiResponse && (
                      <div className="experiment-api-response">
                        {/* Helper function to format strings with escape characters */}
                        {(() => {
                          const formatString = (str) => {
                            if (typeof str !== 'string') return str
                            // Replace escape sequences with their actual values
                            return str
                              .replace(/\\n/g, '\n')
                              .replace(/\\t/g, '\t')
                              .replace(/\\r/g, '\r')
                              .replace(/\\"/g, '"')
                              .replace(/\\\\/g, '\\')
                          }

                          const formatValue = (value) => {
                            if (value === null || value === undefined) {
                              return 'null'
                            }
                            if (typeof value === 'string') {
                              return formatString(value)
                            }
                            if (Array.isArray(value)) {
                              return value.map(item => formatString(String(item))).join('\n')
                            }
                            if (typeof value === 'object') {
                              return JSON.stringify(value, null, 2)
                            }
                            return String(value)
                          }

                          return (
                            <div className="experiment-api-response-fields">
                              {/* completions */}
                              {experimentApiResponse.completions !== undefined && (
                                <div className="output-field">
                                  <label className="output-field-label">completions</label>
                                  <textarea
                                    className="output-field-textarea"
                                    value={formatValue(experimentApiResponse.completions)}
                                    readOnly
                                    rows={1}
                                    ref={(el) => {
                                      if (el) autoResizeTextarea(el)
                                    }}
                                  />
                                </div>
                              )}

                              {/* idToRecipientMap */}
                              {experimentApiResponse.idToRecipientMap !== undefined && (
                                <div className="output-field">
                                  <label className="output-field-label">idToRecipientMap</label>
                                  <textarea
                                    className="output-field-textarea"
                                    value={formatValue(experimentApiResponse.idToRecipientMap)}
                                    readOnly
                                    rows={1}
                                    ref={(el) => {
                                      if (el) autoResizeTextarea(el)
                                    }}
                                  />
                                </div>
                              )}

                              {/* idToCitationMap */}
                              {experimentApiResponse.idToCitationMap !== undefined && (
                                <div className="output-field">
                                  <label className="output-field-label">idToCitationMap</label>
                                  <textarea
                                    className="output-field-textarea"
                                    value={formatValue(experimentApiResponse.idToCitationMap)}
                                    readOnly
                                    rows={1}
                                    ref={(el) => {
                                      if (el) autoResizeTextarea(el)
                                    }}
                                  />
                                </div>
                              )}

                              {/* gptRequest */}
                              {experimentApiResponse.gptRequest !== undefined && (
                                <div className="output-field">
                                  <label className="output-field-label">gptRequest</label>
                                  <textarea
                                    className="output-field-textarea"
                                    value={formatValue(experimentApiResponse.gptRequest)}
                                    readOnly
                                    rows={1}
                                    ref={(el) => {
                                      if (el) autoResizeTextarea(el)
                                    }}
                                  />
                                </div>
                              )}

                              {/* truncationInformation */}
                              {experimentApiResponse.truncationInformation !== undefined && (
                                <div className="output-field">
                                  <label className="output-field-label">truncationInformation</label>
                                  <textarea
                                    className="output-field-textarea"
                                    value={formatValue(experimentApiResponse.truncationInformation)}
                                    readOnly
                                    rows={1}
                                    ref={(el) => {
                                      if (el) autoResizeTextarea(el)
                                    }}
                                  />
                                </div>
                              )}

                              {/* qualityStatus */}
                              {experimentApiResponse.qualityStatus !== undefined && (
                                <div className="output-field">
                                  <label className="output-field-label">qualityStatus</label>
                                  <textarea
                                    className="output-field-textarea"
                                    value={formatValue(experimentApiResponse.qualityStatus)}
                                    readOnly
                                    rows={1}
                                    ref={(el) => {
                                      if (el) autoResizeTextarea(el)
                                    }}
                                  />
                                </div>
                              )}

                              {/* outputLanguageInformation */}
                              {experimentApiResponse.outputLanguageInformation !== undefined && (
                                <div className="output-field">
                                  <label className="output-field-label">outputLanguageInformation</label>
                                  <textarea
                                    className="output-field-textarea"
                                    value={formatValue(experimentApiResponse.outputLanguageInformation)}
                                    readOnly
                                    rows={1}
                                    ref={(el) => {
                                      if (el) autoResizeTextarea(el)
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                    {!experimentApiLoading && !experimentApiError && !experimentApiResponse && (
                      <p className="output-placeholder">Click "Call Experiment API" to see the response here.</p>
                    )}
                  </div>
                    </div>
                  )}
                  {/* Save and Download Buttons - Only show if there is output */}
                  {experimentApiResponse && (
                    <div className="save-button-container">
                      <button 
                        className="save-button"
                        onClick={handleSaveClick}
                        title="Save to localStorage for Analysis tab"
                      >
                        Save
                      </button>
                      <button 
                        className="download-button"
                        onClick={handleDownload}
                        title="Download as JSON file"
                      >
                        Download
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      )}

      {/* Save Popup Modal */}
      {showSavePopup && (
        <div className="save-popup-overlay" onClick={handleSaveCancel}>
          <div className="save-popup-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Name This Run</h3>
            <input
              type="text"
              className="save-popup-input"
              value={saveRunName}
              onChange={(e) => setSaveRunName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveConfirm()
                } else if (e.key === 'Escape') {
                  handleSaveCancel()
                }
              }}
              placeholder="Enter a name for this run..."
              autoFocus
            />
            <div className="save-popup-buttons">
              <button 
                className="save-popup-cancel-button"
                onClick={handleSaveCancel}
              >
                Cancel
              </button>
              <button 
                className="save-popup-confirm-button"
                onClick={handleSaveConfirm}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Playground
