import axios from 'axios'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

// Google Apps for the Grid Icon
export const GOOGLE_APPS = [
  {
    name: 'Gmail',
    icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
    url: 'https://mail.google.com',
    color: 'bg-red-50 text-red-600',
    iconSize: 'w-8 h-8'
  },
  {
    name: 'Drive',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png',
    url: 'https://drive.google.com',
    color: 'bg-blue-50 text-blue-600',
    iconSize: 'w-8 h-8'
  },
  {
    name: 'Docs',
    icon: 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_document_x128.png',
    url: 'https://docs.google.com',
    color: 'bg-blue-50 text-blue-600',
    iconSize: 'w-8 h-8'
  },
  {
    name: 'Sheets',
    icon: 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_spreadsheet_x128.png',
    url: 'https://sheets.google.com',
    color: 'bg-green-50 text-green-600',
    iconSize: 'w-8 h-8'
  },
  {
    name: 'Slides',
    icon: 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_presentation_x128.png',
    url: 'https://slides.google.com',
    color: 'bg-yellow-50 text-yellow-600',
    iconSize: 'w-8 h-8'
  },
  {
    name: 'Calendar',
    icon: 'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_31.ico',
    url: 'https://calendar.google.com',
    color: 'bg-blue-50 text-blue-600',
    iconSize: 'w-8 h-8'
  },
  {
    name: 'Meet',
    icon: 'https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v6/web-64dp/logo_meet_2020q4_color_2x_web_64dp.png',
    url: 'https://meet.google.com',
    color: 'bg-green-50 text-green-600',
    iconSize: 'w-8 h-8'
  },
  {
    name: 'Photos',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/photos_48dp.png',
    url: 'https://photos.google.com',
    color: 'bg-pink-50 text-pink-600',
    iconSize: 'w-8 h-8'
  }
]

// Initialize Google API for OAuth
export const initGoogleAuth = (callback) => {
  if (typeof window === 'undefined') return

  // Load Google Identity Services script
  if (!window.google) {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      // Disable automatic One Tap to prevent CORS errors on unconfigured domains
      try {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.cancel()
        }
      } catch (e) {
        // Silently ignore
      }
      if (callback) callback()
    }
    document.body.appendChild(script)
  } else {
    // Cancel any automatic prompts
    try {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel()
      }
    } catch (e) {
      // Silently ignore
    }
    if (callback) callback()
  }
}

// Google Sign-In Handler (using OAuth2 popup for explicit button clicks)
export const handleGoogleSignIn = (onSuccess, onError) => {
  if (!window.google) {
    onError?.('Google API not loaded')
    return
  }

  try {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: async (response) => {
        if (response.access_token) {
          try {
            // Fetch user info using the access token
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: {
                Authorization: `Bearer ${response.access_token}`
              }
            })
            const userInfo = await userInfoResponse.json()
            onSuccess?.(userInfo, response.access_token)
          } catch (error) {
            onError?.('Failed to fetch user information')
          }
        } else {
          onError?.('No access token received')
        }
      },
      error_callback: (error) => {
        onError?.('Sign-in was cancelled or failed')
      }
    })

    client.requestAccessToken()
  } catch (error) {
    onError?.('Failed to initialize Google Sign-In')
  }
}

// Request Google Drive and Gmail Access
export const requestGoogleDocsAccess = async (onSuccess, onError) => {
  if (!window.google) {
    onError?.('Google API not loaded')
    return
  }

  try {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/gmail.readonly',
      callback: (response) => {
        if (response.access_token) {
          onSuccess?.(response.access_token)
        } else {
          onError?.('Failed to get access token')
        }
      },
    })

    client.requestAccessToken()
  } catch (error) {
    onError?.(error)
  }
}

