import { useState, useEffect } from 'react'
import { graphConfig } from './authConfig'
import JsonView from '@uiw/react-json-view'
import { singleValueExtendedProperties, fetchMessageDetails } from './messageUtils'
import './Graph.css'

function Graph({ bearerToken, onTokenSubmit, onLogout, onProfileChange, onFavoritesChange, onTokenError }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mailbox, setMailbox] = useState(null)
  const [mailLoading, setMailLoading] = useState(false)
  const [mailError, setMailError] = useState(null)
  const [selectedFolder, setSelectedFolder] = useState('inbox')
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [emailDetails, setEmailDetails] = useState(null)
  const [emailThread, setEmailThread] = useState([])
  const [emailDetailsLoading, setEmailDetailsLoading] = useState(false)
  const [emailDetailsError, setEmailDetailsError] = useState(null)
  const [activeTab, setActiveTab] = useState('profile')
  const [favoriteMessages, setFavoriteMessages] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState(null)
  const [isFetchingFavorites, setIsFetchingFavorites] = useState(false)
  const [conversationIdInput, setConversationIdInput] = useState('')
  const [messageIdInput, setMessageIdInput] = useState('')
  const [fetchingByConversationId, setFetchingByConversationId] = useState(false)
  const [conversationIdError, setConversationIdError] = useState(null)
  const [mailboxNextLink, setMailboxNextLink] = useState(null)
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false)
  
  // Load favorite message IDs from localStorage
  const getFavoriteIds = () => {
    try {
      const stored = localStorage.getItem('favoriteMessageIds')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }
  
  // Save favorite message IDs to localStorage
  const saveFavoriteIds = (ids) => {
    try {
      localStorage.setItem('favoriteMessageIds', JSON.stringify(ids))
    } catch (err) {
      console.error('Error saving favorites:', err)
    }
  }


  useEffect(() => {
    if (bearerToken) {
      fetchProfile()
    }
  }, [bearerToken])

  const parseErrorResponse = async (response) => {
    try {
      const errorData = await response.json()
      if (errorData.error) {
        return errorData.error.message || errorData.error.code || response.statusText
      }
      return response.statusText
    } catch {
      return response.statusText
    }
  }

  const fetchManagerChain = async (accessToken, userId, chain = []) => {
    try {
      const managerResponse = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/manager`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (managerResponse.ok) {
        const manager = await managerResponse.json()
        const managerChain = [...chain, manager]
        // Recursively fetch the manager's manager (up to 10 levels to prevent infinite loops)
        if (managerChain.length < 10) {
          return fetchManagerChain(accessToken, manager.id, managerChain)
        } else {
          return managerChain
        }
      } else if (managerResponse.status === 404) {
        // No manager found, return the chain
        return chain
      } else {
        // Error fetching manager, return what we have
        console.error('Error fetching manager:', await parseErrorResponse(managerResponse))
        return chain
      }
    } catch (err) {
      console.error('Error fetching manager chain:', err)
      return chain
    }
  }

  const fetchProfile = async () => {
    if (!bearerToken) return

    setLoading(true)
    setError(null)

    try {
      // Fetch user profile from Microsoft Graph API using provided Bearer token
      const profileResponse = await fetch(graphConfig.graphMeEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!profileResponse.ok) {
        const errorMessage = await parseErrorResponse(profileResponse)
        
        // Check for specific error types
        let userFriendlyError = errorMessage
        if (errorMessage.includes('InvalidAudience') || errorMessage.includes('invalid audience')) {
          userFriendlyError = 'Invalid Audience Error: The token provided is not valid for Microsoft Graph API. Please ensure your token has the audience set to "https://graph.microsoft.com".'
        } else if (profileResponse.status === 401) {
          userFriendlyError = 'Authentication Error: The token is invalid or expired. Please check your token and try again.'
          // Clear token on authentication error
          if (onTokenError) {
            onTokenError()
          }
        } else if (profileResponse.status === 403) {
          userFriendlyError = 'Permission Error: The token does not have the required permissions to access this resource.'
        }
        
        throw new Error(userFriendlyError)
      }

      const profileData = await profileResponse.json()
      
      // Fetch manager chain starting from current user
      const managerChain = await fetchManagerChain(bearerToken, profileData.id)
      
      // Add manager chain to profile data
      const extendedProfile = {
        ...profileData,
        managerChain: managerChain.length > 0 ? managerChain : null,
      }
      
      setProfile(extendedProfile)
      // Notify parent component of profile change
      if (onProfileChange) {
        onProfileChange(extendedProfile)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError(err.message || 'Failed to fetch profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchFavoriteMessages = async () => {
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
      // Notify parent component of favorites change
      if (onFavoritesChange) {
        onFavoritesChange(validMessages)
      }
    } catch (err) {
      console.error('Error fetching favorite messages:', err)
    } finally {
      setFavoritesLoading(false)
      setIsFetchingFavorites(false)
    }
  }

  const fetchMailbox = async (folder = selectedFolder) => {
    if (!bearerToken || mailLoading) return // Prevent multiple simultaneous calls

    setMailLoading(true)
    setMailError(null)

    try {
      // Map folder names to Microsoft Graph API folder identifiers
      const folderMap = {
        'inbox': 'Inbox',
        'sent': 'SentItems',
        'drafts': 'Drafts',
        'deleted': 'DeletedItems',
        'junk': 'JunkEmail',
        'archive': 'Archive',
      }

      const folderId = folderMap[folder.toLowerCase()] || 'Inbox'
      
      // Fetch messages from the specified folder with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90000) // 90 second timeout
      
      try {
        // URL encode the query parameters
        const queryParams = new URLSearchParams({
          '$top': '20',
          '$orderby': 'receivedDateTime desc',
          '$select': 'id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments,conversationId'
        })

        const inboxQueryParams = new URLSearchParams({
          '$top': '20',
          '$orderby': 'receivedDateTime desc',
          '$select': 'id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments,conversationId',
          '$filter': "parentFolderId eq 'inbox'"
        })

        let mailResponse
        
        // For inbox, use the simpler /me/messages endpoint
        // For other folders, use the folder-specific endpoint
        const endpoint = folderId === 'Inbox' 
          ? `https://graph.microsoft.com/v1.0/me/messages?${inboxQueryParams.toString()}`
          : `https://graph.microsoft.com/v1.0/me/mailFolders/${encodeURIComponent(folderId)}/messages?${queryParams.toString()}`
        
        mailResponse = await fetch(
          endpoint,
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

        if (!mailResponse.ok) {
          const errorMessage = await parseErrorResponse(mailResponse)
          
          let userFriendlyError = errorMessage
          if (errorMessage.includes('InvalidAudience') || errorMessage.includes('invalid audience')) {
            userFriendlyError = 'Invalid Audience Error: The token provided is not valid for Microsoft Graph API.'
          } else if (mailResponse.status === 401) {
            userFriendlyError = 'Authentication Error: The token is invalid or expired.'
            // Clear token on authentication error
            if (onTokenError) {
              onTokenError()
            }
          } else if (mailResponse.status === 403) {
            userFriendlyError = 'Permission Error: The token does not have Mail.Read permission.'
          } else if (mailResponse.status === 404) {
            userFriendlyError = `Folder "${folderId}" not found. Please check the folder name.`
          }
          
          throw new Error(userFriendlyError)
        }

        const mailData = await mailResponse.json()
        setMailbox(mailData.value || [])
        // Store the nextLink for pagination
        setMailboxNextLink(mailData['@odata.nextLink'] || null)
        
        // Refresh favorites after loading mailbox (non-blocking)
        if (!isFetchingFavorites) {
          fetchFavoriteMessages()
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId)
        if (fetchErr.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.')
        }
        throw fetchErr
      }
    } catch (err) {
      console.error('Error fetching mailbox:', err)
      setMailError(err.message || 'Failed to fetch mailbox. Please try again.')
    } finally {
      setMailLoading(false)
    }
  }

  const handleFolderChange = (folder) => {
    setSelectedFolder(folder)
    setMailboxNextLink(null) // Reset pagination when changing folders
    fetchMailbox(folder)
  }

  const loadMoreMessages = async () => {
    if (!bearerToken || !mailboxNextLink || loadingMoreMessages) return

    setLoadingMoreMessages(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000) // 90 second timeout

    try {
      const response = await fetch(mailboxNextLink, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response)
        let userFriendlyError = errorMessage
        if (response.status === 401 || response.status === 403) {
          if (onTokenError) {
            onTokenError()
          }
          userFriendlyError = 'Authentication Error: The token is invalid or expired.'
        }
        throw new Error(userFriendlyError)
      }

      const mailData = await response.json()
      // Append new messages to existing mailbox
      setMailbox(prevMailbox => [...(prevMailbox || []), ...(mailData.value || [])])
      // Update nextLink for further pagination
      setMailboxNextLink(mailData['@odata.nextLink'] || null)
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error loading more messages:', err)
        setMailError(err.message || 'Failed to load more messages. Please try again.')
      }
    } finally {
      setLoadingMoreMessages(false)
    }
  }

  const toggleFavorite = (messageId, e) => {
    e.stopPropagation() // Prevent triggering the email click
    const favoriteIds = getFavoriteIds()
    const isFavorite = favoriteIds.includes(messageId)
    
    if (isFavorite) {
      // Remove from favorites
      const updatedIds = favoriteIds.filter(id => id !== messageId)
      saveFavoriteIds(updatedIds)
    } else {
      // Add to favorites
      const updatedIds = [...favoriteIds, messageId]
      saveFavoriteIds(updatedIds)
    }
    
    // Refresh favorites display
    fetchFavoriteMessages()
  }

  const fetchByConversationId = async () => {
    if (!bearerToken || !conversationIdInput.trim()) {
      setConversationIdError('Please enter a conversation ID')
      return
    }

    setFetchingByConversationId(true)
    setConversationIdError(null)

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 30000) // 30-second timeout

    try {
      const conversationId = conversationIdInput.trim()
      const messageId = messageIdInput.trim()
      
      let messages = []
      // If messageId is provided, fetch that specific message and verify it matches the conversationId
      if (messageId) {
        try {
          const encodedMessageId = encodeURIComponent(messageId)
          const messageResponse = await fetch(
            `${graphConfig.graphMeMailEndpoint}/${encodedMessageId}&$select=id,conversationId,receivedDateTime`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${bearerToken}`,
                'Content-Type': 'application/json',
              },
              signal: abortController.signal,
            }
          )

          if (!messageResponse.ok) {
            // Clear token on authentication/authorization errors
            if (messageResponse.status === 401 || messageResponse.status === 403) {
              if (onTokenError) {
                onTokenError()
              }
            }
            throw new Error('Message not found or access denied')
          }

          const messageData = await messageResponse.json()
          
          // Verify the message belongs to the specified conversation
          if (messageData.conversationId !== conversationId) {
            throw new Error('Message does not belong to the specified conversation ID')
          }

          messages = [messageData]
        } catch (err) {
          clearTimeout(timeoutId)
          if (err.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.')
          }
          throw err
        }
      } else {
        // Fetch messages by conversationId with filter
        const encodedConversationId = encodeURIComponent(conversationId)
        // Construct OData filter with properly encoded conversationId
        const filterValue = `conversationId eq '${encodedConversationId}'`
        
        let recentResponse
        recentResponse = await fetch(
          `${graphConfig.graphMeMailEndpoint}?$filter=${filterValue}&$select=id,conversationId,receivedDateTime`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${bearerToken}`,
              'Content-Type': 'application/json',
            },
            signal: abortController.signal,
          }
        )

        clearTimeout(timeoutId)

        if (!recentResponse.ok) {
          // Clear token on authentication/authorization errors
          if (recentResponse.status === 401 || recentResponse.status === 403) {
            if (onTokenError) {
              onTokenError()
            }
          }
          const errorMessage = await parseErrorResponse(recentResponse)
          throw new Error(errorMessage || 'Failed to fetch messages')
        }

        const recentData = await recentResponse.json()
        const allMessages = recentData.value || []

        // Sort by receivedDateTime descending (most recent first)
        allMessages.sort((a, b) => {
          const dateA = new Date(a.receivedDateTime || 0)
          const dateB = new Date(b.receivedDateTime || 0)
          return dateB - dateA
        })

        // Get the most recent message (first in sorted array)
        messages = [allMessages[0]]
      }

      // Add message(s) to favorites
      const favoriteIds = getFavoriteIds()
      
      if (messageId && messages.length > 0) {
        // If messageId was provided, favorite only that specific message
        const newFavoriteIds = [...new Set([...favoriteIds, messages[0].id])]
        saveFavoriteIds(newFavoriteIds)
      } else if (messages.length > 0) {
        // If no messageId provided, favorite the most recent message
        const mostRecentMessage = messages[0]
        const newFavoriteIds = [...new Set([...favoriteIds, mostRecentMessage.id])]
        saveFavoriteIds(newFavoriteIds)
      } else {
        throw new Error('No messages found')
      }
      
      setConversationIdInput('')
      setMessageIdInput('')
      fetchFavoriteMessages()
    } catch (err) {
      if (err.name === 'AbortError') {
        setConversationIdError('Request timed out. Please try again.')
      } else {
        console.error('Error fetching by conversation ID:', err)
        setConversationIdError(err.message || 'Failed to fetch messages by conversation ID')
      }
    } finally {
      setFetchingByConversationId(false)
    }
  }

  const copyIdsToClipboard = async (messageId, conversationId, e) => {
    e.stopPropagation() // Prevent triggering the email click
    
    const jsonData = {
      conversationId: conversationId || null,
      messageId: messageId || null
    }
    
    const jsonString = JSON.stringify(jsonData, null, 2)
    
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopiedMessageId(messageId)
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedMessageId(null)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = jsonString
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopiedMessageId(messageId)
        setTimeout(() => {
          setCopiedMessageId(null)
        }, 2000)
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr)
      }
      document.body.removeChild(textArea)
    }
  }

  useEffect(() => {
    if (bearerToken && activeTab === 'mailbox' && !isFetchingFavorites) {
      fetchFavoriteMessages()
    }
  }, [bearerToken, activeTab])

  const fetchEmailDetails = async (emailId) => {
    if (!bearerToken || !emailId) return

    setEmailDetailsLoading(true)
    setEmailDetailsError(null)

    try {
      // Fetch full email details from Microsoft Graph API using centralized function
      const emailData = await fetchMessageDetails(bearerToken, emailId)
      
      setEmailDetails(emailData)

      // Fetch all messages in the conversation thread
      if (emailData.conversationId) {
        await fetchEmailThread(emailData.conversationId, emailData)
      } else {
        // If no conversationId, just show this single message
        setEmailThread([emailData])
      }
    } catch (err) {
      console.error('Error fetching email details:', err)
      // Clear token on authentication/authorization errors
      if (err.status === 401 || err.status === 403) {
        if (onTokenError) {
          onTokenError()
        }
      }
      setEmailDetailsError(err.message || 'Failed to fetch email details. Please try again.')
    } finally {
      setEmailDetailsLoading(false)
    }
  }

  const fetchEmailThread = async (conversationId, fallbackEmail) => {
    if (!bearerToken || !conversationId) return

    try {
      // Fetch recent messages and filter by conversationId client-side
      // This avoids the InefficientFilter error
      const recentMessagesResponse = await fetch(
        `${graphConfig.graphMeMailEndpoint}?$top=100&$orderby=receivedDateTime desc`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
          },
        }
      )
      
      if (recentMessagesResponse.ok) {
        const recentData = await recentMessagesResponse.json()
        const filteredMessages = (recentData.value || []).filter(
          msg => msg.conversationId === conversationId
        )
        
        if (filteredMessages.length > 0) {
          // Sort by receivedDateTime ascending (oldest first)
          filteredMessages.sort((a, b) => {
            const dateA = new Date(a.receivedDateTime || 0)
            const dateB = new Date(b.receivedDateTime || 0)
            return dateA - dateB
          })
          
          // Fetch full details with uniqueBody for each message using centralized function
          const messageDetailsPromises = filteredMessages.map(async (msg) => {
            try {
              return await fetchMessageDetails(bearerToken, msg.id)
            } catch (err) {
              console.error('Error fetching message details:', err)
              return msg
            }
          })
          const detailedMessages = await Promise.all(messageDetailsPromises)
          
          setEmailThread(detailedMessages)
        } else {
          // No matching messages found, use fallback
          setEmailThread(fallbackEmail ? [fallbackEmail] : [])
        }
      } else {
        // If fetch fails, use fallback
        setEmailThread(fallbackEmail ? [fallbackEmail] : [])
      }
    } catch (err) {
      console.error('Error fetching email thread:', err)
      // If thread fetch fails, just show the single email
      if (fallbackEmail) {
        setEmailThread([fallbackEmail])
      }
    }
  }

  const handleEmailClick = (email) => {
    setSelectedEmail(email)
    setEmailDetails(null)
    setEmailThread([])
    fetchEmailDetails(email.id)
  }

  const handleBackToList = () => {
    setSelectedEmail(null)
    setEmailDetails(null)
    setEmailThread([])
    setEmailDetailsError(null)
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


  return (
    <div className="graph-container">
      <div className="graph-card">
        <div className="graph-header">
          <h1>Microsoft Graph</h1>
        </div>

        {!bearerToken && (
          <div className="no-token-message">
            <p>Please add a Bearer token in the Auth page to access Microsoft Graph API features.</p>
          </div>
        )}
        
        {profile && (
          <div className="user-info">
            <p><strong>Name:</strong> {profile.displayName || profile.name || 'N/A'}</p>
            <p><strong>Email:</strong> {profile.mail || profile.userPrincipalName || 'N/A'}</p>
          </div>
        )}

        {bearerToken && (
          <div className="tabs-container">
            <div className="tabs">
              <button
                className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                Profile & Manager Chain
              </button>
              <button
                className={`tab-button ${activeTab === 'mailbox' ? 'active' : ''}`}
                onClick={() => setActiveTab('mailbox')}
              >
                Mailbox
              </button>
            </div>
          </div>
        )}

        {bearerToken && activeTab === 'profile' && (
          <div className="profile-section">
          <div className="profile-header">
            <h2>User Profile</h2>
            <button onClick={fetchProfile} className="refresh-button" disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {loading && !profile && (
            <div className="loading-message">Loading profile...</div>
          )}

          {profile && (
            <div className="profile-data">
              {Object.entries(profile).map(([key, value]) => {
                // Skip managerChain as it's displayed separately
                if (key === 'managerChain') return null
                
                const isJson = isJsonValue(value)
                
                return (
                  <div key={key} className="profile-item">
                    <div className="profile-key">{key}</div>
                    <div className="profile-value">
                      {isJson ? (
                        <JsonView value={getJsonValue(value)} style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px' }} />
                      ) : (
                        formatValue(value)
                      )}
                    </div>
                  </div>
                )
              })}
              {profile.managerChain && Array.isArray(profile.managerChain) && profile.managerChain.length > 0 && (
                <div className="profile-item manager-chain-item">
                  <div className="profile-key">Manager Chain</div>
                  <div className="manager-chain">
                    {profile.managerChain.map((manager, index) => (
                      <div key={manager.id || index} className="manager-level">
                        <div className="manager-level-indicator">Level {index + 1}</div>
                        <div className="manager-info">
                          <div><strong>Name:</strong> {manager.displayName || manager.name || 'N/A'}</div>
                          <div><strong>Email:</strong> {manager.mail || manager.userPrincipalName || 'N/A'}</div>
                          {manager.jobTitle && <div><strong>Title:</strong> {manager.jobTitle}</div>}
                          {manager.department && <div><strong>Department:</strong> {manager.department}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        )}

        {bearerToken && activeTab === 'mailbox' && (
          <div className="mailbox-section">
          <div className="mailbox-header">
            <h2>Mailbox</h2>
            <div className="mailbox-controls">
              <div className="conversation-id-fetch">
                <input
                  type="text"
                  value={conversationIdInput}
                  onChange={(e) => setConversationIdInput(e.target.value)}
                  placeholder="Enter conversation ID..."
                  className="conversation-id-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !fetchingByConversationId) {
                      fetchByConversationId()
                    }
                  }}
                />
                <input
                  type="text"
                  value={messageIdInput}
                  onChange={(e) => setMessageIdInput(e.target.value)}
                  placeholder="Message ID (optional)..."
                  className="conversation-id-input message-id-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !fetchingByConversationId) {
                      fetchByConversationId()
                    }
                  }}
                />
                <button
                  onClick={fetchByConversationId}
                  className="fetch-conversation-button"
                  disabled={fetchingByConversationId || !conversationIdInput.trim()}
                >
                  {fetchingByConversationId ? 'Fetching...' : 'Fetch & Add to Favorites'}
                </button>
                {conversationIdError && (
                  <div className="error-message conversation-id-error">
                    {conversationIdError}
                  </div>
                )}
              </div>
              <div className="folder-selector">
                <button 
                  onClick={() => handleFolderChange('inbox')} 
                  className={`folder-button ${selectedFolder === 'inbox' ? 'active' : ''}`}
                  disabled={mailLoading}
                >
                  Inbox
                </button>
                <button 
                  onClick={() => handleFolderChange('sent')} 
                  className={`folder-button ${selectedFolder === 'sent' ? 'active' : ''}`}
                  disabled={mailLoading}
                >
                  Sent
                </button>
                <button 
                  onClick={() => handleFolderChange('drafts')} 
                  className={`folder-button ${selectedFolder === 'drafts' ? 'active' : ''}`}
                  disabled={mailLoading}
                >
                  Drafts
                </button>
                <button 
                  onClick={() => handleFolderChange('deleted')} 
                  className={`folder-button ${selectedFolder === 'deleted' ? 'active' : ''}`}
                  disabled={mailLoading}
                >
                  Deleted
                </button>
                <button 
                  onClick={() => handleFolderChange('archive')} 
                  className={`folder-button ${selectedFolder === 'archive' ? 'active' : ''}`}
                  disabled={mailLoading}
                >
                  Archive
                </button>
              </div>
              <button onClick={() => fetchMailbox()} className="refresh-button" disabled={mailLoading}>
                {mailLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {mailError && (
            <div className="error-message">
              {mailError}
            </div>
          )}

          {/* Favorite Messages Section */}
          {favoriteMessages.length > 0 && !selectedEmail && (
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
                    return (
                      <div 
                        key={message.id} 
                        className={`mail-item ${!message.isRead ? 'unread' : ''} favorite-item`}
                        onClick={() => handleEmailClick(message)}
                      >
                        <div className="mail-item-header">
                          <div className="mail-sender">
                            {message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'Unknown'}
                          </div>
                          <div className="mail-meta">
                            <button
                              className={`favorite-button ${isFavorite ? 'favorited' : ''}`}
                              onClick={(e) => toggleFavorite(message.id, e)}
                              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              ⭐
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

          {mailLoading && !mailbox && (
            <div className="loading-message">Loading mailbox...</div>
          )}

          {mailbox && !selectedEmail && (
            <div className="mailbox-data">
              {mailbox.length === 0 ? (
                <div className="no-mail-message">No messages found.</div>
              ) : (
                <div className="mail-list">
                  {mailbox.map((message) => {
                    const favoriteIds = getFavoriteIds()
                    const isFavorite = favoriteIds.includes(message.id)
                    return (
                      <div 
                        key={message.id} 
                        className={`mail-item ${!message.isRead ? 'unread' : ''}`}
                        onClick={() => handleEmailClick(message)}
                      >
                        <div className="mail-item-header">
                          <div className="mail-sender">
                            {message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'Unknown'}
                          </div>
                          <div className="mail-meta">
                            <button
                              className={`favorite-button ${isFavorite ? 'favorited' : ''}`}
                              onClick={(e) => toggleFavorite(message.id, e)}
                              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              ⭐
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
              {mailboxNextLink && (
                <div className="load-more-container">
                  <button
                    onClick={loadMoreMessages}
                    className="load-more-button"
                    disabled={loadingMoreMessages}
                  >
                    {loadingMoreMessages ? 'Loading...' : 'Load More Messages'}
                  </button>
                </div>
              )}
            </div>
          )}

          {selectedEmail && (
            <div className="email-detail-view">
              <div className="email-detail-header">
                <button onClick={handleBackToList} className="back-button">
                  ← Back to Mailbox
                </button>
              </div>

              {emailDetailsLoading && (
                <div className="loading-message">Loading email details...</div>
              )}

              {emailDetailsError && (
                <div className="error-message">
                  {emailDetailsError}
                </div>
              )}

              {emailDetails && emailThread.length > 0 && (
                <div className="email-detail-content">
                  <div className="email-detail-subject">
                    {emailDetails.subject || '(No Subject)'}
                  </div>

                  <div className="email-thread">
                    {emailThread.map((message, index) => (
                      <div key={message.id || index} className="email-message-block">
                        <div className="email-message-ids">
                          <div className="message-id-row">
                            <strong>Message ID:</strong>
                            <span className="message-id-value">{message.id || 'N/A'}</span>
                            <button
                              className="copy-button copy-button-inline"
                              onClick={(e) => copyIdsToClipboard(message.id, message.conversationId, e)}
                              title="Copy conversationId and messageId"
                            >
                              {copiedMessageId === message.id ? '✓ Copied' : '📋 Copy'}
                            </button>
                          </div>
                          {message.conversationId && (
                            <div className="message-id-row">
                              <strong>Conversation ID:</strong>
                              <span className="message-id-value">{message.conversationId}</span>
                            </div>
                          )}
                        </div>

                        <div className="email-message-meta">
                          <div className="email-message-meta-row">
                            <strong>From:</strong>
                            <span>
                              {message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'Unknown'}
                              {message.from?.emailAddress?.address && (
                                <span className="email-address"> &lt;{message.from.emailAddress.address}&gt;</span>
                              )}
                            </span>
                          </div>

                          {message.toRecipients && message.toRecipients.length > 0 && (
                            <div className="email-message-meta-row">
                              <strong>To:</strong>
                              <span>
                                {message.toRecipients.map((recipient, idx) => (
                                  <span key={idx}>
                                    {recipient.emailAddress?.name || recipient.emailAddress?.address}
                                    {idx < message.toRecipients.length - 1 && ', '}
                                  </span>
                                ))}
                              </span>
                            </div>
                          )}

                          {message.ccRecipients && message.ccRecipients.length > 0 && (
                            <div className="email-message-meta-row">
                              <strong>CC:</strong>
                              <span>
                                {message.ccRecipients.map((recipient, idx) => (
                                  <span key={idx}>
                                    {recipient.emailAddress?.name || recipient.emailAddress?.address}
                                    {idx < message.ccRecipients.length - 1 && ', '}
                                  </span>
                                ))}
                              </span>
                            </div>
                          )}

                          <div className="email-message-meta-row">
                            <strong>Date:</strong>
                            <span>
                              {message.receivedDateTime 
                                ? new Date(message.receivedDateTime).toLocaleString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })
                                : 'N/A'}
                            </span>
                          </div>

                          {message.hasAttachments && (
                            <div className="email-message-meta-row">
                              <strong>Attachments:</strong>
                              <span>Yes</span>
                            </div>
                          )}

                          {message.importance && (
                            <div className="email-message-meta-row">
                              <strong>Importance:</strong>
                              <span className={`importance-${message.importance.toLowerCase()}`}>
                                {message.importance}
                              </span>
                            </div>
                          )}

                          {Object.entries(singleValueExtendedProperties).map(([key, value]) => (
                            <div className="email-message-meta-row">
                              <strong>{value}:</strong>
                              <span>{message[value] || 'N/A'}</span>
                            </div>
                          ))}
                        </div>

                        <div className="email-detail-body">
                          {message.uniqueBody?.content ? (
                            <div 
                              className="email-body-content"
                              dangerouslySetInnerHTML={{ __html: message.uniqueBody.content }}
                            />
                          ) : message.body?.content ? (
                            <div 
                              className="email-body-content"
                              dangerouslySetInnerHTML={{ __html: message.body.content }}
                            />
                          ) : message.bodyPreview ? (
                            <div className="email-body-preview">
                              {message.bodyPreview}
                            </div>
                          ) : (
                            <div className="email-body-empty">No content available</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        )}

      </div>
    </div>
  )
}

export default Graph
