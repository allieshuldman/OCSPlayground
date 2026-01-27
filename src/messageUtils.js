import { graphConfig } from './authConfig'

// Mapping of singleValueExtendedProperties IDs to property names
export const singleValueExtendedProperties = {
  'String {00020386-0000-0000-C000-000000000046} Name Content-Class': 'ContentClassName',
  'String 0x1A': 'ItemClassName',
  'short {00062008-0000-0000-c000-000000000046} Name CopilotInboxScore': 'PriorityScore',
  'string {00062008-0000-0000-c000-000000000046} Name CopilotInboxScoreReason': 'PriorityReason',
  'string {00062008-0000-0000-c000-000000000046} Name CopilotInboxHeadline': 'PriorityHeadline',
}

/**
 * Processes singleValueExtendedProperties and adds them to the message object
 * @param {Object} message - The message object
 */
export const processExtendedProperties = (message) => {
  if (message.singleValueExtendedProperties && Array.isArray(message.singleValueExtendedProperties)) {
    const lowercaseSingleValueExtendedProperties = Object.fromEntries(
      Object.entries(singleValueExtendedProperties).map(([key, value]) => [key.toLowerCase(), value])
    )
    
    message.singleValueExtendedProperties.forEach(extendedProp => {
      const property = lowercaseSingleValueExtendedProperties[extendedProp.id?.toLowerCase()]
      if (property && extendedProp.value !== undefined) {
        message[property] = extendedProp.value
      }
    })
  }
  return message
}

/**
 * Fetches a single message with extended properties
 * @param {string} bearerToken - The bearer token for authentication
 * @param {string} messageId - The message ID to fetch
 * @param {AbortSignal} signal - Optional abort signal for request cancellation
 * @returns {Promise<Object>} The message data with processed extended properties
 */