// Fetch Google Drive Files with optional app filter
export const fetchGoogleDriveFiles = async (accessToken, appType = 'all') => {
  if (!accessToken) {
    throw new Error('No access token provided')
  }

  let query = "trashed=false"
  
  // Filter by specific app/MIME type
  if (appType === 'sheets') {
    query += " and mimeType='application/vnd.google-apps.spreadsheet'"
  } else if (appType === 'docs') {
    query += " and mimeType='application/vnd.google-apps.document'"
  } else if (appType === 'slides') {
    query += " and mimeType='application/vnd.google-apps.presentation'"
  } else if (appType === 'drive') {
    // Exclude Google Workspace files, show only uploaded files
    query += " and mimeType!='application/vnd.google-apps.folder'"
  }

  try {
    const response = await axios.get(
      'https://www.googleapis.com/drive/v3/files',
      {
        params: {
          pageSize: 50,
          fields: 'files(id, name, mimeType, webViewLink, iconLink, thumbnailLink, createdTime, modifiedTime, owners)',
          orderBy: 'modifiedTime desc',
          q: query
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    )
    return response.data.files || []
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error('Access denied. Please ensure Drive permissions are granted.')
    } else if (error.response?.status === 401) {
      throw new Error('Invalid or expired token. Please reconnect your Google account.')
    }
    throw new Error('Failed to fetch Drive files. Please try again.')
  }
}

// Get app type from MIME type
export const getAppTypeFromMime = (mimeType) => {
  if (mimeType?.includes('spreadsheet')) return 'sheets'
  if (mimeType?.includes('document')) return 'docs'
  if (mimeType?.includes('presentation')) return 'slides'
  if (mimeType?.includes('pdf')) return 'pdf'
  return 'drive'
}

// Get app display name
export const getAppDisplayName = (appType) => {
  const names = {
    sheets: 'Google Sheets',
    docs: 'Google Docs',
    slides: 'Google Slides',
    gmail: 'Gmail',
    drive: 'Google Drive',
    pdf: 'PDF'
  }
  return names[appType] || 'Google Drive'
}

// Get app icon/color with official Google icons
export const getAppIcon = (appType) => {
  const icons = {
    sheets: { 
      emoji: '📊', 
      color: 'bg-green-50 text-green-600', 
      border: 'border-green-200',
      iconUrl: 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_spreadsheet_x128.png'
    },
    docs: { 
      emoji: '📄', 
      color: 'bg-blue-50 text-blue-600', 
      border: 'border-blue-200',
      iconUrl: 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_document_x128.png'
    },
    slides: { 
      emoji: '📽️', 
      color: 'bg-yellow-50 text-yellow-600', 
      border: 'border-yellow-200',
      iconUrl: 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_presentation_x128.png'
    },
    gmail: { 
      emoji: '📧', 
      color: 'bg-red-50 text-red-600', 
      border: 'border-red-200',
      iconUrl: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico'
    },
    drive: { 
      emoji: '📁', 
      color: 'bg-blue-50 text-blue-600', 
      border: 'border-blue-200',
      iconUrl: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png'
    },
    pdf: { 
      emoji: '📕', 
      color: 'bg-red-50 text-red-600', 
      border: 'border-red-200',
      iconUrl: 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_pdf_x128.png'
    }
  }
  return icons[appType] || icons.drive
}

// Fetch Gmail Attachments with full details (sender, subject, etc.)
export const fetchGmailAttachments = async (accessToken) => {
  if (!accessToken) {
    return []
  }

  try {
    // First, get messages with attachments (fetch more for better coverage)
    const messagesResponse = await axios.get(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      {
        params: {
          q: 'has:attachment',
          maxResults: 50
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    )

    const messages = messagesResponse.data.messages || []
    if (messages.length === 0) {
      return []
    }

    const attachments = []

    // Fetch details for each message (limit to 20 to balance coverage and rate limits)
    for (const message of messages.slice(0, 20)) {
      try {
        const messageDetail = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            params: {
              format: 'full'
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        )

        const headers = messageDetail.data.payload?.headers || []
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No Subject'
        const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender'
        const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || ''
        
        // Parse sender name and email
        const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/)
        const senderName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : from
        const senderEmail = fromMatch ? fromMatch[2] : from

        // Helper to extract attachments recursively from parts
        const extractAttachments = (parts, parentMessageId) => {
          if (!parts) return
          for (const part of parts) {
            // Check for nested parts (multipart messages)
            if (part.parts) {
              extractAttachments(part.parts, parentMessageId)
            }
            
            // Check if this part is an attachment
            if (part.filename && part.filename.length > 0) {
              const attachmentId = part.body?.attachmentId
              const size = part.body?.size || 0
              
              // Get MIME type and determine if it's a viewable document
              const mimeType = part.mimeType || 'application/octet-stream'
              const isDocument = mimeType.includes('pdf') || 
                                 mimeType.includes('document') || 
                                 mimeType.includes('spreadsheet') ||
                                 mimeType.includes('presentation') ||
                                 mimeType.includes('text') ||
                                 mimeType.includes('image')
              
              // Determine file type icon
              let fileIcon = '📎'
              if (mimeType.includes('pdf')) fileIcon = '📕'
              else if (mimeType.includes('image')) fileIcon = '🖼️'
              else if (mimeType.includes('document') || mimeType.includes('word')) fileIcon = '📄'
              else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) fileIcon = '📊'
              else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) fileIcon = '📽️'
              else if (mimeType.includes('zip') || mimeType.includes('archive')) fileIcon = '📦'
              else if (mimeType.includes('video')) fileIcon = '🎬'
              else if (mimeType.includes('audio')) fileIcon = '🎵'
              
              attachments.push({
                id: attachmentId || `${parentMessageId}-${part.partId}`,
                messageId: parentMessageId,
                partId: part.partId,
                filename: part.filename,
                mimeType: mimeType,
                size: size,
                date: messageDetail.data.internalDate,
                subject: subject,
                senderName: senderName,
                senderEmail: senderEmail,
                from: from,
                isDocument: isDocument,
                fileIcon: fileIcon,
                snippet: messageDetail.data.snippet || '',
                threadId: messageDetail.data.threadId,
                labelIds: messageDetail.data.labelIds || []
              })
            }
          }
        }

        const payload = messageDetail.data.payload
        extractAttachments(payload?.parts, message.id)
        
        // Also check the main payload body for inline attachments
        if (payload?.filename && payload?.body?.attachmentId) {
          const mimeType = payload.mimeType || 'application/octet-stream'
          let fileIcon = '📎'
          if (mimeType.includes('pdf')) fileIcon = '📕'
          else if (mimeType.includes('image')) fileIcon = '🖼️'
          
          attachments.push({
            id: payload.body.attachmentId,
            messageId: message.id,
            partId: '0',
            filename: payload.filename,
            mimeType: mimeType,
            size: payload.body.size || 0,
            date: messageDetail.data.internalDate,
            subject: subject,
            senderName: senderName,
            senderEmail: senderEmail,
            from: from,
            isDocument: true,
            fileIcon: fileIcon,
            snippet: messageDetail.data.snippet || '',
            threadId: messageDetail.data.threadId,
            labelIds: messageDetail.data.labelIds || []
          })
        }
      } catch (err) {
        // Skip this message if it fails
        console.warn('Failed to fetch message details:', err)
        continue
      }
    }

    // Sort by date (newest first)
    attachments.sort((a, b) => parseInt(b.date) - parseInt(a.date))

    return attachments
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error('Gmail access denied. Please ensure Gmail permissions are granted.')
    } else if (error.response?.status === 401) {
      throw new Error('Invalid or expired token. Please reconnect your Google account.')
    }
    // Return empty array instead of throwing for Gmail errors
    return []
  }
}

// Download Gmail Attachment - returns blob URL for preview/download
export const downloadGmailAttachment = async (accessToken, messageId, attachmentId) => {
  if (!accessToken || !messageId || !attachmentId) {
    throw new Error('Missing required parameters')
  }

  try {
    const response = await axios.get(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    )

    // Gmail returns base64url encoded data
    const base64Data = response.data.data
    // Convert base64url to base64
    const base64 = base64Data.replace(/-/g, '+').replace(/_/g, '/')
    
    // Decode base64 to binary
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    return bytes
  } catch (error) {
    console.error('Failed to download attachment:', error)
    throw new Error('Failed to download attachment')
  }
}

// Get preview URL for Gmail attachment
export const getGmailAttachmentPreviewUrl = async (accessToken, messageId, attachmentId, mimeType, filename) => {
  try {
    const bytes = await downloadGmailAttachment(accessToken, messageId, attachmentId)
    const blob = new Blob([bytes], { type: mimeType })
    return URL.createObjectURL(blob)
  } catch (error) {
    console.error('Failed to get preview URL:', error)
    return null
  }
}

// Check for new Gmail messages with attachments (for real-time sync)
export const checkNewGmailAttachments = async (accessToken, lastCheckTime) => {
  if (!accessToken) {
    return { hasNew: false, attachments: [] }
  }

  try {
    // Query for messages newer than lastCheckTime
    const afterDate = lastCheckTime ? Math.floor(lastCheckTime / 1000) : Math.floor((Date.now() - 3600000) / 1000)
    
    const messagesResponse = await axios.get(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      {
        params: {
          q: `has:attachment after:${afterDate}`,
          maxResults: 10
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    )

    const messages = messagesResponse.data.messages || []
    if (messages.length === 0) {
      return { hasNew: false, attachments: [] }
    }

    // Fetch full details for new messages
    const newAttachments = await fetchGmailAttachments(accessToken)
    const filteredAttachments = newAttachments.filter(att => parseInt(att.date) > (lastCheckTime || 0))

    return {
      hasNew: filteredAttachments.length > 0,
      attachments: filteredAttachments
    }
  } catch (error) {
    console.error('Failed to check for new Gmail attachments:', error)
    return { hasNew: false, attachments: [] }
  }
}

// Helper function to parse JWT token
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error('Error parsing JWT:', error)
    return null
  }
}