export const fetchMessageDetails = async (bearerToken, messageId, signal = null) => {
  if (!bearerToken || !messageId) {
    throw new Error('Bearer token and message ID are required')
  }

  const encodedMessageId = encodeURIComponent(messageId)
  const singleValueExtendedPropertiesKeys = Object.keys(singleValueExtendedProperties)
  const propertiesClause = singleValueExtendedPropertiesKeys.map(property => `id eq '${property}'`).join(' or ')
  const expandClause = `$expand=singleValueExtendedProperties($filter=(${propertiesClause}))`
  const selectClause = '$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,isRead,body,bodyPreview,uniqueBody,hasAttachments,importance,conversationId,flag,attachments'

  const url = `${graphConfig.graphMeMailEndpoint}/${encodedMessageId}?${selectClause}&${expandClause}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    signal: signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.error?.message || errorData.error?.code || response.statusText
    const error = new Error(errorMessage || 'Failed to fetch message details')
    error.status = response.status
    throw error
  }

  const messageData = await response.json()
  return processExtendedProperties(messageData)
}

/**
 * Parses an error response from the API
 * @param {Response} response - The fetch response object
 * @returns {Promise<string>} The error message
 */
export const parseErrorResponse = async (response) => {
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

/**
 * Folder name mapping for Microsoft Graph API
 */
const folderMap = {
  inbox: 'Inbox',
  sent: 'SentItems',
  drafts: 'Drafts',
  deleted: 'DeletedItems',
  junk: 'JunkEmail',
  archive: 'Archive',
}

/**
 * Fetches messages from a mailbox folder
 * @param {string} bearerToken - The bearer token for authentication
 * @param {string} folder - The folder name (e.g., 'inbox', 'sent')
 * @param {Object} options - Optional configuration
 * @param {number} options.top - Number of messages to fetch (default: 20)
 * @param {string} options.select - Fields to select (default: basic fields)
 * @param {AbortSignal} options.signal - Optional abort signal
 * @returns {Promise<Array>} Array of message objects
 */
export const fetchMailbox = async (bearerToken, folder = 'inbox', options = {}) => {
  if (!bearerToken) {
    throw new Error('Bearer token is required')
  }

  const { top = 20, select = 'id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments,conversationId', signal = null } = options

  const folderId = folderMap[folder.toLowerCase()] || 'Inbox'
  
  const queryParams = new URLSearchParams({
    '$top': top.toString(),
    '$orderby': 'receivedDateTime desc',
    '$select': select
  })
  
  // For inbox, use the simpler /me/messages endpoint
  // For other folders, use the folder-specific endpoint
  const endpoint = folderId === 'Inbox' 
    ? `${graphConfig.graphMeMailEndpoint}?${queryParams.toString()}`
    : `${graphConfig.graphMeMailEndpoint.replace('/messages', `/mailFolders/${encodeURIComponent(folderId)}/messages`)}?${queryParams.toString()}`

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    signal: signal,
  })

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response)
    let userFriendlyError = errorMessage
    if (errorMessage.includes('InvalidAudience') || errorMessage.includes('invalid audience')) {
      userFriendlyError = 'Invalid Audience Error: The token provided is not valid for Microsoft Graph API.'
    } else if (response.status === 401) {
      userFriendlyError = 'Authentication Error: The token is invalid or expired.'
    } else if (response.status === 403) {
      userFriendlyError = 'Permission Error: The token does not have Mail.Read permission.'
    } else if (response.status === 404) {
      userFriendlyError = `Folder "${folderId}" not found. Please check the folder name.`
    }
    throw new Error(userFriendlyError)
  }

  const mailData = await response.json()
  return mailData.value || []
}

/**
 * Fetches favorite messages by their IDs
 * @param {string} bearerToken - The bearer token for authentication
 * @param {Array<string>} messageIds - Array of message IDs to fetch
 * @param {Object} options - Optional configuration
 * @param {number} options.timeout - Timeout in milliseconds (default: 10000)
 * @param {string} options.select - Fields to select (default: basic fields)
 * @returns {Promise<Array>} Array of message objects, sorted by receivedDateTime desc
 */
export const fetchFavoriteMessages = async (bearerToken, messageIds, options = {}) => {
  if (!bearerToken) {
    throw new Error('Bearer token is required')
  }

  if (!messageIds || messageIds.length === 0) {
    return []
  }

  const { timeout = 10000, select = 'id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments,conversationId' } = options

  // Fetch all favorite messages in parallel with timeout
  const messagePromises = messageIds.map(async (messageId) => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const encodedMessageId = encodeURIComponent(messageId)
      const response = await fetch(
        `${graphConfig.graphMeMailEndpoint}/${encodedMessageId}?$select=${select}`,
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
  return messages
    .filter(msg => msg !== null)
    .sort((a, b) => {
      const dateA = new Date(a.receivedDateTime || 0)
      const dateB = new Date(b.receivedDateTime || 0)
      return dateB - dateA
    })
}

/**
 * Fetches messages by conversation ID
 * @param {string} bearerToken - The bearer token for authentication
 * @param {string} conversationId - The conversation ID
 * @param {Object} options - Optional configuration
 * @param {string} options.messageId - Optional specific message ID to fetch
 * @param {AbortSignal} options.signal - Optional abort signal
 * @returns {Promise<Array>} Array of message objects (most recent if no messageId provided)
 */
export const fetchByConversationId = async (bearerToken, conversationId, options = {}) => {
  if (!bearerToken || !conversationId) {
    throw new Error('Bearer token and conversation ID are required')
  }

  const { messageId = null, signal = null } = options

  let messages = []

  // If messageId is provided, fetch that specific message and verify it matches the conversationId
  if (messageId) {
    const encodedMessageId = encodeURIComponent(messageId)
    const messageResponse = await fetch(
      `${graphConfig.graphMeMailEndpoint}/${encodedMessageId}?$select=id,conversationId,receivedDateTime`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        signal: signal,
      }
    )

    if (!messageResponse.ok) {
      throw new Error('Message not found or access denied')
    }

    const messageData = await messageResponse.json()
    
    // Verify the message belongs to the specified conversation
    if (messageData.conversationId !== conversationId) {
      throw new Error('Message does not belong to the specified conversation ID')
    }

    messages = [messageData]
  } else {
    // Fetch messages by conversationId with filter
    const encodedConversationId = encodeURIComponent(conversationId)
    // Construct OData filter with properly encoded conversationId
    const filterValue = `conversationId eq '${encodedConversationId}'`
    
    const recentResponse = await fetch(
      `${graphConfig.graphMeMailEndpoint}?$filter=${filterValue}&$select=id,conversationId,receivedDateTime`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        signal: signal,
      }
    )

    if (!recentResponse.ok) {
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

  return messages
}

/**
 * Fetches recent messages (helper function)
 * @param {string} bearerToken - The bearer token for authentication
 * @param {Object} options - Optional configuration
 * @param {number} options.top - Number of messages to fetch (default: 100)
 * @param {string} options.orderby - Order by field (default: 'receivedDateTime desc')
 * @returns {Promise<Array>} Array of message objects
 */
export const fetchRecentMessages = async (bearerToken, options = {}) => {
  if (!bearerToken) {
    throw new Error('Bearer token is required')
  }

  const { top = 100, orderby = 'receivedDateTime desc' } = options

  const response = await fetch(
    `${graphConfig.graphMeMailEndpoint}?$top=${top}&$orderby=${orderby}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response)
    throw new Error(errorMessage || 'Failed to fetch recent messages')
  }

  const data = await response.json()
  return data.value || []
}

/**
 * Fetches all messages in a conversation thread
 * @param {string} bearerToken - The bearer token for authentication
 * @param {string} conversationId - The conversation ID
 * @param {Object} options - Optional configuration
 * @param {Object} options.fallbackEmail - Fallback email to return if thread fetch fails
 * @returns {Promise<Array>} Array of message objects with full details, sorted by receivedDateTime ascending
 */
export const fetchEmailThread = async (bearerToken, conversationId, options = {}) => {
  if (!bearerToken || !conversationId) {
    throw new Error('Bearer token and conversation ID are required')
  }

  const { fallbackEmail = null } = options

  try {
    // Fetch recent messages and filter by conversationId client-side
    // This avoids the InefficientFilter error
    const recentMessages = await fetchRecentMessages(bearerToken, { top: 100 })
    const filteredMessages = recentMessages.filter(
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
      
      return await Promise.all(messageDetailsPromises)
    } else {
      // No matching messages found, use fallback
      return fallbackEmail ? [fallbackEmail] : []
    }
  } catch (err) {
    console.error('Error fetching email thread:', err)
    // If thread fetch fails, just show the single email
    return fallbackEmail ? [fallbackEmail] : []
  }
}