// Store Google Access Token
export const setGoogleAccessToken = (token) => {
  localStorage.setItem('google_access_token', token)
}

export const getGoogleAccessToken = () => {
  return localStorage.getItem('google_access_token')
}

export const removeGoogleAccessToken = () => {
  localStorage.removeItem('google_access_token')
}

export const isGoogleConnected = () => {
  return !!getGoogleAccessToken()
}

// Store Google Calendar Access Token
export const setGoogleCalendarToken = (token) => {
  localStorage.setItem('google_calendar_token', token)
}

export const getGoogleCalendarToken = () => {
  return localStorage.getItem('google_calendar_token')
}

export const removeGoogleCalendarToken = () => {
  localStorage.removeItem('google_calendar_token')
}

// Request Google Calendar Access
export const requestGoogleCalendarAccess = async (onSuccess, onError) => {
  if (!window.google) {
    onError?.('Google API not loaded')
    return
  }

  try {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      // Request read+write calendar permissions so the app can create events (Meet links)
      scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
      callback: (response) => {
        if (response.access_token) {
          onSuccess?.(response.access_token)
        } else {
          onError?.('Failed to get calendar access token')
        }
      },
    })

    client.requestAccessToken()
  } catch (error) {
    onError?.(error)
  }
}

// Fetch Google Calendar Events
export const fetchGoogleCalendarEvents = async (accessToken) => {
  if (!accessToken) {
    throw new Error('No access token provided')
  }

  try {
    const timeMin = new Date().toISOString()
    const response = await axios.get(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        params: {
          timeMin: timeMin,
          maxResults: 50,
          singleEvents: true,
          orderBy: 'startTime'
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    )
    return response.data.items || []
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error('Calendar access denied. Please ensure Calendar permissions are granted.')
    } else if (error.response?.status === 401) {
      throw new Error('Invalid or expired token. Please reconnect your Google account.')
    }
    throw new Error('Failed to fetch calendar events. Please try again.')
  }
}

// Create a calendar event with an attached Google Meet link.
export const createCalendarEvent = async (accessToken, {summary, description, startDateTime, endDateTime, attendees = [], ephemeral = false}) => {
  if (!accessToken) throw new Error('No access token provided')

  // Build attendees array in expected format
  const formattedAttendees = (attendees || []).map(email => ({email}))

  const body = {
    summary: summary || 'Meeting',
    description: description || '',
    start: {dateTime: startDateTime},
    end: {dateTime: endDateTime},
    attendees: formattedAttendees,
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  }

  // Mark ephemeral (live) meetings so the frontend can ignore them in the
  // calendar UI. Use extendedProperties.private.ephemeral_meet = 'true'
  if (ephemeral) {
    body.extendedProperties = body.extendedProperties || {}
    body.extendedProperties.private = body.extendedProperties.private || {}
    body.extendedProperties.private.ephemeral_meet = 'true'
  }

  try {
    const resp = await axios.post(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    return resp.data
  } catch (err) {
    if (err.response?.status === 401) throw new Error('Invalid or expired token')
    if (err.response?.status === 403) throw new Error('Calendar access denied')
    throw err
  }
}
