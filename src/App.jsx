import React, { useState, useEffect, useRef, useMemo } from "react"
import {
  Send,
  Hash,
  Users,
  Search,
  Plus,
  Bell,
  Paperclip,
  Edit2,
  Trash2,
  MessageSquare,
  X,
  ChevronDown,
  ChevronRight,
  Menu,
  Video,
  Info,
  Mail,
  UserPlus,
  Check,
  Sparkles,
  GraduationCap,
  Briefcase,
  User as UserIcon,
  MessageCircle,
  LogIn,
  UserPlus as UserPlusIcon,
  CheckCircle,
  XCircle,
  File as FileIcon,
  Calendar,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Phone,
  Lock,
  ExternalLink,
  ShieldAlert,
  Grid3x3,
  FileText,
  ClipboardList,
  Download,
  Clock,
  Sun,
  Moon,
  Monitor,
  PenTool,
  Settings,
  MoreVertical,
  Smile,
  LogOut
} from "lucide-react"
import * as Storage from "./services/storage"
import { getStoredUser, getToken, logout as authLogout, saveAuth } from "./services/auth"
import * as GoogleService from "./services/google"
import { connectChatSocket, connectUserSocket } from "./services/ws"
import TaskModal from "./components/TaskModal"
import * as TasksService from "./services/tasks"
import * as RolesService from "./services/roles"
import AdminDashboard from "./AdminDashboard"

// Backend API base used for uploads and metadata fetches
// Prefer explicit env `VITE_API_URL`. If it's missing or malformed (e.g. ":8000"),
// build a proper origin using the current window location so fetch() calls don't
// try to hit an invalid host like ":8000" which causes ERR_CONNECTION_REFUSED.
let API_BASE = "http://localhost:8000"
try {
  const raw = import.meta.env.VITE_API_URL || ''
  if (raw && typeof raw === 'string') {
    // If raw already contains protocol, use it
    if (/^https?:\/\//.test(raw)) {
      API_BASE = raw
    } else if (/^:\d+/.test(raw)) {
      // raw like ":8000" -> build origin with current host + port
      if (typeof window !== 'undefined') {
        API_BASE = `${window.location.protocol}//${window.location.hostname}${raw}`
      } else {
        API_BASE = `http://localhost${raw}`
      }
    } else if (raw.startsWith('//')) {
      // protocol-relative
      if (typeof window !== 'undefined') API_BASE = `${window.location.protocol}${raw}`
      else API_BASE = `http:${raw}`
    } else if (raw.length > 0) {
      // assume a host maybe without protocol (e.g. "localhost:8000")
      if (/^[A-Za-z0-9.-]+:\d+$/.test(raw) && typeof window !== 'undefined') {
        API_BASE = `${window.location.protocol}//${raw}`
      } else if (/^[A-Za-z0-9.-]+(:\d+)?$/.test(raw)) {
        API_BASE = `http://${raw}`
      } else {
        // fallback to raw value
        API_BASE = raw
      }
    } else {
      if (typeof window !== 'undefined') API_BASE = window.location.origin
    }
  } else if (typeof window !== 'undefined') {
    API_BASE = window.location.origin
  }
} catch (e) {
  // keep default
}

// Custom hook to detect window size for responsive design
function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  })

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    
    window.addEventListener('resize', handleResize)
    handleResize() // Call on mount
    
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return windowSize
}

export default function CollaborationApp() {
  // Mobile responsive detection
  const { width: windowWidth } = useWindowSize()
  const isMobile = windowWidth < 768
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return <AdminDashboard />
  }
  const [mobileView, setMobileView] = useState("chat") // "spaces" | "chat" | "friends"
  const [showMobileDrawer, setShowMobileDrawer] = useState(false) // Mobile drawer menu

  // Dark Mode State - persisted to localStorage
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('spacexyz-dark-mode')
    return saved ? JSON.parse(saved) : false
  })

  // Apply dark mode class to document when it changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('spacexyz-dark-mode', JSON.stringify(isDarkMode))
  }, [isDarkMode])

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [showLandingPage, setShowLandingPage] = useState(true) // Landing page state
  const [authMode, setAuthMode] = useState("login")
  const [authData, setAuthData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: ""
  })
  const [authError, setAuthError] = useState("")
  const [authSuccess, setAuthSuccess] = useState("")

  // Main Data State
  const [spaces, setSpaces] = useState([])
  const [users, setUsers] = useState([])
  const [friends, setFriends] = useState([])
  const [events, setEvents] = useState([])

  // UI State
  const [activeSpace, setActiveSpace] = useState(null)
  const [activeChannel, setActiveChannel] = useState(null)
  const [activeView, setActiveView] = useState("channel")
  const [activeDMUser, setActiveDMUser] = useState(null)

  const [messages, setMessages] = useState({})
  const [unreadChannels, setUnreadChannels] = useState([]) // Track unread channel IDs
  const [messageCounts, setMessageCounts] = useState({}) // Track counts to detect changes

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [friendsSidebarCollapsed, setFriendsSidebarCollapsed] = useState(true)

  // Search State
  const [searchQuery, setSearchQuery] = useState("") // Spaces Search Input
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [spaceSearchResults, setSpaceSearchResults] = useState([])

  const [dmSearchQuery, setDmSearchQuery] = useState("") // DMs Search Input
  const [debouncedDmSearchQuery, setDebouncedDmSearchQuery] = useState("")
  const [dmSearchResults, setDmSearchResults] = useState([])

  // Search Highlighting & Navigation
  const [highlightTerm, setHighlightTerm] = useState("")
  const [targetMessageId, setTargetMessageId] = useState(null)
  const [pinnedMessageId, setPinnedMessageId] = useState(null)
  const [hoveredMessageId, setHoveredMessageId] = useState(null)
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState(null)

  // Modals & Panels
  const [messageInput, setMessageInput] = useState("")
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false)
  const [showAddFriendModal, setShowAddFriendModal] = useState(false)
  const [showAddToSpaceModal, setShowAddToSpaceModal] = useState(false)
  const [showNotificationsModal, setShowNotificationsModal] = useState(false)
  const [showMemberDetails, setShowMemberDetails] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showNewEventForm, setShowNewEventForm] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [tasksList, setTasksList] = useState([])
  const alertedScheduledRef = useRef(new Set())
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  // Organization registration modal state
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [orgForm, setOrgForm] = useState({ name: "", adminEmail: "", domain: "", logoUrl: "" })
  const [orgStage, setOrgStage] = useState("form") // form | otp | dns | verified
  const [orgError, setOrgError] = useState("")
  const [orgMessage, setOrgMessage] = useState("")
  const [orgOtp, setOrgOtp] = useState("")
  const [orgOtpExpiresAt, setOrgOtpExpiresAt] = useState(null)
  // Set-password modal state (shown to admin after DNS verification)
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false)
  const [setPasswordEmail, setSetPasswordEmail] = useState("")
  const [setPasswordValue, setSetPasswordValue] = useState("")
  const [setPasswordError, setSetPasswordError] = useState("")
  const [setPasswordLoading, setSetPasswordLoading] = useState(false)
  const [pendingAdminUserId, setPendingAdminUserId] = useState(null)

  const handleSetPasswordSubmit = async () => {
    setSetPasswordError("")
    if (!setPasswordValue || setPasswordValue.length < 6) {
      setSetPasswordError('Password must be at least 6 characters')
      return
    }
    setSetPasswordLoading(true)
    try {
      const res = await fetch(`${API_BASE}/users/set-password`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: setPasswordEmail, password: setPasswordValue }) })
      const j = await res.json()
      if (!res.ok) {
        setSetPasswordError(j.detail || j.error || 'Failed to set password')
        setSetPasswordLoading(false)
        return
      }
      // on success, save auth and mark authenticated
      try {
        const user = j.user
        const token = j.token
        saveAuth(user, token)
        setCurrentUser(user)
        setIsAuthenticated(true)
        setActiveView('channel')
        setShowAdminDashboard(true)
      } catch (e) {
        console.error('Failed during post-set-password login', e)
      }
      setShowSetPasswordModal(false)
      setShowOrgModal(false)
    } catch (e) {
      setSetPasswordError('Request failed')
    }
    setSetPasswordLoading(false)
  }
  const [orgDnsStatus, setOrgDnsStatus] = useState(null)
  const [orgDnsChecking, setOrgDnsChecking] = useState(false)
  const orgDnsPollRef = useRef(null)
  const [orgDnsVerified, setOrgDnsVerified] = useState(false)
  // Clear any DNS polling if modal closed or component unmounts
  useEffect(() => {
    if (!showOrgModal) {
      try { if (orgDnsPollRef.current) { clearInterval(orgDnsPollRef.current); orgDnsPollRef.current = null } } catch (e) {}
      setOrgDnsChecking(false)
    }
    return () => {
      try { if (orgDnsPollRef.current) { clearInterval(orgDnsPollRef.current); orgDnsPollRef.current = null } } catch (e) {}
    }
  }, [showOrgModal])
  // Admin dashboard state
  const [orgInfo, setOrgInfo] = useState(null)
  const [orgDnsToken, setOrgDnsToken] = useState(null)
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [adminUsers, setAdminUsers] = useState([])
  const [adminSearch, setAdminSearch] = useState("")
  const adminSocketRef = useRef(null)
  const [adminOnlineSet, setAdminOnlineSet] = useState(new Set())

  // Load organization info when currentUser changes (by domain)
  useEffect(() => {
    (async () => {
      try {
        if (!currentUser || !currentUser.email) { setOrgInfo(null); return }
        const m = (currentUser.email.match(/@([A-Za-z0-9.-]+)$/) || [])
        const domain = m[1]
        if (!domain) { setOrgInfo(null); return }
        const res = await fetch(`${API_BASE}/api/org/org/${encodeURIComponent(domain)}`)
        if (res.ok) {
          const j = await res.json()
          setOrgInfo(j)
        } else {
          setOrgInfo(null)
        }
      } catch (e) {
        setOrgInfo(null)
      }
    })()
  }, [currentUser])

  // When admin dashboard opens, connect to notifications socket to receive presence updates
  useEffect(() => {
    if (!showAdminDashboard) return
    const sock = connectUserSocket(data => {
      if (!data) return
      if (data.type === 'presence_update') {
        setAdminOnlineSet(new Set(data.online_users || []))
      }
    })
    adminSocketRef.current = sock
    return () => {
      try { sock.close(); adminSocketRef.current = null } catch (e) {}
    }
  }, [showAdminDashboard])
  // When organization becomes verified, auto-close modal and open Spaces (channel) view
  useEffect(() => {
    console.log('orgStage changed:', orgStage)
    if (orgStage === 'verified') {
      console.log('orgStage is verified — running auto-login flow')
      try { setShowOrgModal(false) } catch (e) {}
      try { setActiveView('channel') } catch (e) {}
      try { setShowAdminDashboard(true) } catch (e) {}
      (async () => {
        try {
          const domain = (orgForm && orgForm.domain) || (orgInfo && orgInfo.domain) || ''
          if (!domain) return

          // refresh org info
          let oj = orgInfo
          try {
            const resOrg = await fetch(`${API_BASE}/api/org/org/${encodeURIComponent(domain)}`)
            if (resOrg.ok) { oj = await resOrg.json(); setOrgInfo(oj) }
          } catch (e) {}

          // fetch users for domain and try to auto-login the org admin
          try {
            const resUsers = await fetch(`${API_BASE}/users/by-domain/${encodeURIComponent(domain)}`)
            if (resUsers.ok) {
              const uj = await resUsers.json()
              const usersList = Array.isArray(uj) ? uj : []
              setAdminUsers(usersList)

              // prefer admin email from the original registration form, then org record
              const adminEmail = (orgForm && orgForm.adminEmail) || (oj && oj.adminEmail) || ''
              let adminUser = null
              if (adminEmail) adminUser = usersList.find(u => String(u.email).toLowerCase() === String(adminEmail).toLowerCase())
              if (!adminUser) adminUser = usersList.find(u => u.role === 'org_admin' || u.role === 'admin')
              if (!adminUser && usersList.length > 0) adminUser = usersList[0]

              // Always prompt the admin email to create a password (use form value or org record)
              const promptEmail = (orgForm && orgForm.adminEmail) || (oj && oj.adminEmail) || ''
              if (promptEmail) {
                try { setSetPasswordEmail(promptEmail) } catch (e) {}
                try { if (adminUser) setPendingAdminUserId(adminUser.id) } catch (e) {}
                try { setShowSetPasswordModal(true) } catch (e) {}
              }
            }
          } catch (e) {
            console.error('Failed fetching users for domain during auto-login', e)
          }
        } catch (e) {
          console.error('Auto-open after org verified failed', e)
        }
      })()
    }
  }, [orgStage])
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false)
  const [showAddFriendConfirm, setShowAddFriendConfirm] = useState(null) // ID of user to add

  // Management Modals
  const [showRenameModal, setShowRenameModal] = useState(null)
  const [newNameInput, setNewNameInput] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState(null)

  // Invite/Friend System State
  const [inviteSearchQuery, setInviteSearchQuery] = useState("")
  const [debouncedInviteSearchQuery, setDebouncedInviteSearchQuery] = useState("")
  const [inviteSearchResults, setInviteSearchResults] = useState([])
  // Changed to array for bulk selection in Friend Modal
  const [selectedFriendInvitees, setSelectedFriendInvitees] = useState([])

  // For Channel Invites
  const [selectedInviteUsers, setSelectedInviteUsers] = useState([])

  const [newSpaceName, setNewSpaceName] = useState("")
  const [inviteSent, setInviteSent] = useState(false)

  // --- Persistent Login: restore auth state from localStorage on app load
  useEffect(() => {
    const stUser = getStoredUser()
    const token = getToken()
    if (stUser && token) {
      setCurrentUser(stUser)
      setIsAuthenticated(true)
    } else if (!stUser && !token) {
      // If no stored credentials, ensure we're logged out
      setIsAuthenticated(false)
      setCurrentUser(null)
    }
  }, [])

  // Sync currentUser to localStorage whenever it changes (ensures auth persistence)
  useEffect(() => {
    if (currentUser && isAuthenticated) {
      const existingToken = getToken()
      const token = existingToken || `token_${currentUser.id}_${Date.now()}`
      saveAuth(currentUser, token)
      console.log("Auth saved to localStorage:", currentUser.email)
    }
  }, [currentUser, isAuthenticated])

  // File Attachment State
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date())
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    time: "09:00",
    type: "event"
  })
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Video Meeting State
  const [isMicOn, setIsMicOn] = useState(true)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [activeMeetingTitle, setActiveMeetingTitle] = useState("Meeting")
  const [activeCallId, setActiveCallId] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [incomingCallCountdown, setIncomingCallCountdown] = useState(10) // 10 second countdown
  const videoRef = useRef(null)
  const incomingTimeoutRef = useRef(null)
  const incomingCountdownRef = useRef(null)
  // Feature flag to enable live video calls in channels and chats
  const VIDEO_ENABLED = true

  // WebRTC Video Call State
  const [showWebRTCCall, setShowWebRTCCall] = useState(false)
  const [showAddFriendsToCall, setShowAddFriendsToCall] = useState(false)
  const [webrtcCallStatus, setWebrtcCallStatus] = useState('idle') // 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
  const [webrtcCallPartner, setWebrtcCallPartner] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [webrtcError, setWebrtcError] = useState(null)
  const [isWebRTCMicOn, setIsWebRTCMicOn] = useState(true)
  const [isWebRTCVideoOn, setIsWebRTCVideoOn] = useState(true)
  const [callStartTime, setCallStartTime] = useState(null)
  const [callDuration, setCallDuration] = useState(0)
  const [callerCountdown, setCallerCountdown] = useState(10) // 10 second countdown for caller
  const [callParticipants, setCallParticipants] = useState([]) // Array of participants in the call
  const [pendingCallParticipants, setPendingCallParticipants] = useState([]) // Friends being called
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const pendingIceCandidatesRef = useRef([])
  const callSocketRef = useRef(null)
  const userSocketRef = useRef(null)
  const callTimerRef = useRef(null)
  const callerCountdownRef = useRef(null)

  // Google Integration State
  const [showGoogleAppsMenu, setShowGoogleAppsMenu] = useState(false)
  const [showDocsModal, setShowDocsModal] = useState(false)
  const [showConnectAppsModal, setShowConnectAppsModal] = useState(false)
  const [googleAccessToken, setGoogleAccessToken] = useState(null)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [selectedCallMembers, setSelectedCallMembers] = useState([])
  const [callCreating, setCallCreating] = useState(false)
  const [currentMeeting, setCurrentMeeting] = useState(null)
  const [googleDocs, setGoogleDocs] = useState([])
  const [gmailAttachments, setGmailAttachments] = useState([])
  const [gmailLastCheckTime, setGmailLastCheckTime] = useState(null) // For real-time Gmail sync
  // Documents shared in chats/channels (collected from messages)
  const [sharedChatDocs, setSharedChatDocs] = useState([])
  const [connectedApps, setConnectedApps] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [docsError, setDocsError] = useState(null)
  const [selectedAppFilter, setSelectedAppFilter] = useState('all')
  const [googleCalendarToken, setGoogleCalendarToken] = useState(null)
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([])
  const [showCalendarConnectModal, setShowCalendarConnectModal] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const prevScrollHeightRef = useRef(0)
  const chatSocketRef = useRef(null)
  const fileInputRef = useRef(null)
  const messageInputRef = useRef(null)
  const justSwitchedThreadRef = useRef(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [visibleDateLabel, setVisibleDateLabel] = useState("Today")

  // --- Initialize Google API on mount ---
  useEffect(() => {
    GoogleService.initGoogleAuth()
    
    // Check if user already has Google access token
    const savedToken = GoogleService.getGoogleAccessToken()
    if (savedToken) {
      setGoogleAccessToken(savedToken)
    }
    
    // Check if user already has Google Calendar token
    const savedCalendarToken = GoogleService.getGoogleCalendarToken()
    if (savedCalendarToken) {
      setGoogleCalendarToken(savedCalendarToken)
      loadGoogleCalendarEvents(savedCalendarToken)
    }
  }, [])

  // Helper: render avatar for a user object
  const renderAvatar = (user, size = 40) => {
    if (!user) return null
    let url = user.avatar_url || user.avatarImage || user.avatar_image
    const preset = user.avatar_preset
    const emojiAvatar =
      typeof user.avatar === "string" && user.avatar.trim().length > 0
        ? user.avatar
        : null
    const name = user.name || "?"
    const initial = (name && name[0]) ? name[0].toUpperCase() : "?"

    const sizeStyle = { width: size, height: size, lineHeight: `${size}px`, fontSize: Math.floor(size/2) }

    // Handle relative URLs by prepending API_BASE
    if (url && typeof url === 'string') {
      // Convert relative URLs to absolute
      if (url.startsWith('/')) {
        url = `${API_BASE}${url}`
      }
      
      if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('blob:')) {
        // Ensure we bust browser cache if server did not include a version param
        let finalUrl = url
        try {
          if (!rawUrlStartsWithDataOrBlob(url)) {
            const hasVersion = /[?&]v=\d+/.test(url)
            if (!hasVersion) {
              const sep = url.includes("?") ? "&" : "?"
              finalUrl = `${url}${sep}v=${Date.now()}`
            }
          }
        } catch (e) {}
        return (
          <img src={finalUrl} alt={name} className="rounded-full object-cover" style={sizeStyle} />
        )
      }
    }

    if (preset) {
      // simple gradient generation from preset id
      const grad = `linear-gradient(135deg, ${preset[0]} 0%, ${preset[1]} 100%)`
      return (
        <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ ...sizeStyle, background: grad }}>
          {initial}
        </div>
      )
    }
    // fallback: emoji avatar or letter avatar with generated gradient
    const colors = ["#ff9a9e","#fad0c4","#f6d365","#f093fb","#a1c4fd","#c2e9fb","#d4fc79","#96fbc4"]
    const idx = (String(user.id || user._id || name).length) % colors.length
    const grad = `linear-gradient(135deg, ${colors[idx]} 0%, ${colors[(idx+3)%colors.length]} 100%)`
    if (emojiAvatar) {
      return (
        <div className="rounded-full flex items-center justify-center font-bold" style={{ ...sizeStyle, background: grad }}>
          {emojiAvatar}
        </div>
      )
    }
    return (
      <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ ...sizeStyle, background: grad }}>
        {initial}
      </div>
    )
  }

  // small helper to detect data/blob urls
  const rawUrlStartsWithDataOrBlob = u => {
    try {
      return typeof u === 'string' && (u.startsWith('data:') || u.startsWith('blob:'))
    } catch (e) { return false }
  }

  // Helper: return local YYYY-MM-DD for a Date or date string (avoids UTC shift from toISOString)
  const toLocalDateStr = (input) => {
    try {
      if (!input) return ''
      const d = input instanceof Date ? input : new Date(input)
      if (isNaN(d.getTime())) return ''
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const da = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${da}`
    } catch (e) {
      return ''
    }
  }

  const getUserIdValue = user => {
    if (!user) return ""
    if (user.id !== undefined && user.id !== null) return String(user.id)
    if (user.userId !== undefined && user.userId !== null) return String(user.userId)
    if (user._id) {
      if (typeof user._id === "object" && user._id.$oid) return String(user._id.$oid)
      return String(user._id)
    }
    return ""
  }

  const avatarPresets = [
    ["#ff9a9e", "#fecfef"],
    ["#a1c4fd", "#c2e9fb"],
    ["#f6d365", "#fda085"],
    ["#f093fb", "#f5576c"],
    ["#96fbc4", "#f9f586"],
    ["#c2e9fb", "#a1c4fd"],
    ["#fddb92", "#d1fdff"],
    ["#fbc2eb", "#a6c1ee"]
  ]

  const syncUserCollections = updatedUser => {
    if (!updatedUser) return
    const updatedId = getUserIdValue(updatedUser)
    if (!updatedId) return
    setUsers(prev => {
      if (!Array.isArray(prev)) return [updatedUser]
      const exists = prev.some(u => getUserIdValue(u) === updatedId)
      if (exists) {
        return prev.map(user =>
          getUserIdValue(user) === updatedId ? { ...user, ...updatedUser } : user
        )
      }
      return [...prev, updatedUser]
    })
    setFriends(prev => {
      if (!Array.isArray(prev)) return prev
      const exists = prev.some(f => getUserIdValue(f) === updatedId)
      if (exists) {
        return prev.map(friend =>
          getUserIdValue(friend) === updatedId ? { ...friend, ...updatedUser } : friend
        )
      }
      // If this updated user is in the current user's friend list but missing from `friends` state, append it
      try {
        const myFriends = Array.isArray(currentUser?.friends) ? currentUser.friends.map(String) : []
        if (myFriends.includes(String(updatedId))) {
          return [...prev, updatedUser]
        }
      } catch (e) {}
      return prev
    })
    // Update spaces' member objects if spaces store member details (defensive)
    setSpaces(prev => {
      if (!Array.isArray(prev)) return prev
      let changed = false
      const mapped = prev.map(space => {
        let spaceChanged = false
        const s = { ...space }

        // Update space-level members if they are objects
        if (Array.isArray(s.members) && s.members.length > 0 && typeof s.members[0] === 'object') {
          const newMembers = s.members.map(m =>
            getUserIdValue(m) === updatedId ? { ...m, ...updatedUser } : m
          )
          if (JSON.stringify(newMembers) !== JSON.stringify(s.members)) {
            s.members = newMembers
            spaceChanged = true
          }
        }

        // Update channels' member objects (defensive)
        if (Array.isArray(s.channels)) {
          const newChannels = s.channels.map(ch => {
            if (Array.isArray(ch.members) && ch.members.length > 0 && typeof ch.members[0] === 'object') {
              const newChMembers = ch.members.map(m =>
                getUserIdValue(m) === updatedId ? { ...m, ...updatedUser } : m
              )
              if (JSON.stringify(newChMembers) !== JSON.stringify(ch.members)) {
                spaceChanged = true
                return { ...ch, members: newChMembers }
              }
            }
            return ch
          })
          if (spaceChanged) s.channels = newChannels
        }

        if (spaceChanged) changed = true
        return spaceChanged ? s : space
      })
      return changed ? mapped : prev
    })
    // Update invite search results if present
    try {
      setInviteSearchResults(prev => {
        if (!Array.isArray(prev)) return prev
        let changed = false
        const mapped = prev.map(u => {
          if (getUserIdValue(u) === updatedId) {
            changed = true
            return { ...u, ...updatedUser }
          }
          return u
        })
        return changed ? mapped : prev
      })
    } catch (e) {}

    // Refresh any messages that reference this user so UI re-renders (avatars cached by id)
    try {
      setMessages(prev => {
        const out = {}
        let changed = false
        for (const k of Object.keys(prev || {})) {
          const list = prev[k] || []
          const newList = list.map(m => (m && (m.userId === updatedId || m.userId === String(updatedId)) ? { ...m } : m))
          if (JSON.stringify(newList) !== JSON.stringify(list)) changed = true
          out[k] = newList
        }
        return changed ? out : prev
      })
    } catch (e) {}
  }

  // --- Debounce Logic ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150)
    return () => clearTimeout(handler)
  }, [searchQuery])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDmSearchQuery(dmSearchQuery)
    }, 150)
    return () => clearTimeout(handler)
  }, [dmSearchQuery])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInviteSearchQuery(inviteSearchQuery)
    }, 100)
    return () => clearTimeout(handler)
  }, [inviteSearchQuery])


  // --- Search Logic: Spaces ---
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSpaceSearchResults([])
      // Clear any search highlights / pinned result when the search box is empty
      setHighlightTerm("")
      setPinnedMessageId(null)
      return
    }

    ;(async () => {
      const query = debouncedSearchQuery.toLowerCase()
      const results = []

      for (const space of spaces) {
        // 1. Space Match
        if (space.name.toLowerCase().includes(query)) {
          results.push({
            id: `space-${space.id}`,
            type: "space",
            title: space.name,
            subtitle: "Space",
            spaceId: space.id,
            icon: space.icon
          })
        }

        for (const channel of space.channels) {
          // 2. Channel Match
          if (channel.name.toLowerCase().includes(query)) {
            results.push({
              id: `channel-${channel.id}`,
              type: "channel",
              title: `# ${channel.name}`,
              subtitle: `Channel in ${space.name}`,
              spaceId: space.id,
              channelId: channel.id
            })
          }

          // 3. Message Match (Full scan via Storage)
          try {
            const msgs = await Storage.getMessages(channel.id)
            const users = await Storage.getUsers()
            for (const msg of msgs || []) {
              if (msg.text && msg.text.toLowerCase().includes(query)) {
                const user = users.find(u => u.id === msg.userId)
                results.push({
                  id: `msg-${msg.id}`,
                  type: "message",
                  title: user?.name || "Unknown",
                  subtitle: msg.text,
                  timestamp: msg.timestamp,
                  spaceId: space.id,
                  channelId: channel.id,
                  messageId: msg.id
                })
              }
            }
          } catch (e) {
            // If channel is restricted, ignore during search (don't spam modal)
            if (e && e.status === 403) {
              // silently ignore
            } else {
              console.error("Space search failed to load messages", e)
            }
          }
        }
      }

      // Sort by relevance (Messages recently first)
      results.sort((a, b) => {
        if (a.timestamp && b.timestamp)
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        return 0
      })

      setSpaceSearchResults(results)
    })()
  }, [debouncedSearchQuery, spaces])

  // --- Search Logic: DMs ---
  useEffect(() => {
    if (!debouncedDmSearchQuery.trim() || !currentUser) {
      setDmSearchResults([])
      // Clear any search highlights / pinned result when the DM search box is empty or no user
      setHighlightTerm("")
      setPinnedMessageId(null)
      return
    }

    ;(async () => {
      const query = debouncedDmSearchQuery.toLowerCase()
      const results = []

      for (const friend of friends) {
        // 1. Friend Name Match
        if (friend.name.toLowerCase().includes(query)) {
            results.push({
              id: `friend-${friend.id}`,
              type: "user",
              title: friend.name,
              subtitle: friend.status === "online" ? "Online" : "Offline",
              userId: friend.id,
              icon: renderAvatar(friend, 32)
            })
        }

        // 2. Message Match
        const ids = [currentUser.id, friend.id].sort((a, b) => a - b)
        const chatId = `dm_${ids[0]}_${ids[1]}`
        try {
          const msgs = await Storage.getMessages(chatId)
          for (const msg of msgs || []) {
            if (msg.text && msg.text.toLowerCase().includes(query)) {
              const isMe = msg.userId === currentUser.id
              results.push({
                id: `dm-msg-${msg.id}`,
                type: "message",
                title: isMe ? "You" : friend.name,
                subtitle: msg.text,
                userId: friend.id,
                messageId: msg.id,
                timestamp: msg.timestamp,
                icon: renderAvatar(friend, 28)
              })
            }
          }
        } catch (e) {
          console.error("DM search failed to load messages", e)
        }
      }

      // Sort by relevance
      results.sort((a, b) => {
        if (a.timestamp && b.timestamp)
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        return 0
      })

      setDmSearchResults(results)
    })()
  }, [debouncedDmSearchQuery, friends, currentUser])

  // --- Initialization & Data Loading ---

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return

    const pollData = async () => {
      try {
        const storedUsers = await Storage.getUsers()
        const freshUser = storedUsers.find(u => u.id === currentUser.id)

        // Update User Data
        if (freshUser) {
          if (!freshUser.friends) freshUser.friends = []
          const filteredFresh = filterDismissedUser(freshUser)
          const friendsChanged =
            (filteredFresh.friends?.length || 0) !==
            (currentUser.friends?.length || 0)
          const notifsChanged =
            (filteredFresh.notifications?.length || 0) !== (currentUser.notifications?.length || 0)
          const spacesChanged =
            filteredFresh.spaces.length !== currentUser.spaces.length

          if (friendsChanged || notifsChanged || spacesChanged) {
            setCurrentUser(filteredFresh)
          }
        }

        // Check for Active Space Data Updates (Members/Channels)
        if (activeSpace) {
          const freshSpaces = await Storage.getSpaces()
          const freshActiveSpace = freshSpaces.find(s => s.id === activeSpace)
          const currentActiveSpace = spaces.find(s => s.id === activeSpace)

          if (freshActiveSpace && currentActiveSpace) {
            const hasMemberChange =
              freshActiveSpace.members.length !==
              currentActiveSpace.members.length
            const freshChannelsStr = JSON.stringify(freshActiveSpace.channels)
            const currentChannelsStr = JSON.stringify(currentActiveSpace.channels)

            if (hasMemberChange || freshChannelsStr !== currentChannelsStr) {
              setSpaces(prev =>
                prev.map(s => {
                  if (s.id === activeSpace) {
                    return {
                      ...freshActiveSpace,
                      icon: s.icon, // Preserve ReactNode icon from existing state
                      expanded: s.expanded
                    }
                  }
                  return s
                })
              )
            }
          }
        }

        // Poll for Unread Messages in Channels - only check channels user isn't currently viewing
        // Use cached message counts instead of fetching all messages for every channel
        const allSpaces = await Storage.getSpaces()
        const channelsToCheck = []
        for (const space of allSpaces) {
          for (const ch of (space.channels || [])) {
            // Skip the currently active channel - we already have real-time updates
            if (activeView === "channel" && activeChannel === ch.id) continue
            channelsToCheck.push(ch)
          }
        }
        
        // Only check a few channels per poll cycle to avoid overloading
        const maxChannelsPerPoll = 3
        const channelsThisCycle = channelsToCheck.slice(0, maxChannelsPerPoll)
        
        for (const ch of channelsThisCycle) {
          try {
            const msgs = await Storage.getMessages(ch.id)
            if (msgs === null) {
              continue
            }
            const count = (msgs && msgs.length) || 0
            const prevCount = messageCounts[ch.id] || 0

            // If new message AND channel not active, mark unread
            if (count > prevCount) {
              if (!unreadChannels.includes(ch.id)) {
                setUnreadChannels(prev => [...prev, ch.id])
              }
            }
            // Update tracking map
            messageCounts[ch.id] = count
          } catch (e) {
            if (e && e.status === 403) {
              // Restricted channel — ignore for unread polling
            } else {
              // Silently ignore polling errors to avoid console spam
            }
          }
        }
        if (channelsThisCycle.length > 0) {
          setMessageCounts({ ...messageCounts })
        }

        // Update Events
        const storedEvents = await Storage.getEvents()
        // Map current google calendar items (if any) into app event shape
        const mappedGoogle = (googleCalendarEvents || []).map(ge => {
          const startIso = ge.start?.dateTime || ge.start?.date || null
          const endIso = ge.end?.dateTime || ge.end?.date || null
          const startDate = startIso ? toLocalDateStr(startIso) : ''
          return {
            id: `gcal-${ge.id}`,
            title: ge.summary || 'Untitled',
            type: ge.conferenceData ? 'meeting' : 'event',
            startDate: startDate,
            startDateTime: startIso,
            endDateTime: endIso,
            description: ge.description || '',
            link: ge.hangoutLink || ge.htmlLink || (ge.conferenceData && ge.conferenceData.entryPoints && ge.conferenceData.entryPoints[0] && ge.conferenceData.entryPoints[0].uri) || null,
            source: 'google'
          }
        })

        // Merge stored (local) events with google events, dedupe by id
        const stored = storedEvents || []
        const dedupedGoogle = mappedGoogle.filter(g => !stored.some(s => String(s.id) === String(g.id)))
        const merged = [...stored, ...dedupedGoogle]

        if ((merged?.length || 0) !== events.length) {
          setEvents(merged)
        }

        // Poll Calls
        if (activeView !== "meeting") {
          const incoming = await Storage.getIncomingCall(currentUser.id)
          if (incoming && incoming.id !== incomingCall?.id) {
            setIncomingCall(incoming)
          } else if (!incoming && incomingCall) {
            setIncomingCall(null)
          }
        }

        if (activeView === "meeting" && activeCallId) {
          const calls = await Storage.getCalls()
          const myCall = calls.find(c => c.id === activeCallId)
          if (myCall) {
            if (myCall.status === "rejected" || myCall.status === "ended") {
              setActiveView("channel")
              setActiveCallId(null)
              setIncomingCall(null)
            }
          }
        }
      } catch (e) {
        console.error("pollData failed", e)
      }
    }

    // Fast polling for real-time notifications
    const interval = setInterval(pollData, 1000)
    return () => clearInterval(interval)
  }, [
    isAuthenticated,
    currentUser,
    events.length,
    activeView,
    incomingCall,
    activeCallId,
    activeSpace,
    spaces,
    activeChannel,
    unreadChannels
  ])

  // Ensure any incoming timeout is cleared when incomingCall is removed elsewhere
  useEffect(() => {
    if (!incomingCall) {
      try { if (incomingTimeoutRef.current) { clearTimeout(incomingTimeoutRef.current); incomingTimeoutRef.current = null } } catch(e){}
    }
  }, [incomingCall])

  useEffect(() => {
    // Clear unread when entering a channel
    if (activeView === "channel" && activeChannel && currentUser) {
      setUnreadChannels(prev => prev.filter(id => id !== activeChannel))
      // Update current count reference
      ;(async () => {
        try {
          const msgs = await Storage.getMessages(activeChannel)
          messageCounts[activeChannel] = (msgs && msgs.length) || 0
          setMessageCounts({ ...messageCounts })
        } catch (e) {
          if (e && e.status === 403) {
            // restricted channel — skip silently
            messageCounts[activeChannel] = 0
            setMessageCounts({ ...messageCounts })
          }
          // Silently ignore other errors during initial load
        }
      })()
    }
  }, [activeChannel, activeView, currentUser])

  useEffect(() => {
    let userSocket = null
    let refreshTimeout = null

    if (isAuthenticated && currentUser) {
      const loadInitialData = async () => {
        // Load spaces, users, friends, and events in parallel for faster startup
        const [userSpaces, allUsers, friendsList, evts] = await Promise.all([
          Storage.getSpacesForUser(currentUser.spaces).catch(() => []),
          Storage.getUsers().catch(() => []),
          Storage.getFriends(currentUser.friends || []).catch(() => []),
          Storage.getEvents().catch(() => [])
        ])
        
        const safeUserSpaces = Array.isArray(userSpaces) ? userSpaces : []

        const enrichedSpaces = safeUserSpaces.map(s => ({
          ...s,
          icon:
            s.iconType === "graduation" ? (
              <GraduationCap className="w-5 h-5" />
            ) : s.iconType === "briefcase" ? (
              <Briefcase className="w-5 h-5" />
            ) : (
              <UserIcon className="w-5 h-5" />
            )
        }))

        setSpaces(enrichedSpaces)
        setUsers(Array.isArray(allUsers) ? allUsers : [])
        setFriends(Array.isArray(friendsList) ? friendsList : [])
        setEvents(evts || [])
        // Load tasks for current user (assigned or created)
        try {
          const t = await TasksService.getTasksForUser(currentUser.id)
          setTasksList(Array.isArray(t) ? t : [])
        } catch (e) {
          console.warn('Failed to load tasks', e)
        }

        return enrichedSpaces
      }

      ;(async () => {
        const enrichedSpaces = await loadInitialData()

        if (
          enrichedSpaces.length > 0 &&
          !activeSpace &&
          activeView === "channel"
        ) {
          // Find first accessible channel
          const firstSpace = enrichedSpaces[0]
          const accessibleChannel = firstSpace.channels.find(
            c =>
              (c.members || []).includes(currentUser.id) ||
              (firstSpace.members || []).includes(currentUser.id) ||
              firstSpace.ownerId === currentUser.id
          )

          setActiveSpace(firstSpace.id)
          if (accessibleChannel) {
            setActiveChannel(accessibleChannel.id)
          } else {
            // No accessible channel in first space — do not auto-select a restricted channel
            setActiveChannel("")
          }
        }
        
        // Refresh again after a short delay to pick up background-refreshed data
        refreshTimeout = setTimeout(async () => {
          const refreshedSpaces = await loadInitialData()
          // Update active space if we didn't have any before but now we do
          if (refreshedSpaces.length > 0 && !activeSpace) {
            const firstSpace = refreshedSpaces[0]
            const accessibleChannel = firstSpace.channels?.find(
              c =>
                (c.members || []).includes(currentUser.id) ||
                (firstSpace.members || []).includes(currentUser.id) ||
                firstSpace.ownerId === currentUser.id
            )
            setActiveSpace(firstSpace.id)
            if (accessibleChannel) setActiveChannel(accessibleChannel.id)
          }
        }, 1500)
      })()

      // Open a background user socket to receive notifications in real-time
      import("./services/ws")
        .then(({ connectUserSocket }) => {
          userSocket = connectUserSocket(async data => {
              if (!data || !data.type) return

              console.log('User socket received message:', data.type, data)

              // When backend notifies that a domain was verified, try to auto-login the org admin
              if (data.type === 'org_verified') {
                try {
                  const domain = data.domain
                  if (!domain) return

                  // refresh org info
                  let oj = orgInfo
                  try {
                    const resOrg = await fetch(`${API_BASE}/api/org/org/${encodeURIComponent(domain)}`)
                    if (resOrg.ok) { oj = await resOrg.json(); setOrgInfo(oj) }
                  } catch (e) {}

                  // fetch users for domain and try to auto-login the org admin
                  try {
                    const resUsers = await fetch(`${API_BASE}/users/by-domain/${encodeURIComponent(domain)}`)
                    if (resUsers.ok) {
                      const uj = await resUsers.json()
                      const usersList = Array.isArray(uj) ? uj : []
                      setAdminUsers(usersList)

                      const adminEmail = (orgForm && orgForm.adminEmail) || (oj && oj.adminEmail) || ''
                      let adminUser = null
                      if (adminEmail) adminUser = usersList.find(u => String(u.email).toLowerCase() === String(adminEmail).toLowerCase())
                      if (!adminUser) adminUser = usersList.find(u => u.role === 'org_admin' || u.role === 'admin')
                      if (!adminUser && usersList.length > 0) adminUser = usersList[0]

                      const promptEmail = (orgForm && orgForm.adminEmail) || (oj && oj.adminEmail) || ''
                      if (promptEmail) {
                        try { setSetPasswordEmail(promptEmail) } catch (e) {}
                        try { if (adminUser) setPendingAdminUserId(adminUser.id) } catch (e) {}
                        // Only show the Set Password modal to the registering admin (when they're the unauthenticated
                        // user who submitted the org form) or to a connected user whose email matches the org admin email.
                        try {
                          const loggedEmail = (currentUser && currentUser.email) ? String(currentUser.email).toLowerCase() : ''
                          const registeringEmail = (orgForm && orgForm.adminEmail) ? String(orgForm.adminEmail).toLowerCase() : ''
                          const orgRecordEmail = (oj && oj.adminEmail) ? String(oj.adminEmail).toLowerCase() : ''
                          const targetEmail = String(promptEmail).toLowerCase()
                          const isRegisteringUser = registeringEmail && registeringEmail === targetEmail && !loggedEmail
                          const isMatchingLoggedInUser = loggedEmail && loggedEmail === targetEmail
                          if (isRegisteringUser || isMatchingLoggedInUser) {
                            setShowSetPasswordModal(true)
                          }
                        } catch (e) {}
                      }
                    }
                  } catch (e) {
                    console.error('Failed fetching users for domain during org_verified notification', e)
                  }
                } catch (e) {
                  console.error('org_verified handler failed', e)
                }
                return
              }

              // Real-time channel role updates
              if (data.type === 'channel_roles_updated') {
                try {
                  setSpaces(prev => {
                    if (!Array.isArray(prev)) return prev
                    return prev.map(s => {
                      if (String(s.id) !== String(data.space_id)) return s
                      const newChannels = (s.channels || []).map(ch => {
                        if (String(ch.id) === String(data.channel_id)) {
                          return { ...ch, roles: data.roles }
                        }
                        return ch
                      })
                      return { ...s, channels: newChannels }
                    })
                  })
                } catch (e) { console.error('Failed applying channel_roles_updated', e) }
                return
              }

              if (data.type === 'channel_member_changed') {
                try {
                  setSpaces(prev => {
                    if (!Array.isArray(prev)) return prev
                    return prev.map(s => {
                      if (String(s.id) !== String(data.space_id)) return s
                      const newChannels = (s.channels || []).map(ch => {
                        if (String(ch.id) === String(data.channel_id)) {
                          return { ...ch, members: data.members, roles: data.roles }
                        }
                        return ch
                      })
                      return { ...s, channels: newChannels }
                    })
                  })
                } catch (e) { console.error('Failed applying channel_member_changed', e) }
                return
              }

            // Handle WebRTC signaling messages via notification socket
            if (data.type?.startsWith('webrtc-') || data.type === 'ice-candidate') {
              console.log('WebRTC signaling via user socket:', data.type, data)
              
              if (data.type === 'webrtc-call-request') {
                // Incoming call - check if this message is for current user
                if (String(data.targetUserId) === String(currentUser?.id)) {
                  console.log('Incoming WebRTC call from:', data.fromUserName)
                  // Clear any existing timeouts and countdown
                  if (incomingTimeoutRef.current) {
                    clearTimeout(incomingTimeoutRef.current)
                    incomingTimeoutRef.current = null
                  }
                  if (incomingCountdownRef.current) {
                    clearInterval(incomingCountdownRef.current)
                    incomingCountdownRef.current = null
                  }
                  
                  // Reset countdown to 10 seconds
                  setIncomingCallCountdown(10)
                  
                  setIncomingCall({
                    id: `webrtc-${Date.now()}`,
                    fromId: data.fromUserId,
                    fromName: data.fromUserName,
                    fromAvatar: data.fromUserAvatar || '👤',
                    webrtcOffer: data.offer,
                    isWebRTC: true
                  })
                  
                  // Start countdown interval
                  incomingCountdownRef.current = setInterval(() => {
                    setIncomingCallCountdown(prev => {
                      if (prev <= 1) {
                        // Time's up - clear and dismiss
                        clearInterval(incomingCountdownRef.current)
                        incomingCountdownRef.current = null
                        setIncomingCall(null)
                        return 10
                      }
                      return prev - 1
                    })
                  }, 1000)
                  
                  // Auto-dismiss after 10 seconds if not answered (backup)
                  incomingTimeoutRef.current = setTimeout(() => {
                    if (incomingCountdownRef.current) {
                      clearInterval(incomingCountdownRef.current)
                      incomingCountdownRef.current = null
                    }
                    setIncomingCall(null)
                    setIncomingCallCountdown(10)
                    incomingTimeoutRef.current = null
                  }, 10000)
                }
              } else {
                // Handle other WebRTC signaling (answer, ice-candidate, etc.)
                handleWebRTCSignaling(data)
              }
              return
            }

            // Handle task notifications
            if (data.type === 'task_created' || data.type === 'task_updated') {
              const t = data.task
              if (t) {
                setTasksList(prev => {
                  try {
                    const exists = (prev || []).find(p => String(p.id) === String(t.id) || (p.timestamp && t.timestamp && String(p.timestamp) === String(t.timestamp)))
                    if (exists) return (prev || []).map(p => (String(p.id) === String(t.id) ? t : p))
                    return [t, ...(prev || [])]
                  } catch (e) { return prev }
                })
              }
            }

            // Handle global profile updates emitted by server
            if (data.type === 'profileUpdated' && data.userId) {
              const updatedUser = {
                id: data.userId,
                avatar_url: data.avatar_url,
                avatar_preset: data.avatar_preset
              }
              syncUserCollections(updatedUser)
              // Refresh authoritative users list to avoid stale cached data
              ;(async () => {
                try {
                  const allUsers = await (await import("./services/storage")).getUsers()
                  if (Array.isArray(allUsers)) setUsers(allUsers)
                } catch (e) {
                  // ignore refresh errors
                }
              })()
              return
            }

            // Only react to 'notification' messages
            if (data.type === "notification" && data.notification) {
              const incoming = data.notification

              // Handle avatar update notifications from other users
              if (incoming.type === 'avatar_updated' && incoming.userId && incoming.avatarData) {
                const updatedUser = {
                  id: incoming.userId,
                  avatar_url: incoming.avatarData.avatar_url,
                  avatar_preset: incoming.avatarData.avatar_preset,
                  name: incoming.avatarData.name
                }
                syncUserCollections(updatedUser)
                // Also refresh users and friends list to ensure real-time avatar sync
                ;(async () => {
                  try {
                    const allUsers = await Storage.getUsers()
                    if (Array.isArray(allUsers)) setUsers(allUsers)
                    if (currentUser?.friends?.length > 0) {
                      const friendsList = await Storage.getFriends(currentUser.friends)
                      if (Array.isArray(friendsList)) setFriends(friendsList)
                    }
                  } catch (e) {
                    console.error('Failed to refresh users after avatar update', e)
                  }
                })()
                return
              }

              // If this is a scheduled calendar meet, show incoming call pop instead of saving to notifications
              // NOTE: live `meet_invite` notifications are ignored when video feature is disabled
              if (incoming.type === 'scheduled_meet') {
                // Normalize timestamp
                if (incoming.timestamp && incoming.timestamp < 1e12) incoming.timestamp = incoming.timestamp * 1000

                // Build incomingCall object expected by the modal
                const callObj = {
                  id: incoming.id,
                  fromId: incoming.from,
                  fromName: incoming.fromName || String(incoming.from),
                  fromAvatar: incoming.fromAvatar || '👤',
                  link: incoming.link || null,
                  title: incoming.title || 'Video Call',
                  timestamp: incoming.timestamp
                }
                // Clear any previous incoming timeout
                try { if (incomingTimeoutRef.current) { clearTimeout(incomingTimeoutRef.current); incomingTimeoutRef.current = null } } catch(e){}

                setIncomingCall(callObj)

                // Auto-dismiss the incoming call popup after 60s if unanswered
                incomingTimeoutRef.current = setTimeout(() => {
                  setIncomingCall(null)
                  incomingTimeoutRef.current = null
                }, 60000)

                // Do not persist into notifications list
                return
              }

              if (isNotificationDismissed(currentUser?.id, incoming.id)) return

              setCurrentUser(prev => {
                if (!prev) return prev
                const already = (prev.notifications || []).some(n => n.id === incoming.id)
                if (already) return prev
                return { ...prev, notifications: [...(prev.notifications || []), incoming] }
              })

              // Also refresh users list so friend lists / counts stay in sync
              ;(async () => {
                try {
                  const allUsers = await Storage.getUsers()
                  setUsers(Array.isArray(allUsers) ? allUsers : [])
                } catch (e) {
                  console.error('Failed to refresh users after incoming notification', e)
                }
              })()
            }

            // Presence events and other types could be handled here in future
          })
          // Store in ref for WebRTC signaling
          userSocketRef.current = userSocket
          console.log('User notification socket connected and stored in ref')
        })
        .catch(e => {
          console.error('Failed to connect user socket', e)
        })
    }

    return () => {
      try {
        if (userSocket) userSocket.close()
      } catch (e) {}
      try {
        if (refreshTimeout) clearTimeout(refreshTimeout)
      } catch (e) {}
    }
  }, [isAuthenticated, currentUser?.spaces, currentUser?.friends, currentUser?.id])

  useEffect(() => {
    if (activeView === "meeting" && videoRef.current) {
      let cancelled = false
      ;(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          })
          if (!cancelled && videoRef.current) videoRef.current.srcObject = stream
        } catch (err) {
          console.error("Error accessing media devices", err)
        }
      })()
      return () => {
        cancelled = true
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject
          stream.getTracks().forEach(track => track.stop())
        }
      }
    }
  }, [activeView])

  useEffect(() => {
    if (!isAuthenticated) return
    
    let chatId = null
    if (activeView === "channel" && activeChannel) {
      chatId = Number(activeChannel)
    } else if (activeView === "dm" && activeDMUser && currentUser) {
      const ids = [currentUser.id, activeDMUser].sort((a, b) => a - b)
      chatId = `dm_${ids[0]}_${ids[1]}`
    }
    
    if (!chatId) return
    
    // Don't try to load messages if spaces haven't been loaded yet
    if (activeView === "channel" && spaces.length === 0) return
    
    const loadMessages = async () => {
      try {
        const storedMessages = await Storage.getMessages(chatId)
        const normalized = Array.isArray(storedMessages)
          ? storedMessages.map(msg => ({ ...msg, status: "sent", optimistic: false }))
          : []

        setMessages(prev => {
          const existing = prev[chatId] || []
          const serverIds = new Set(normalized.map(m => m.id))
          const optimisticOnly = existing.filter(m => m.optimistic && !serverIds.has(m.id))
          return {
            ...prev,
            [chatId]: [...normalized, ...optimisticOnly]
          }
        })
      } catch (e) {
        if (e && e.status === 403) {
          // Only show access denied modal if user has spaces loaded (not initial load)
          if (spaces.length > 0 && !sessionStorage.getItem(`denied_${chatId}`)) {
            setShowAccessDeniedModal(true)
            // Mark this channel as already shown to prevent repeated popups
            sessionStorage.setItem(`denied_${chatId}`, 'true')
          }
          // Don't clear messages - keep what we have locally
          // User might have sent messages that are awaiting sync
        }
        // Silently ignore other errors
      }
    }
    loadMessages()
    // Poll for messages as backup to WebSocket (WebSocket handles real-time delivery)
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [isAuthenticated, activeChannel, activeView, activeDMUser, currentUser, spaces.length])


  // Chat websocket connection for real-time message delivery
  useEffect(() => {
    if (!isAuthenticated) return

    let chatId = null
    if (activeView === "channel" && activeChannel) {
      chatId = Number(activeChannel)
    } else if (activeView === "dm" && activeDMUser && currentUser) {
      const ids = [currentUser.id, activeDMUser].sort((a, b) => a - b)
      chatId = `dm_${ids[0]}_${ids[1]}`
    }

    if (!chatId) return

    // Close previous socket if any
    try {
      if (chatSocketRef.current) {
        chatSocketRef.current.close()
      }
    } catch (e) {}

    // Connect new chat socket
    const ws = connectChatSocket(chatId, data => {
      // Expect data to be a message object; ignore presence updates
      if (!data) return
      
      // Handle WebRTC signaling messages inline to avoid stale closure issues
      if (data.type?.startsWith('webrtc-') || data.type === 'ice-candidate') {
        console.log('WebRTC signaling received:', data.type, data)
        
        // Process different signaling message types
        if (data.type === 'webrtc-call-request') {
          // Incoming call - check if this message is for current user
          if (String(data.targetUserId) === String(currentUser?.id)) {
            console.log('Incoming WebRTC call from:', data.fromUserName)
            setIncomingCall({
              id: `webrtc-${Date.now()}`,
              fromId: data.fromUserId,
              fromName: data.fromUserName,
              fromAvatar: data.fromUserAvatar || '👤',
              webrtcOffer: data.offer,
              isWebRTC: true
            })
            // Auto-dismiss after 10 seconds if not answered
            if (incomingTimeoutRef.current) {
              clearTimeout(incomingTimeoutRef.current)
            }
            incomingTimeoutRef.current = setTimeout(() => {
              setIncomingCall(null)
              incomingTimeoutRef.current = null
            }, 10000)
          }
        } else {
          // For other signaling messages, delegate to handler
          handleWebRTCSignaling(data)
        }
        return
      }
      
      // Convert server-side task broadcasts into chat messages
      if (data.type === 'task' && data.task) {
        try {
          const t = data.task
          const msg = {
            id: t.id || (t._id ? String(t._id) : `task-${Date.now()}`),
            userId: t.created_by,
            text: t.message,
            timestamp: t.timestamp,
            type: 'task',
            assigned_to: t.assigned_to || [],
            status: t.status || 'pending'
          }
          const normalized = { ...msg, status: 'sent', optimistic: false }
          setMessages(prev => {
            const key = chatId
            const existing = prev[key] || []
            const filtered = normalized.id
              ? existing.filter(m => m.id !== normalized.id)
              : existing
            return { ...prev, [key]: [...filtered, normalized] }
          })
        } catch (e) { console.warn('failed to normalize task broadcast', e) }
        return
      }

      const normalized = { ...data, status: "sent", optimistic: false }

      setMessages(prev => {
        const key = chatId
        const existing = prev[key] || []
        const filtered = normalized.id
          ? existing.filter(m => m.id !== normalized.id)
          : existing
        return { ...prev, [key]: [...filtered, normalized] }
      })
      // If message has attachments with file ids, fetch metadata for previews/downloads
      if (normalized.attachments && normalized.attachments.length > 0) {
        normalized.attachments.forEach(att => {
          const fid = att.fileId || att.id || att.drive_file_id || att.driveId
          if (fid && !att.url) {
            // fetch metadata and update message attachments
            (async () => {
              const meta = await fetchFileMetadata(fid)
              if (meta && meta.url) {
                updateMessageMeta(chatId, normalized.id || normalized.localId, msg => ({
                  ...msg,
                  attachments: (msg.attachments || []).map(a => (String(a.id) === String(fid) || String(a.fileId) === String(fid) || String(a.drive_file_id) === String(fid) ? { ...a, url: meta.url, status: meta.status } : a))
                }))
              }
            })()
          }
        })
      }
    })

    chatSocketRef.current = ws
    ws.onopen = () => console.log("Chat socket connected", chatId)
    ws.onclose = () => console.log("Chat socket closed", chatId)
    ws.onerror = e => console.error("Chat socket error", e)

    return () => {
      try {
        if (chatSocketRef.current) chatSocketRef.current.close()
      } catch (e) {}
      chatSocketRef.current = null
    }
  }, [isAuthenticated, activeView, activeChannel, activeDMUser, currentUser?.id])

  // --- Scroll to Message Logic ---
  useEffect(() => {
    // 1) If a specific message is targeted (search -> result), center it
    if (targetMessageId) {
      // Small timeout to allow render
      const timer = setTimeout(() => {
        const element = document.getElementById(`msg-${targetMessageId}`)
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" })
          setTargetMessageId(null)
        }
      }, 500)
      return () => clearTimeout(timer)
    }

    // 2) If the user is reviewing a pinned search result, DO NOT auto-scroll away
    if (pinnedMessageId) {
      return
    }

    // 3) When the user manually switches a thread (channel/DM), do an instant jump to latest
    if (justSwitchedThreadRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
      setIsAtBottom(true)
      justSwitchedThreadRef.current = false
      return
    }

    // 4) If user is at bottom, smooth-scroll to latest when messages change.
    // If user is NOT at bottom, preserve their scroll position instead of forcing them to the latest message.
    const el = messagesContainerRef.current
    if (!el) return

    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      setIsAtBottom(true)
      // record current height so future incoming messages can preserve scroll position
      try { prevScrollHeightRef.current = el.scrollHeight } catch (e) {}
      try { setVisibleDateLabel(messageDateLabel || "Today") } catch (e) {}
    } else {
      // Preserve scroll position: adjust scrollTop by the increase in scrollHeight
      try {
        const prev = prevScrollHeightRef.current || 0
        const delta = el.scrollHeight - prev
        if (delta > 0) {
          el.scrollTop = el.scrollTop + delta
        }
      } catch (e) {}
      // update stored height
      prevScrollHeightRef.current = el.scrollHeight
    }
  }, [messages, activeChannel, activeView, activeDMUser, targetMessageId, pinnedMessageId])

  useEffect(() => {
    ;(async () => {
      // 1. "Add Friend" Modal: Global Search for NEW friends
      if (showAddFriendModal && debouncedInviteSearchQuery.length > 0) {
        try {
          const q = debouncedInviteSearchQuery.toLowerCase()
          // Fast client-side matches from cached `users` for immediate responsiveness
          const localMatches = Array.isArray(users)
            ? users.filter(
                u =>
                  u.name &&
                  u.name.toLowerCase().includes(q) &&
                  u.id !== currentUser?.id &&
                  !currentUser?.friends?.includes(u.id)
              )
            : []
          // show a limited set immediately to avoid UI jank
          setInviteSearchResults(localMatches.slice(0, 50))

          // For longer queries, fetch server-side results to improve coverage
          if (q.length >= 3) {
            const remote = await Storage.searchUsersByName(debouncedInviteSearchQuery)
            const safeUsers = Array.isArray(remote) ? remote : []
            const results = safeUsers.filter(
              u => u.id !== currentUser?.id && !currentUser?.friends?.includes(u.id)
            )
            setInviteSearchResults(results)
          }
        } catch (e) {
          console.error("searchUsersByName failed", e)
          // keep local matches if available, otherwise clear
          setInviteSearchResults(prev => (Array.isArray(prev) && prev.length ? prev : []))
        }
      }
      // 2. "Invite to Channel" Modal: Filter EXISTING friends only
      else if (showAddToSpaceModal && activeView === "channel") {
        const currentCh = getCurrentChannels().find(c => c.id === activeChannel)
        // We only show friends who are NOT in the current channel
        // If inviteSearchQuery is empty, we show all eligible friends
        // If inviteSearchQuery is set, we filter friends by name
        const eligibleFriends = friends.filter(friend => {
          const isMember = currentCh
            ? currentCh.members.includes(friend.id)
            : false
          const matchesSearch =
            inviteSearchQuery.trim() === "" ||
            friend.name.toLowerCase().includes(inviteSearchQuery.toLowerCase())
          return !isMember && matchesSearch
        })
        setInviteSearchResults(eligibleFriends)
      } else {
        setInviteSearchResults([])
      }
    })()
  }, [
    debouncedInviteSearchQuery,
    inviteSearchQuery,
    showAddFriendModal,
    showAddToSpaceModal,
    currentUser,
    activeChannel,
    spaces,
    friends
  ])

  // --- Auth & Logout ---
  const handleAuthSubmit = async e => {
    e.preventDefault()
    setAuthError("")
    setAuthSuccess("")

    if (authMode === "signup") {
      if (!authData.name || !authData.email || !authData.password) {
        setAuthError("Please fill in all fields")
        return
      }
      if (authData.password !== authData.confirmPassword) {
        setAuthError("Passwords do not match")
        return
      }
      const existingUser = await Storage.findUserByEmail(authData.email)
      if (existingUser) {
        setAuthError("Email already registered")
        return
      }

      const newUserId = Date.now()

      // 1. Create Default Space 1
      const defaultSpace = {
        id: newUserId + 1, // Simple ID gen
        name: "Space 1",
        iconType: "briefcase",
        members: [newUserId],
        inviteCode: `SPACE1-${Math.floor(1000 + Math.random() * 9000)}`,
        channels: [
          {
            id: newUserId + 2,
            name: "general",
            type: "public",
            members: [newUserId]
          },
          {
            id: newUserId + 3,
            name: "random",
            type: "public",
            members: [newUserId]
          }
        ],
        expanded: true,
        ownerId: newUserId
      }
      await Storage.saveSpace(defaultSpace)

      // 2. Create User with Space 1
      const newUser = {
        id: newUserId,
        name: authData.name,
        email: authData.email,
        password: authData.password,
        avatar: "👤",
        status: "online",
        spaces: [defaultSpace.id],
        dms: [],
        friends: [],
        notifications: [],
        integrations: {}
      }
      await Storage.saveUser(newUser)

      // Generate a simple token for the new user
      const token = `token_${newUserId}_${Date.now()}`
      saveAuth(newUser, token)
      
      setCurrentUser(newUser)
      setIsAuthenticated(true)
      setActiveSpace(defaultSpace.id)
      setActiveChannel(defaultSpace.channels[0].id)
      setAuthSuccess("Account created successfully!")
    } else {
      if (!authData.email || !authData.password) {
        setAuthError("Please fill in all fields")
        return
      }
      try {
        const data = await Storage.login({ email: authData.email, password: authData.password })
        if (data?.user && data?.token) {
          setCurrentUser(data.user)
          setIsAuthenticated(true)
          setAuthSuccess("Logged in successfully!")
        } else {
          setAuthError(data?.error || "Invalid credentials")
        }
      } catch (e) {
        console.error("Login failed", e)
        setAuthError("Invalid credentials")
      }
    }
  }

  const handleLogout = () => {
    // Clear persisted auth
    authLogout()

    setIsAuthenticated(false)
    setCurrentUser(null)
    setSpaces([])
    setFriends([])
    setEvents([])
    setActiveSpace(null)
    setActiveView("channel")
    setAuthData({ email: "", password: "", confirmPassword: "", name: "" })
    setAuthError("")
    setAuthSuccess("")
    setDmSearchQuery("")
    setSearchQuery("")
    
    // Clear Google data
    GoogleService.removeGoogleAccessToken()
    setGoogleAccessToken(null)
    setGoogleDocs([])
    setGmailAttachments([])
  }

  // --- Google OAuth Handlers ---
  const handleGoogleLogin = () => {
    // Ensure org modal is closed if present before starting Google flow
    try { setShowOrgModal(false); setOrgStage('form') } catch (e) {}
    GoogleService.handleGoogleSignIn(
      async (userInfo, credential) => {
        setAuthError("")
        
        // Check if user exists
        const existingUser = await Storage.findUserByEmail(userInfo.email)
        
        if (existingUser) {
          // Login existing user
          const token = `token_${existingUser.id}_${Date.now()}`
          saveAuth(existingUser, token)
          
          setCurrentUser(existingUser)
          setIsAuthenticated(true)
          setAuthSuccess("Logged in with Google successfully!")
        } else {
          // Create new user from Google data
          const newUserId = Date.now()
          
          // Create default space
          const defaultSpace = {
            id: newUserId + 1,
            name: "Space 1",
            iconType: "briefcase",
            members: [newUserId],
            inviteCode: `SPACE1-${Math.floor(1000 + Math.random() * 9000)}`,
            channels: [
              {
                id: newUserId + 2,
                name: "general",
                type: "public",
                members: [newUserId]
              },
              {
                id: newUserId + 3,
                name: "random",
                type: "public",
                members: [newUserId]
              }
            ],
            expanded: true,
            ownerId: newUserId
          }
          await Storage.saveSpace(defaultSpace)
          
          // Create new user
          const newUser = {
            id: newUserId,
            name: userInfo.name || userInfo.email.split('@')[0],
            email: userInfo.email,
            password: '', // No password for Google OAuth users
            avatar: userInfo.picture ? '🔵' : '👤',
            status: "online",
            spaces: [defaultSpace.id],
            dms: [],
            friends: [],
            notifications: [],
            integrations: {
              google: {
                connected: true,
                email: userInfo.email
              }
            }
          }
          await Storage.saveUser(newUser)
          
          // Generate a simple token for the new user
          const token = `token_${newUserId}_${Date.now()}`
          saveAuth(newUser, token)
          
          setCurrentUser(newUser)
          setIsAuthenticated(true)
          setActiveSpace(defaultSpace.id)
          setActiveChannel(defaultSpace.channels[0].id)
          setAuthSuccess("Account created with Google successfully!")
          // Make sure org modal remains closed after Google signup
          try { setShowOrgModal(false); setOrgStage('form') } catch (e) {}
        }
      },
      (error) => {
        console.error('Google Sign-In Error:', error)
        
        // Check if it's an origin error
        if (error && (error.includes?.('origin') || error.includes?.('client ID'))) {
          setAuthError("Google Sign-In configuration error. Please use regular email/password login.")
        } else {
          setAuthError("Google sign-in temporarily unavailable. Please use email/password login.")
        }
      }
    )
  }

  const handleConnectGoogleDocs = () => {
    GoogleService.requestGoogleDocsAccess(
      (accessToken) => {
        setGoogleAccessToken(accessToken)
        GoogleService.setGoogleAccessToken(accessToken)
        // Mark initial apps as connected
        setConnectedApps(['drive', 'gmail'])
        // Load cached docs quickly for immediate UI responsiveness
        try {
          const cachedDrive = JSON.parse(localStorage.getItem('google_drive_cache') || 'null')
          if (cachedDrive && Array.isArray(cachedDrive.files)) {
            setGoogleDocs(cachedDrive.files)
          }
          const cachedGmail = JSON.parse(localStorage.getItem('google_gmail_cache') || 'null')
          if (cachedGmail && Array.isArray(cachedGmail.attachments)) {
            setGmailAttachments(cachedGmail.attachments)
            setGmailLastCheckTime(cachedGmail.time || Date.now())
          }
        } catch (e) {}
        // Automatically load fresh docs after connection (background)
        loadGoogleDocs(accessToken)
      },
      (error) => {
        setDocsError("Failed to connect Google account. Please ensure you've granted all permissions and that the Google Drive API and Gmail API are enabled in your Google Cloud Console.")
      }
    )
  }

  const handleConnectSpecificApp = (appType) => {
    if (!googleAccessToken) {
      handleConnectGoogleDocs()
      return
    }
    
    // Add app to connected apps if not already there
    if (!connectedApps.includes(appType)) {
      setConnectedApps(prev => [...prev, appType])
    }
    
    setShowConnectAppsModal(false)
    loadGoogleDocs(googleAccessToken, appType)
  }

  const loadGoogleDocs = async (token, specificApp = null) => {
    setLoadingDocs(true)
    setDocsError(null)
    
    try {
      // Fetch Google Drive files first
      let driveFiles = []
      try {
        driveFiles = await GoogleService.fetchGoogleDriveFiles(token, specificApp || 'all')
        setGoogleDocs(driveFiles)
      } catch (driveError) {
        setDocsError(driveError.message || "Failed to load Google Drive files.")
        setGoogleDocs([])
      }
      
      // Fetch Gmail attachments (fetch all when no specific app or when gmail is requested)
      if (!specificApp || specificApp === 'gmail' || specificApp === 'all') {
        try {
          const gmailFiles = await GoogleService.fetchGmailAttachments(token)
          setGmailAttachments(gmailFiles)
          setGmailLastCheckTime(Date.now()) // Track last fetch time for real-time sync
        } catch (gmailError) {
          console.warn('Gmail fetch error:', gmailError)
          // Gmail is optional, just log the error
          setGmailAttachments([])
        }
      }
      
      setLoadingDocs(false)
    } catch (error) {
      setDocsError(error.message || "Failed to load documents. Please try again.")
      setLoadingDocs(false)
    }
  }

  // Extract attachments from current in-memory messages for display in Documents modal
  const extractSharedChatDocs = (messagesObj = {}) => {
    const collected = []
    const seen = new Set()

    Object.keys(messagesObj).forEach(chatId => {
      const msgs = messagesObj[chatId] || []
      msgs.forEach(m => {
        if (m && Array.isArray(m.attachments)) {
          m.attachments.forEach(att => {
            try {
              const key = att.webViewLink || att.url || att.id || `${att.name}-${att.size || 0}`
              if (!key || seen.has(key)) return
              seen.add(key)

              collected.push({
                ...att,
                chatId,
                messageId: m.id,
                timestamp: m.timestamp || m.date || null,
                source: att.source || 'chat'
              })
            } catch (e) {
              // ignore per-item errors
            }
          })
        }
      })
    })

    // Sort by timestamp descending (most recent first)
    return collected.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return timeB - timeA
    })
  }

  const handleDocsClick = () => {
    setShowDocsModal(true)
    
    if (googleAccessToken) {
      loadGoogleDocs(googleAccessToken)
    }
    // Populate shared chat docs from currently loaded messages
    setSharedChatDocs(extractSharedChatDocs(messages))
  }

  // Keep shared chat docs up-to-date while the modal is open
  useEffect(() => {
    if (!showDocsModal) return
    setSharedChatDocs(extractSharedChatDocs(messages))
  }, [showDocsModal, messages])

  // Real-time Gmail sync - periodically check for new attachments
  useEffect(() => {
    if (!googleAccessToken || !showDocsModal) return
    
    const checkNewGmail = async () => {
      try {
        const result = await GoogleService.checkNewGmailAttachments(googleAccessToken, gmailLastCheckTime)
        if (result.hasNew && result.attachments.length > 0) {
          // Merge new attachments with existing ones, avoiding duplicates
          setGmailAttachments(prev => {
            const existingIds = new Set(prev.map(a => `${a.messageId}-${a.id}`))
            const newOnes = result.attachments.filter(a => !existingIds.has(`${a.messageId}-${a.id}`))
            if (newOnes.length > 0) {
              // Show toast for new attachments
              setSuccessMessage(`${newOnes.length} new Gmail attachment${newOnes.length > 1 ? 's' : ''} found`)
              setShowSuccessToast(true)
              setTimeout(() => setShowSuccessToast(false), 3000)
              return [...newOnes, ...prev]
            }
            return prev
          })
        }
        setGmailLastCheckTime(Date.now())
      } catch (err) {
        // Silently ignore sync errors
        console.warn('Gmail sync check failed:', err)
      }
    }
    
    // Check every 30 seconds for new Gmail attachments
    const interval = setInterval(checkNewGmail, 30000)
    
    return () => clearInterval(interval)
  }, [googleAccessToken, showDocsModal, gmailLastCheckTime])

  // Add document as attachment to message input
  const addDocumentAsAttachment = (doc) => {
    const newAttachment = {
      id: Date.now() + Math.random(),
      name: doc.name,
      size: doc.size || 0,
      type: doc.mimeType,
      url: doc.source === 'gmail' ? null : (doc.webViewLink || doc.url || doc.public_url),
      source: doc.source || "drive",
      thumbnailLink: doc.thumbnailLink,
      iconLink: doc.iconLink,
      // Gmail-specific fields for direct download
      gmailMessageId: doc.gmailMessageId || doc.messageId || null,
      gmailAttachmentId: doc.gmailAttachmentId || doc.id || null
    }
    setSelectedFiles(prev => [...prev, newAttachment])
    
    // Show success message
    setSuccessMessage(`"${doc.name}" added to message`)
    setShowSuccessToast(true)
    setTimeout(() => setShowSuccessToast(false), 3000)
  }

  // Connect Google Calendar
  const handleConnectGoogleCalendar = () => {
    GoogleService.requestGoogleCalendarAccess(
      (accessToken) => {
        setGoogleCalendarToken(accessToken)
        GoogleService.setGoogleCalendarToken(accessToken)
        loadGoogleCalendarEvents(accessToken)
        setShowCalendarConnectModal(false)
        // Navigate to calendar view after successful connection
        setActiveView("calendar")
        setActiveSpace(null)
      },
      (error) => {
        console.error('Failed to connect Google Calendar:', error)
        alert('Failed to connect Google Calendar. Please ensure you\'ve granted Calendar permissions.')
      }
    )
  }

  const handleDisconnectGoogleCalendar = () => {
    try {
      GoogleService.removeGoogleCalendarToken()
    } catch (e) {}
    setGoogleCalendarToken(null)
    setGoogleCalendarEvents([])
    // Remove google-sourced events from the main events list
    setEvents(prev => (prev || []).filter(e => e.source !== 'google'))
  }

  const refreshGoogleCalendar = async () => {
    const token = googleCalendarToken || GoogleService.getGoogleCalendarToken()
    if (!token) return
    try {
      await loadGoogleCalendarEvents(token)
    } catch (e) {
      console.error('Failed to refresh Google Calendar events', e)
    }
  }

  const loadGoogleCalendarEvents = async (token) => {
    try {
      const gEvents = await GoogleService.fetchGoogleCalendarEvents(token)
      setGoogleCalendarEvents(gEvents)

      // Map Google events into app event format and merge into local `events`
      const mapped = (gEvents || [])
        // Ignore ephemeral live Meet events created by the app for immediate calls
        .filter(ge => !(ge.extendedProperties && ge.extendedProperties.private && ge.extendedProperties.private.ephemeral_meet === 'true'))
        .map(ge => {
        const startIso = ge.start?.dateTime || ge.start?.date || null
        const endIso = ge.end?.dateTime || ge.end?.date || null
        const startDate = startIso ? toLocalDateStr(startIso) : ''
        return {
          id: `gcal-${ge.id}`,
          title: ge.summary || 'Untitled',
          type: ge.conferenceData ? 'meeting' : 'event',
          startDate: startDate,
          startDateTime: startIso,
          endDateTime: endIso,
          description: ge.description || '',
          link: ge.hangoutLink || ge.htmlLink || (ge.conferenceData && ge.conferenceData.entryPoints && ge.conferenceData.entryPoints[0] && ge.conferenceData.entryPoints[0].uri) || null,
          source: 'google'
        }
      })

      setEvents(prev => {
        const others = (prev || []).filter(e => e.source !== 'google')
        return [...others, ...mapped]
      })

      // If any google event is scheduled to start very soon, trigger an incomingCall pop
      try {
        const now = Date.now()
        for (const ge of mapped) {
          if (!ge.startDateTime) continue
          const startTs = new Date(ge.startDateTime).getTime()
          // If event starts within the next 60 seconds and hasn't been alerted yet
          if (startTs >= now && startTs - now <= 60000 && !alertedScheduledRef.current.has(ge.id)) {
            alertedScheduledRef.current.add(ge.id)
            setIncomingCall({
              id: ge.id,
              fromId: null,
              fromName: ge.title || 'Scheduled Meeting',
              fromAvatar: '📅',
              link: ge.link || null,
              title: ge.title,
              timestamp: startTs
            })
          }
        }
      } catch (e) {
        // ignore scheduling alert errors
      }
    } catch (error) {
      console.error('Failed to load calendar events:', error)
    }
  }

  // Poll Google Calendar regularly when connected (near real-time sync)
  useEffect(() => {
    if (!googleCalendarToken) return
    // Initial load already handled by connect flow, but ensure we fetch here too
    loadGoogleCalendarEvents(googleCalendarToken)
    const id = setInterval(() => loadGoogleCalendarEvents(googleCalendarToken), 30000)
    return () => clearInterval(id)
  }, [googleCalendarToken])

  // Video call helpers
  const toggleCallMember = (userId) => {
    setSelectedCallMembers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }

  const createMeetCall = async ({callEveryone = false} = {}) => {
    if (!currentUser) return
    const members = getActiveMembers()
    const targets = callEveryone ? members.filter(m => m.id !== currentUser.id) : members.filter(m => selectedCallMembers.includes(m.id))
    const emails = targets.map(t => t.email).filter(Boolean)

    // Ensure we have a calendar token with write access
    let token = GoogleService.getGoogleCalendarToken()
    if (!token) {
      // request interactive permission
      try {
        await new Promise((resolve, reject) => {
          GoogleService.requestGoogleCalendarAccess((accessToken) => { token = accessToken; GoogleService.setGoogleCalendarToken(accessToken); resolve() }, err => reject(err))
        })
      } catch (err) {
        alert('Google Calendar access is required to create Meet links.')
        return
      }
    }
    setCallCreating(true)
    let triedRefresh = false
    try {
      const attemptCreate = async () => {
        const start = new Date()
        const end = new Date(start.getTime() + 30 * 60000)
        const ev = await GoogleService.createCalendarEvent(token, {
          summary: `${getActiveViewName().replace('#','').trim()} — ${currentUser.name}`,
          description: `Video call started by ${currentUser.name}`,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          attendees: emails,
          ephemeral: true
        })
        return ev
      }

      let ev
      try {
        ev = await attemptCreate()
      } catch (err) {
        const msg = (err && err.message) || ''
        if (!triedRefresh && (msg.includes('Invalid or expired token') || msg.includes('Calendar access denied') || msg.includes('401') || msg.includes('403'))) {
          triedRefresh = true
          try {
            await new Promise((resolve, reject) => {
              GoogleService.requestGoogleCalendarAccess((accessToken) => { token = accessToken; GoogleService.setGoogleCalendarToken(accessToken); resolve() }, err2 => reject(err2))
            })
            ev = await attemptCreate()
          } catch (err2) {
            throw err2 || err
          }
        } else {
          throw err
        }
      }

      const meetLink = ev.hangoutLink || (ev.conferenceData && ev.conferenceData.entryPoints && ev.conferenceData.entryPoints[0] && ev.conferenceData.entryPoints[0].uri) || null

      setCurrentMeeting({ event: ev, link: meetLink })

      await Storage.sendMeetInvite({
        organizerId: currentUser.id,
        targetUserIds: targets.map(t => t.id),
        spaceId: activeSpace,
        channelId: activeView === 'channel' ? activeChannel : null,
        meetingLink: meetLink,
        meetingTitle: ev.summary
      })

      // Send a message in the channel/chat with the meeting link
      if (meetLink) {
        const chatId = getActiveChatId()
        if (chatId) {
          const tempId = `tmp-meet-${Date.now()}-${Math.floor(Math.random() * 1000)}`
          const meetMessage = {
            id: tempId,
            userId: currentUser.id,
            text: `${currentUser.name} has started a meet: ${meetLink}`,
            timestamp: new Date().toISOString(),
            reactions: {},
            thread: [],
            attachments: [],
            type: 'meet-invite',
            meetLink: meetLink,
            meetTitle: ev.summary,
            status: "sending",
            optimistic: true
          }

          // Add to local state
          setMessages(prev => ({
            ...prev,
            [chatId]: [...(prev[chatId] || []), meetMessage]
          }))

          const payload = sanitizeMessagePayload(meetMessage)

          // Send via WebSocket
          try {
            if (chatSocketRef.current) {
              chatSocketRef.current.send(payload)
            }
          } catch (wsErr) {
            console.warn('chat socket send failed', wsErr)
          }

          // Persist to database
          persistMessageWithRetry(chatId, payload, tempId, 0)
        }
      }

      if (meetLink) window.open(meetLink, '_blank')

      setShowVideoModal(false)
    } catch (err) {
      console.error('Failed to create Meet call', err)
      const friendly = (err && err.message) ? err.message : 'Failed to create Meet call. Please ensure Calendar permissions are granted.'
      alert(friendly)
    } finally {
      setCallCreating(false)
    }
  }

  const addParticipantsToMeeting = async (additionalUserIds = []) => {
    if (!currentMeeting || !currentMeeting.event) return
    const token = GoogleService.getGoogleCalendarToken()
    if (!token) {
      alert('No calendar token available')
      return
    }

    // Build attendees emails and send notifications; we won't patch the original event attendees for brevity,
    // but we will notify the new participants with the same meet link.
    const targets = users.filter(u => additionalUserIds.includes(u.id))
    await Storage.sendMeetInvite({
      organizerId: currentUser.id,
      targetUserIds: targets.map(t => t.id),
      spaceId: activeSpace,
      channelId: activeView === 'channel' ? activeChannel : null,
      meetingLink: currentMeeting.link,
      meetingTitle: currentMeeting.event.summary
    })
  }

  // ============================================
  // WebRTC Video Call Functions
  // ============================================
  
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]

  // Initialize WebRTC peer connection
  const createPeerConnection = (partnerId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const iceMessage = {
          type: 'ice-candidate',
          candidate: event.candidate,
          fromUserId: currentUser?.id,
          targetUserId: partnerId
        }
        // Prefer user socket for reliable delivery
        if (userSocketRef.current) {
          userSocketRef.current.send(iceMessage)
        } else if (chatSocketRef.current) {
          chatSocketRef.current.send(iceMessage)
        }
      }
    }

    pc.ontrack = (event) => {
      console.log('Remote track received:', event.streams)
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0])
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'connected') {
        setWebrtcCallStatus('connected')
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        endWebRTCCall()
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState)
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        endWebRTCCall()
      }
    }

    return pc
  }

  // Start outgoing video call
  const startWebRTCCall = async (targetUser) => {
    if (!currentUser || !targetUser) return
    
    setWebrtcError(null)
    setWebrtcCallPartner(targetUser)
    setWebrtcCallStatus('calling')
    setShowWebRTCCall(true)
    setCallerCountdown(10) // Reset countdown to 10 seconds

    try {
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true }
      })
      
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // Create peer connection
      const pc = createPeerConnection(targetUser.id)
      peerConnectionRef.current = pc

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })

      // Create and send offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Send call request via user notification socket (works regardless of which chat is open)
      const callRequest = {
        type: 'webrtc-call-request',
        fromUserId: currentUser.id,
        fromUserName: currentUser.name,
        fromUserAvatar: currentUser.avatar || currentUser.avatar_url,
        targetUserId: targetUser.id,
        offer: pc.localDescription
      }
      
      console.log('Sending WebRTC call request:', callRequest)
      
      if (userSocketRef.current) {
        console.log('Sending via userSocketRef, readyState:', userSocketRef.current.readyState)
        userSocketRef.current.send(callRequest)
      } else if (chatSocketRef.current) {
        // Fallback to chat socket
        console.log('Sending via chatSocketRef (fallback)')
        chatSocketRef.current.send(callRequest)
      } else {
        console.error('No WebSocket available to send call request!')
      }

      // Start countdown for caller (10 seconds)
      if (callerCountdownRef.current) {
        clearInterval(callerCountdownRef.current)
      }
      callerCountdownRef.current = setInterval(() => {
        setCallerCountdown(prev => {
          if (prev <= 1) {
            clearInterval(callerCountdownRef.current)
            callerCountdownRef.current = null
            // Only end call if still in calling state
            if (webrtcCallStatus === 'calling') {
              setWebrtcError('Call not answered')
              endWebRTCCall()
            }
            return 10
          }
          return prev - 1
        })
      }, 1000)

      // Backup timeout for unanswered call (10 seconds)
      setTimeout(() => {
        if (webrtcCallStatus === 'calling') {
          if (callerCountdownRef.current) {
            clearInterval(callerCountdownRef.current)
            callerCountdownRef.current = null
          }
          setWebrtcError('Call not answered')
          endWebRTCCall()
        }
      }, 10000)

    } catch (err) {
      console.error('Failed to start video call:', err)
      setWebrtcError(err.name === 'NotAllowedError' 
        ? 'Camera/microphone access denied. Please allow access and try again.'
        : 'Failed to start video call. Please check your camera and microphone.')
      setWebrtcCallStatus('idle')
    }
  }

  // Answer incoming video call
  const answerWebRTCCall = async () => {
    if (!incomingCall || !incomingCall.webrtcOffer) return

    // Capture incoming call data before clearing state
    const callerId = incomingCall.fromId
    const callerName = incomingCall.fromName
    const callerAvatar = incomingCall.fromAvatar
    const offer = incomingCall.webrtcOffer

    // Clear incoming call countdown
    if (incomingCountdownRef.current) {
      clearInterval(incomingCountdownRef.current)
      incomingCountdownRef.current = null
    }
    if (incomingTimeoutRef.current) {
      clearTimeout(incomingTimeoutRef.current)
      incomingTimeoutRef.current = null
    }
    setIncomingCallCountdown(10)

    setWebrtcError(null)
    setWebrtcCallPartner({
      id: callerId,
      name: callerName,
      avatar: callerAvatar
    })
    setWebrtcCallStatus('connecting')
    setShowWebRTCCall(true)
    setIncomingCall(null)

    try {
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true }
      })
      
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // Create peer connection
      const pc = createPeerConnection(callerId)
      peerConnectionRef.current = pc

      // Add local tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })

      // Set remote description from offer
      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      // Process any pending ICE candidates
      for (const candidate of pendingIceCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
      pendingIceCandidatesRef.current = []

      // Create and send answer via user socket
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      const answerMessage = {
        type: 'webrtc-call-answer',
        fromUserId: currentUser.id,
        targetUserId: callerId,
        answer: pc.localDescription
      }
      
      if (userSocketRef.current) {
        userSocketRef.current.send(answerMessage)
      } else if (chatSocketRef.current) {
        chatSocketRef.current.send(answerMessage)
      }

      setWebrtcCallStatus('connected')

    } catch (err) {
      console.error('Failed to answer video call:', err)
      setWebrtcError(err.name === 'NotAllowedError'
        ? 'Camera/microphone access denied.'
        : 'Failed to answer video call.')
      endWebRTCCall()
    }
  }

  // Decline incoming video call
  const declineWebRTCCall = () => {
    if (incomingCall) {
      const declineMessage = {
        type: 'webrtc-call-declined',
        fromUserId: currentUser?.id,
        targetUserId: incomingCall.fromId
      }
      if (userSocketRef.current) {
        userSocketRef.current.send(declineMessage)
      } else if (chatSocketRef.current) {
        chatSocketRef.current.send(declineMessage)
      }
    }
    setIncomingCall(null)
  }

  // Format call duration as mm:ss or hh:mm:ss
  const formatCallDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Call timer effect
  useEffect(() => {
    if (webrtcCallStatus === 'connected' && !callStartTime) {
      setCallStartTime(Date.now())
    }
    
    if (callStartTime && webrtcCallStatus === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime) / 1000))
      }, 1000)
    }
    
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
        callTimerRef.current = null
      }
    }
  }, [webrtcCallStatus, callStartTime])

  // Add friend to ongoing call
  const addFriendToCall = async (friend) => {
    if (!currentUser || !friend) return
    
    // Add to pending participants with "calling" status
    setPendingCallParticipants(prev => [...prev, { ...friend, status: 'calling' }])
    setShowAddFriendsToCall(false)
    
    // Send call request to the friend
    const callRequest = {
      type: 'webrtc-call-request',
      fromUserId: currentUser.id,
      fromUserName: currentUser.name,
      fromUserAvatar: currentUser.avatar || currentUser.avatar_url,
      targetUserId: friend.id,
      isGroupCall: true
    }
    
    if (userSocketRef.current) {
      userSocketRef.current.send(callRequest)
    }
    
    // Remove from pending after 10 seconds if not answered
    setTimeout(() => {
      setPendingCallParticipants(prev => prev.filter(p => p.id !== friend.id))
    }, 10000)
  }

  // End video call
  const endWebRTCCall = () => {
    // Clear call timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
    
    // Stop all local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
    }
    setLocalStream(null)
    setRemoteStream(null)

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // Notify other party
    if (webrtcCallPartner) {
      const endMessage = {
        type: 'webrtc-call-ended',
        fromUserId: currentUser?.id,
        targetUserId: webrtcCallPartner.id
      }
      if (userSocketRef.current) {
        userSocketRef.current.send(endMessage)
      } else if (chatSocketRef.current) {
        chatSocketRef.current.send(endMessage)
      }
    }
    
    // Notify all participants in group call
    callParticipants.forEach(participant => {
      if (participant.id !== currentUser?.id) {
        const endMessage = {
          type: 'webrtc-call-ended',
          fromUserId: currentUser?.id,
          targetUserId: participant.id
        }
        if (userSocketRef.current) {
          userSocketRef.current.send(endMessage)
        }
      }
    })

    // Reset state
    setShowWebRTCCall(false)
    setWebrtcCallStatus('idle')
    setWebrtcCallPartner(null)
    setWebrtcError(null)
    setIsWebRTCMicOn(true)
    setIsWebRTCVideoOn(true)
    setCallStartTime(null)
    setCallDuration(0)
    setCallParticipants([])
    setPendingCallParticipants([])
    pendingIceCandidatesRef.current = []
  }

  // Toggle microphone
  const toggleWebRTCMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsWebRTCMicOn(audioTrack.enabled)
      }
    }
  }

  // Toggle camera
  const toggleWebRTCVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsWebRTCVideoOn(videoTrack.enabled)
      }
    }
  }

  // Handle WebRTC signaling messages
  const handleWebRTCSignaling = async (data) => {
    console.log('WebRTC signaling:', data.type)
    
    switch (data.type) {
      case 'webrtc-call-request':
        // Incoming call - show notification
        if (String(data.targetUserId) === String(currentUser?.id)) {
          setIncomingCall({
            id: `webrtc-${Date.now()}`,
            fromId: data.fromUserId,
            fromName: data.fromUserName,
            fromAvatar: data.fromUserAvatar || '👤',
            webrtcOffer: data.offer,
            isWebRTC: true
          })
        }
        break

      case 'webrtc-call-answer':
        // Call was answered - set remote description
        if (peerConnectionRef.current && String(data.targetUserId) === String(currentUser?.id)) {
          // Clear caller countdown since call was answered
          if (callerCountdownRef.current) {
            clearInterval(callerCountdownRef.current)
            callerCountdownRef.current = null
          }
          setCallerCountdown(10)
          
          try {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            )
            setWebrtcCallStatus('connected')
            
            // Process any pending ICE candidates
            for (const candidate of pendingIceCandidatesRef.current) {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
            }
            pendingIceCandidatesRef.current = []
          } catch (err) {
            console.error('Failed to set remote description:', err)
          }
        }
        break

      case 'webrtc-call-declined':
        // Call was declined
        if (String(data.targetUserId) === String(currentUser?.id)) {
          setWebrtcError('Call was declined')
          endWebRTCCall()
        }
        break

      case 'webrtc-call-ended':
        // Other party ended the call
        if (String(data.targetUserId) === String(currentUser?.id)) {
          endWebRTCCall()
        }
        break

      case 'ice-candidate':
        // ICE candidate received
        if (String(data.targetUserId) === String(currentUser?.id)) {
          if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
            } catch (err) {
              console.error('Failed to add ICE candidate:', err)
            }
          } else {
            // Queue candidates if remote description not set yet
            pendingIceCandidatesRef.current.push(data.candidate)
          }
        }
        break
    }
  }

  // Attach the signaling handler to WebSocket messages
  useEffect(() => {
    if (chatSocketRef.current && chatSocketRef.current._wrapper) {
      const existingHandler = chatSocketRef.current._wrapper._handlers?.onmessage
      chatSocketRef.current._wrapper.setOnMessage((data) => {
        // Handle WebRTC signaling messages
        if (data && (data.type?.startsWith('webrtc-') || data.type === 'ice-candidate')) {
          handleWebRTCSignaling(data)
          return
        }
        // Pass to existing handler for regular messages
        if (existingHandler) existingHandler({ data: JSON.stringify(data) })
      })
    }
  }, [chatSocketRef.current, currentUser?.id])

  // Attach remote stream to video element when it changes
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('Attaching remote stream to video element')
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // Attach local stream to video element when it changes
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log('Attaching local stream to video element')
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // --- Helpers ---
  const formatTime = timestamp => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch (e) {
      return ""
    }
  }

  // Live relative time for notifications (updates when `timeTicker` changes)
  const [timeTicker, setTimeTicker] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setTimeTicker(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const formatRelativeTime = (timestamp, now = Date.now()) => {
    if (!timestamp) return ""
    const ts = new Date(timestamp).getTime()
    const diff = Math.max(0, now - ts)
    const seconds = Math.floor(diff / 1000)
    if (seconds < 5) return "just now"
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
  }

  // Date label for chat header (Today / Yesterday / actual date) — updates with `timeTicker`
  const formatDateLabel = (timestamp, now = Date.now()) => {
    // Default to Today when we have no timestamp
    if (!timestamp) return "Today"
    const d = new Date(timestamp)
    const n = new Date(now)

    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()

    if (sameDay(d, n)) return "Today"
    const yesterday = new Date(n)
    yesterday.setDate(n.getDate() - 1)
    if (sameDay(d, yesterday)) return "Yesterday"
    return d.toLocaleDateString()
  }

  // Compute the current chat's date label (latest message) and update when relevant state changes
  const messageDateLabel = useMemo(() => {
    try {
      const _msgs = getCurrentMessages() || []
      const _latest = _msgs.length ? _msgs[_msgs.length - 1] : null
      return formatDateLabel(_latest?.timestamp, timeTicker)
    } catch (e) {
      return "Today"
    }
  }, [messages, activeView, activeChannel, activeDMUser, timeTicker])

  // Visible date label (changes while scrolling to indicate the date of messages in view)

  // --- Dismissed notifications persistence helpers ---
  const dismissedKeyFor = userId => `spaces_dismissed_notifications_${userId}`

  const getDismissedNotifications = userId => {
    if (!userId) return []
    try {
      return JSON.parse(localStorage.getItem(dismissedKeyFor(userId)) || "[]")
    } catch (e) {
      return []
    }
  }

  const addDismissedNotification = (userId, notificationId) => {
    if (!userId || !notificationId) return
    try {
      const key = dismissedKeyFor(userId)
      const arr = JSON.parse(localStorage.getItem(key) || "[]")
      if (!arr.includes(notificationId)) {
        arr.push(notificationId)
        localStorage.setItem(key, JSON.stringify(arr))
      }
    } catch (e) {
      // ignore localStorage errors
    }
  }

  const isNotificationDismissed = (userId, notificationId) => {
    const arr = getDismissedNotifications(userId)
    return arr.includes(notificationId)
  }

  const filterDismissedUser = user => {
    if (!user) return user
    const dismissed = getDismissedNotifications(user.id)
    if (!dismissed || dismissed.length === 0) return user
    return { ...user, notifications: (user.notifications || []).filter(n => !dismissed.includes(n.id)) }
  }

  const renderWithHighlight = (text, highlight) => {
    if (!highlight || !text) return text
    const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const parts = text.split(new RegExp(`(${escapedHighlight})`, "gi"))
    return parts.map((part, i) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <span
          key={i}
          className="bg-yellow-300 text-slate-900 px-0.5 rounded shadow-sm"
        >
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  const getCurrentSpace = () => spaces.find(s => s.id === activeSpace)
  const getCurrentChannels = () => getCurrentSpace()?.channels || []

  // Reactions / Emoji helpers
  const EMOJIS = ['👍','❤️','😂','😮','😢','🎉','🔥']
  const longPressTimerRef = useRef(null)

  const toggleReaction = async (chatId, messageId, emoji) => {
    if (!chatId || !currentUser) return
    const msgs = messages[chatId] || []
    const idx = msgs.findIndex(m => m.id === messageId)
    if (idx === -1) return
    const msg = { ...msgs[idx] }
    if (!msg.reactions) msg.reactions = {}
    const current = Array.isArray(msg.reactions[emoji]) ? [...msg.reactions[emoji]] : []
    const hasReacted = current.includes(currentUser.id)
    const next = hasReacted ? current.filter(id => id !== currentUser.id) : [...current, currentUser.id]
    if (next.length === 0) delete msg.reactions[emoji]
    else msg.reactions[emoji] = next

    try {
      await Storage.updateMessage(chatId, msg)
      setMessages(prev => ({
        ...prev,
        [chatId]: prev[chatId].map(m => (m.id === msg.id ? msg : m))
      }))
    } catch (e) {
      console.error('Failed to update reaction', e)
    }
  }

  const getActiveChatId = () => {
    if (activeView === "channel") return Number(activeChannel)
    if (activeView === "dm" && activeDMUser && currentUser) {
      const ids = [currentUser.id, activeDMUser].sort((a, b) => a - b)
      return `dm_${ids[0]}_${ids[1]}`
    }
    return null
  }

  const getCurrentMessages = () => {
    const chatId = getActiveChatId()
    return chatId ? messages[chatId] || [] : []
  }

  const getUser = userId => {
    if (currentUser?.id === userId || String(currentUser?.id) === String(userId)) return currentUser
    // Use string comparison to handle type mismatches (number vs string ids)
    const strUserId = String(userId)
    const found = users.find(u => String(u.id) === strUserId) || friends.find(u => String(u.id) === strUserId)
    return found
  }

  const getActiveMembers = () => {
    if (activeView === "channel") {
      const channel = getCurrentChannels().find(c => c.id === activeChannel)
      if (!channel) return []
      // Bug Fix: Filter out undefined users to prevent white screen if user data isn't synced
      return channel.members.map(id => getUser(id)).filter(u => u !== undefined)
    } else if (activeView === "dm" && activeDMUser && currentUser) {
      const partner = getUser(activeDMUser)
      return partner ? [currentUser, partner] : [currentUser]
    }
    return []
  }

  const getChannelRole = (memberId) => {
    const channel = getCurrentChannels().find(c => c.id === activeChannel)
    if (!channel) return 'member'
    const roles = channel.roles || {}
    return roles[String(memberId)] || 'member'
  }

  const MAX_MESSAGE_SEND_RETRIES = 3

  const sanitizeMessagePayload = message => {
    if (!message) return message
    const { status, optimistic, retryCount, previewUrl, data, source, ...rest } = message
    // Also sanitize attachments - remove local blob URLs that won't work for other users
    if (rest.attachments && Array.isArray(rest.attachments)) {
      rest.attachments = rest.attachments.map(att => {
        const { previewUrl: attPreview, data: attData, source: attSource, ...cleanAtt } = att
        // Ensure we have a proper server URL for the attachment (absolute URL with API_BASE)
        if (cleanAtt.fileId && !cleanAtt.url) {
          cleanAtt.url = `${API_BASE}/upload/file/${cleanAtt.fileId}/download`
        } else if (cleanAtt.id && !cleanAtt.url && !String(cleanAtt.id).startsWith('tmp-')) {
          cleanAtt.url = `${API_BASE}/upload/file/${cleanAtt.id}/download`
        }
        return cleanAtt
      })
    }
    return rest
  }

  // Poll backend for file metadata until it's available (url/status)
  const fetchFileMetadata = async fileId => {
    try {
      const token = getToken()
      const stored = getStoredUser()
      const userId = stored && (stored.id || stored._id || (stored._id && stored._id.$oid) || stored.userId)
      const resp = await fetch(`${API_BASE}/upload/file/${fileId}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(userId ? { 'X-User-Id': String(userId) } : {}) } })
      if (!resp.ok) return null
      const json = await resp.json()
      if (json && !json.error) return json
    } catch (e) {
      // ignore
    }
    return null
  }

  // Fetch a protected file URL using auth headers and return an object URL for preview/download
  const fetchProtectedUrlAndCreateObjectURL = async att => {
    try {
      const url = att.url || att.public_url || null
      const fid = (att.fileId || att.id) || null
      // Prefer explicit URL if available
      if (url) {
        const token = getToken()
        const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
        const resp = await fetch(url, { headers })
        if (!resp.ok) return null
        const blob = await resp.blob()
        return URL.createObjectURL(blob)
      }
      // Otherwise try fileId metadata endpoint
      if (fid) {
        const meta = await fetchFileMetadata(fid)
        const realUrl = meta && (meta.url || meta.public_url)
        if (realUrl) {
          const token = getToken()
          const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
          const resp = await fetch(realUrl, { headers })
          if (!resp.ok) return null
          const blob = await resp.blob()
          return URL.createObjectURL(blob)
        }
      }
    } catch (e) {
      console.error('fetchProtectedUrl failed', e)
    }
    return null
  }

  const startPollingFileStatus = (fileId) => {
    if (!fileId) return
    let attempts = 0
    const maxAttempts = 30
    const interval = setInterval(async () => {
      attempts += 1
      const meta = await fetchFileMetadata(fileId)
      if (meta) {
        setSelectedFiles(prev => prev.map(f => (String(f.id) === String(fileId) ? { ...f, status: meta.status || f.status, url: meta.url || meta.public_url || f.url } : f)))
        // Also update any messages in current thread that reference this fileId
        setMessages(prev => {
          const key = getActiveChatId()
          if (!key || !prev[key]) return prev
          return {
            ...prev,
            [key]: prev[key].map(m => {
              if (!m.attachments || !m.attachments.length) return m
              const updated = m.attachments.map(att => (String(att.id) === String(fileId) || String(att.fileId) === String(fileId) ? { ...att, url: meta.url || att.url, status: meta.status || att.status } : att))
              return { ...m, attachments: updated }
            })
          }
        })
      }
      if (meta && (meta.status === 'done' || meta.status === 'error')) clearInterval(interval)
      if (attempts >= maxAttempts) clearInterval(interval)
    }, 1500)
  }

  const updateMessageMeta = (chatId, messageId, updater) => {
    if (!chatId || !messageId) return
    setMessages(prev => {
      const list = prev[chatId] || []
      if (!list.length) return prev
      return {
        ...prev,
        [chatId]: list.map(msg => (msg.id === messageId ? updater(msg) : msg))
      }
    })
  }

  const persistMessageWithRetry = (chatId, payload, localId, attempt = 0) => {
    if (!chatId || !localId || !payload) return
    Storage.saveMessage(chatId, payload)
      .then(() => {
        updateMessageMeta(chatId, localId, msg => ({
          ...msg,
          status: "sent",
          optimistic: false
        }))
      })
      .catch(err => {
        if (err && err.status === 403) {
          setShowAccessDeniedModal(true)
          updateMessageMeta(chatId, localId, msg => ({ ...msg, status: "failed" }))
          return
        }

        if (attempt + 1 >= MAX_MESSAGE_SEND_RETRIES) {
          updateMessageMeta(chatId, localId, msg => ({ ...msg, status: "failed" }))
        } else {
          updateMessageMeta(chatId, localId, msg => ({ ...msg, status: "retrying" }))
          const delay = Math.min(5000, 1200 * (attempt + 1))
          setTimeout(() => persistMessageWithRetry(chatId, payload, localId, attempt + 1), delay)
        }
      })
  }

  const retryFailedMessage = (chatId, message) => {
    if (!chatId || !message) return
    const payload = sanitizeMessagePayload(message)
    updateMessageMeta(chatId, message.id, msg => ({
      ...msg,
      status: "sending",
      optimistic: true
    }))

    try {
      if (chatSocketRef.current) {
        chatSocketRef.current.send(payload)
      }
    } catch (wsErr) {
      console.warn("chat socket send failed during retry", wsErr)
    }

    persistMessageWithRetry(chatId, payload, message.id, 0)
  }

  const getActiveViewName = () => {
    if (activeView === "channel") {
      const channels = getCurrentChannels()
      const channel = channels.find(c => c.id === activeChannel)
      return channel ? `# ${channel.name}` : ""
    } else if (activeView === "dm" && activeDMUser) {
      const user = getUser(activeDMUser)
      return user ? user.name : "Unknown User"
    } else if (activeView === "calendar") return "Calendar"
    else if (activeView === "meeting") return "Meeting"
    return ""
  }

  // --- Actions ---

  const handleChannelNavigation = (spaceId, channelId) => {
    if (!currentUser) return
    const space = spaces.find(s => s.id === spaceId)
    if (!space) return
    const channel = space.channels.find(c => c.id === channelId)
    if (!channel) return

    // Access Check: User has access if they own the space OR have it in their spaces list OR are in members array
    // For public channels: space members have access
    // For private channels: need to be channel member
    const userOwnsSpace = space.ownerId === currentUser.id
    const userHasSpace = (currentUser.spaces || []).includes(spaceId)
    const userInSpaceMembers = (space.members || []).includes(currentUser.id)
    
    const hasAccess =
      userOwnsSpace || userHasSpace || 
      (channel.type === "public" ? userInSpaceMembers : (channel.members || []).includes(currentUser.id))

  if (hasAccess) {
    setActiveSpace(spaceId)
    setActiveChannel(channelId)
    setActiveView("channel")
    // When navigating to a channel, collapse the friends sidebar for focused view
    setFriendsSidebarCollapsed(true)
    // Indicate a manual thread switch so scroll logic jumps directly to latest (no long smooth animation)
    justSwitchedThreadRef.current = true
    if (isMobile) setMobileView("chat")
  } else {
    setShowAccessDeniedModal(true)
  }
}

  const handleFileSelect = async e => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true)
      const files = Array.from(e.target.files)
      // Upload concurrently
      const uploadPromises = files.map(async file => {
        const previewUrl = URL.createObjectURL(file)
        try {
          const form = new FormData()
          form.append('file', file)
          const token = getToken()
          const stored = getStoredUser()
          const userId = stored && (stored.id || stored._id || (stored._id && stored._id.$oid) || stored.userId)
          const resp = await fetch(`${API_BASE}/upload/file`, { method: 'POST', body: form, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(userId ? { 'X-User-Id': String(userId) } : {}) } })
          if (!resp.ok) throw new Error('Upload failed')
          const data = await resp.json()
          const id = data.file_id || `tmp-${Date.now()}-${Math.floor(Math.random()*1000)}`
          // start polling for drive url
          startPollingFileStatus(id)
          return {
            id,
            name: file.name,
            size: file.size,
            type: file.type,
            fileId: data.file_id || null,
            status: 'uploading',
            source: 'uploaded',
            previewUrl
          }
        } catch (err) {
          return {
            id: `tmp-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'error',
            source: 'local',
            previewUrl
          }
        }
      })

      const newAttachments = await Promise.all(uploadPromises)
      setSelectedFiles(prev => [...prev, ...newAttachments])
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeAttachment = id => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id))
  }

  // Open confirmation modal to remove a member from a channel (owner-only action)
  const handleRemoveMember = memberId => {
    if (!memberId || !activeSpace) return
    const memberName = getUser(memberId)?.name || ""
    setShowRemoveMemberConfirm({ id: memberId, name: memberName })
  }

  // Confirm and perform the removal
  const confirmRemoveMember = async () => {
    if (!showRemoveMemberConfirm || !activeSpace) return
    const memberId = showRemoveMemberConfirm.id
    try {
      await Storage.removeMemberFromSpace(memberId, activeSpace, activeChannel)

      // Refresh spaces for current user so UI updates accurately
      try {
        const sps = await Storage.getSpacesForUser(currentUser.spaces)
        const enrichedSpaces = sps.map(s => ({
          ...s,
          icon:
            s.iconType === "graduation" ? (
              <GraduationCap className="w-5 h-5" />
            ) : s.iconType === "briefcase" ? (
              <Briefcase className="w-5 h-5" />
            ) : (
              <UserIcon className="w-5 h-5" />
            )
        }))
        setSpaces(enrichedSpaces)
      } catch (e) {
        console.error('Failed to refresh spaces after remove', e)
      }

    } catch (e) {
      console.error('Failed to remove member', e)
    } finally {
      setShowRemoveMemberConfirm(null)
    }
  }

  const handleSetRole = async (memberId, role) => {
    if (!activeSpace || !activeChannel) return
    try {
      await RolesService.setChannelRole({ space_id: activeSpace, channel_id: activeChannel, user_id: memberId, role })
      // Refresh local spaces to reflect change
      try {
        const sps = await Storage.getSpacesForUser(currentUser.spaces)
        const enrichedSpaces = sps.map(s => ({
          ...s,
          icon:
            s.iconType === "graduation" ? (
              <GraduationCap className="w-5 h-5" />
            ) : s.iconType === "briefcase" ? (
              <Briefcase className="w-5 h-5" />
            ) : (
              <UserIcon className="w-5 h-5" />
            )
        }))
        setSpaces(enrichedSpaces)
      } catch (e) {
        console.error('Failed to refresh spaces after role change', e)
      }
    } catch (e) {
      console.error('Failed to set role', e)
      // Optionally show an access denied modal
      if (e && e.status === 403) setShowAccessDeniedModal(true)
    }
  }

  const sendMessage = async () => {
    if ((!messageInput.trim() && selectedFiles.length === 0) || !currentUser)
      return
    const chatId = getActiveChatId()
    if (!chatId) return

    const attachments = selectedFiles.map(file => ({ ...file }))
    const tempId = `tmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const newMsg = {
      id: tempId,
      userId: currentUser.id,
      text: messageInput,
      timestamp: new Date().toISOString(),
      reactions: {},
      thread: [],
      attachments,
      status: "sending",
      optimistic: true
    }

    setMessages(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), newMsg]
    }))
    setMessageInput("")
    setSelectedFiles([])

    const payload = sanitizeMessagePayload(newMsg)

    try {
      if (chatSocketRef.current) {
        chatSocketRef.current.send(payload)
      }
    } catch (wsErr) {
      console.warn('chat socket send failed', wsErr)
    }

    persistMessageWithRetry(chatId, payload, newMsg.id, 0)
  }

  // Helper to open or download attachments
  const openAttachment = async att => {
    if (!att) return
    
    // Handle Gmail attachments - download and open directly
    if (att.source === 'gmail' && att.gmailMessageId && att.gmailAttachmentId && googleAccessToken) {
      try {
        const blobUrl = await GoogleService.getGmailAttachmentPreviewUrl(
          googleAccessToken,
          att.gmailMessageId,
          att.gmailAttachmentId,
          att.type || att.mimeType,
          att.name
        )
        if (blobUrl) {
          window.open(blobUrl, "_blank")
          return
        }
      } catch (e) {
        console.error("Failed to open Gmail attachment:", e)
      }
    }
    
    const url = att.url || att.public_url || att.previewUrl
    if (url) {
      // If URL looks internal/protected (relative path, API host, or server upload), fetch with auth
      let shouldFetchProtected = false
      try {
        const parsed = new URL(url, window.location.href)
        const apiHost = (() => {
          try { return new URL(API_BASE).host } catch(e) { return null }
        })()
        if (!parsed.protocol || parsed.origin === window.location.origin) shouldFetchProtected = true
        if (apiHost && parsed.host && parsed.host.includes(apiHost)) shouldFetchProtected = true
      } catch (e) {
        shouldFetchProtected = true
      }

      if (shouldFetchProtected || att.fileId || att.drive_file_id) {
        ;(async () => {
          const blobUrl = await fetchProtectedUrlAndCreateObjectURL(att)
          if (blobUrl) window.open(blobUrl, "_blank")
        })()
        return
      }

      // Otherwise open directly
      window.open(url, "_blank")
      return
    }
    // If we only have a fileId, try to fetch metadata and open
    const fid = att.fileId || att.id
    if (fid) {
      (async () => {
        const meta = await fetchFileMetadata(fid)
        if (meta && (meta.url || meta.public_url)) window.open(meta.url || meta.public_url, "_blank")
      })()
    }
  }

  const downloadAttachment = async att => {
    if (!att) return
    
    // Handle Gmail attachments - download directly from Gmail API
    if (att.source === 'gmail' && att.gmailMessageId && att.gmailAttachmentId && googleAccessToken) {
      try {
        const blobUrl = await GoogleService.getGmailAttachmentPreviewUrl(
          googleAccessToken,
          att.gmailMessageId,
          att.gmailAttachmentId,
          att.type || att.mimeType,
          att.name
        )
        if (blobUrl) {
          const a = document.createElement("a")
          a.href = blobUrl
          a.download = att.name || "attachment"
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(blobUrl)
          return
        }
      } catch (e) {
        console.error("Failed to download Gmail attachment:", e)
      }
    }
    
    const url = att.url || att.public_url
    if (url) {
      // If URL is likely protected/internal, fetch and download via blob
      let shouldFetchProtected = false
      try {
        const parsed = new URL(url, window.location.href)
        const apiHost = (() => {
          try { return new URL(API_BASE).host } catch(e) { return null }
        })()
        if (!parsed.protocol || parsed.origin === window.location.origin) shouldFetchProtected = true
        if (apiHost && parsed.host && parsed.host.includes(apiHost)) shouldFetchProtected = true
      } catch (e) {
        shouldFetchProtected = true
      }

      if (shouldFetchProtected || att.fileId || att.drive_file_id) {
        try {
          const blobUrl = await fetchProtectedUrlAndCreateObjectURL(att)
          if (blobUrl) {
            const a = document.createElement("a")
            a.href = blobUrl
            a.download = att.name || "attachment"
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(blobUrl)
            return
          }
        } catch (e) {
          console.error("downloadAttachment fetch failed", e)
        }
      }

      // Fallback: open the url in a new tab for user to download
      window.open(url, "_blank")
      return
    }

    if (att.previewUrl) {
      // download the blob from previewUrl
      try {
        const res = await fetch(att.previewUrl)
        const blob = await res.blob()
        const url2 = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url2
        a.download = att.name || "attachment"
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url2)
      } catch (e) {
        console.error("downloadAttachment failed", e)
      }
      return
    }

    // Fallback: try fetching metadata by fileId
    const fid = att.fileId || att.id
    if (fid) {
      const meta = await fetchFileMetadata(fid)
      if (meta && (meta.url || meta.public_url)) window.open(meta.url || meta.public_url, "_blank")
    }
  }

  const createSpace = async () => {
    if (!newSpaceName.trim() || !currentUser) return
    const newSpace = {
      id: Date.now(),
      name: newSpaceName,
      iconType: "user",
      members: [currentUser.id],
      inviteCode: `${newSpaceName.substring(0, 4).toUpperCase()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`,
      channels: [
        {
          id: Date.now() + 1,
          name: "general",
          type: "public",
          members: [currentUser.id],
          roles: { [String(currentUser.id)]: 'owner' }
        },
        {
          id: Date.now() + 2,
          name: "random",
          type: "public",
          members: [currentUser.id],
          roles: { [String(currentUser.id)]: 'owner' }
        }
      ],
      expanded: true,
      ownerId: currentUser.id
    }
    await Storage.saveSpace(newSpace)
    // Reflect owner role locally so creator sees Owner badge immediately
    setSpaces(prev => {
      const arr = Array.isArray(prev) ? [...prev] : []
      return [...arr, newSpace]
    })
    const updatedUser = {
      ...currentUser,
      spaces: [...currentUser.spaces, newSpace.id]
    }
    await Storage.saveUser(updatedUser)
    setCurrentUser(updatedUser)
    setShowCreateSpaceModal(false)
    setNewSpaceName("")
  }

  const createChannel = async () => {
    if (!newChannelName.trim() || !currentUser || !activeSpace) return
    // Removed visibility selection as per requirement
    const newChannel = {
      id: Date.now(),
      name: newChannelName.toLowerCase().replace(/\s+/g, "-"),
      type: "public", // Defaulted
      members: [currentUser.id],
      roles: { [String(currentUser.id)]: 'owner' }
    }
    const space = spaces.find(s => s.id === activeSpace)
    if (space) {
      const updatedSpace = {
        ...space,
        channels: [...space.channels, newChannel]
      }
      // Reflect owner role locally immediately so creator sees Owner badge without waiting for broadcast
      setSpaces(prev => prev.map(s => (s.id === activeSpace ? updatedSpace : s)))
      await Storage.saveSpace(updatedSpace)
      setSpaces(prev =>
        prev.map(s => (s.id === activeSpace ? updatedSpace : s))
      )
      setMessages(prev => ({ ...prev, [newChannel.id]: [] }))
      setShowChannelModal(false)
      setNewChannelName("")
      setActiveChannel(newChannel.id)
      setActiveView("channel")
    }
  }

  // Management Logic
  const handleRename = async () => {
    if (!showRenameModal || !newNameInput.trim()) return
    if (showRenameModal.type === "space") {
      await Storage.renameSpace(showRenameModal.id, newNameInput)
      setSpaces(prev =>
        prev.map(s =>
          s.id === showRenameModal.id ? { ...s, name: newNameInput } : s
        )
      )
    } else if (showRenameModal.type === "channel" && activeSpace) {
      await Storage.renameChannel(activeSpace, showRenameModal.id, newNameInput)
      setSpaces(prev =>
        prev.map(s => {
          if (s.id === activeSpace) {
            const newChannels = s.channels.map(c =>
              c.id === showRenameModal.id ? { ...c, name: newNameInput } : c
            )
            return { ...s, channels: newChannels }
          }
          return s
        })
      )
    }
    setShowRenameModal(null)
    setNewNameInput("")
  }

  const handleDelete = async () => {
    if (!showDeleteConfirm) return
    if (showDeleteConfirm.type === "space") {
      await Storage.deleteSpace(showDeleteConfirm.id)
      setSpaces(prev => prev.filter(s => s.id !== showDeleteConfirm.id))
      if (activeSpace === showDeleteConfirm.id) setActiveSpace(null)
    } else if (showDeleteConfirm.type === "channel" && activeSpace) {
      await Storage.deleteChannel(activeSpace, showDeleteConfirm.id)
      setSpaces(prev =>
        prev.map(s => {
          if (s.id === activeSpace) {
            return {
              ...s,
              channels: s.channels.filter(c => c.id !== showDeleteConfirm.id)
            }
          }
          return s
        })
      )
      if (activeChannel === showDeleteConfirm.id) {
        const space = spaces.find(s => s.id === activeSpace)
        if (space && space.channels.length > 0) {
          const firstRemaining = space.channels.find(
            c => c.id !== showDeleteConfirm.id
          )
          if (firstRemaining) setActiveChannel(firstRemaining.id)
          else setActiveChannel("")
        }
      }
    }
    setShowDeleteConfirm(null)
  }

  const saveCalendarEvent = async () => {
    if (!currentUser || !newEvent.title.trim()) return
    const dateStr = toLocalDateStr(selectedDate)
    const event = {
      id: Date.now(),
      title: newEvent.title,
      description: newEvent.description,
      startDate: dateStr,
      startTime: newEvent.time,
      duration: 60,
      type: newEvent.type,
      createdBy: currentUser.id,
      attendees: [currentUser.id]
    }
    await Storage.saveEvent(event)
    setEvents(prev => [...prev, event])
    setShowEventModal(false)
    setNewEvent({ title: "", description: "", time: "09:00", type: "event" })
  }

  const getDaysInMonth = date => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    return { daysInMonth, firstDay }
  }

  const changeMonth = offset => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + offset)
    setCurrentDate(newDate)
  }

  const startVideoCall = async () => {
    if (!VIDEO_ENABLED) return
    if (activeView === "dm" && activeDMUser && currentUser) {
      const partner = getUser(activeDMUser)
      if (partner) {
        const call = await Storage.initiateCall(currentUser, activeDMUser)
        setActiveCallId(call.id)
        setActiveMeetingTitle(`Calling ${partner.name}...`)
        setActiveView("meeting")
      }
    } else {
      setActiveMeetingTitle("Instant Meeting")
      setActiveView("meeting")
    }
  }

  const startMeeting = title => {
    setActiveMeetingTitle(title)
    setActiveView("meeting")
  }

  const answerCall = async () => {
    if (incomingCall) {
      // Handle WebRTC calls
      if (incomingCall.isWebRTC) {
        answerWebRTCCall()
        return
      }

      // If the incoming call has a Meet link (scheduled or meet invite), open it
      if (incomingCall.link) {
        try {
          window.open(incomingCall.link, '_blank')
        } catch (e) {}
        setActiveCallId(incomingCall.id)
        setActiveMeetingTitle(`Call with ${incomingCall.fromName || incomingCall.title}`)
        setActiveView("meeting")
        // Clear any auto-dismiss timer
        try { if (incomingTimeoutRef.current) { clearTimeout(incomingTimeoutRef.current); incomingTimeoutRef.current = null } } catch(e){}
        setIncomingCall(null)
        return
      }

      await Storage.updateCallStatus(incomingCall.id, "accepted")
      setActiveCallId(incomingCall.id)
      setActiveMeetingTitle(`Call with ${incomingCall.fromName}`)
      setActiveView("meeting")
      // Clear any auto-dismiss timer
      try { if (incomingTimeoutRef.current) { clearTimeout(incomingTimeoutRef.current); incomingTimeoutRef.current = null } } catch(e){}
      setIncomingCall(null)
    }
  }

  const declineCall = async () => {
    if (incomingCall) {
      // Clear countdown timers
      if (incomingCountdownRef.current) {
        clearInterval(incomingCountdownRef.current)
        incomingCountdownRef.current = null
      }
      if (incomingTimeoutRef.current) {
        clearTimeout(incomingTimeoutRef.current)
        incomingTimeoutRef.current = null
      }
      setIncomingCallCountdown(10)
      
      // Handle WebRTC calls
      if (incomingCall.isWebRTC) {
        declineWebRTCCall()
        return
      }

      // If scheduled event (has link) simply dismiss
      if (incomingCall.link) {
        // Clear any auto-dismiss timer
        try { if (incomingTimeoutRef.current) { clearTimeout(incomingTimeoutRef.current); incomingTimeoutRef.current = null } } catch(e){}
        setIncomingCall(null)
        return
      }
      await Storage.updateCallStatus(incomingCall.id, "rejected")
        try { if (incomingTimeoutRef.current) { clearTimeout(incomingTimeoutRef.current); incomingTimeoutRef.current = null } } catch(e){}
        setIncomingCall(null)
    }
  }

  const endCall = async () => {
    if (activeCallId) {
      await Storage.updateCallStatus(activeCallId, "ended")
    }
    setActiveView("channel")
    setActiveCallId(null)
  }

  const toggleMic = () => {
    setIsMicOn(!isMicOn)
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject
        .getAudioTracks()
        .forEach(t => (t.enabled = !isMicOn))
    }
  }

  const toggleVideo = () => {
    setIsVideoOn(!isVideoOn)
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject
        .getVideoTracks()
        .forEach(t => (t.enabled = !isVideoOn))
    }
  }

  const sendFriendRequest = async targetId => {
    if (!currentUser) return
    const target = users.find(u => u.id === targetId)
    if (!target) return

    await Storage.sendFriendRequest(currentUser.id, currentUser.name, target.id)
  }

  const handleBulkFriendInvite = async () => {
    if (selectedFriendInvitees.length === 0) return
    for (const id of selectedFriendInvitees) {
      // await each to ensure backend compatibility
      // errors are intentionally not thrown to keep UI flow
      // eslint-disable-next-line no-await-in-loop
      await sendFriendRequest(id)
    }

    setInviteSent(true)
    setTimeout(() => {
      setShowAddFriendModal(false)
      setInviteSearchQuery("")
      setSelectedFriendInvitees([])
      setInviteSent(false)
    }, 2000)
  }

  const toggleFriendSelection = userId => {
    setSelectedFriendInvitees(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
    // Hide the dropdown after a selection to reveal the Send button and avoid overlay issues
    setInviteSearchResults([])
  }

  const addFriendsToChannel = async () => {
    if (
      selectedInviteUsers.length === 0 ||
      !currentUser ||
      !activeSpace ||
      !activeChannel
    )
      return

    // Use the new Bulk Add function
    await Storage.addBulkMembersToChannel(
      selectedInviteUsers,
      activeSpace,
      Number(activeChannel)
    )

    setInviteSent(true)
    setTimeout(() => {
      setShowAddToSpaceModal(false)
      setSelectedInviteUsers([])
      setInviteSent(false)
      const updatedSpace = Storage.getSpaces().find(s => s.id === activeSpace)
      if (updatedSpace) {
        setSpaces(prev =>
          prev.map(s => {
            if (s.id === activeSpace) {
              // Preserve ReactNode icon and local UI state (expanded) from current state
              // Fixes the white screen crash
              return {
                ...updatedSpace,
                icon: s.icon,
                expanded: s.expanded
              }
            }
            return s
          })
        )
      }
    }, 1500)
  }

  const toggleInviteSelection = userId => {
    setSelectedInviteUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleNotificationAction = async (notificationId, type) => {
    if (!currentUser) return

    // Find the notification object from currentUser's notifications
    const notif = (currentUser.notifications || []).find(n => n.id === notificationId)

    if (type === "info") {
      await Storage.deleteNotification(currentUser.id, notificationId)
      // Refresh users and currentUser from server
      const allUsers = await Storage.getUsers()
      setUsers(Array.isArray(allUsers) ? allUsers : [])
      const updatedUser = (allUsers || []).find(u => u.id === currentUser.id)
      if (updatedUser) setCurrentUser(filterDismissedUser(updatedUser))
    } else if (type === "friend_request") {
      const friendId = notif?.fromId
      if (!friendId) return
      await Storage.acceptFriendRequest(friendId, notificationId)
      // Refresh users and currentUser from server so friend lists and notifications stay in sync
      const allUsers = await Storage.getUsers()
      setUsers(Array.isArray(allUsers) ? allUsers : [])
      const updatedUser = (allUsers || []).find(u => u.id === currentUser.id)
      if (updatedUser) setCurrentUser(filterDismissedUser(updatedUser))
    } else {
      const joinedSpace = await Storage.acceptInvite(currentUser.id, notificationId)
      // Force refresh user regardless of joinedSpace result to ensure notification is gone
      const allUsers = await Storage.getUsers()
      setUsers(Array.isArray(allUsers) ? allUsers : [])
      const updatedUser = (allUsers || []).find(u => u.id === currentUser.id)
      if (updatedUser) {
        setCurrentUser(filterDismissedUser(updatedUser))
        if (joinedSpace) {
          setActiveSpace(joinedSpace.id)
          setActiveView("channel")
          if (joinedSpace.channels.length > 0) {
            const firstChannel = joinedSpace.channels[0]
            // User has access if they own the space OR have it in their spaces list
            const userOwnsSpace = joinedSpace.ownerId === currentUser.id
            const userHasSpace = (updatedUser.spaces || []).includes(joinedSpace.id)
            const hasAccess = userOwnsSpace || userHasSpace
            if (hasAccess) {
              setActiveChannel(firstChannel.id)
            }
          }
        }
      }
    }
  }

  const handleRejectNotification = async (notificationId, type) => {
    if (!currentUser) return

    // Find the notification to extract sender id
    const notif = (currentUser.notifications || []).find(n => n.id === notificationId)

    if (type === "friend_request") {
      const friendId = notif?.fromId
      if (!friendId) return
      await Storage.rejectFriendRequest(friendId, notificationId)
    } else {
      await Storage.rejectInvite(currentUser.id, notificationId)
    }

    // Refresh users and currentUser
    const allUsers = await Storage.getUsers()
    setUsers(Array.isArray(allUsers) ? allUsers : [])
    const updatedUser = (allUsers || []).find(u => u.id === currentUser.id)
    if (updatedUser) setCurrentUser(filterDismissedUser(updatedUser))
  }

  // Optimistic dismiss for simple info notifications
  const dismissNotification = async (notificationId) => {
    if (!currentUser) return

    // Persist dismissed id locally so it never re-appears
    addDismissedNotification(currentUser.id, notificationId)

    // Optimistically remove from UI
    setCurrentUser(prev => ({
      ...prev,
      notifications: (prev.notifications || []).filter(n => n.id !== notificationId)
    }))

    try {
      await Storage.deleteNotification(currentUser.id, notificationId)
    } catch (e) {
      console.error('dismissNotification failed', e)
      // On failure, refetch full user to ensure consistency and re-apply dismissed filter
      const allUsers = await Storage.getUsers()
      setUsers(Array.isArray(allUsers) ? allUsers : [])
      const updatedUser = (allUsers || []).find(u => u.id === currentUser.id)
      if (updatedUser) setCurrentUser(filterDismissedUser(updatedUser))
    }
  }

  // Clear only 'info' type notification messages (keep invites/friend requests)
  const clearAllNotifications = async () => {
    if (!currentUser) return
    const infos = (currentUser.notifications || []).filter(n => n.type === 'info')
    if (infos.length === 0) return

    // Persist dismissed ids locally
    infos.forEach(i => addDismissedNotification(currentUser.id, i.id))

    // Optimistically remove info notifications from UI
    setCurrentUser(prev => ({
      ...prev,
      notifications: (prev.notifications || []).filter(n => n.type !== 'info')
    }))

    try {
      await Promise.all(infos.map(n => Storage.deleteNotification(currentUser.id, n.id)))
    } catch (e) {
      console.error('clearAllNotifications failed', e)
      // On failure, refetch full user to ensure consistency and re-apply filter
      const allUsers = await Storage.getUsers()
      setUsers(Array.isArray(allUsers) ? allUsers : [])
      const updatedUser = (allUsers || []).find(u => u.id === currentUser.id)
      if (updatedUser) setCurrentUser(filterDismissedUser(updatedUser))
    }
  }

  const toggleSpaceExpansion = spaceId => {
    setSpaces(prev =>
      prev.map(space =>
        space.id === spaceId ? { ...space, expanded: !space.expanded } : space
      )
    )
  }

  // --- Render ---

  // Landing Page Component
  const LandingPage = () => (
    <div className={`min-h-screen font-sans relative overflow-x-hidden ${
      isDarkMode 
        ? 'bg-[#0a0a0f] text-white' 
        : 'bg-[#fafbff] text-slate-900'
    }`}>
      {/* Animated mesh gradient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-[120px] animate-pulse ${
          isDarkMode ? 'bg-violet-600/20' : 'bg-violet-300/30'
        }`} style={{ animationDuration: '8s' }}></div>
        <div className={`absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full blur-[100px] animate-pulse ${
          isDarkMode ? 'bg-pink-600/15' : 'bg-pink-300/25'
        }`} style={{ animationDuration: '10s', animationDelay: '2s' }}></div>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full blur-[150px] ${
          isDarkMode ? 'bg-indigo-600/10' : 'bg-indigo-200/20'
        }`}></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-4 sm:px-6 py-4">
        <div className={`max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 rounded-2xl backdrop-blur-xl ${
          isDarkMode 
            ? 'bg-slate-900/60 border border-slate-800/50' 
            : 'bg-white/60 border border-slate-200/50 shadow-lg shadow-slate-200/20'
        }`}>
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/Logo.png" alt="Spaces" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl" />
            <span className={`text-lg sm:text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent ${
              isDarkMode 
                ? 'from-white to-slate-400' 
                : 'from-slate-800 to-slate-600'
            }`}>Spaces</span>
          </div>
          <div className="hidden lg:flex items-center gap-8">
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
              Features
            </button>
            <button onClick={() => document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })}
              className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
              Showcase
            </button>
            <button onClick={() => document.getElementById('usecases')?.scrollIntoView({ behavior: 'smooth' })}
              className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
              Use Cases
            </button>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => {
                setIsDarkMode(!isDarkMode)
                localStorage.setItem('spacexyz-dark-mode', JSON.stringify(!isDarkMode))
              }}
              className={`p-2 sm:p-2.5 rounded-xl transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-slate-800 hover:bg-slate-700 text-yellow-400' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { setShowLandingPage(false); setAuthMode('login'); }}
              className={`hidden sm:block px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isDarkMode 
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setShowLandingPage(false); setAuthMode('signup'); }}
              className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-500 hover:via-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
            >
              <span className="hidden sm:inline">Get Started</span>
              <span className="sm:hidden">Start</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-4 sm:px-6 pt-12 sm:pt-20 pb-8">
        <div className="max-w-6xl mx-auto text-center">
          {/* Badge */}
          <div className={`inline-flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold mb-6 sm:mb-8 backdrop-blur-sm ${
            isDarkMode 
              ? 'bg-gradient-to-r from-violet-500/10 to-pink-500/10 text-violet-300 border border-violet-500/20' 
              : 'bg-gradient-to-r from-violet-50 to-pink-50 text-violet-700 border border-violet-200/50'
          }`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
            </span>
            <span className="hidden sm:inline">Trusted by 10,000+ teams worldwide</span>
            <span className="sm:hidden">10,000+ teams trust us</span>
          </div>
          
          {/* Main Headline */}
          <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black mb-6 sm:mb-8 leading-[0.95] tracking-tight ${
            isDarkMode 
              ? 'text-white' 
              : 'text-slate-900'
          }`}>
            <span className="block">Team work,</span>
            <span className="bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              simplified.
            </span>
          </h1>
          
          {/* Subheadline */}
          <p className={`text-base sm:text-lg md:text-xl lg:text-2xl max-w-3xl mx-auto mb-8 sm:mb-12 leading-relaxed font-medium px-2 ${
            isDarkMode ? 'text-slate-400' : 'text-slate-600'
          }`}>
            One workspace for messaging, video calls, tasks, and files.
            <span className={`block mt-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              Stop juggling apps. Start shipping faster.
            </span>
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-20 px-4">
            <button
              onClick={() => { setShowLandingPage(false); setAuthMode('signup'); }}
              className="group relative w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold text-base sm:text-lg text-white overflow-hidden transition-all duration-500 hover:scale-105 shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex items-center justify-center gap-2">
                Start Free Today
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
            <button
              onClick={() => document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })}
              className={`w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold text-base sm:text-lg transition-all border-2 hover:scale-105 ${
                isDarkMode 
                  ? 'border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800/50' 
                  : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-white'
              }`}
            >
              See it in action
            </button>
          </div>
        </div>
      </section>

      {/* Hero Image Showcase */}
      <section id="showcase" className="relative z-10 px-4 sm:px-6 pb-16 sm:pb-32">
        <div className="max-w-7xl mx-auto">
          {/* Main Screenshot with 3D effect */}
          <div className="relative">
            {/* Glow effect behind image */}
            <div className={`absolute inset-0 rounded-2xl sm:rounded-3xl blur-3xl ${
              isDarkMode ? 'bg-gradient-to-r from-violet-600/30 via-purple-600/20 to-pink-600/30' : 'bg-gradient-to-r from-violet-400/20 via-purple-400/15 to-pink-400/20'
            }`}></div>
            
            {/* Main screenshot */}
            <div className={`relative rounded-2xl sm:rounded-3xl overflow-hidden border-2 shadow-2xl ${
              isDarkMode 
                ? 'border-slate-700/50 shadow-violet-500/10' 
                : 'border-slate-200/50 shadow-slate-400/20'
            }`}>
              <div className={`flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 ${
                isDarkMode ? 'bg-slate-900/90' : 'bg-slate-100/90'
              }`}>
                <div className="flex gap-1.5 sm:gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500"></div>
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
                </div>
                <div className={`flex-1 text-center text-[10px] sm:text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  spaces.app
                </div>
              </div>
              <img 
                src="/Image 2.png" 
                alt="Spaces - Team Communication Platform" 
                className="w-full"
              />
            </div>

            {/* Floating feature cards - hidden on mobile */}
            <div className={`absolute -left-4 lg:-left-12 top-1/4 p-4 rounded-2xl backdrop-blur-xl shadow-2xl max-w-[200px] hidden lg:block transform hover:scale-105 transition-transform ${
              isDarkMode 
                ? 'bg-slate-900/80 border border-slate-700/50' 
                : 'bg-white/80 border border-slate-200/50'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
                  <Users className="w-5 h-5" />
                </div>
                <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Team Spaces</div>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Organize by project, team, or topic
              </p>
            </div>

            <div className={`absolute -right-4 lg:-right-12 top-1/3 p-4 rounded-2xl backdrop-blur-xl shadow-2xl max-w-[200px] hidden lg:block transform hover:scale-105 transition-transform ${
              isDarkMode 
                ? 'bg-slate-900/80 border border-slate-700/50' 
                : 'bg-white/80 border border-slate-200/50'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Real-time Chat</div>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Instant messaging with threads
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className={`relative z-10 px-4 sm:px-6 py-16 sm:py-24 ${
        isDarkMode ? 'bg-slate-900/30' : 'bg-white/50'
      }`}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <span className={`inline-block px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${
              isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
            }`}>
              The Problem
            </span>
            <h2 className={`text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Sound familiar?
            </h2>
            <p className={`text-base sm:text-lg max-w-2xl mx-auto px-4 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Your team is drowning in tool chaos
            </p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                emoji: '😵‍💫',
                title: 'App overload',
                desc: 'Slack, Zoom, Notion, Trello, Drive... 5+ tabs open just to collaborate.',
                gradient: 'from-red-500/10 to-orange-500/10',
                border: 'border-red-500/20'
              },
              {
                emoji: '🔍',
                title: 'Lost context',
                desc: 'Critical decisions buried across email, chat, and docs.',
                gradient: 'from-amber-500/10 to-yellow-500/10',
                border: 'border-amber-500/20'
              },
              {
                emoji: '😤',
                title: 'Notification fatigue',
                desc: 'Constant pings, @mentions, and FOMO destroying focus.',
                gradient: 'from-rose-500/10 to-pink-500/10',
                border: 'border-rose-500/20'
              }
            ].map((item, i) => (
              <div key={i} className={`group relative p-6 sm:p-8 rounded-2xl sm:rounded-3xl transition-all duration-500 hover:scale-105 backdrop-blur-sm border ${
                isDarkMode 
                  ? `bg-gradient-to-br ${item.gradient} ${item.border}` 
                  : `bg-white border-slate-200 shadow-lg hover:shadow-xl`
              }`}>
                <div className="text-4xl sm:text-5xl mb-4 sm:mb-6 transform group-hover:scale-110 transition-transform">{item.emoji}</div>
                <h3 className={`text-lg sm:text-xl font-bold mb-2 sm:mb-3 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>{item.title}</h3>
                <p className={`text-sm leading-relaxed ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-20">
            <span className={`inline-block px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${
              isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
            }`}>
              The Solution
            </span>
            <h2 className={`text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Everything in one place
            </h2>
            <p className={`text-base sm:text-lg max-w-2xl mx-auto px-4 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Replace your scattered tools with one beautiful, powerful workspace
            </p>
          </div>

          {/* Feature Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Large Feature Card - Messaging */}
            <div className={`md:col-span-2 lg:col-span-2 group relative overflow-hidden rounded-2xl sm:rounded-3xl p-6 sm:p-8 transition-all duration-500 hover:scale-[1.02] ${
              isDarkMode 
                ? 'bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-transparent border border-violet-500/20' 
                : 'bg-gradient-to-br from-violet-50 via-purple-50 to-white border border-violet-200/50 shadow-xl'
            }`}>
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-4 sm:mb-6">
                  <div>
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white mb-3 sm:mb-4 shadow-lg shadow-violet-500/30">
                      <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <h3 className={`text-xl sm:text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      Real-time Messaging
                    </h3>
                    <p className={`text-sm sm:text-base max-w-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Organized channels, threaded conversations, and direct messages that keep context intact.
                    </p>
                  </div>
                </div>
                <div className={`mt-auto rounded-xl sm:rounded-2xl overflow-hidden border ${
                  isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'
                }`}>
                  <img src="/Image 3.png" alt="Chat Interface" className="w-full object-cover object-top h-36 sm:h-48" />
                </div>
              </div>
            </div>

            {/* Google Integration Card */}
            <div className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-6 transition-all duration-500 hover:scale-[1.02] ${
              isDarkMode 
                ? 'bg-gradient-to-br from-blue-600/20 via-cyan-600/10 to-transparent border border-blue-500/20' 
                : 'bg-gradient-to-br from-blue-50 via-cyan-50 to-white border border-blue-200/50 shadow-xl'
            }`}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white mb-3 sm:mb-4 shadow-lg shadow-blue-500/30">
                <Grid3x3 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className={`text-lg sm:text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Google Integration
              </h3>
              <p className={`text-sm mb-3 sm:mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Connect Gmail, Drive, Docs, Meet & more.
              </p>
              <div className={`rounded-lg sm:rounded-xl overflow-hidden border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'}`}>
                <img src="/Image 4.png" alt="Google Apps" className="w-full object-cover h-28 sm:h-32" />
              </div>
            </div>

            {/* Documents Card */}
            <div className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-6 transition-all duration-500 hover:scale-[1.02] ${
              isDarkMode 
                ? 'bg-gradient-to-br from-emerald-600/20 via-teal-600/10 to-transparent border border-emerald-500/20' 
                : 'bg-gradient-to-br from-emerald-50 via-teal-50 to-white border border-emerald-200/50 shadow-xl'
            }`}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-500/30">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className={`text-lg sm:text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                My Documents
              </h3>
              <p className={`text-sm mb-3 sm:mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                All your files in one organized place.
              </p>
              <div className={`rounded-lg sm:rounded-xl overflow-hidden border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'}`}>
                <img src="/Image 5.png" alt="Documents" className="w-full object-cover object-top h-28 sm:h-32" />
              </div>
            </div>

            {/* Video Calls Card */}
            <div className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-6 transition-all duration-500 hover:scale-[1.02] ${
              isDarkMode 
                ? 'bg-gradient-to-br from-pink-600/20 via-rose-600/10 to-transparent border border-pink-500/20' 
                : 'bg-gradient-to-br from-pink-50 via-rose-50 to-white border border-pink-200/50 shadow-xl'
            }`}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white mb-3 sm:mb-4 shadow-lg shadow-pink-500/30">
                <Video className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className={`text-lg sm:text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Video Meetings
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                One-click video calls. Crystal clear quality. No scheduling hassle.
              </p>
            </div>

            {/* Tasks Card */}
            <div className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-6 transition-all duration-500 hover:scale-[1.02] ${
              isDarkMode 
                ? 'bg-gradient-to-br from-orange-600/20 via-amber-600/10 to-transparent border border-orange-500/20' 
                : 'bg-gradient-to-br from-orange-50 via-amber-50 to-white border border-orange-200/50 shadow-xl'
            }`}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white mb-3 sm:mb-4 shadow-lg shadow-orange-500/30">
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className={`text-lg sm:text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Built-in Tasks
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Assign, track, and ship tasks without ever leaving the conversation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="usecases" className={`relative z-10 px-4 sm:px-6 py-16 sm:py-24 ${
        isDarkMode ? 'bg-slate-900/30' : 'bg-gradient-to-br from-violet-50/50 via-purple-50/30 to-pink-50/30'
      }`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <span className={`inline-block px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${
              isDarkMode ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'
            }`}>
              Use Cases
            </span>
            <h2 className={`text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Built for every team
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-8">
            {[
              {
                icon: <Briefcase className="w-7 h-7" />,
                title: 'Remote & Hybrid Teams',
                desc: 'Bridge the gap between office and remote. Stay connected anywhere.',
                features: ['Async-friendly workflows', 'Time zone awareness', 'Virtual water cooler'],
                gradient: 'from-blue-500 to-cyan-500'
              },
              {
                icon: <GraduationCap className="w-7 h-7" />,
                title: 'Startups & Small Teams',
                desc: 'Move fast without complexity. Free for small teams.',
                features: ['Setup in minutes', 'Free tier available', 'Scales with you'],
                gradient: 'from-emerald-500 to-teal-500'
              },
              {
                icon: <Grid3x3 className="w-7 h-7" />,
                title: 'Agencies & Consultants',
                desc: 'Manage clients and projects without chaos.',
                features: ['Client spaces', 'Project organization', 'Easy handoffs'],
                gradient: 'from-orange-500 to-amber-500'
              },
              {
                icon: <ShieldAlert className="w-7 h-7" />,
                title: 'Enterprise Teams',
                desc: 'Security and compliance for large organizations.',
                features: ['SSO & SAML', 'Admin dashboard', 'Audit logs'],
                gradient: 'from-violet-500 to-purple-500'
              }
            ].map((useCase, i) => (
              <div key={i} className={`group p-6 sm:p-8 rounded-2xl sm:rounded-3xl transition-all duration-500 hover:scale-[1.02] ${
                isDarkMode 
                  ? 'bg-slate-800/50 border border-slate-700/50 hover:border-slate-600' 
                  : 'bg-white border border-slate-200/50 shadow-lg hover:shadow-xl'
              }`}>
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${useCase.gradient} flex items-center justify-center text-white mb-4 sm:mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                  {useCase.icon}
                </div>
                <h3 className={`text-lg sm:text-xl font-bold mb-2 sm:mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {useCase.title}
                </h3>
                <p className={`text-sm mb-4 sm:mb-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  {useCase.desc}
                </p>
                <ul className="space-y-2">
                  {useCase.features.map((f, j) => (
                    <li key={j} className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative z-10 px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-[2.5rem] p-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500">
            <div className={`relative rounded-xl sm:rounded-[2.25rem] p-8 sm:p-12 md:p-16 text-center overflow-hidden ${
              isDarkMode ? 'bg-slate-900' : 'bg-white'
            }`}>
              {/* Background decorations */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-3xl ${
                  isDarkMode ? 'bg-violet-600/20' : 'bg-violet-200/50'
                }`}></div>
                <div className={`absolute -bottom-32 -left-32 w-64 h-64 rounded-full blur-3xl ${
                  isDarkMode ? 'bg-pink-600/20' : 'bg-pink-200/50'
                }`}></div>
              </div>
              
              <div className="relative z-10">
                <h2 className={`text-2xl sm:text-3xl md:text-5xl font-black mb-4 sm:mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Ready to simplify
                  <span className="block bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    teamwork?
                  </span>
                </h2>
                <p className={`text-base sm:text-lg md:text-xl mb-8 sm:mb-10 max-w-2xl mx-auto px-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Join thousands of teams shipping faster with Spaces. Get started in minutes.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <button
                    onClick={() => { setShowLandingPage(false); setAuthMode('signup'); }}
                    className="group w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-500 hover:via-purple-500 hover:to-pink-500 transition-all duration-300 hover:scale-105 shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50"
                  >
                    <span className="flex items-center justify-center gap-2">
                      Get Started Free
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </button>
                  <button
                    onClick={() => { setShowLandingPage(false); setAuthMode('login'); }}
                    className={`w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg transition-all border-2 hover:scale-105 ${
                      isDarkMode 
                        ? 'border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800' 
                        : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    Sign In
                  </button>
                </div>
                <p className={`mt-6 sm:mt-8 text-xs sm:text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  ✨ Free forever for teams up to 10 • No credit card required
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`relative z-10 px-4 sm:px-6 py-8 sm:py-12 border-t ${
        isDarkMode ? 'border-slate-800' : 'border-slate-200'
      }`}>
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-4 sm:gap-6 text-center sm:text-left sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/Logo.png" alt="Spaces" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg" />
            <span className={`font-bold text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Spaces</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <a href="#" className={`text-xs sm:text-sm transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>Privacy</a>
            <a href="#" className={`text-xs sm:text-sm transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>Terms</a>
            <a href="#" className={`text-xs sm:text-sm transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>Contact</a>
          </div>
          <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            © 2026 Spaces
          </p>
        </div>
      </footer>
    </div>
  )

  // Show landing page for unauthenticated users who haven't clicked sign in/up
  if (!isAuthenticated && showLandingPage) {
    return <LandingPage />
  }

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 font-sans relative overflow-hidden ${
        isDarkMode 
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 text-white' 
          : 'bg-gradient-to-br from-slate-100 via-indigo-50/50 to-purple-50/30 text-slate-900'
      }`}>
        {/* Theme Toggle for Login */}
        {/* Back to Landing & Theme Toggle */}
        <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between">
          <button
            onClick={() => setShowLandingPage(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-medium transition-all duration-300 ${
              isDarkMode 
                ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300' 
                : 'bg-white/70 hover:bg-white text-slate-600 shadow-lg shadow-slate-200/50'
            } backdrop-blur-xl`}
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back
          </button>
          <button
            onClick={() => {
              setIsDarkMode(!isDarkMode)
              localStorage.setItem('spacexyz-dark-mode', JSON.stringify(!isDarkMode))
            }}
            className={`p-3 rounded-2xl transition-all duration-300 ${
              isDarkMode 
                ? 'bg-slate-800/80 hover:bg-slate-700 text-yellow-400' 
                : 'bg-white/70 hover:bg-white text-slate-600 shadow-lg shadow-slate-200/50'
            } backdrop-blur-xl`}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-float ${
            isDarkMode ? 'bg-gradient-to-br from-violet-600/20 to-pink-600/20' : 'bg-gradient-to-br from-purple-300/25 to-pink-300/25'
          }`}></div>
          <div className={`absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl animate-float ${
            isDarkMode ? 'bg-gradient-to-br from-indigo-600/20 to-blue-600/20' : 'bg-gradient-to-br from-indigo-300/25 to-blue-300/25'
          }`} style={{animationDelay: '1s'}}></div>
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl ${
            isDarkMode ? 'bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10' : 'bg-gradient-to-br from-violet-200/15 to-fuchsia-200/15'
          }`}></div>
        </div>
        
        <div className="w-full max-w-md animate-fade-in-up relative z-10">
          <div className="text-center mb-10">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-[2rem] mb-6 shadow-2xl transform hover:scale-110 hover:rotate-6 transition-all duration-500 animate-float ${
              isDarkMode 
                ? 'bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 shadow-violet-500/30' 
                : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-purple-300/50'
            }`}>
              <Sparkles className="w-12 h-12 text-white drop-shadow-lg" />
            </div>
            <h1 className={`text-5xl font-extrabold mb-3 tracking-tight bg-clip-text text-transparent ${
              isDarkMode 
                ? 'bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400' 
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600'
            }`}>
              Spaces
            </h1>
            <p className={`text-lg font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Where squads and pros collide.
            </p>
          </div>

          <div className={`rounded-[2rem] overflow-hidden p-1 backdrop-blur-2xl shadow-2xl border transition-shadow duration-500 ${
            isDarkMode 
              ? 'bg-slate-800/70 shadow-violet-500/20 border-slate-700/60 hover:shadow-violet-500/30' 
              : 'bg-white/60 shadow-slate-300/30 border-white/50 hover:shadow-slate-400/40'
          }`}>
            <div className={`flex p-1.5 rounded-[1.6rem] mb-2 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-100/60'}`}>
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-3 px-6 text-center font-bold text-sm rounded-2xl transition-all duration-300 ${
                  authMode === "login"
                    ? isDarkMode 
                      ? "bg-slate-700 text-violet-400 shadow-lg shadow-violet-500/20" 
                      : "bg-white text-indigo-600 shadow-lg shadow-indigo-100/50"
                    : isDarkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthMode("signup")}
                className={`flex-1 py-3 px-6 text-center font-bold text-sm rounded-2xl transition-all duration-300 ${
                  authMode === "signup"
                    ? isDarkMode 
                      ? "bg-slate-700 text-violet-400 shadow-lg shadow-violet-500/20" 
                      : "bg-white text-indigo-600 shadow-lg shadow-indigo-100/50"
                    : isDarkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Sign Up
              </button>
            </div>
            <form onSubmit={handleAuthSubmit} className="p-8 space-y-5">
              {authSuccess && (
                <div className={`px-4 py-3 rounded-2xl text-sm flex items-center gap-3 ${
                  isDarkMode 
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' 
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                }`}>
                  <CheckCircle className="w-5 h-5" />
                  {authSuccess}
                </div>
              )}
              {authError && (
                <div className={`px-4 py-3 rounded-2xl text-sm flex items-center gap-3 ${
                  isDarkMode 
                    ? 'bg-red-500/20 border border-red-500/30 text-red-400' 
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <XCircle className="w-5 h-5" />
                  {authError}
                </div>
              )}

              {authMode === "signup" && (
                <div className="group">
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ml-1 ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={authData.name}
                    onChange={e =>
                      setAuthData({ ...authData, name: e.target.value })
                    }
                    className={`w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent transition-all font-medium ${
                      isDarkMode 
                        ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:ring-violet-500/50' 
                        : 'bg-white/70 border border-slate-200/60 text-slate-700 placeholder-slate-400 focus:ring-indigo-500/40 shadow-sm'
                    }`}
                    placeholder="Jane Doe"
                  />
                </div>
              )}
              <div className="group">
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ml-1 ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Email
                </label>
                <input
                  type="email"
                  value={authData.email}
                  onChange={e =>
                    setAuthData({ ...authData, email: e.target.value })
                  }
                  className={`w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent transition-all font-medium ${
                    isDarkMode 
                      ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:ring-violet-500/50' 
                      : 'bg-white/70 border border-slate-200/60 text-slate-700 placeholder-slate-400 focus:ring-indigo-500/40 shadow-sm'
                  }`}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="group">
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ml-1 ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Password
                </label>
                <input
                  type="password"
                  value={authData.password}
                  onChange={e =>
                    setAuthData({ ...authData, password: e.target.value })
                  }
                  className={`w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent transition-all font-medium ${
                    isDarkMode 
                      ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:ring-violet-500/50' 
                      : 'bg-white/70 border border-slate-200/60 text-slate-700 placeholder-slate-400 focus:ring-indigo-500/40 shadow-sm'
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {authMode === "signup" && (
                <div className="group">
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ml-1 ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={authData.confirmPassword}
                    onChange={e =>
                      setAuthData({
                        ...authData,
                        confirmPassword: e.target.value
                      })
                    }
                    className={`w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent transition-all font-medium ${
                      isDarkMode 
                        ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:ring-violet-500/50' 
                        : 'bg-slate-50 border border-slate-200 text-slate-800 focus:ring-pink-500/50'
                    }`}
                    placeholder="••••••••"
                  />
                </div>
              )}
              <button
                type="submit"
                className={`w-full py-4 font-bold rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 transform active:scale-[0.98] mt-4 text-white shadow-xl hover:scale-[1.02] ${
                  isDarkMode 
                    ? 'bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 hover:from-violet-600 hover:via-purple-600 hover:to-pink-600 shadow-violet-500/30 hover:shadow-violet-500/50' 
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 shadow-purple-300/40 hover:shadow-purple-400/50'
                }`}
              >
                {authMode === "login" ? (
                  <>
                    <LogIn className="w-5 h-5" /> Enter Space
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="w-5 h-5" /> Join the Crew
                  </>
                )}
              </button>

              {/* Google Sign-In Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className={`w-full border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200/60'}`}></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className={`px-3 font-bold ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-white/60 text-slate-400'}`}>Or continue with</span>
                </div>
              </div>

              {/* Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className={`w-full py-4 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 transform active:scale-[0.98] border-2 ${
                  isDarkMode 
                    ? 'bg-slate-700/50 border-slate-600 text-slate-200 hover:bg-slate-700 hover:border-slate-500 hover:shadow-md' 
                    : 'bg-white/60 border-slate-200/60 text-slate-600 hover:bg-white hover:border-slate-300 hover:shadow-md shadow-sm'
                }`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
              {/* Register Company Button (glass style) - show only on Sign Up mode */}
              {authMode === "signup" && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
                      console.log('Opening org modal')
                      setShowOrgModal(true);
                      setOrgStage('form');
                      setOrgError('');
                      setOrgMessage('');
                      setOrgForm({ name: '', adminEmail: '', domain: '', logoUrl: '' });
                      setOrgOtp('');
                      setOrgOtpExpiresAt(null);
                      setOrgDnsStatus(null);
                    }}
                    className={`w-full py-3 font-semibold rounded-3xl transition-all duration-300 flex items-center justify-center gap-2 transform active:scale-[0.98] mt-2 ${
                      isDarkMode
                        ? 'text-white shadow-xl bg-white/6 backdrop-blur-lg border border-white/10 hover:scale-[1.01] shadow-violet-600/20'
                        : 'text-slate-800 shadow-sm bg-white border border-slate-200 hover:scale-[1.01]'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span className="ml-2">Register your company with Spaces</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {showOrgModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowOrgModal(false)}></div>
            <div className="relative w-full max-w-xl p-6 z-[85]">
              <div className="rounded-[1.6rem] overflow-hidden p-6 backdrop-blur-2xl bg-white/60 dark:bg-slate-800/70 border border-white/30 shadow-2xl">

                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-2xl font-extrabold">Register your company with Spaces</h3>
                  <button onClick={() => setShowOrgModal(false)} className="p-2 rounded-full hover:bg-white/20">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {orgStage === 'form' && (
                  <div className="space-y-4">
                    {orgError && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700">{orgError}</div>}
                    {orgMessage && <div className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700">{orgMessage}</div>}
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Organization Name</label>
                      <input value={orgForm.name} onChange={e => setOrgForm({...orgForm, name: e.target.value})} className="w-full px-4 py-3 rounded-2xl mt-2" placeholder="Example, Acme Corp" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Company Admin Email</label>
                      <input value={orgForm.adminEmail} onChange={e => { const v=e.target.value; const d=(v.match(/@([A-Za-z0-9.-]+)$/)||[])[1]||''; setOrgForm({...orgForm, adminEmail: v, domain: d}) }} className="w-full px-4 py-3 rounded-2xl mt-2" placeholder="admin@yourcompany.com" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Company Domain (auto-parsed)</label>
                      <input value={orgForm.domain} readOnly className="w-full px-4 py-3 rounded-2xl mt-2 bg-white/30" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Logo (optional)</label>
                      <div className="mt-2 flex items-center gap-3">
                        <input id="org-logo-file" type="file" accept="image/*" onChange={async e => {
                          const f = e.target.files && e.target.files[0]
                          if (!f) return
                          try {
                            const form = new FormData()
                            form.append('file', f)
                            const upl = await fetch(`${API_BASE}/upload/file`, { method: 'POST', body: form })
                            const jr = await upl.json()
                            if (upl.ok && jr.file_id) {
                              const url = `${API_BASE}/upload/file/${jr.file_id}/download`
                              setOrgForm(prev => ({ ...prev, logoUrl: url }))
                              setOrgMessage('Logo uploaded')
                            } else {
                              setOrgError(jr.detail || jr.error || 'Upload failed')
                            }
                          } catch (err) {
                            console.error('upload failed', err)
                            setOrgError('Logo upload failed')
                          }
                        }} className="rounded-2xl" />
                        <input type="text" value={orgForm.logoUrl} onChange={e => setOrgForm({...orgForm, logoUrl: e.target.value})} placeholder="Image URL or uploaded file" className="flex-1 px-4 py-3 rounded-2xl" />
                      </div>
                    </div>

                    <div className="flex gap-3 mt-3">
                      <button onClick={async () => {
                        setOrgError('')
                        setOrgMessage('')
                        if (!orgForm.name || !orgForm.adminEmail) { setOrgError('Please provide organization name and admin email'); return }
                        const domain = orgForm.domain
                        const publicDomains = ['gmail.com','yahoo.com','outlook.com','hotmail.com','aol.com','icloud.com']
                        if (publicDomains.includes(domain)) { setOrgError('Public email domains are not allowed'); return }
                        try {
                          const resExist = await fetch(`${API_BASE}/api/org/org/${domain}`)
                          if (resExist.ok) {
                            const data = await resExist.json()
                            if (data.verified) { setOrgError('This domain is already registered and verified'); return }
                          }
                        } catch (e) {}
                        try {
                          const resp = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`)
                          const j = await resp.json()
                          if (!j.Answer || j.Answer.length === 0) { setOrgError('Domain appears to have no MX records'); return }
                        } catch (e) {}
                        try {
                          const reg = await fetch(`${API_BASE}/api/org/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: orgForm.name, adminEmail: orgForm.adminEmail, logoUrl: orgForm.logoUrl }) })
                          const jr = await reg.json()
                          if (reg.status >= 400) { setOrgError(jr.detail || jr.error || 'Registration failed'); return }
                          setOrgMessage(jr.message || 'OTP sent to admin email')
                          setOrgStage('otp')
                          setOrgOtp('')
                          setOrgOtpExpiresAt(Date.now() + 5*60*1000)
                        } catch (e) {
                          setOrgError('Registration request failed')
                        }
                      }} className="px-4 py-2 rounded-2xl bg-indigo-600 text-white font-bold">Send OTP</button>
                      <button onClick={() => setShowOrgModal(false)} className="px-4 py-2 rounded-2xl border">Cancel</button>
                    </div>
                  </div>
                )}

                {orgStage === 'otp' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">Enter the 6-digit code sent to <strong>{orgForm.adminEmail}</strong></p>
                    <input value={orgOtp} onChange={e => setOrgOtp(e.target.value)} className="w-full px-4 py-3 rounded-2xl mt-2 text-center text-lg tracking-widest" placeholder="123456" />
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-slate-500">Expires in: {orgOtpExpiresAt ? Math.max(0, Math.ceil((orgOtpExpiresAt - Date.now())/1000)) : ''}s</div>
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          setOrgError('')
                          try {
                            const v = await fetch(`${API_BASE}/api/org/verify-otp`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ adminEmail: orgForm.adminEmail, code: orgOtp }) })
                            const j = await v.json()
                            if (v.status >= 400) { setOrgError(j.detail || j.error || 'OTP verify failed'); return }
                            // capture DNS instruction token if provided
                            try {
                              const dnsVal = (j && j.dns_instructions && j.dns_instructions.value) || ''
                              let extracted = dnsVal
                              if (dnsVal && dnsVal.startsWith('spaces-verify=')) {
                                extracted = dnsVal.split('spaces-verify=')[1]
                              }
                              if (extracted) setOrgDnsToken(extracted)
                            } catch (e) {}
                            setOrgMessage('Email verified. Please add DNS TXT record to complete verification.')
                            setOrgStage('dns')
                            setOrgDnsStatus('pending')
                          } catch (e) { setOrgError('OTP verify request failed') }
                        }} className="px-4 py-2 rounded-2xl bg-indigo-600 text-white">Verify</button>
                        <button onClick={async () => {
                          setOrgError('')
                          try {
                            await fetch(`${API_BASE}/api/org/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: orgForm.name, adminEmail: orgForm.adminEmail, logoUrl: orgForm.logoUrl }) })
                            setOrgMessage('OTP resent (if SMTP configured)')
                          } catch (e) { setOrgError('Resend failed') }
                        }} className="px-4 py-2 rounded-2xl border">Resend</button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setOrgStage('form'); setOrgMessage(''); setOrgError('') }} className="px-4 py-2 rounded-2xl border">Back</button>
                    </div>
                  </div>
                )}

                {orgStage === 'dns' && (
                  <div className="space-y-4">
                    <p className="text-sm">Please add the following DNS TXT record to domain <strong>{orgForm.domain}</strong>:</p>
                    <div className="p-3 rounded-xl bg-slate-50 border">record name: <strong>@</strong><br/>type: <strong>TXT</strong><br/>value: <strong>{orgDnsToken ? `spaces-verify=${orgDnsToken}` : 'spaces-verify=<token>'}</strong></div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setOrgError('')
                          // prevent double start
                          if (orgDnsChecking) return
                          setOrgDnsChecking(true)

                          const stopPolling = () => {
                            try { if (orgDnsPollRef.current) { clearInterval(orgDnsPollRef.current); orgDnsPollRef.current = null } } catch (e) {}
                            setOrgDnsChecking(false)
                          }

                          const singleCheck = async () => {
                            try {
                              const q = await fetch(`${API_BASE}/api/org/check-dns?domain=${encodeURIComponent(orgForm.domain)}`)
                              const j = await q.json()
                              if (!q.ok) { setOrgError(j.detail || 'DNS check failed'); stopPolling(); return false }

                              const verifiedFlag = (j && (j.verified === true || String(j.verified).toLowerCase() === 'true' || j.status === 'verified' || String(j.status || '').toLowerCase() === 'verified'))
                              if (verifiedFlag) {
                                setOrgDnsStatus('verified')
                                setOrgDnsVerified(true)
                                setOrgStage('verified')
                                setOrgMessage('Domain verified — organization is active')
                                // refresh org info and navigate to main workspace
                                try {
                                  const resOrg = await fetch(`${API_BASE}/api/org/org/${encodeURIComponent(orgForm.domain)}`)
                                  if (resOrg.ok) { const oj = await resOrg.json(); setOrgInfo(oj) }
                                } catch (e) {}
                                setOrgDnsChecking(false)
                                console.log('DNS verified in UI (second handler) — updating state and navigating')
                                try {
                                  const resOrg = await fetch(`${API_BASE}/api/org/org/${encodeURIComponent(orgForm.domain)}`)
                                  if (resOrg.ok) { const oj = await resOrg.json(); setOrgInfo(oj) }
                                } catch (e) {}
                                setShowOrgModal(false)
                                setOrgStage('verified')
                                setActiveView('channel')
                                // Open Admin Dashboard and fetch admin users
                                setShowAdminDashboard(true)
                                try {
                                  const resUsers = await fetch(`${API_BASE}/users/by-domain/${encodeURIComponent(orgForm.domain)}`)
                                  const uj = await resUsers.json()
                                  setAdminUsers(Array.isArray(uj) ? uj : [])
                                } catch (e) {
                                  console.error('Failed fetching admin users after DNS verify', e)
                                }
                                stopPolling()
                                return true
                              } else {
                                setOrgDnsStatus('not_found')
                                setOrgMessage('DNS not verified yet. This can take a few minutes.')
                                return false
                              }
                            } catch (e) {
                              setOrgError('DNS check request failed')
                              stopPolling()
                              return false
                            }
                          }

                          // Run first check immediately
                          const ok = await singleCheck()
                          if (ok) return

                          // Start polling every 5s until verified
                          orgDnsPollRef.current = setInterval(async () => {
                            const r = await singleCheck()
                            if (r) {
                              try { clearInterval(orgDnsPollRef.current); orgDnsPollRef.current = null } catch (e) {}
                            }
                          }, 5000)
                        }}
                        disabled={orgDnsChecking}
                        className={`px-4 py-2 rounded-2xl bg-indigo-600 text-white flex items-center gap-2 ${orgDnsChecking ? 'opacity-70 cursor-not-allowed' : ''}`}>
                        {orgDnsChecking ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-20"/><path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-80"/></svg>
                            <span>Checking DNS...</span>
                          </>
                        ) : (
                          'Check DNS'
                        )}
                      </button>
                      <button onClick={() => setShowOrgModal(false)} className="px-4 py-2 rounded-2xl border">Close</button>
                    </div>
                  </div>
                )}

                {orgStage === 'verified' && (
                  <div className="space-y-4 text-center">
                    <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
                    <h4 className="text-lg font-bold">Organization Verified</h4>
                    <p className="text-sm text-slate-600">Your organization is now verified via DNS. Admins can invite employees by email.</p>
                    <div className="mt-4">
                      <button onClick={() => { setShowOrgModal(false); setOrgStage('form'); try { setActiveView('channel') } catch(e){}; try { setShowAdminDashboard(true) } catch(e){} }} className="px-4 py-2 rounded-2xl bg-indigo-600 text-white">Done</button>
                    </div>
                  </div>
                )}

                

              </div>
            </div>
          </div>
          
        )}

                {showSetPasswordModal && (
                  <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowSetPasswordModal(false)}></div>
                    <div className="relative w-full max-w-md p-6 z-[95] bg-white rounded-2xl shadow-2xl">
                      <h3 className="text-xl font-bold mb-2">Set password for {setPasswordEmail}</h3>
                      <p className="text-sm text-slate-600 mb-4">Create a password for your admin account to sign in to Spaces.</p>
                      {setPasswordError && <div className="mb-3 px-3 py-2 rounded bg-red-50 text-red-700">{setPasswordError}</div>}
                      <input type="password" placeholder="Choose a password" value={setPasswordValue} onChange={e => setSetPasswordValue(e.target.value)} className="w-full px-4 py-3 rounded-2xl mb-3" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowSetPasswordModal(false)} className="px-4 py-2 rounded-2xl border">Cancel</button>
                        <button onClick={handleSetPasswordSubmit} disabled={setPasswordLoading} className={`px-4 py-2 rounded-2xl bg-indigo-600 text-white ${setPasswordLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                          {setPasswordLoading ? 'Saving...' : 'Save & Sign In'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

      </div>
    )
  }

  // --- Authenticated App UI ---
  const activeMembers = getActiveMembers()
  const { daysInMonth, firstDay } = getDaysInMonth(currentDate)

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-all ease-in-out duration-500 ${isDarkMode ? 'dark bg-[var(--bg-primary)] text-[var(--text-primary)]' : 'text-slate-700 bg-[#f4f6fb]'} mesh-gradient`}>
      {/* Professional Incoming Call Popup */}
      {incomingCall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
          {/* Backdrop with blur */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          
          {/* Call Card */}
          <div className="relative z-10 w-full max-w-sm mx-4">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 shadow-2xl border border-white/10">
              {/* Animated Background */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-full blur-3xl animate-pulse" />
              </div>
              
              {/* Content */}
              <div className="relative p-8 text-center">
                {/* Timer Circle */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <div className="relative w-10 h-10">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                      <circle 
                        cx="18" cy="18" r="16" 
                        fill="none" 
                        stroke="#10b981" 
                        strokeWidth="3" 
                        strokeLinecap="round"
                        strokeDasharray={`${(incomingCallCountdown / 10) * 100}, 100`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                      {incomingCallCountdown}
                    </span>
                  </div>
                </div>
                
                {/* Caller Avatar with Ring Animation */}
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-emerald-500/30 rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
                  <div className="absolute -inset-2 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
                  <div className="relative w-28 h-28 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-5xl shadow-xl border-4 border-white/20 overflow-hidden">
                    {renderAvatar({ avatar: incomingCall.fromAvatar, avatar_url: incomingCall.fromAvatar, name: incomingCall.fromName }, 112) || incomingCall.fromAvatar}
                  </div>
                </div>
                
                {/* Caller Info */}
                <h2 className="text-2xl font-bold text-white mb-1">{incomingCall.fromName}</h2>
                <p className="text-emerald-400 font-medium flex items-center justify-center gap-2 mb-8">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Incoming Video Call
                </p>
                
                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-6">
                  {/* Decline Button */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={declineCall}
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-500/40 transition-all duration-200 hover:scale-110 active:scale-95"
                      title="Decline"
                    >
                      <PhoneOff className="w-7 h-7" />
                    </button>
                    <span className="text-xs text-slate-400 font-medium">Decline</span>
                  </div>
                  
                  {/* Accept Button */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={answerCall}
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/50 transition-all duration-200 hover:scale-110 active:scale-95 animate-pulse"
                      style={{ animationDuration: '2s' }}
                      title="Accept"
                    >
                      <Video className="w-9 h-9" />
                    </button>
                    <span className="text-xs text-slate-400 font-medium">Accept</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Call Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 backdrop-blur-xl flex items-center justify-center z-50 p-6 animate-fade-in bg-slate-900/50">
          <div className="rounded-[2rem] p-6 w-full max-w-lg shadow-2xl bg-white/95 backdrop-blur-2xl ring-1 ring-white/50 shadow-purple-200/30">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-indigo-700 bg-clip-text text-transparent">Start Video Call</h3>
              <button
                onClick={() => setShowVideoModal(false)}
                className="p-2 rounded-xl transition-all duration-200 hover:bg-slate-100 hover:shadow-md text-slate-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => createMeetCall({ callEveryone: true })}
                disabled={callCreating}
                className="flex-1 py-3 rounded-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 disabled:opacity-60 shadow-lg shadow-indigo-200/50 transition-all duration-300 hover:shadow-indigo-300/60 hover:scale-[1.02]"
              >
                Call Everyone
              </button>
              <button
                onClick={() => setSelectedCallMembers([])}
                className="py-3 px-4 rounded-2xl font-bold border-2 border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/50 transition-all duration-200"
              >
                Select Members
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-2xl border p-3 bg-slate-50 mt-4">
              {getActiveMembers().map(m => (
                <label
                  key={m.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCallMembers.includes(m.id)}
                    onChange={() => toggleCallMember(m.id)}
                    disabled={m.id === currentUser?.id}
                  />
                  <div className="flex-1">
                    <div className="font-bold text-sm">{m.name}</div>
                    <div className="text-xs text-slate-500">{m.email || ''}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3 justify-end mt-6">
              <button
                onClick={() => setShowVideoModal(false)}
                className="px-4 py-2 rounded-2xl border"
              >
                Cancel
              </button>
              <button
                onClick={() => createMeetCall({ callEveryone: false })}
                disabled={callCreating || selectedCallMembers.length === 0}
                className="px-4 py-2 rounded-2xl bg-indigo-600 text-white disabled:opacity-60"
              >
                {activeView === 'dm' ? 'Start Call' : 'Create Call'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional WebRTC Video Call UI - Grid Layout Like Teams/Meet */}
      {showWebRTCCall && (
        <div className="fixed inset-0 z-[80] animate-fade-in bg-[#1a1d21]">
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 z-20 h-14 px-4 flex items-center justify-between bg-[#1a1d21] border-b border-white/5">
            {/* Left: Meeting Info */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Video className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-white font-medium text-sm">Video Call with {webrtcCallPartner?.name || 'Unknown'}</h3>
              </div>
            </div>

            {/* Center: Live Indicator & Timer */}
            <div className="flex items-center gap-4">
              {webrtcCallStatus === 'connected' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/40">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs font-semibold uppercase tracking-wide">Live</span>
                  <span className="text-white/80 text-xs font-mono">{formatCallDuration(callDuration)}</span>
                </div>
              )}
              {webrtcCallStatus === 'calling' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-amber-400 text-xs font-semibold">Calling... {callerCountdown}s</span>
                </div>
              )}
              {webrtcCallStatus === 'connecting' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/40">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-blue-400 text-xs font-semibold">Connecting...</span>
                </div>
              )}
            </div>

            {/* Right: User Avatar */}
            <div className="flex items-center gap-3">
              {pendingCallParticipants.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                  <Phone className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                  <span className="text-yellow-300 text-xs">Calling {pendingCallParticipants.length}</span>
                </div>
              )}
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-emerald-500/50">
                {renderAvatar(currentUser, 32) || (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                    {(currentUser?.name || '?')[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="absolute top-14 bottom-20 left-0 right-0 p-4">
            {/* Video Grid Container */}
            <div className="w-full h-full flex gap-4">
              {/* Video Grid */}
              <div className="flex-1 grid grid-cols-2 gap-3 auto-rows-fr">
                {/* Remote Video Tile */}
                <div className="relative rounded-2xl overflow-hidden bg-[#2d3136] group">
                  <video 
                    ref={remoteVideoRef}
                    autoPlay 
                    playsInline
                    className={`w-full h-full object-cover ${!remoteStream ? 'hidden' : ''}`}
                  />
                  
                  {/* No Video - Show Avatar */}
                  {!remoteStream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#2d3136] to-[#1f2226]">
                      {webrtcCallStatus === 'calling' ? (
                        <>
                          {/* Calling Animation */}
                          <div className="relative">
                            <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                            <div className="absolute -inset-2 rounded-full bg-emerald-500/10 animate-pulse" />
                            <div className="w-24 h-24 rounded-full overflow-hidden border-3 border-white/20">
                              {renderAvatar(webrtcCallPartner, 96) || (
                                <div className="w-full h-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-3xl font-bold">
                                  {(webrtcCallPartner?.name || '?').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="mt-4 text-white/60 text-sm">Ringing...</p>
                          {/* Countdown */}
                          <div className="mt-3 w-10 h-10 rounded-full border-2 border-emerald-500/50 flex items-center justify-center">
                            <span className="text-emerald-400 text-sm font-bold">{callerCountdown}</span>
                          </div>
                        </>
                      ) : webrtcCallStatus === 'connecting' ? (
                        <>
                          <div className="w-24 h-24 rounded-full overflow-hidden border-3 border-white/20">
                            {renderAvatar(webrtcCallPartner, 96) || (
                              <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-3xl font-bold">
                                {(webrtcCallPartner?.name || '?').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="mt-4 flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-24 h-24 rounded-full overflow-hidden border-3 border-white/20">
                            {renderAvatar(webrtcCallPartner, 96) || (
                              <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-3xl font-bold">
                                {(webrtcCallPartner?.name || '?').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <p className="mt-3 text-white/40 text-sm">Camera off</p>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Name Badge */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-sm font-medium">
                      {webrtcCallPartner?.name || 'Unknown'}
                    </span>
                  </div>
                  
                  {/* Mic indicator */}
                  <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <Mic className="w-4 h-4 text-white/70" />
                  </div>
                </div>

                {/* Local Video Tile (You) */}
                <div className="relative rounded-2xl overflow-hidden bg-[#2d3136] group">
                  <video 
                    ref={localVideoRef}
                    autoPlay 
                    playsInline 
                    muted
                    className={`w-full h-full object-cover ${!isWebRTCVideoOn ? 'hidden' : ''}`}
                  />
                  
                  {/* No Video - Show Avatar */}
                  {!isWebRTCVideoOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#2d3136] to-[#1f2226]">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-3 border-white/20">
                        {renderAvatar(currentUser, 96) || (
                          <div className="w-full h-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-3xl font-bold">
                            {(currentUser?.name || '?').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <p className="mt-3 text-white/40 text-sm">Camera off</p>
                    </div>
                  )}
                  
                  {/* Name Badge with (You) */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-sm font-medium">
                      {currentUser?.name || 'You'} <span className="text-emerald-400">(You)</span>
                    </span>
                  </div>
                  
                  {/* Mic indicator */}
                  {!isWebRTCMicOn && (
                    <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-red-500/90">
                      <MicOff className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                {/* Pending Call Participants (Tiles for people being called) */}
                {pendingCallParticipants.map((participant) => (
                  <div key={participant.id} className="relative rounded-2xl overflow-hidden bg-[#2d3136]">
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#2d3136] to-[#1f2226]">
                      <div className="relative">
                        <div className="absolute -inset-3 rounded-full bg-yellow-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                        <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-yellow-500/30">
                          {renderAvatar(participant, 80) || (
                            <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-2xl font-bold">
                              {(participant.name || '?').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 text-yellow-400/80 text-xs">Calling...</p>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <span className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-sm font-medium">
                        {participant.name}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Connected Participants */}
                {callParticipants.filter(p => p.id !== webrtcCallPartner?.id && p.id !== currentUser?.id).map((participant) => (
                  <div key={participant.id} className="relative rounded-2xl overflow-hidden bg-[#2d3136] group">
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#2d3136] to-[#1f2226]">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-3 border-white/20">
                        {renderAvatar(participant, 96) || (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
                            {(participant.name || '?').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <span className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-sm font-medium">
                        {participant.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {webrtcError && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50">
              <p className="text-red-400 text-sm font-medium flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {webrtcError}
              </p>
            </div>
          )}

          {/* Bottom Control Bar */}
          <div className="absolute bottom-0 left-0 right-0 z-20 h-20 px-6 flex items-center justify-between bg-[#1a1d21] border-t border-white/5">
            {/* Left Controls */}
            <div className="flex items-center gap-1">
              {/* Mic Toggle */}
              <button
                onClick={toggleWebRTCMic}
                className={`relative p-3 rounded-xl flex items-center gap-2 transition-all ${
                  isWebRTCMicOn 
                    ? 'bg-[#2d3136] hover:bg-[#3d4146] text-white' 
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {isWebRTCMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>

              {/* Video Toggle */}
              <button
                onClick={toggleWebRTCVideo}
                className={`relative p-3 rounded-xl flex items-center gap-2 transition-all ${
                  isWebRTCVideoOn 
                    ? 'bg-[#2d3136] hover:bg-[#3d4146] text-white' 
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {isWebRTCVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
            </div>

            {/* Center Controls */}
            <div className="flex items-center gap-2">
              {/* Screen Share */}
              <button
                className="p-3 rounded-xl bg-[#2d3136] text-white/40 cursor-not-allowed"
                disabled
                title="Screen share coming soon"
              >
                <Monitor className="w-5 h-5" />
              </button>

              {/* Reactions */}
              <button
                className="p-3 rounded-xl bg-[#2d3136] hover:bg-[#3d4146] text-white transition-all"
                title="Reactions"
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Leave Call - Red Button */}
              <button
                onClick={endWebRTCCall}
                className="px-5 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-medium flex items-center gap-2 transition-all hover:scale-105"
              >
                <LogOut className="w-5 h-5" />
              </button>

              {/* More Options */}
              <button
                className="p-3 rounded-xl bg-[#2d3136] hover:bg-[#3d4146] text-white transition-all"
                title="More options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              {/* Chat Toggle */}
              <button
                className="p-3 rounded-xl bg-[#2d3136] hover:bg-[#3d4146] text-white transition-all"
                title="Chat"
              >
                <MessageSquare className="w-5 h-5" />
              </button>

              {/* Add People */}
              <button
                onClick={() => setShowAddFriendsToCall(true)}
                className="p-3 rounded-xl bg-[#2d3136] hover:bg-[#3d4146] text-white transition-all flex items-center gap-2"
                title="Add friends to call"
              >
                <Users className="w-5 h-5" />
                <span className="text-sm text-white/60">{2 + pendingCallParticipants.length + callParticipants.filter(p => p.id !== webrtcCallPartner?.id && p.id !== currentUser?.id).length}</span>
              </button>

              {/* Settings */}
              <button
                className="p-3 rounded-xl bg-[#2d3136] hover:bg-[#3d4146] text-white transition-all"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Add Friends Modal - Only shows user's friends */}
          {showAddFriendsToCall && (
            <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="w-full max-w-md bg-[#2d3136] border border-white/10 rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Add Friends to Call</h3>
                    <p className="text-xs text-white/50 mt-0.5">Invite your friends to join this call</p>
                  </div>
                  <button
                    onClick={() => setShowAddFriendsToCall(false)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto p-3 space-y-1">
                  {/* Filter to only show friends */}
                  {friends.filter(friend => 
                    friend.id !== currentUser?.id && 
                    friend.id !== webrtcCallPartner?.id && 
                    !callParticipants.find(p => p.id === friend.id) && 
                    !pendingCallParticipants.find(p => p.id === friend.id)
                  ).map(friend => (
                    <button
                      key={friend.id}
                      onClick={() => addFriendToCall(friend)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                    >
                      <div className="relative">
                        <div className="w-11 h-11 rounded-full overflow-hidden">
                          {renderAvatar(friend, 44) || (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-base font-bold">
                              {(friend.name || '?').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2d3136] ${friend.is_online ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{friend.name}</div>
                        <div className="text-xs text-slate-400 truncate">{friend.is_online ? 'Online' : 'Offline'}</div>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <Phone className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                  {friends.filter(friend => 
                    friend.id !== currentUser?.id && 
                    friend.id !== webrtcCallPartner?.id && 
                    !callParticipants.find(p => p.id === friend.id) && 
                    !pendingCallParticipants.find(p => p.id === friend.id)
                  ).length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                      <Users className="w-14 h-14 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No friends available</p>
                      <p className="text-sm text-slate-500 mt-1">Add friends to invite them to calls</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setAvatarPreview(null)
              setSelectedPreset(null)
              setShowProfileModal(false)
            }}
          ></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-[720px] max-w-full p-6 z-[75]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Edit Profile</h3>
              <button
                type="button"
                onClick={() => {
                  setAvatarPreview(null)
                  setSelectedPreset(null)
                  setShowProfileModal(false)
                }}
                className="p-2 rounded-full hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="mb-3 text-sm font-semibold text-slate-600">Choose an avatar</div>
                <div className="grid grid-cols-4 gap-3">
                  {avatarPresets.map((preset, i) => {
                    const isActive = Array.isArray(selectedPreset) &&
                      selectedPreset.length === preset.length &&
                      selectedPreset.every((clr, idx) => clr === preset[idx])
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedPreset([...preset])
                          setAvatarPreview(null)
                        }}
                        className={`w-16 h-16 rounded-full shadow-md flex items-center justify-center transition-all ${
                          isActive ? "ring-4 ring-indigo-200 scale-105" : "ring-0"
                        }`}
                        style={{ background: `linear-gradient(135deg, ${preset[0]} 0%, ${preset[1]} 100%)` }}
                      >
                        <span className="text-white font-bold">
                          {(currentUser?.name || "?")[0]?.toUpperCase() || "?"}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-sm font-semibold text-slate-600">Or upload your own</div>
                  <label className="block">
                    <span className="sr-only">Choose avatar image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const f = e.target.files && e.target.files[0]
                        if (!f) return
                        const reader = new FileReader()
                        reader.onload = () => {
                          setAvatarPreview(reader.result)
                          setSelectedPreset(null)
                        }
                        reader.readAsDataURL(f)
                      }}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </label>
                  {avatarPreview && (
                    <div className="mt-3">
                      <img
                        src={avatarPreview}
                        alt="preview"
                        className="w-32 h-32 rounded-full object-cover border"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-semibold text-slate-600">Preview</div>
                <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-4">
                  <div>
                    {renderAvatar(
                      {
                        id: currentUser?.id,
                        name: currentUser?.name,
                        avatar_url: avatarPreview,
                        avatar_preset: selectedPreset
                      },
                      64
                    )}
                  </div>
                  <div>
                    <div className="font-bold">{currentUser?.name}</div>
                    <div className="text-xs text-slate-500">{currentUser?.email}</div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={async (e) => {
                      try { e?.preventDefault?.() } catch(_){}
                      if (isSavingProfile) return
                      setIsSavingProfile(true)
                      try {
                        const stored = getStoredUser()
                        const uid = getUserIdValue(stored)
                        if (!uid) throw new Error("No user id")

                        // Only send avatar-related fields to avoid overwriting other data
                        const updates = {
                          avatar_url: avatarPreview || null,
                          avatar_preset: selectedPreset || null
                        }

                        // Optimistically update UI immediately for fast feedback
                        const optimisticMerged = { ...stored, ...updates }
                        saveAuth(optimisticMerged, getToken())
                        setCurrentUser(optimisticMerged)
                        syncUserCollections(optimisticMerged)
                        setShowProfileModal(false)
                        setIsSavingProfile(false)

                        // Perform backend save in background (non-blocking)
                        Storage.updateUser(uid, updates).then(res => {
                          // Merge backend response (which may be partial) with local stored user
                          const updatedFromRes = (res && typeof res === 'object') ? (res.user || res || {}) : {}
                          const merged = { ...optimisticMerged, ...updatedFromRes }
                          saveAuth(merged, getToken())
                          setCurrentUser(merged)
                          syncUserCollections(merged)
                        }).catch(err => {
                          console.error('Backend save failed', err)
                        })

                        // Broadcast avatar update to friends/members via notification (non-blocking)
                        Storage.broadcastAvatarUpdate(uid, {
                          avatar_url: updates.avatar_url,
                          avatar_preset: updates.avatar_preset,
                          name: optimisticMerged.name
                        }).catch(e => {
                          console.error('Failed to broadcast avatar update', e)
                        })

                      } catch (err) {
                        console.error("save profile failed", err)
                        setIsSavingProfile(false)
                      }
                    }}
                    disabled={isSavingProfile}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow disabled:opacity-60"
                  >
                    {isSavingProfile ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarPreview(null)
                      setSelectedPreset(null)
                      setShowProfileModal(false)
                    }}
                    className="px-4 py-2 rounded-xl border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTaskModal && (
        <TaskModal
          visible={showTaskModal}
          onClose={() => setShowTaskModal(false)}
          members={getActiveMembers()}
          currentUser={currentUser}
          spaceId={activeSpace}
          onTaskCreated={(payload) => {
            // optimistic UI: add a task message to current chat and add to tasks list
            try {
              const chatId = getActiveChatId()
              const tempId = `tmp-task-${Date.now()}-${Math.floor(Math.random()*1000)}`
              const newMsg = {
                id: tempId,
                userId: currentUser?.id,
                text: payload.message,
                timestamp: payload.timestamp || new Date().toISOString(),
                type: 'task',
                assigned_to: payload.assigned_to,
                status: 'sent',
                optimistic: false
              }
              if (chatId) {
                setMessages(prev => ({
                  ...prev,
                  [chatId]: [...(prev[chatId] || []), newMsg]
                }))
              }
              setTasksList(prev => [payload, ...(prev || [])])
            } catch (e) {
              console.warn('optimistic task create failed', e)
            }
          }}
        />
      )}

      {showOrgModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowOrgModal(false)}></div>
          <div className="relative w-full max-w-xl p-6 z-[85]">
            <div className="rounded-[1.6rem] overflow-hidden p-6 backdrop-blur-2xl bg-white/60 dark:bg-slate-800/70 border border-white/30 shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-extrabold">Register your company with Spaces</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Secure your company domain and invite employees.</p>
                </div>
                <button onClick={() => setShowOrgModal(false)} className="p-2 rounded-full hover:bg-white/20">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {orgStage === 'form' && (
                <div className="space-y-4">
                  {orgError && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700">{orgError}</div>}
                  {orgMessage && <div className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700">{orgMessage}</div>}
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Organization Name</label>
                    <input value={orgForm.name} onChange={e => setOrgForm({...orgForm, name: e.target.value})} className="w-full px-4 py-3 rounded-2xl mt-2" placeholder="Example, Acme Corp" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Company Admin Email</label>
                    <input value={orgForm.adminEmail} onChange={e => { const v=e.target.value; const d=(v.match(/@([A-Za-z0-9.-]+)$/)||[])[1]||''; setOrgForm({...orgForm, adminEmail: v, domain: d}) }} className="w-full px-4 py-3 rounded-2xl mt-2" placeholder="admin@yourcompany.com" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Company Domain (auto-parsed)</label>
                    <input value={orgForm.domain} readOnly className="w-full px-4 py-3 rounded-2xl mt-2 bg-white/30" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Logo (optional)</label>
                    <div className="mt-2 flex items-center gap-3">
                      <input id="org-logo-file" type="file" accept="image/*" onChange={async e => {
                        const f = e.target.files && e.target.files[0]
                        if (!f) return
                        try {
                          const form = new FormData()
                          form.append('file', f)
                          const upl = await fetch(`${API_BASE}/upload/file`, { method: 'POST', body: form })
                          const jr = await upl.json()
                          if (upl.ok && jr.file_id) {
                            // set logoUrl to download endpoint
                            const url = `${API_BASE}/upload/file/${jr.file_id}/download`
                            setOrgForm(prev => ({ ...prev, logoUrl: url }))
                            setOrgMessage('Logo uploaded')
                          } else {
                            setOrgError(jr.detail || jr.error || 'Upload failed')
                          }
                        } catch (err) {
                          console.error('upload failed', err)
                          setOrgError('Logo upload failed')
                        }
                      }} className="rounded-2xl" />
                      <input type="text" value={orgForm.logoUrl} onChange={e => setOrgForm({...orgForm, logoUrl: e.target.value})} placeholder="Image URL or uploaded file" className="flex-1 px-4 py-3 rounded-2xl" />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-3">
                    <button onClick={async () => {
                      setOrgError('')
                      setOrgMessage('')
                      // basic validation
                      if (!orgForm.name || !orgForm.adminEmail) { setOrgError('Please provide organization name and admin email'); return }
                      const domain = orgForm.domain
                      const publicDomains = ['gmail.com','yahoo.com','outlook.com','hotmail.com','aol.com','icloud.com']
                      if (publicDomains.includes(domain)) { setOrgError('Public email domains are not allowed'); return }
                      // check existing org via backend
                      try {
                        const resExist = await fetch(`${API_BASE}/api/org/org/${domain}`)
                        if (resExist.ok) {
                          const data = await resExist.json()
                          if (data.verified) { setOrgError('This domain is already registered and verified'); return }
                          // allow continuing if pending
                        }
                      } catch (e) {}
                      // quick MX check via dns over https
                      try {
                        const resp = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`)
                        const j = await resp.json()
                        if (!j.Answer || j.Answer.length === 0) { setOrgError('Domain appears to have no MX records'); return }
                      } catch (e) {
                        // ignore and let backend validate
                      }
                      // submit to backend
                      try {
                        const reg = await fetch(`${API_BASE}/api/org/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: orgForm.name, adminEmail: orgForm.adminEmail, logoUrl: orgForm.logoUrl }) })
                        const jr = await reg.json()
                        if (reg.status >= 400) { setOrgError(jr.detail || jr.error || 'Registration failed'); return }
                        setOrgMessage(jr.message || 'OTP sent to admin email')
                        setOrgStage('otp')
                        setOrgOtp('')
                        setOrgOtpExpiresAt(Date.now() + 5*60*1000)
                      } catch (e) {
                        setOrgError('Registration request failed')
                      }
                    }} className="px-4 py-2 rounded-2xl bg-indigo-600 text-white font-bold">Send OTP</button>
                    <button onClick={() => setShowOrgModal(false)} className="px-4 py-2 rounded-2xl border">Cancel</button>
                  </div>
                </div>
              )}

              {orgStage === 'otp' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Enter the 6-digit code sent to <strong>{orgForm.adminEmail}</strong></p>
                  <input value={orgOtp} onChange={e => setOrgOtp(e.target.value)} className="w-full px-4 py-3 rounded-2xl mt-2 text-center text-lg tracking-widest" placeholder="123456" />
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-500">Expires in: {orgOtpExpiresAt ? Math.max(0, Math.ceil((orgOtpExpiresAt - Date.now())/1000)) : ''}s</div>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        setOrgError('')
                        try {
                          const v = await fetch(`${API_BASE}/api/org/verify-otp`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ adminEmail: orgForm.adminEmail, code: orgOtp }) })
                          const j = await v.json()
                          if (v.status >= 400) { setOrgError(j.detail || j.error || 'OTP verify failed'); return }
                          try {
                            const dnsVal = (j && j.dns_instructions && j.dns_instructions.value) || ''
                            let extracted = dnsVal
                            if (dnsVal && dnsVal.startsWith('spaces-verify=')) {
                              extracted = dnsVal.split('spaces-verify=')[1]
                            }
                            if (extracted) setOrgDnsToken(extracted)
                          } catch (e) {}
                          setOrgMessage('Email verified. Please add DNS TXT record to complete verification.')
                          setOrgStage('dns')
                          setOrgDnsStatus('pending')
                        } catch (e) { setOrgError('OTP verify request failed') }
                      }} className="px-4 py-2 rounded-2xl bg-indigo-600 text-white">Verify</button>
                      <button onClick={async () => {
                        // Re-trigger registration to resend OTP
                        setOrgError('')
                        try {
                          await fetch(`${API_BASE}/api/org/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: orgForm.name, adminEmail: orgForm.adminEmail, logoUrl: orgForm.logoUrl }) })
                          setOrgMessage('OTP resent (if SMTP configured)')
                        } catch (e) { setOrgError('Resend failed') }
                      }} className="px-4 py-2 rounded-2xl border">Resend</button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setOrgStage('form'); setOrgMessage(''); setOrgError('') }} className="px-4 py-2 rounded-2xl border">Back</button>
                  </div>
                </div>
              )}

              {orgStage === 'dns' && (
                <div className="space-y-4">
                  <p className="text-sm">Please add the following DNS TXT record to domain <strong>{orgForm.domain}</strong>:</p>
                  <div className="p-3 rounded-xl bg-slate-50 border">record name: <strong>@</strong><br/>type: <strong>TXT</strong><br/>value: <strong>spaces-verify=&lt;token&gt;</strong></div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setOrgError('')
                        if (orgDnsChecking) return
                        setOrgDnsChecking(true)

                        const stopPolling = () => {
                          try { if (orgDnsPollRef.current) { clearInterval(orgDnsPollRef.current); orgDnsPollRef.current = null } } catch (e) {}
                          setOrgDnsChecking(false)
                        }

                        const singleCheck = async () => {
                          try {
                            const q = await fetch(`${API_BASE}/api/org/check-dns?domain=${encodeURIComponent(orgForm.domain)}`)
                            const j = await q.json()
                            console.log('DNS CHECK RESPONSE', j)
                            if (!q.ok) { setOrgError(j.detail || 'DNS check failed'); stopPolling(); return false }

                            // Accept multiple response shapes: {verified: true}, {verified: 'True'}, or legacy {status: 'verified'}
                            const verifiedFlag = (j && (j.verified === true || String(j.verified).toLowerCase() === 'true' || j.status === 'verified' || String(j.status || '').toLowerCase() === 'verified'))
                            if (verifiedFlag) {
                              setOrgDnsStatus('verified')
                              setOrgDnsVerified(true)
                              setOrgStage('verified')
                              setOrgMessage('Domain verified — organization is active')
                              // close modal and open admin/dashboard
                              try {
                                const resOrg = await fetch(`${API_BASE}/api/org/org/${encodeURIComponent(orgForm.domain)}`)
                                if (resOrg.ok) { const oj = await resOrg.json(); setOrgInfo(oj) }
                              } catch (e) {}
                              setOrgDnsChecking(false)
                              console.log('DNS verified in UI — updating state and navigating')
                              try {
                                const resOrg = await fetch(`${API_BASE}/api/org/org/${encodeURIComponent(orgForm.domain)}`)
                                if (resOrg.ok) { const oj = await resOrg.json(); setOrgInfo(oj) }
                              } catch (e) {}
                              setShowOrgModal(false)
                              setOrgStage('verified')
                              setActiveView('channel')
                              // Open Admin Dashboard and fetch admin users
                              setShowAdminDashboard(true)
                              try {
                                const resUsers = await fetch(`${API_BASE}/users/by-domain/${encodeURIComponent(orgForm.domain)}`)
                                const uj = await resUsers.json()
                                setAdminUsers(Array.isArray(uj) ? uj : [])
                              } catch (e) {
                                console.error('Failed fetching admin users after DNS verify', e)
                              }
                              stopPolling()
                              return true
                            } else {
                              setOrgDnsStatus('not_found')
                              setOrgMessage('DNS not verified yet. This can take a few minutes.')
                              return false
                            }
                          } catch (e) {
                            setOrgError('DNS check request failed')
                            stopPolling()
                            return false
                          }
                        }

                        const ok = await singleCheck()
                        if (ok) return

                        orgDnsPollRef.current = setInterval(async () => {
                          const r = await singleCheck()
                          if (r) {
                            try { clearInterval(orgDnsPollRef.current); orgDnsPollRef.current = null } catch (e) {}
                          }
                        }, 5000)
                      }}
                      disabled={orgDnsChecking}
                      className={`px-4 py-2 rounded-2xl bg-indigo-600 text-white flex items-center gap-2 ${orgDnsChecking ? 'opacity-70 cursor-not-allowed' : ''}`}>
                      {orgDnsChecking ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-20"/><path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-80"/></svg>
                          <span>Checking DNS...</span>
                        </>
                      ) : (
                        'Check DNS'
                      )}
                    </button>
                    <button onClick={() => setShowOrgModal(false)} className="px-4 py-2 rounded-2xl border">Close</button>
                  </div>
                </div>
              )}

              {orgStage === 'verified' && (
                <div className="space-y-4 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
                  <h4 className="text-lg font-bold">Organization Verified</h4>
                  <p className="text-sm text-slate-600">Your organization is now verified via DNS. Admins can invite employees by email.</p>
                  <div className="mt-4">
                    <button onClick={() => { setShowOrgModal(false); setOrgStage('form') }} className="px-4 py-2 rounded-2xl bg-indigo-600 text-white">Done</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {showAdminDashboard && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowAdminDashboard(false); if (adminSocketRef.current) { adminSocketRef.current.close(); adminSocketRef.current = null } }}></div>
          <div className="relative w-full max-w-3xl p-6 z-[95]">
            <div className="rounded-[1.2rem] p-6 backdrop-blur-2xl bg-white/60 dark:bg-slate-800/70 border shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Admin Dashboard</h3>
                <div className="flex items-center gap-2">
                  <input placeholder="Search users" value={adminSearch} onChange={e => setAdminSearch(e.target.value)} className="px-3 py-2 rounded-md" />
                  <button onClick={() => { setShowAdminDashboard(false); if (adminSocketRef.current) { adminSocketRef.current.close(); adminSocketRef.current = null } }} className="px-3 py-2 rounded-md border">Close</button>
                </div>
              </div>
              <div className="mb-4 text-sm text-slate-600">Domain: <strong>{orgInfo?.domain}</strong></div>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {adminUsers.filter(u => u.name?.toLowerCase().includes(adminSearch.toLowerCase()) || u.email?.toLowerCase().includes(adminSearch.toLowerCase())).map(u => {
                    const uid = getUserIdValue(u)
                    const online = adminOnlineSet && adminOnlineSet.has(String(uid))
                    return (
                      <div key={uid || u.email} className="p-3 rounded-xl flex items-center justify-between bg-white/40 border">
                        <div>
                          <div className="font-bold">{u.name}</div>
                          <div className="text-sm text-slate-500">{u.email}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-slate-500">{u.role || 'user'}</div>
                          <div className={`text-xs px-2 py-1 rounded-full ${online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{ online ? 'online' : 'offline' }</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && (mobileView === "spaces" || mobileView === "friends") && (
        <div 
          className="mobile-sidebar-overlay"
          onClick={() => setMobileView("chat")}
        />
      )}

      {/* Left Sidebar - SPACES */}
      <div
        className={`${
          sidebarCollapsed ? "w-20" : "w-80"
        } ${isMobile ? (mobileView === "spaces" ? "flex fixed inset-y-0 left-0 w-[85%] max-w-[320px] mobile-slide-in-left" : "hidden") : "flex"} flex-col transition-all ease-[cubic-bezier(0.32,0.72,0,1)] duration-300 z-40 flex-shrink-0 liquid-glass-sidebar`}
      >
        {/* Mobile Swipe Indicator */}
        {isMobile && mobileView === "spaces" && (
          <div className="swipe-indicator mt-2" />
        )}
        {/* ... (Sidebar Content) ... */}
        <div className={`p-6 ${isMobile ? 'pt-4 pb-4' : ''} flex items-center justify-between h-[80px] border-b ${isDarkMode ? 'border-[var(--border-light)]' : 'border-slate-100/60'}`}>
          {!sidebarCollapsed && (
            <div
              className="flex items-center gap-3 animate-fade-in cursor-pointer group"
              onClick={() => {
                if (!googleCalendarToken) {
                  setShowCalendarConnectModal(true)
                } else {
                  setActiveView("calendar")
                  setActiveSpace(null)
                }
              }}
            >
              <div className="p-2.5 rounded-2xl shadow-lg transition-all bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-indigo-300/50 group-hover:shadow-indigo-400/60 group-hover:scale-105 animate-gradient">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className={`font-extrabold text-xl tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Spaces
              </h1>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            {isMobile && (
              <button
                onClick={() => { setActiveView('tasks'); setActiveSpace(null); setMobileView('chat') }}
                className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-violet-400' : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                title="Tasks"
              >
                <ClipboardList className="w-5 h-5" />
              </button>
            )}
            {isMobile && (
              <button
                onClick={() => setShowCreateSpaceModal(true)}
                className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-violet-400' : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                title="Create Space"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
            {isMobile && (
              <button
                onClick={() => setMobileView("chat")}
                className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-violet-400' : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {!sidebarCollapsed && !isMobile && (
              <button
                onClick={() => setShowCreateSpaceModal(true)}
                className="p-2 rounded-xl transition-colors hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
            {!sidebarCollapsed && !isMobile && (
              <button
                onClick={() => { setActiveView('tasks'); setActiveSpace(null) }}
                className="p-2 rounded-xl transition-colors hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
                title="Tasks"
              >
                <ClipboardList className={`w-5 h-5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
              </button>
            )}
            {/* Admin dashboard access - visible to org admins of verified org */}
            {!sidebarCollapsed && !isMobile && currentUser?.role === 'org_admin' && orgInfo?.verified && (
              <button
                onClick={() => {
                  try {
                    const url = `${window.location.origin}/admin/dashboard`
                    window.open(url, '_blank')
                  } catch (e) {
                    // fallback to same-tab modal if window.open is blocked
                    setShowAdminDashboard(true)
                  }
                }}
                className="p-2 rounded-xl transition-colors hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
                title="Admin Dashboard"
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
            )}
            {!isMobile && (
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-xl transition-colors hover:bg-slate-100 text-slate-400"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {!sidebarCollapsed && (
          <div className="px-5 pt-6 pb-2 animate-fade-in">
            <div className="relative group">
              <Search className="absolute left-4 top-3.5 w-4 h-4 transition-colors text-slate-400 group-focus-within:text-indigo-500" />
              <input
                type="text"
                placeholder="Find a space..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none transition-all ease-in-out duration-300 ${
                  isDarkMode
                    ? 'bg-slate-800/60 border border-slate-700/50 focus:bg-slate-800 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 text-slate-200 hover:bg-slate-800/80 placeholder:text-slate-500'
                    : 'bg-slate-100/60 border border-slate-200/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 text-slate-700 hover:bg-slate-100/80 hover:border-slate-200 placeholder:text-slate-400 shadow-sm'
                }`}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-6">
          {!sidebarCollapsed ? (
            <div className="animate-fade-in">
              {/* Conditional Rendering: Show Search Results or Standard Tree */}
              {debouncedSearchQuery.trim().length > 0 ? (
                <div className="space-y-4">
                  <div className="px-2 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Search Results
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {spaceSearchResults.length}
                    </span>
                  </div>
                  {spaceSearchResults.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs font-medium">
                      No results found
                    </div>
                  ) : (
                    spaceSearchResults.map(result => (
                      <div
                        key={result.id}
                        onClick={() => {
                          if (result.spaceId && result.channelId) {
                            handleChannelNavigation(
                              result.spaceId,
                              result.channelId
                            )

                            // Highlight the search query in the channel
                            setHighlightTerm(debouncedSearchQuery)

                            if (result.messageId) {
                              // Scroll to the message and pin it for review
                              setTargetMessageId(result.messageId)
                              setPinnedMessageId(result.messageId)
                            } else {
                              // If we don't have a specific message, try to find the first message in the channel that matches
                              ;(async () => {
                                try {
                                  const chatId = Number(result.channelId)
                                  const existing = messages[chatId]
                                  const msgs =
                                    Array.isArray(existing) && existing.length > 0
                                      ? existing
                                      : (await Storage.getMessages(chatId)) || []

                                  const firstMatch = (msgs || []).find(m =>
                                    m.text &&
                                    m.text
                                      .toLowerCase()
                                      .includes(debouncedSearchQuery.toLowerCase())
                                  )

                                  if (firstMatch) {
                                    setTargetMessageId(firstMatch.id)
                                    setPinnedMessageId(firstMatch.id)
                                  } else {
                                    setPinnedMessageId(null)
                                    setTargetMessageId(null)
                                  }
                                } catch (e) {
                                  console.error("Search navigation failed to load messages", e)
                                  setPinnedMessageId(null)
                                  setTargetMessageId(null)
                                }
                              })()
                            }
                          } else if (result.spaceId) {
                            setActiveSpace(result.spaceId)
                          }
                        }}
                        className="p-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-1">
                          <span
                            className={`p-1.5 rounded-lg ${
                              result.type === "message"
                                ? "bg-indigo-50 text-indigo-500"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {result.type === "space" ? (
                              <Briefcase className="w-3 h-3" />
                            ) : result.type === "channel" ? (
                              <Hash className="w-3 h-3" />
                            ) : (
                              <MessageSquare className="w-3 h-3" />
                            )}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {result.title}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 truncate pl-9">
                          {renderWithHighlight(
                            result.subtitle,
                            debouncedSearchQuery
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <button
                    onClick={() => {
                      if (!googleCalendarToken) {
                        setShowCalendarConnectModal(true)
                      } else {
                        setActiveView("calendar")
                        setActiveSpace(null)
                      }
                    }}
                    className={`w-full flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all duration-300 mb-6 group hover-lift ${
                      activeView === "calendar"
                        ? "bg-gradient-to-r from-white to-indigo-50/50 shadow-lg shadow-indigo-100/50 border border-indigo-100/80 ring-1 ring-indigo-100 text-indigo-600"
                        : "hover:bg-white/80 border border-transparent hover:border-slate-200/50 hover:shadow-md text-slate-600"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl transition-all duration-300 ${
                        activeView === "calendar"
                          ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-300/50"
                          : "bg-slate-100/80 text-slate-500 group-hover:bg-gradient-to-br group-hover:from-indigo-100 group-hover:to-purple-100 group-hover:text-indigo-600"
                      }`}
                    >
                      <Calendar className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm tracking-wide">
                      Calendar
                    </span>
                  </button>

                  <div className="px-2 mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Your Spaces
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {spaces.length}
                    </span>
                  </div>

                  {spaces.map(space => (
                    <div key={space.id} className="mb-2">
                      <div
                        className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-300 group hover-lift ${
                            activeView === "channel" && activeSpace === space.id
                              ? (isDarkMode
                                  ? "bg-gradient-to-r from-purple-900/40 to-violet-900/30 border-purple-600/30 shadow-md shadow-purple-500/10 ring-1 ring-purple-600/20"
                                  : "bg-gradient-to-r from-white to-indigo-50/50 shadow-lg shadow-indigo-100/50 border border-indigo-100/80 ring-1 ring-indigo-100")
                              : (isDarkMode
                                  ? "bg-slate-800/50 border-transparent hover:bg-gradient-to-r hover:from-purple-900/10 hover:to-violet-900/10 hover:border-purple-600/10"
                                  : "hover:bg-white/80 border border-transparent hover:border-slate-200/50 hover:shadow-md")
                          }`}
                        onClick={() => {
                          setActiveSpace(space.id)
                          // Don't auto-switch channel unless user has access to current active, handled by effect
                          // Just set view to channel
                          setActiveView("channel")
                        }}
                      >
                        <div
                          className={`p-2.5 rounded-xl transition-all duration-300 ${
                              activeSpace === space.id
                                ? (isDarkMode
                                    ? "bg-gradient-to-br from-purple-800/60 to-violet-800/40 text-purple-200 shadow-md shadow-purple-500/10"
                                    : "bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-300/50")
                                : (isDarkMode
                                    ? "bg-slate-700/60 text-slate-300 group-hover:bg-gradient-to-br group-hover:from-purple-900/10 group-hover:to-violet-900/10 group-hover:text-purple-300"
                                    : "bg-slate-100/80 text-slate-500 group-hover:bg-gradient-to-br group-hover:from-indigo-100 group-hover:to-purple-100 group-hover:text-indigo-600")
                            }`}
                        >
                          <img src="/hexagon-gradient%20For%20spaces..png" alt={space.name || 'space'} className="w-5 h-5 object-contain" />
                        </div>
                        <span
                          className={`font-semibold text-sm truncate flex-1 transition-colors ${
                            activeSpace === space.id
                              ? (isDarkMode ? "text-white" : "text-slate-900")
                              : (isDarkMode ? "text-white" : "text-slate-600")
                          }`}
                        >
                          {space.name}
                        </span>

                        {/* Space Actions */}
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {space.ownerId === currentUser?.id && (
                            <>
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  setShowRenameModal({
                                    type: "space",
                                    id: space.id,
                                    currentName: space.name
                                  })
                                }}
                                className="p-1 text-blue-500 hover:text-blue-600"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  setShowDeleteConfirm({
                                    type: "space",
                                    id: space.id
                                  })
                                }}
                                className="p-1 text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              toggleSpaceExpansion(space.id)
                            }}
                            className="p-1 rounded-lg hover:bg-slate-200"
                          >
                            {space.expanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                        </div>
                      </div>

                      {space.expanded && (
                        <div className="ml-6 pl-4 border-l-2 mt-2 space-y-1 border-slate-100">
                          {(space.channels || []).filter(channel => {
                            const chMembers = channel?.members || []
                            if (chMembers && chMembers.length > 0) {
                              return (
                                currentUser &&
                                (chMembers.includes(currentUser.id) || space.ownerId === currentUser.id)
                              )
                            }
                            const spaceMembers = space?.members || []
                            return (
                              currentUser &&
                              (space.ownerId === currentUser.id || spaceMembers.includes(currentUser.id))
                            )
                          }).map(channel => (
                            <div
                              key={channel.id}
                              className="relative group/channel"
                            >
                              <button
                                onClick={() =>
                                  handleChannelNavigation(space.id, channel.id)
                                }
                                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                                  activeView === "channel" &&
                                  activeChannel === channel.id
                                    ? (isDarkMode
                                        ? "bg-gradient-to-r from-purple-900/30 to-violet-900/20 text-purple-300 shadow-sm"
                                        : "bg-gradient-to-r from-indigo-50 to-purple-50/50 text-indigo-600 shadow-sm")
                                    : (isDarkMode
                                        ? "text-slate-400 hover:text-purple-300 hover:bg-gradient-to-r hover:from-purple-900/8 hover:to-violet-900/8 hover:shadow-sm"
                                        : "text-slate-500 hover:text-slate-800 hover:bg-white/80 hover:shadow-sm")
                                }`} 
                              >
                                <Hash
                                  className={`w-4 h-4 transition-colors ${
                                    activeChannel === channel.id
                                      ? (isDarkMode ? "text-purple-300" : "text-indigo-500")
                                      : (isDarkMode ? "text-slate-400 group-hover/channel:text-purple-300" : "text-slate-300 group-hover/channel:text-indigo-400")
                                  }`} 
                                />
                                <span className="truncate flex-1 text-left">
                                  {channel.name}
                                </span>

                                {/* Unread Indicator */}
                                {unreadChannels.includes(channel.id) &&
                                  activeChannel !== channel.id && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                                  )}

                                {/* Real-time member count */}
                                <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded-full text-slate-500 group-hover/channel:hidden">
                                  {channel.members.length}
                                </span>

                                {space.ownerId === currentUser?.id && (
                                  <div className="hidden group-hover/channel:flex items-center gap-1">
                                    <span
                                      className="p-1 text-blue-500 hover:text-blue-600 cursor-pointer"
                                      onClick={e => {
                                        e.stopPropagation()
                                        setShowRenameModal({
                                          type: "channel",
                                          id: channel.id,
                                          currentName: channel.name
                                        })
                                      }}
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </span>
                                    <span
                                      className="p-1 text-red-500 hover:text-red-600 cursor-pointer"
                                      onClick={e => {
                                        e.stopPropagation()
                                        setShowDeleteConfirm({
                                          type: "channel",
                                          id: channel.id
                                        })
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </span>
                                  </div>
                                )}
                              </button>
                            </div>
                          ))}
                          {space.ownerId === currentUser?.id && (
                            <button
                              onClick={() => {
                                setActiveSpace(space.id)
                                setShowChannelModal(true)
                              }}
                              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-[13px] transition-all group mt-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Add channel</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 mt-2 animate-fade-in">
              <button
                onClick={() => {
                  if (!googleCalendarToken) {
                    setShowCalendarConnectModal(true)
                  } else {
                    setActiveView("calendar")
                    setActiveSpace(null)
                  }
                }}
                className={`p-3 rounded-2xl transition-all duration-300 ${
                  activeView === "calendar"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                    : "bg-slate-100 text-slate-500 hover:bg-white hover:shadow-md"
                }`}
                title="Calendar"
              >
                <Calendar className="w-5 h-5" />
              </button>
              <div className="w-8 h-px my-2 bg-slate-200"></div>
              {spaces.map(s => (
                <button
                  key={s.id}
                  className={`w-12 h-12 flex items-center justify-center transition-all duration-300 relative ${activeSpace === s.id ? 'ring-2 ring-indigo-500 squircle-mask' : ''}`}
                  /* Add this style at the top-level or in your CSS file if not present already */
                  // .squircle-mask { border-radius: 40%/50% !important; }
                  title={s.name}
                  onClick={() => {
                    setActiveSpace(s.id)
                    setActiveView("channel")
                    const accChannel = s.channels.find(
                      c =>
                        c.members.includes(currentUser?.id || 0) ||
                        s.ownerId === currentUser?.id
                    )
                    if (accChannel) setActiveChannel(accChannel.id)
                    if (isMobile) setMobileView("chat")
                  }}
                >
                  <img src="/hexagon-gradient%20For%20spaces..png" alt={s.name} className="w-10 h-10 object-contain" />
                  <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${activeSpace === s.id ? 'text-white' : 'text-white'}`}>
                    {s.name.charAt(0).toUpperCase()}
                  </span>
                </button>
              ))}
              <button
                onClick={() => setShowCreateSpaceModal(true)}
                className="p-3 rounded-2xl border-2 border-dashed transition-all border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-500"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ... (Main Content, Headers, etc.) ... */}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 relative ${isMobile && mobileView !== "chat" ? "hidden" : ""}`}>
        {/* VIEW: VIDEO MEETING / CALENDAR (No changes needed) ... */}
        {activeView === "meeting" ? (
          <div className="flex-1 flex flex-col relative bg-slate-900">
            {/* ... (Meeting UI) ... */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
              <div className="text-white">
                <h2 className="font-bold text-xl tracking-tight">
                  {activeMeetingTitle}
                </h2>
                <span className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 flex items-center gap-2 w-fit mt-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>{" "}
                  LIVE
                </span>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-6 relative">
              <div className="relative w-full h-full max-w-6xl rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
                <div className="absolute bottom-8 right-8 w-64 h-40 bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 overflow-hidden">
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <UserIcon className="w-10 h-10 mb-2 opacity-50" />
                    <span className="text-xs font-medium uppercase tracking-wider">
                      Waiting for user...
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-28 flex items-center justify-center gap-6 pb-6">
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full p-2 flex gap-4 shadow-2xl">
                <button
                  onClick={toggleMic}
                  className={`p-4 rounded-full ${
                    isMicOn
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-red-500 text-white hover:bg-red-600"
                  } transition-all`}
                >
                  {isMicOn ? (
                    <Mic className="w-6 h-6" />
                  ) : (
                    <MicOff className="w-6 h-6" />
                  )}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-full ${
                    isVideoOn
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-red-500 text-white hover:bg-red-600"
                  } transition-all`}
                >
                  {isVideoOn ? (
                    <Video className="w-6 h-6" />
                  ) : (
                    <VideoOff className="w-6 h-6" />
                  )}
                </button>
                <button
                  onClick={endCall}
                  className="px-8 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-red-900/50 transition-all transform hover:scale-105"
                >
                  <PhoneOff className="w-6 h-6" />{" "}
                  <span className="hidden sm:inline">End Call</span>
                </button>
              </div>
            </div>
          </div>
        ) : activeView === "calendar" ? (
          /* VIEW: CALENDAR */
          <div className={`flex-1 flex flex-col overflow-hidden ${isDarkMode ? 'bg-[var(--bg-tertiary)]' : 'bg-gradient-to-br from-slate-50/80 via-white/40 to-indigo-50/30'}`}>
            {/* ... (Calendar UI) ... */}
            <div className={`h-[90px] flex items-center justify-between px-8 border-b ${isDarkMode ? 'bg-[var(--bg-secondary)]/90 border-[var(--border-light)]' : 'bg-white/80 border-slate-200/50'} backdrop-blur-xl`}>
              <h2 className={`text-3xl font-bold flex items-center gap-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/30' : 'bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-200/50'}`}>
                  <Calendar className="w-7 h-7 text-white" />
                </div>
                Calendar
              </h2>
              <div className="flex items-center gap-4">
                <div className={`flex rounded-2xl p-1.5 border ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-slate-200/60 shadow-sm'}`}>
                  <button
                    onClick={() => changeMonth(-1)}
                    className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-purple-400' : 'hover:bg-slate-100 text-slate-600'}`}
                  >
                    <ChevronDown className="w-5 h-5 rotate-90" />
                  </button>
                  <span className={`px-6 font-bold flex items-center ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
                    {currentDate.toLocaleString("default", {
                      month: "long",
                      year: "numeric"
                    })}
                  </span>
                  <button
                    onClick={() => changeMonth(1)}
                    className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-purple-400' : 'hover:bg-slate-100 text-slate-600'}`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    setSelectedDate(new Date())
                    setShowEventModal(true)
                  }}
                  className={`px-6 py-3 rounded-2xl font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex items-center gap-2 text-white ${isDarkMode ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 shadow-purple-500/30 hover:shadow-purple-500/50' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-purple-300/40 hover:shadow-purple-400/50'}`}
                >
                  <Plus className="w-5 h-5" /> New Event
                </button>
                {!googleCalendarToken ? (
                  <button
                    onClick={() => handleConnectGoogleCalendar()}
                    className={`px-4 py-2.5 rounded-2xl font-bold text-sm border transition-all flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-purple-600/50 hover:text-purple-300' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 shadow-sm'}`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    </svg>
                    Connect Calendar
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700 shadow-sm'}`}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>
                      Connected
                    </div>
                    <button
                      onClick={refreshGoogleCalendar}
                      className={`px-3 py-2 rounded-2xl text-sm border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      Refresh
                    </button>
                    <button
                      onClick={handleDisconnectGoogleCalendar}
                      className={`px-3 py-2 rounded-2xl text-sm border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-rose-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-rose-600 hover:bg-slate-50'}`}
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className={`flex-1 overflow-y-auto p-8 ${isDarkMode ? '' : ''}`}>
              {/* ... (Calendar Grid) ... */}
              <div className="grid grid-cols-7 gap-4 mb-6">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                  <div
                    key={d}
                    className={`text-center text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-4 auto-rows-[140px]">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className={`rounded-3xl ${isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}
                  ></div>
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const d = new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth(),
                    day
                  )
                  const dateStr = toLocalDateStr(d)
                  const dayEvents = events.filter(e => e.startDate === dateStr)
                  const isToday = toLocalDateStr(new Date()) === dateStr

                  return (
                    <div
                      key={day}
                      onClick={() => {
                        const d = new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth(),
                          day
                        )
                        setSelectedDate(d)
                        setShowEventModal(true)
                      }}
                      className={`p-4 rounded-3xl border transition-all cursor-pointer flex flex-col gap-2 group hover:scale-[1.02] ${
                        isToday
                          ? isDarkMode 
                            ? "bg-purple-900/30 border-purple-600/40 shadow-lg shadow-purple-500/10"
                            : "bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-md shadow-indigo-100/50"
                          : isDarkMode 
                            ? "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-purple-600/30 hover:shadow-lg hover:shadow-purple-500/10"
                            : "bg-white/80 border-slate-200/60 hover:bg-white hover:shadow-lg hover:border-indigo-200 hover:shadow-indigo-100/30"
                      }`}
                    >
                      <span
                        className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                          isToday
                            ? isDarkMode 
                              ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30"
                              : "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-300/50"
                            : isDarkMode 
                              ? "text-slate-300 group-hover:bg-slate-700 group-hover:text-purple-400"
                              : "text-slate-700 group-hover:bg-slate-100"
                        }`}
                      >
                        {day}
                      </span>
                      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5 mt-1">
                        {dayEvents.map(ev => (
                          <div
                            key={ev.id}
                            onClick={e => {
                              e.stopPropagation()
                            }}
                            className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold truncate flex items-center gap-1.5 transition-all ${
                              isDarkMode 
                                ? "bg-purple-900/50 text-purple-300 hover:bg-purple-800/50 border border-purple-700/30"
                                : "bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 hover:from-indigo-200 hover:to-purple-200"
                            }`}
                          >
                            <Calendar className="w-3 h-3 flex-shrink-0" />
                            {ev.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : activeView === "tasks" ? (
          <div className={`flex-1 flex flex-col overflow-auto ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/30' : 'bg-gradient-to-br from-slate-50 via-white to-indigo-50/30'}`}>
            {/* Tasks Header */}
            <div className={`sticky top-0 z-10 px-6 py-5 border-b backdrop-blur-xl ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200/60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${isDarkMode ? 'bg-gradient-to-br from-violet-600 to-purple-700' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                    <ClipboardList className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>My Tasks</h2>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {(tasksList || []).filter(t => (t.assigned_to || []).map(String).includes(String(currentUser?.id)) || String(t.created_by) === String(currentUser?.id)).length} total tasks
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isDarkMode ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {(tasksList || []).filter(t => t.status === 'completed' && ((t.assigned_to || []).map(String).includes(String(currentUser?.id)) || String(t.created_by) === String(currentUser?.id))).length} completed
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isDarkMode ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    {(tasksList || []).filter(t => t.status !== 'completed' && ((t.assigned_to || []).map(String).includes(String(currentUser?.id)) || String(t.created_by) === String(currentUser?.id))).length} pending
                  </div>
                </div>
              </div>
            </div>

            {/* Tasks Content */}
            <div className="flex-1 p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
                {/* Assigned to me */}
                <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200/60 shadow-sm'}`}>
                  <div className={`px-5 py-4 border-b flex items-center gap-3 ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-r from-violet-900/30 to-transparent' : 'border-slate-100 bg-gradient-to-r from-indigo-50/50 to-transparent'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-violet-900/50 text-violet-400' : 'bg-indigo-100 text-indigo-600'}`}>
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Assigned to me</h3>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {(tasksList || []).filter(t => (t.assigned_to || []).map(String).includes(String(currentUser?.id))).length} tasks
                      </p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto">
                    {(tasksList || []).filter(t => (t.assigned_to || []).map(String).includes(String(currentUser?.id))).length === 0 ? (
                      <div className={`text-center py-12 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                          <CheckCircle className="w-8 h-8" />
                        </div>
                        <p className="font-medium">No tasks assigned</p>
                        <p className="text-xs mt-1">You're all caught up!</p>
                      </div>
                    ) : (
                      (tasksList || []).filter(t => (t.assigned_to || []).map(String).includes(String(currentUser?.id))).map(t => (
                        <div 
                          key={t.id || t.timestamp} 
                          className={`p-4 rounded-2xl border transition-all hover:shadow-md ${
                            t.status === 'completed' 
                              ? isDarkMode ? 'bg-emerald-900/20 border-emerald-800/30' : 'bg-emerald-50/50 border-emerald-100' 
                              : isDarkMode ? 'bg-slate-700/30 border-slate-600/30 hover:border-violet-500/30' : 'bg-white border-slate-200 hover:border-indigo-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button 
                              onClick={async () => {
                                if (t.status === 'completed') return
                                const id = t.id || t.timestamp
                                setTasksList(prev => prev.map(p => (p === t ? {...p, status: 'completed'} : p)))
                                try {
                                  await TasksService.updateTask(id, { status: 'completed' })
                                } catch (e) {
                                  console.warn('task update failed', e)
                                }
                              }}
                              className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                t.status === 'completed'
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : isDarkMode ? 'border-slate-500 hover:border-violet-500 hover:bg-violet-500/20' : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50'
                              }`}
                            >
                              {t.status === 'completed' && <Check className="w-4 h-4" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className={`font-semibold ${t.status === 'completed' ? 'line-through opacity-60' : ''} ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                {t.message}
                              </div>
                              <div className="flex items-center gap-3 mt-2">
                                <span className={`text-xs flex items-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  <Clock className="w-3 h-3" />
                                  {t.timestamp}
                                </span>
                                {t.channel_id && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                    #{channels.find(c => c.id === t.channel_id)?.name || 'channel'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              t.status === 'completed' 
                                ? isDarkMode ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-700' 
                                : isDarkMode ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {t.status === 'completed' ? 'Done' : 'Pending'}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Created by me */}
                <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200/60 shadow-sm'}`}>
                  <div className={`px-5 py-4 border-b flex items-center gap-3 ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-r from-purple-900/30 to-transparent' : 'border-slate-100 bg-gradient-to-r from-purple-50/50 to-transparent'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                      <PenTool className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Created by me</h3>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {(tasksList || []).filter(t => String(t.created_by) === String(currentUser?.id)).length} tasks
                      </p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto">
                    {(tasksList || []).filter(t => String(t.created_by) === String(currentUser?.id)).length === 0 ? (
                      <div className={`text-center py-12 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                          <Plus className="w-8 h-8" />
                        </div>
                        <p className="font-medium">No tasks created</p>
                        <p className="text-xs mt-1">Create tasks by typing /task in chat</p>
                      </div>
                    ) : (
                      (tasksList || []).filter(t => String(t.created_by) === String(currentUser?.id)).map(t => (
                        <div 
                          key={t.id || t.timestamp} 
                          className={`p-4 rounded-2xl border transition-all hover:shadow-md ${
                            t.status === 'completed' 
                              ? isDarkMode ? 'bg-emerald-900/20 border-emerald-800/30' : 'bg-emerald-50/50 border-emerald-100' 
                              : isDarkMode ? 'bg-slate-700/30 border-slate-600/30 hover:border-purple-500/30' : 'bg-white border-slate-200 hover:border-purple-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                              t.status === 'completed'
                                ? 'bg-emerald-500 text-white'
                                : isDarkMode ? 'bg-slate-600 text-slate-400' : 'bg-slate-200 text-slate-500'
                            }`}>
                              {t.status === 'completed' ? <Check className="w-4 h-4" /> : <Clock className="w-3 h-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-semibold ${t.status === 'completed' ? 'line-through opacity-60' : ''} ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                {t.message}
                              </div>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className={`text-xs flex items-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  <Clock className="w-3 h-3" />
                                  {t.timestamp}
                                </span>
                                {t.channel_id && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                    #{channels.find(c => c.id === t.channel_id)?.name || 'channel'}
                                  </span>
                                )}
                                {(t.assigned_to || []).length > 0 && (
                                  <span className={`text-xs flex items-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    <Users className="w-3 h-3" />
                                    {(t.assigned_to || []).length} assignee{(t.assigned_to || []).length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              t.status === 'completed' 
                                ? isDarkMode ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-700' 
                                : isDarkMode ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {t.status === 'completed' ? 'Done' : 'Pending'}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW: CHANNEL / DM */
          <>
            {/* Header - Desktop with Liquid Glass */}
            <div className={`liquid-glass-navbar h-[90px] sticky top-0 z-30 ${isMobile ? 'hidden' : 'flex'} items-center justify-between px-4 sm:px-6 md:px-8 lg:px-10 mx-0 w-full mt-3 rounded-2xl`}>
              {/* Liquid Glass Channel Info Container */}
              <div
                onClick={() => setShowMemberDetails(prev => !prev)}
                className={`liquid-glass-header flex items-center gap-5 cursor-pointer group py-3 px-5 transition-all ease-in-out duration-300 hover:scale-[1.01]`}
              >
                {activeView === "dm" ? (
                  <div className="flex items-center gap-5 relative z-10">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg border-2 ${isDarkMode ? 'bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border-purple-700/50' : 'bg-gradient-to-br from-indigo-100 to-purple-100 border-white'} text-slate-700 overflow-hidden`}>
                        {renderAvatar(getUser(activeDMUser), 48)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[3px] ${isDarkMode ? 'border-[var(--bg-secondary)]' : 'border-white'} shadow-md ${
                          getUser(activeDMUser)?.status === "online"
                            ? "bg-emerald-500"
                            : "bg-slate-400"
                        }`}
                      ></span>
                    </div>
                    <div>
                      <h2 className={`font-bold text-2xl leading-tight tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {getActiveViewName()}
                      </h2>
                      <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 mt-0.5 ${getUser(activeDMUser)?.status === "online" ? "text-emerald-600" : isDarkMode ? 'text-slate-500' : "text-slate-400"}`}>
                        <span className={`w-2 h-2 rounded-full ${getUser(activeDMUser)?.status === "online" ? "bg-emerald-500 animate-pulse shadow-sm shadow-emerald-300" : "bg-slate-400"}`}></span>{" "}
                        {getUser(activeDMUser)?.status === "online" ? "Online" : "Offline"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-5 relative z-10">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-gradient-to-br from-slate-800/80 to-slate-700/80 text-slate-300 border-2 border-slate-600/50 group-hover:from-purple-900/50 group-hover:to-indigo-900/50 group-hover:border-purple-600/50 group-hover:text-purple-400' : 'bg-gradient-to-br from-white/80 to-slate-50/80 text-slate-600 border-2 border-white/50 shadow-sm group-hover:shadow-md group-hover:from-indigo-50 group-hover:to-purple-50 group-hover:border-indigo-200 group-hover:text-indigo-600'}`}>
                      <Hash className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className={`font-bold text-2xl leading-tight tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'} flex items-center gap-2.5`}>
                        {/* Header Breadcrumb Context */}
                        <span className={`font-semibold max-w-[18vw] md:max-w-[28vw] lg:max-w-[32vw] xl:max-w-[36vw] 2xl:max-w-[40vw] truncate block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} title={getCurrentSpace()?.name}>
                          {getCurrentSpace()?.name}
                        </span>
                        <ChevronRight className={`w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                        <span className="truncate max-w-[18vw] md:max-w-[24vw] lg:max-w-[28vw] xl:max-w-[32vw] 2xl:max-w-[36vw] block" title={getActiveViewName().replace('#','')}>
                          {getActiveViewName().replace("#", "")}
                        </span>
                      </h2>
                      <div className={`flex items-center gap-3 text-xs font-medium mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className={`flex items-center gap-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          <Users className="w-3.5 h-3.5" /> {activeMembers.length}{" "}
                          members
                        </span>
                        <span className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDarkMode ? 'text-purple-400' : 'text-indigo-500'}`}>
                          • View details
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons with Liquid Glass */}
              <div className="flex items-center gap-3">
                {/* Docs Icon */}
                <div className="relative">
                  <button
                    onClick={handleDocsClick}
                    className={`liquid-glass-nav-item p-3.5 transition-all relative group`}
                    title="Documents"
                  >
                    <FileText className={`w-5 h-5 group-hover:scale-110 transition-transform ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} />
                    {googleAccessToken && (
                      <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white shadow-md animate-pulse"></span>
                    )}
                  </button>
                </div>

                {/* Google Apps Grid Icon */}
                <div className="relative">
                  <button
                    onClick={() => setShowGoogleAppsMenu(!showGoogleAppsMenu)}
                    className={`liquid-glass-nav-item p-3.5 transition-all group`}
                    title="Google Apps"
                  >
                    <Grid3x3 className={`w-5 h-5 group-hover:scale-110 transition-transform ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} />
                  </button>

                  {showGoogleAppsMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowGoogleAppsMenu(false)}
                      ></div>
                      <div className={`absolute right-0 top-full mt-3 w-96 rounded-3xl shadow-2xl p-8 animate-fade-in origin-top-right z-50 ${isDarkMode ? 'bg-slate-800/95 ring-1 ring-purple-500/30 border border-slate-700' : 'bg-white/95 ring-1 ring-slate-200 border border-slate-100'} backdrop-blur-xl`}>
                        <h3 className={`text-xl font-bold mb-6 flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-gradient-to-br from-purple-600 to-violet-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                            <Grid3x3 className="w-5 h-5 text-white" />
                          </div>
                          Google Apps
                        </h3>
                        <div className="grid grid-cols-4 gap-3">
                          {GoogleService.GOOGLE_APPS.map((app) => (
                            <a
                              key={app.name}
                              href={app.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl transition-all group border border-transparent ${isDarkMode ? 'hover:bg-slate-700/50 hover:border-slate-600' : 'hover:bg-slate-50 hover:border-slate-200 hover:shadow-md'}`}
                              onClick={() => setShowGoogleAppsMenu(false)}
                            >
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${app.color} group-hover:scale-110 transition-all duration-300 shadow-sm group-hover:shadow-md`}>
                                <img 
                                  src={app.icon} 
                                  alt={app.name} 
                                  className="w-8 h-8 object-contain"
                                  onError={(e) => {
                                    e.target.style.display = 'none'
                                    e.target.parentElement.innerHTML = '<span class="text-2xl">' + (app.name.charAt(0)) + '</span>'
                                  }}
                                />
                              </div>
                              <span className={`text-xs font-semibold text-center ${isDarkMode ? 'text-slate-300 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{app.name}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Video Call Icon */}
                {VIDEO_ENABLED && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (activeView === 'dm' && activeDMUser) {
                          // Start WebRTC call for DMs
                          const partner = getUser(activeDMUser)
                          if (partner) {
                            startWebRTCCall(partner)
                          }
                        } else if (activeView === 'channel') {
                          // For channels, directly create Meet link and send to channel
                          createMeetCall({ callEveryone: true })
                        } else {
                          // Show video modal for other cases
                          setSelectedCallMembers([])
                          setShowVideoModal(true)
                        }
                      }}
                      className={`liquid-glass-nav-item p-3.5 transition-all group`}
                      title={activeView === 'dm' ? 'Start video call' : 'Start group call'}
                    >
                      <Video className={`w-5 h-5 group-hover:scale-110 transition-transform ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} />
                    </button>
                    {/* In Call Indicator */}
                    {showWebRTCCall && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white shadow-lg shadow-red-500/50"></span>
                    )}
                  </div>
                )}

                {activeView === "channel" && (() => {
                  const role = getChannelRole(currentUser?.id)
                  const canInvite = role === 'owner' || role === 'admin'
                  return (
                    <button
                      title="Invite Members"
                      aria-label="Invite Members"
                      onClick={() => {
                        if (!canInvite) return
                        setInviteSearchQuery("")
                        setSelectedInviteUsers([])
                        setShowAddToSpaceModal(true)
                      }}
                      disabled={!canInvite}
                      className={`hidden md:flex items-center gap-2.5 px-6 py-3.5 text-xs font-extrabold uppercase tracking-wide rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95 ${canInvite ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 shadow-purple-300/40 hover:shadow-purple-400/50 hover:scale-[1.02]' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'}`}
                    >
                      <UserPlus className="w-4 h-4" />
                      
                    </button>
                  )
                })()}

                <div className={`h-10 w-px mx-2 bg-gradient-to-b ${isDarkMode ? 'from-transparent via-slate-600 to-transparent' : 'from-transparent via-slate-200 to-transparent'}`}></div>

                {/* Theme Toggle Button */}
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`liquid-glass-nav-item relative p-3 transition-all duration-500 group overflow-hidden`}
                  title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  <div className={`relative z-10 transition-transform duration-500 group-hover:rotate-12 ${isDarkMode ? 'text-yellow-400' : 'text-slate-600'}`}>
                    {isDarkMode ? (
                      <Sun className="w-5 h-5" />
                    ) : (
                      <Moon className="w-5 h-5" />
                    )}
                  </div>
                  <div className={`absolute inset-0 transition-opacity duration-500 ${isDarkMode ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 animate-gradient"></div>
                  </div>
                </button>

                {/* User Menu */}
                {/* ... (User Menu) ... */}
                <div className="relative z-50">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`liquid-glass-header flex items-center gap-4 pl-4 pr-3 py-2.5 transition-all ${showUserMenu ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}
                  >
                    {/* Only show name if at least one sidebar is collapsed */}
                    {!(sidebarCollapsed === false && friendsSidebarCollapsed === false) && (
                      <div className="text-right hidden sm:block relative z-10">
                        <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {currentUser?.name}
                        </div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          Available
                        </div>
                      </div>
                    )}
                    <div className="relative z-10">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shadow-md border-2 ${isDarkMode ? 'bg-slate-700 border-slate-600 ring-2 ring-slate-700' : 'bg-white border-white ring-2 ring-slate-100'} overflow-hidden`}>
                        {renderAvatar(currentUser, 44)}
                      </div>
                      {currentUser?.notifications?.length ? (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-gradient-to-br from-red-500 to-rose-600 border-[3px] border-white shadow-lg"></span>
                        </span>
                      ) : null}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 relative z-10 transition-transform duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} ${
                        showUserMenu ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showUserMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowUserMenu(false)}
                      ></div>
                      <div className={`absolute right-0 top-full mt-3 w-72 rounded-3xl shadow-2xl py-2 animate-fade-in origin-top-right ring-1 ${isDarkMode ? 'bg-slate-800/95 border-purple-600/30 ring-purple-500/10 shadow-purple-500/20' : 'bg-white/95 border-slate-100 ring-black/5'} backdrop-blur-xl border z-50`}>
                        <div className={`px-5 py-4 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                          <div className="flex items-center gap-3">
                            <span className={`text-3xl p-2 rounded-full shadow-sm ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-100'} border`}>
                              {renderAvatar(currentUser, 36)}
                            </span>
                            <div className="overflow-hidden">
                              <div className={`font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                {currentUser?.name}
                              </div>
                              <div className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {currentUser?.email}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-2 space-y-1">
                          <button
                            onClick={() => {
                              // prepare modal
                              setSelectedPreset(currentUser?.avatar_preset || null)
                              setAvatarPreview(currentUser?.avatar_url || null)
                              setShowProfileModal(true)
                              setShowUserMenu(false)
                            }}
                            className="w-full text-left px-4 py-3 text-sm rounded-2xl flex items-center justify-between transition-colors font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <div className="flex items-center gap-3">
                              <UserPlus className="w-4 h-4" /> Edit Profile
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              setShowNotificationsModal(true)
                              setShowUserMenu(false)
                            }}
                            className="w-full text-left px-4 py-3 text-sm rounded-2xl flex items-center justify-between transition-colors font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <div className="flex items-center gap-3">
                              <Bell className="w-4 h-4" /> Notifications
                            </div>
                            {currentUser?.notifications?.length ? (
                              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/30">
                                {currentUser?.notifications?.length || 0}
                              </span>
                            ) : null}
                          </button>
                          <div className="h-px my-1 mx-2 bg-slate-100"></div>
                          <button
                            onClick={() => {
                              handleLogout()
                              setShowUserMenu(false)
                            }}
                            className="w-full text-left px-4 py-3 text-sm rounded-2xl flex items-center gap-3 transition-colors font-medium text-red-600 hover:bg-red-50"
                          >
                            <LogIn className="w-4 h-4" /> Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Header - Mobile */}
            {isMobile && (
              <div className={`h-[70px] fixed top-0 left-0 right-0 z-[60] flex items-center justify-between gap-2 px-3 border-b backdrop-blur-xl shadow-sm safe-area-top ${
                isDarkMode 
                  ? 'bg-slate-900/95 border-slate-700/60 shadow-slate-950/30' 
                  : 'bg-white/95 border-slate-200/60 shadow-slate-100/50'
              }`}>
                {/* Left: Profile & Context */}
                <div 
                  onClick={() => setShowMemberDetails(prev => !prev)}
                  className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer touch-active"
                >
                  {activeView === "dm" ? (
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-base shadow-md border-2 overflow-hidden ${
                          isDarkMode 
                            ? 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600' 
                            : 'bg-gradient-to-br from-indigo-100 to-purple-100 border-white'
                        }`}>
                          {renderAvatar(getUser(activeDMUser), 44)}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 shadow-sm ${
                            getUser(activeDMUser)?.status === "online"
                              ? "bg-emerald-500 shadow-emerald-300/50"
                              : "bg-slate-400"
                          } ${isDarkMode ? 'border-slate-900' : 'border-white'}`}
                        ></span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className={`font-bold text-[15px] leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {getActiveViewName()}
                        </h2>
                        <p className={`text-[11px] font-semibold flex items-center gap-1.5 ${getUser(activeDMUser)?.status === "online" ? "text-emerald-500" : isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                          <span className={`w-2 h-2 rounded-full ${getUser(activeDMUser)?.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                          {getUser(activeDMUser)?.status === "online" ? "Online" : "Offline"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${
                        isDarkMode 
                          ? 'bg-gradient-to-br from-slate-700 to-slate-800 text-slate-300 border border-slate-600' 
                          : 'bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 border border-slate-200/50'
                      }`}>
                        <Hash className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className={`font-bold text-[15px] leading-tight flex items-center gap-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          <span className={`font-medium text-xs truncate max-w-[70px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{getCurrentSpace()?.name}</span>
                          <ChevronRight className={`w-3 h-3 flex-shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                          <span className="truncate max-w-[100px]">{getActiveViewName().replace("#", "")}</span>
                        </h2>
                        <p className={`text-[11px] font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Users className="w-3 h-3" /> {activeMembers.length} members
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Action Icons & Menu */}
                <div className="flex items-center gap-1 flex-shrink-0 relative z-10">
                  {/* Docs Icon */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDocsClick(); }}
                    className={`p-2.5 rounded-xl transition-all relative touch-active ${
                      isDarkMode 
                        ? 'bg-slate-800 text-slate-400 active:bg-slate-700' 
                        : 'bg-slate-50 text-slate-500 active:bg-indigo-50'
                    }`}
                    title="Documents"
                  >
                    <FileText className="w-5 h-5" />
                    {googleAccessToken && (
                      <span className={`absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full border ${isDarkMode ? 'border-slate-800' : 'border-white'}`}></span>
                    )}
                  </button>

                  {/* Video Call Icon */}
                  {VIDEO_ENABLED && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeView === 'dm' && activeDMUser) {
                            // Start WebRTC call for DMs
                            const partner = getUser(activeDMUser)
                            if (partner) {
                              startWebRTCCall(partner)
                            }
                          } else if (activeView === 'channel') {
                            // For channels, directly create Meet link and send to channel
                            createMeetCall({ callEveryone: true })
                          } else {
                            // Show video modal for other cases
                            setSelectedCallMembers([])
                            setShowVideoModal(true)
                          }
                        }}
                        className={`p-2.5 rounded-xl transition-all touch-active ${
                          isDarkMode 
                            ? 'bg-slate-800 text-slate-400 active:bg-slate-700' 
                            : 'bg-slate-50 text-slate-500 active:bg-indigo-50'
                        }`}
                        title={activeView === 'dm' ? 'Start video call' : 'Start group call'}
                      >
                        <Video className="w-5 h-5" />
                      </button>
                      {/* In Call Indicator */}
                      {showWebRTCCall && (
                        <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 shadow-sm ${isDarkMode ? 'border-slate-900' : 'border-white'}`}></span>
                      )}
                    </div>
                  )}

                  {/* Invite Members (Channel only) */}
                  {activeView === "channel" && (() => {
                    const role = getChannelRole(currentUser?.id)
                    const canInvite = role === 'owner' || role === 'admin'
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canInvite) return
                          setInviteSearchQuery("")
                          setSelectedInviteUsers([])
                          setShowAddToSpaceModal(true)
                        }}
                        disabled={!canInvite}
                        className={`p-2.5 rounded-xl transition-all shadow-md touch-active ${canInvite ? (isDarkMode ? 'text-white bg-gradient-to-r from-violet-600 to-purple-600 shadow-violet-500/30 active:from-violet-500 active:to-purple-500' : 'text-white bg-gradient-to-r from-indigo-500 to-purple-500 shadow-indigo-200/50 active:from-indigo-600 active:to-purple-600') : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'}`}
                        title="Invite Members"
                      >
                        <UserPlus className="w-5 h-5" />
                      </button>
                    )
                  })()}

                  {/* Mobile Menu Button with Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMobileDrawer(prev => !prev); }}
                      className={`p-2.5 rounded-xl transition-all touch-active ${
                        isDarkMode 
                          ? 'bg-slate-800 text-slate-400 active:bg-slate-700' 
                          : 'bg-slate-50 text-slate-500 active:bg-indigo-50'
                      }`}
                      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                      title="Menu"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                    
                    {/* Quick Menu Dropdown */}
                    {showMobileDrawer && (
                      <>
                        <div 
                          className="fixed inset-0 z-[99]"
                          onClick={() => setShowMobileDrawer(false)}
                        />
                        <div className={`absolute right-0 top-full mt-2 w-48 rounded-2xl shadow-xl border z-[100] animate-fade-in overflow-hidden ${
                          isDarkMode 
                            ? 'bg-slate-800 border-slate-700' 
                            : 'bg-white border-slate-200'
                        }`}>
                          {/* Profile */}
                          <button
                            onClick={() => {
                              setSelectedPreset(currentUser?.avatar_preset || null)
                              setAvatarPreview(currentUser?.avatar_url || null)
                              setShowProfileModal(true)
                              setShowMobileDrawer(false)
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${
                              isDarkMode 
                                ? 'text-slate-300 hover:bg-slate-700 active:bg-slate-600' 
                                : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                              {renderAvatar(currentUser, 32)}
                            </div>
                            Profile
                          </button>
                          
                          {/* Google Apps */}
                          <button
                            onClick={() => {
                              setShowGoogleAppsMenu(true)
                              setShowMobileDrawer(false)
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-t ${
                              isDarkMode 
                                ? 'text-slate-300 hover:bg-slate-700 active:bg-slate-600 border-slate-700' 
                                : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-slate-100'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-violet-400' : 'bg-slate-100 text-slate-500'}`}>
                              <Grid3x3 className="w-4 h-4" />
                            </div>
                            Google Apps
                          </button>
                          
                          {/* Theme Toggle */}
                          <button
                            onClick={() => {
                              setIsDarkMode(!isDarkMode)
                              setShowMobileDrawer(false)
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-t ${
                              isDarkMode 
                                ? 'text-slate-300 hover:bg-slate-700 active:bg-slate-600 border-slate-700' 
                                : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-slate-100'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-yellow-400' : 'bg-slate-100 text-slate-500'}`}>
                              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </div>
                            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                          </button>
                          
                          {/* Notifications */}
                          <button
                            onClick={() => {
                              setShowNotificationsModal(true)
                              setShowMobileDrawer(false)
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-t ${
                              isDarkMode 
                                ? 'text-slate-300 hover:bg-slate-700 active:bg-slate-600 border-slate-700' 
                                : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-slate-100'
                            }`}
                          >
                            <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-amber-400' : 'bg-slate-100 text-slate-500'}`}>
                              <Bell className="w-4 h-4" />
                              {currentUser?.notifications?.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                  {currentUser?.notifications?.length}
                                </span>
                              )}
                            </div>
                            Notifications
                          </button>
                          
                          {/* Sign Out */}
                          <button
                            onClick={() => {
                              handleLogout()
                              setShowMobileDrawer(false)
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-t ${
                              isDarkMode 
                                ? 'text-red-400 hover:bg-red-900/30 active:bg-red-900/50 border-slate-700' 
                                : 'text-red-600 hover:bg-red-50 active:bg-red-100 border-slate-100'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-500'}`}>
                              <LogOut className="w-4 h-4" />
                            </div>
                            Sign Out
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Messages / Chat Area */}
            {/* ... (Chat Area Code) ... */}
            <div className={`flex-1 flex overflow-hidden liquid-glass-chat-area relative ${isMobile ? 'mt-[70px]' : ''}`}>
              <div className={`flex-1 flex flex-col min-w-0 ${activeView === 'dm' ? (isDarkMode ? 'dm-chat-background-dark' : 'dm-chat-background') : (isDarkMode ? 'channel-chat-background-dark' : 'channel-chat-background')}`}>
                {/* Updated Container with Custom Pattern Background */}
                {/* day label computed above via `messageDateLabel` */}

                <div
                  ref={messagesContainerRef}
                  onScroll={() => {
                    const el = messagesContainerRef.current
                    if (!el) return
                    const threshold = (messageInputRef.current?.offsetHeight || 64) + 16
                    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
                    setIsAtBottom(atBottom)
                    // keep track of latest scrollHeight for preserving position when new messages arrive
                    prevScrollHeightRef.current = el.scrollHeight
                    // Update the visible date label based on the message near the vertical center
                    try {
                      const mid = el.scrollTop + el.clientHeight / 2
                      const nodes = el.querySelectorAll('[id^="msg-"]')
                      let foundTs = null
                      for (let i = 0; i < nodes.length; i++) {
                        const n = nodes[i]
                        if (n.offsetTop <= mid) {
                          foundTs = n.dataset.timestamp || null
                        } else break
                      }
                      if (foundTs) {
                        const label = formatDateLabel(foundTs, timeTicker)
                        setVisibleDateLabel(label)
                      }
                    } catch (e) {}
                  }}
                  className={`flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 scrollbar-thin relative`}
                >
                  {/* ... (Existing Message Rendering) ... */}
                      {getCurrentMessages().length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <div className={`p-10 rounded-[2.5rem] text-center max-w-sm backdrop-blur-sm border ${isDarkMode ? 'bg-slate-800/80 border-purple-600/20 shadow-lg shadow-purple-500/5' : 'bg-white/70 border-slate-200/50 shadow-xl shadow-indigo-100/30'}`}>
                        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-[2rem] mb-6 relative shadow-lg transform rotate-3 hover:rotate-6 transition-transform ${isDarkMode ? 'bg-purple-900/50 text-purple-400' : 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600'}`}>
                          <MessageCircle className="w-12 h-12" />
                          <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-4 animate-bounce bg-yellow-400 ${isDarkMode ? 'border-slate-800' : 'border-white'}`}></div>
                        </div>
                        <h3 className={`text-2xl font-extrabold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
                          Say Hello!
                        </h3>
                        <p className={`text-sm leading-relaxed mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          This is the start of something epic in{" "}
                          <span className={`font-bold ${isDarkMode ? 'text-purple-400' : 'text-indigo-600'}`}>
                            {getActiveViewName()}
                          </span>
                          . Send a message to break the ice.
                        </p>
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-purple-900/30 border-purple-600/30 text-purple-300' : 'bg-indigo-50/80 border-indigo-100/60 text-indigo-600'}`}>
                          <Lock className="w-3 h-3" /> End-to-End Encrypted
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {pinnedMessageId && (
                        <div className={`sticky top-0 z-20 mb-4 flex items-center justify-between gap-4 rounded-xl px-4 py-3 border shadow-sm ${isDarkMode ? 'bg-slate-800/90 border-purple-600/30' : 'bg-white/90 border-slate-100'}`}>
                          <div className="flex items-center gap-3">
                            <Sparkles className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-indigo-500'}`} />
                            <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : ''}`}>Pinned Search Result</div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Reviewing highlighted message</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                                setPinnedMessageId(null)
                                setHighlightTerm("")
                              }}
                              className="px-3 py-1 rounded-full text-sm bg-indigo-50 text-indigo-600 font-semibold"
                            >
                              Back to Latest
                            </button>
                            <button
                              onClick={() => {
                                setPinnedMessageId(null)
                                setHighlightTerm("")
                              }}
                              className="px-3 py-1 rounded-full text-sm bg-white border border-slate-100"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="sticky top-0 z-10 flex justify-center mb-6 pointer-events-none">
                        <span className="text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg backdrop-blur-xl bg-white/90 text-slate-500 border border-slate-100">
                          {visibleDateLabel || messageDateLabel || 'Today'}
                        </span>
                      </div>

                      {getCurrentMessages().map((msg, idx) => {
                        const user = getUser(msg.userId)
                        const isMe = user?.id === currentUser?.id
                        const prevMsg =
                          idx > 0 ? getCurrentMessages()[idx - 1] : null
                        // Date separator logic
                        const msgDayLabel = formatDateLabel(msg.timestamp, timeTicker)
                        const prevDayLabel = prevMsg ? formatDateLabel(prevMsg.timestamp, timeTicker) : null
                        const showDateSeparator = idx === 0 || msgDayLabel !== prevDayLabel
                        const isSequence =
                          prevMsg && prevMsg.userId === msg.userId
                        const messageStatus = msg.status || "sent"
                        const statusLabel = (() => {
                          if (!isMe) return null
                          if (messageStatus === "failed") {
                            return (
                              <button
                                onClick={() => retryFailedMessage(getActiveChatId(), msg)}
                                className="flex items-center gap-1 text-[9px] text-rose-200 underline underline-offset-2"
                              >
                                <XCircle className="w-3 h-3" />
                                Retry send
                              </button>
                            )
                          }
                          if (messageStatus === "sending" || messageStatus === "retrying") {
                            return (
                              <span className="flex items-center gap-1 text-[9px] text-indigo-100">
                                <span className="w-3 h-3 rounded-full border border-white/40 border-t-transparent animate-spin"></span>
                                {messageStatus === "retrying" ? "Retrying" : "Sending"}
                              </span>
                            )
                          }
                          return (
                            <span className="flex items-center gap-1 text-[9px] text-indigo-100">
                              Sent
                              <Check className="w-3 h-3" />
                            </span>
                          )
                        })()

                        return (
                          <React.Fragment key={msg.id}>
                            {showDateSeparator && (
                              <div className="w-full flex justify-center mb-4">
                                <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                                  isDarkMode 
                                    ? 'bg-slate-800/90 border-slate-700 text-slate-400' 
                                    : 'bg-white/90 border-slate-100 text-slate-500'
                                }`}>
                                  {msgDayLabel}
                                </span>
                              </div>
                            )}
                            <div
                              id={`msg-${msg.id}`}
                              data-timestamp={msg.timestamp || ''}
                              className={`flex gap-4 ${
                                isMe ? "flex-row-reverse" : ""
                              } ${
                                isSequence ? "mt-1" : "mt-6"
                              } group animate-fade-in`}
                            >
                            {/* Avatar only for first in sequence */}
                            <div className="flex-shrink-0 w-10 flex flex-col items-center">
                              {!isSequence ? (
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-lg border-2 ring-2 ${
                                    isMe
                                      ? isDarkMode 
                                        ? "bg-gradient-to-br from-violet-500/30 to-purple-500/30 border-violet-500/50 ring-slate-800/50" 
                                        : "bg-gradient-to-br from-indigo-100 to-purple-100 border-white ring-white/50"
                                      : isDarkMode 
                                        ? "bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600 ring-slate-800/50 text-sm" 
                                        : "bg-gradient-to-br from-white to-slate-50 border-white ring-white/50 text-sm"
                                  } ${isMe ? isDarkMode ? "text-violet-300" : "text-indigo-600" : ""}`}
                                >
                                  {renderAvatar(user, 36)}
                                </div>
                              ) : (
                                <div className="w-10" />
                              )}
                            </div>

                            <div
                              className={`flex flex-col max-w-[70%] ${
                                isMe ? "items-end" : "items-start"
                              }`}
                            >
                              {/* Name only for first in sequence */}
                              {!isSequence && !isMe && (
                                <div className="ml-1 mb-1.5 flex items-baseline gap-2">
                                  <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {user?.name}
                                  </span>
                                  <span className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {msg.timestamp
                                      ? formatTime(msg.timestamp)
                                      : "now"}
                                  </span>
                                </div>
                              )}

                              <div
                              onMouseEnter={() => setHoveredMessageId(msg.id)}
                              onMouseLeave={() => setHoveredMessageId(null)}
                              onTouchStart={() => {
                                longPressTimerRef.current = setTimeout(() => setShowEmojiPickerFor(msg.id), 600)
                              }}
                              onTouchEnd={() => {
                                clearTimeout(longPressTimerRef.current)
                              }}
                              className={`relative px-5 py-3.5 text-[15px] leading-relaxed break-words transition-all duration-200 hover:scale-[1.01] ${
                                  isMe
                                    ? "liquid-glass-message-own text-white rounded-2xl rounded-tr-sm" 
                                    : isDarkMode 
                                      ? "liquid-glass-message text-slate-100 rounded-2xl rounded-tl-sm" 
                                      : "liquid-glass-message text-slate-800 rounded-2xl rounded-tl-sm"
                                } ${pinnedMessageId === msg.id ? isDarkMode ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-900 animate-pulse-soft' : 'ring-2 ring-indigo-400 ring-offset-2 animate-pulse-soft' : ''}`}
                              >
                                {/* Meet Invite Message */}
                                {msg.type === 'meet-invite' && msg.meetLink && (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                                        <Video className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                      </div>
                                      <span className="font-bold">Video Call Started</span>
                                    </div>
                                    <p className={`text-sm ${isMe ? 'text-white/90' : isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                      {msg.meetTitle || 'Join the video meeting'}
                                    </p>
                                    <a
                                      href={msg.meetLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105 ${
                                        isDarkMode 
                                          ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30' 
                                          : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                                      }`}
                                    >
                                      <Video className="w-4 h-4" />
                                      Join Meeting
                                    </a>
                                  </div>
                                )}

                                {/* Task Message */}
                                {msg.type === 'task' && (
                                  <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-yellow-700/20' : 'bg-yellow-50'}`}>
                                      <FileText className={`w-5 h-5 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`} />
                                    </div>
                                    <div>
                                      <div className={`font-bold ${isMe ? 'text-white' : isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{msg.text || (msg.task && msg.task.message)}</div>
                                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{msg.timestamp}</div>
                                    </div>
                                  </div>
                                )}
                                
                                {msg.text && msg.type !== 'meet-invite' && (
                                  <div>
                                    {renderWithHighlight(
                                      msg.text,
                                      highlightTerm
                                    )}
                                  </div>
                                )}

                                {/* Reactions row */}
                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                  <div className="mt-2 flex items-center gap-2">
                                    {Object.entries(msg.reactions).map(([emoji, uids]) => (
                                      <button
                                        key={emoji}
                                        title={uids.map(id => getUser(id)?.name || '').join(', ')}
                                        onClick={() => toggleReaction(getActiveChatId(), msg.id, emoji)}
                                        className={`px-2 py-1 rounded-full text-sm flex items-center gap-2 ${
                                          isDarkMode ? 'bg-slate-700' : 'bg-slate-100'
                                        }`}
                                      >
                                        <span className="text-lg">{emoji}</span>
                                        <span className={`ml-1 text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{uids.length}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Emoji picker - hover or explicit open */}
                                {(hoveredMessageId === msg.id || showEmojiPickerFor === msg.id) && (
                                  <div
                                    className={`absolute flex gap-1 p-2 rounded-xl shadow-lg z-20 animate-fade-in ${
                                      isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'
                                    }`}
                                    style={{ left: '50%', top: '-48px', transform: 'translateX(-50%)' }}
                                  >
                                    {EMOJIS.map(e => (
                                      <button
                                        key={e}
                                        onClick={() => { toggleReaction(getActiveChatId(), msg.id, e); setShowEmojiPickerFor(null) }}
                                        className={`p-1 text-lg rounded transition-colors ${
                                          isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
                                        }`}
                                      >
                                        {e}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div
                                    className={`flex flex-wrap gap-2 ${
                                      msg.text ? "mt-3" : ""
                                    }`}
                                  >
                                    {msg.attachments.map(att => (
                                      <div
                                        key={att.id}
                                        onClick={() => openAttachment(att)}
                                        style={{ cursor: (att.url || att.previewUrl || att.source === 'gmail') ? "pointer" : "default" }}
                                        className={`relative rounded-xl overflow-hidden transition-transform hover:scale-[1.02] ${
                                          att.source === 'gmail'
                                            ? "bg-red-50 border border-red-100"
                                            : ((att.url && String(att.url).includes('drive.google.com')) || att.drive_file_id)
                                              ? "bg-blue-50 border border-blue-100"
                                              : "bg-black/5"
                                        }`}
                                      >
                                        {/* Download overlay */}
                                        {(att.url || att.previewUrl || att.source === 'gmail') && (
                                          <button
                                            onClick={e => {
                                              e.stopPropagation()
                                              downloadAttachment(att)
                                            }}
                                            className="absolute top-2 right-2 z-10 p-1 rounded-lg bg-white/90 border border-slate-100 hover:bg-white shadow-md text-slate-600"
                                          >
                                            Download
                                          </button>
                                        )}
                                        {/* Gmail Attachment */}
                                        {att.source === 'gmail' ? (
                                          <div className="p-3 flex items-center gap-3 rounded-xl min-w-[200px]">
                                            <div className="p-2 rounded-lg bg-white shadow-sm text-red-600">
                                              <Mail className="w-6 h-6" />
                                            </div>
                                            <div className="overflow-hidden flex-1">
                                              <span className="text-xs font-bold truncate block text-slate-800">
                                                {att.name}
                                              </span>
                                              <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-slate-500">
                                                  Gmail Attachment
                                                </span>
                                                <Download className="w-3 h-3 text-slate-400" />
                                              </div>
                                            </div>
                                          </div>
                                        ) : (((att.url && String(att.url).includes('drive.google.com')) || att.drive_file_id)) ? (
                                          <div className="p-3 flex items-center gap-3 rounded-xl min-w-[200px]">
                                            <div className="p-2 rounded-lg bg-white shadow-sm text-blue-600">
                                              <img
                                                src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg"
                                                className="w-6 h-6"
                                                alt="Drive"
                                              />
                                            </div>
                                            <div className="overflow-hidden flex-1">
                                              <span className="text-xs font-bold truncate block text-slate-800">
                                                {att.name}
                                              </span>
                                              <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-slate-500">
                                                  Google Drive
                                                </span>
                                                <ExternalLink className="w-3 h-3 text-slate-400" />
                                              </div>
                                            </div>
                                          </div>
                                        ) : (() => {
                                          // Construct server URL from fileId if url is not set
                                          let serverUrl = att.url || att.public_url || att.webViewLink
                                          // If the URL is a relative path (starts with /), make it absolute
                                          if (serverUrl && typeof serverUrl === 'string' && serverUrl.startsWith('/') && !serverUrl.startsWith('//')) {
                                            serverUrl = `${API_BASE}${serverUrl}`
                                          }
                                          if (!serverUrl && att.fileId) {
                                            serverUrl = `${API_BASE}/upload/file/${att.fileId}/download`
                                          } else if (!serverUrl && att.id && !String(att.id).startsWith('tmp-') && !String(att.id).startsWith('blob:')) {
                                            serverUrl = `${API_BASE}/upload/file/${att.id}/download`
                                          }
                                          // Use previewUrl only as fallback for sender's local preview
                                          const srcUrl = serverUrl || att.previewUrl
                                          const mime = att.type || att.mimeType || att.mimetype || ''
                                          if (mime && mime.startsWith && mime.startsWith('image/') && srcUrl) {
                                            return (
                                              <img
                                                src={srcUrl}
                                                alt={att.name}
                                                className="max-w-[240px] max-h-[240px] object-cover"
                                                onError={async (e) => {
                                                  try {
                                                    // Attempt to fetch protected URL and replace src
                                                    const blobUrl = await fetchProtectedUrlAndCreateObjectURL(att)
                                                    if (blobUrl) {
                                                      // Update message attachment preview so UI persists
                                                      updateMessageMeta(getActiveChatId(), msg.id, m => ({
                                                        ...m,
                                                        attachments: (m.attachments || []).map(a => (String(a.id) === String(att.id) ? { ...a, previewUrl: blobUrl } : a))
                                                      }))
                                                      // swap image src immediately
                                                      e.currentTarget.src = blobUrl
                                                    }
                                                  } catch (err) {
                                                    // ignore
                                                  }
                                                }}
                                              />
                                            )
                                          }
                                          if ((mime === 'application/pdf' || (srcUrl && String(srcUrl).toLowerCase().endsWith('.pdf'))) && srcUrl) {
                                            return (
                                              <div className="max-w-[320px] max-h-[260px] rounded-xl overflow-hidden border bg-white">
                                                <iframe
                                                  src={srcUrl}
                                                  title={att.name}
                                                  className="w-full h-60"
                                                  frameBorder="0"
                                                />
                                              </div>
                                            )
                                          }
                                          if (mime && mime.startsWith && mime.startsWith('video/') && srcUrl) {
                                            return (
                                              <video className="max-w-[320px] max-h-[260px] rounded-xl" controls>
                                                <source src={srcUrl} type={mime} />
                                                Your browser does not support the video tag.
                                              </video>
                                            )
                                          }

                                          return (
                                            <div className="p-3 flex items-center gap-3 rounded-xl min-w-[160px] bg-white/90">
                                              <div className="p-2 rounded-lg text-slate-500">
                                                <FileIcon className="w-5 h-5" />
                                              </div>
                                              <div className="overflow-hidden">
                                                <span className="text-xs font-bold truncate block text-slate-700">
                                                  {att.name}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                  {att.size ? ((att.size / 1024).toFixed(1) + " KB") : ""}
                                                </span>
                                              </div>
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              
                                {/* Timestamp for Me inside bubble, slightly cleaner */}
                                {isMe && (
                                  <div className="text-[9px] text-right mt-1 font-bold flex justify-end items-center gap-2 text-indigo-100 flex-wrap">
                                    <span>
                                      {msg.timestamp
                                        ? formatTime(msg.timestamp)
                                        : "now"}
                                    </span>
                                    {statusLabel}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          </React.Fragment>
                        )
                      })}
                    </>
                  )}
                  <div ref={messagesEndRef} />

                  {!isAtBottom && getCurrentMessages().length > 0 && (
                    <button
                      onClick={() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                        setIsAtBottom(true)
                        setPinnedMessageId(null)
                        setHighlightTerm("")
                      }}
                      style={{ bottom: `${(messageInputRef.current?.offsetHeight || 48) + 12}px`, right: '1.5rem' }}
                      className={`absolute z-30 p-3 rounded-full shadow-lg border transition-transform transition-opacity animate-fade-in hover:-translate-y-1 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-purple-400' : 'bg-white border-slate-100 hover:bg-indigo-50 text-indigo-600 shadow-slate-200/50'}`}
                      aria-label="Scroll to latest messages"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Message Input */}
                <div ref={messageInputRef} className={`p-6 pt-2 ${isMobile ? "pb-20" : ""}`}>
                  {/* ... (Input UI) ... */}
                  <div className={`liquid-glass-card rounded-[2rem] p-2 relative transition-all duration-300 focus-within:ring-2 ${isDarkMode ? 'focus-within:ring-purple-500/30' : 'focus-within:ring-indigo-500/20'}`}>
                    {/* Attachments Preview */}
                    {selectedFiles.length > 0 && (
                      <div className={`flex gap-3 p-3 mb-2 overflow-x-auto border-b ${isDarkMode ? 'border-slate-700/80' : 'border-slate-100/80'}`}>
                        {selectedFiles.map(file => (
                          <div
                            key={file.id}
                            className={`relative group border rounded-2xl p-2 flex items-center gap-3 flex-shrink-0 pr-8 transition-all duration-200 ${isDarkMode ? 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600 hover:border-purple-500/50 hover:shadow-md hover:shadow-purple-500/20' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200/80 hover:border-indigo-200 hover:shadow-md'}`}
                          >
                            {file.source === "drive" || file.source === "gmail" ? (
                              <img
                                src={file.iconLink || GoogleService.getAppIcon(GoogleService.getAppTypeFromMime(file.type)).iconUrl || "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png"}
                                className="w-6 h-6"
                                alt={file.source === "gmail" ? "Gmail" : "Drive"}
                              />
                            ) : file.type && file.type.startsWith("image/") && (file.previewUrl || file.url) ? (
                              <img
                                src={file.url || file.previewUrl}
                                className="w-10 h-10 rounded-xl object-cover"
                                alt=""
                              />
                            ) : (
                              <FileIcon className={`w-6 h-6 ${isDarkMode ? 'text-purple-400' : 'text-indigo-500'}`} />
                            )}
                            <span className={`text-xs font-bold max-w-[100px] truncate ${isDarkMode ? 'text-slate-200' : ''}`}>
                              {file.name}
                            </span>
                            <button
                              onClick={() => removeAttachment(file.id)}
                              className={`absolute -top-2 -right-2 rounded-full p-1 shadow-md hover:scale-110 transition-transform ${isDarkMode ? 'bg-slate-700 border-slate-600 hover:text-red-400' : 'bg-white border-slate-200 hover:text-red-500'} border`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-end gap-2 px-2 pb-1 relative">
                      <div className="relative">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className={`p-3 mb-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-purple-400' : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setShowEmojiPickerFor('input')}
                          className={`p-3 mb-1 ml-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-purple-400' : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                        >
                          <span className="text-lg">😀</span>
                        </button>

                        <button
                          onClick={() => setShowTaskModal(true)}
                          title="Create Task"
                          className={`p-3 mb-1 ml-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-purple-400' : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                        >
                          <ClipboardList className={`w-5 h-5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                        </button>

                        {showEmojiPickerFor === 'input' && (
                          <div className={`absolute left-0 top-12 flex gap-1 p-2 rounded-xl shadow-lg z-30 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
                            {EMOJIS.map(e => (
                              <button
                                key={e}
                                className="p-1 text-lg"
                                onClick={() => {
                                  setMessageInput(prev => prev + e)
                                  setShowEmojiPickerFor(null)
                                }}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                      />

                      <textarea
                        rows={1}
                        placeholder={`Message ${getActiveViewName()}`}
                        value={messageInput}
                        onChange={e => setMessageInput(e.target.value)}
                        onKeyPress={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        className={`flex-1 bg-transparent border-none focus:ring-0 py-3.5 max-h-32 resize-none leading-relaxed font-medium ${isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
                        style={{ minHeight: "48px" }}
                      />

                      <button
                        onClick={sendMessage}
                        disabled={
                          (!messageInput.trim() &&
                            selectedFiles.length === 0) ||
                          isUploading
                        }
                        className={`p-3.5 mb-1 rounded-2xl shadow-lg transition-all duration-300 active:scale-90 transform ${isDarkMode ? 'bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/30 hover:shadow-purple-400/50' : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-300/50 hover:shadow-indigo-400/60'} disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white hover:scale-105`}
                      >
                        <Send className="w-5 h-5 ml-0.5" />
                      </button>
                    </div>
                  </div>
                  <div className={`text-center mt-3 text-[10px] font-bold uppercase tracking-widest opacity-50 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Press <strong>Enter</strong> to send
                  </div>
                </div>
              </div>

              {/* Member Details Sidebar - Added Logic for Add Friend */}
              <div
                className={`absolute right-0 top-0 bottom-0 border-l transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col z-40 ${isDarkMode ? 'border-[var(--border-light)] bg-[var(--bg-secondary)]/95 shadow-2xl shadow-purple-900/20' : 'border-slate-200/60 bg-white/95 shadow-2xl shadow-slate-300/30'} backdrop-blur-xl ${
                  showMemberDetails
                    ? "w-96 translate-x-0 opacity-100"
                      : "w-96 translate-x-full opacity-0 pointer-events-none"
                }`}
              >
                <div className={`h-[80px] flex items-center justify-between px-6 border-b ${isDarkMode ? 'border-[var(--border-light)] bg-gradient-to-r from-slate-800/80 to-purple-900/30' : 'border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-indigo-50/30'}`}>
                  <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Details</h3>
                  <button
                    onClick={() => setShowMemberDetails(false)}
                    className={`p-2 rounded-xl transition-all duration-200 ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-white hover:shadow-md' : 'hover:bg-white hover:shadow-md text-slate-500 hover:text-slate-700'}`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                  <div className="text-center mb-10">
                    <div className="inline-block relative mb-5">
                      {activeView === "dm" ? (
                        <div className="drop-shadow-2xl filter">
                          {renderAvatar(getUser(activeDMUser), 96)}
                        </div>
                      ) : (
                        <div className={`w-24 h-24 rounded-[2rem] mx-auto flex items-center justify-center shadow-lg shadow-inner ${isDarkMode ? 'bg-gradient-to-br from-slate-700 to-slate-800 text-slate-500' : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400'}`}>
                          <Hash className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <h2 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {getActiveViewName().replace("#", "")}
                    </h2>
                    {activeView === "channel" && (
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {activeMembers.length} members in this channel
                      </p>
                    )}
                  </div>

                  {activeView === "channel" && (
                    <div className="mb-8">
                      <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Topic
                      </h4>
                      <div className={`rounded-2xl p-5 border text-sm leading-relaxed ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-slate-50/80 border-slate-100/60 text-slate-600'}`}>
                        Welcome to the{" "}
                        <span className={`font-bold ${isDarkMode ? 'text-purple-400' : 'text-indigo-600'}`}>
                          #{getActiveViewName().replace("# ", "")}
                        </span>{" "}
                        channel. This is the beginning of your collaboration
                        journey in {getCurrentSpace()?.name}.
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center justify-between ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Members
                      <span className={`px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                        {activeMembers.length}
                      </span>
                    </h4>
                    <div className="space-y-2">
                      {activeMembers.map(member => {
                        const isMe = member.id === currentUser?.id
                        const isFriend = Array.isArray(currentUser?.friends)
                          ? currentUser.friends.includes(member.id)
                          : false
                        const isPending = (() => {
                          if (isMe || isFriend) return false
                          // Check if member has an outgoing friend request to current user
                          const memberObj = users.find(u => u.id === member.id)
                          const hasOutgoing = memberObj?.notifications?.some(n => n.type === "friend_request" && n.fromId === currentUser?.id && n.status === "pending")
                          // Check if current user has an incoming friend request from member
                          const hasIncoming = currentUser?.notifications?.some(n => n.type === "friend_request" && n.fromId === member.id && n.status === "pending")
                          return !!hasOutgoing || !!hasIncoming
                        })()

                        return (
                          <div
                            key={member.id}
                            className={`flex items-center gap-3 p-3 rounded-2xl transition-colors cursor-default group border border-transparent ${isDarkMode ? 'hover:bg-slate-800 hover:border-slate-700' : 'hover:bg-slate-50/80 hover:border-slate-100/60'}`}
                          >
                            <div className="relative">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm border overflow-hidden ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-100'}`}>
                                {renderAvatar(member, 40)}
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                                  member.status === "online"
                                    ? "bg-emerald-500"
                                    : "bg-slate-300"
                                } ${isDarkMode ? 'border-slate-800' : 'border-white'}`}
                              ></span>
                            </div>
                            <div className="overflow-hidden flex-1">
                              <div className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                {member.name}
                              </div>
                              <div className={`text-xs truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                {member.email}
                              </div>
                            </div>
                            {isMe ? (
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-1 rounded-md font-bold tracking-wide ${isDarkMode ? 'bg-purple-900/50 text-purple-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                  YOU
                                </span>
                                <span className={`text-[10px] px-2 py-1 rounded-md font-semibold ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                  {getChannelRole(member.id).toUpperCase()}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                  {!isFriend && (
                                    <button
                                      onClick={() =>
                                        !isPending &&
                                        setShowAddFriendConfirm(member.id)
                                      }
                                      disabled={isPending}
                                      className={`p-1.5 rounded-lg transition-all ${
                                        isPending
                                          ? isDarkMode ? "text-slate-600 cursor-default" : "text-slate-300 cursor-default"
                                          : isDarkMode ? "hover:bg-purple-900/50 text-slate-400 hover:text-purple-400" : "hover:bg-indigo-100 text-slate-400 hover:text-indigo-600"
                                      }`}
                                      title={
                                        isPending
                                          ? "Request Sent"
                                          : "Add to friends"
                                      }
                                    >
                                      {isPending ? (
                                        <Check className="w-4 h-4" />
                                      ) : (
                                        <Plus className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}

                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-2 py-1 rounded-md font-semibold ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                      {getChannelRole(member.id).toUpperCase()}
                                    </span>
                                    {currentUser?.id === getCurrentSpace()?.ownerId && !isMe && (
                                      <select value={getChannelRole(member.id)} onChange={e => handleSetRole(member.id, e.target.value)} className="text-sm rounded-md p-1 bg-transparent border">
                                        <option value="owner">Owner</option>
                                        <option value="admin">Admin</option>
                                        <option value="member">Member</option>
                                      </select>
                                    )}
                                  </div>

                                  {/* Remove member (visible to main space or channel creator) */}
                                  {(currentUser?.id === getCurrentSpace()?.ownerId || currentUser?.id === (getCurrentChannels().find(c => c.id === activeChannel)?.ownerId)) && !isMe && (
                                    <button
                                      onClick={() => handleRemoveMember(member.id)}
                                      className="p-1.5 rounded-lg transition-all hover:bg-red-100 text-red-500 hover:text-red-600"
                                      title="Remove member"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Sidebar - FRIENDS & DMs */}
      <div className={`${isMobile ? (mobileView === "friends" ? "flex fixed inset-y-0 right-0 w-[85%] max-w-[320px] mobile-slide-in-right" : "hidden") : "hidden lg:flex"} flex-col ${friendsSidebarCollapsed ? "w-20" : "w-80"} transition-all ease-[cubic-bezier(0.32,0.72,0,1)] duration-300 z-40 liquid-glass-sidebar-right`}>
        {/* Mobile Swipe Indicator */}
        {isMobile && mobileView === "friends" && (
          <div className="swipe-indicator mt-2" />
        )}
        <div className={`p-6 ${isMobile ? 'pt-4' : ''} h-[80px] border-b flex items-center justify-between ${isDarkMode ? 'border-[var(--border-light)] bg-gradient-to-r from-transparent to-purple-900/20' : 'border-slate-100/60 bg-gradient-to-r from-transparent to-indigo-50/30'}`}>
          {isMobile && (
            <button
              onClick={() => setMobileView("chat")}
              className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-purple-400' : 'hover:bg-slate-100/80 text-slate-400 hover:text-indigo-600'} mr-2`}
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {!friendsSidebarCollapsed && (
            <h3 className={`font-extrabold text-lg bg-gradient-to-r ${isDarkMode ? 'from-white to-purple-300' : 'from-slate-700 to-indigo-700'} bg-clip-text text-transparent animate-fade-in`}>Friends</h3>
          )}
          <div className="flex gap-2 ml-auto">
            {!friendsSidebarCollapsed && !isMobile && (
              <button
                onClick={() => {
                  setInviteSearchQuery("")
                  setSelectedFriendInvitees([])
                  setShowAddFriendModal(true)
                }}
                className={`p-2.5 rounded-xl transition-all duration-200 ${isDarkMode ? 'hover:bg-gradient-to-br hover:from-purple-900/50 hover:to-indigo-900/50 text-slate-400 hover:text-purple-400' : 'hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 text-slate-400 hover:text-indigo-600'} hover:shadow-md`}
              >
                <UserPlus className="w-5 h-5" />
              </button>
            )}
            {isMobile && (
              <button
                onClick={() => {
                  setInviteSearchQuery("")
                  setSelectedFriendInvitees([])
                  setShowAddFriendModal(true)
                }}
                className={`p-2.5 rounded-xl transition-all duration-200 ${isDarkMode ? 'hover:bg-gradient-to-br hover:from-purple-900/50 hover:to-indigo-900/50 text-slate-400 hover:text-purple-400' : 'hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 text-slate-400 hover:text-indigo-600'} hover:shadow-md`}
              >
                <UserPlus className="w-5 h-5" />
              </button>
            )}
            {!isMobile && (
              <button
                onClick={() => setFriendsSidebarCollapsed(!friendsSidebarCollapsed)}
                className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {(!friendsSidebarCollapsed || isMobile) && (
          <div className="px-5 pt-6 pb-2 animate-fade-in">
            <div className="relative group">
              <Search className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-purple-400' : 'text-slate-400 group-focus-within:text-indigo-500'}`} />
              <input
                type="text"
                placeholder="Filter friends..."
                value={dmSearchQuery}
                onChange={e => setDmSearchQuery(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none transition-all duration-300 ease-in-out ${isDarkMode ? 'bg-slate-800/70 border-slate-700 focus:bg-slate-800 focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-white hover:bg-slate-800 hover:border-slate-600 placeholder:text-slate-500' : 'bg-white/70 border-slate-200/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 text-slate-700 hover:bg-white hover:border-slate-300 placeholder:text-slate-400 shadow-sm'} border`}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-2">
          {(!friendsSidebarCollapsed || isMobile) ? (
            <>
              {dmSearchResults.length > 0 ? (
                dmSearchResults.map(result => (
                  <div
                    key={result.id}
                    onClick={() => {
                      if (result.userId) {
                        setActiveDMUser(result.userId)
                        setActiveView("dm")
                        // When opening a DM, collapse the spaces (left) sidebar for focus
                        setSidebarCollapsed(true)
                        if (isMobile) setMobileView("chat")
                        if (result.messageId) {
                          // Scroll to the message and pin it for review
                          setTargetMessageId(result.messageId)
                          setPinnedMessageId(result.messageId)
                          setHighlightTerm(debouncedDmSearchQuery)
                        } else {
                          // Navigating to a DM without a specific message should clear any pinned result
                          setPinnedMessageId(null)
                        }
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                      activeView === "dm" && activeDMUser === result.userId
                        ? isDarkMode ? "bg-purple-900/30 border-purple-600/30" : "bg-indigo-50/80 border-indigo-100/60 shadow-sm"
                        : isDarkMode ? "bg-slate-800/50 border-transparent hover:bg-slate-800" : "bg-white/60 border-transparent hover:bg-white/90 hover:shadow-sm"
                    }`}
                  >
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-100'} border`}>
                        {result.icon}
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-sm font-bold truncate ${
                            activeView === "dm" && activeDMUser === result.userId
                              ? isDarkMode ? "text-purple-300" : "text-indigo-900"
                              : isDarkMode ? "text-slate-200" : "text-slate-700"
                          }`}
                        >
                          {result.title}
                        </span>
                        {result.timestamp && (
                          <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {formatTime(result.timestamp)}
                          </span>
                        )}
                      </div>
                      <div className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {renderWithHighlight(
                          result.subtitle,
                          debouncedDmSearchQuery
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : friends.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100/80 text-slate-400'}`}>
                    <Users className="w-8 h-8" />
                  </div>
                  <p className={`text-sm font-medium mb-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    No friends yet.
                  </p>
                  <button
                    onClick={() => setShowAddFriendModal(true)}
                    className={`text-xs font-bold hover:underline ${isDarkMode ? 'text-purple-400' : 'text-indigo-600'}`}
                  >
                    Find people
                  </button>
                </div>
              ) : (
                friends.map(friend => (
                  <div
                    key={friend.id}
                    onClick={() => {
                      setActiveDMUser(friend.id)
                      setActiveView("dm")
                      // Collapse spaces sidebar when opening friends chat
                      setSidebarCollapsed(true)
                      justSwitchedThreadRef.current = true
                      if (isMobile) setMobileView("chat")
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-300 border hover-lift ${
                      activeView === "dm" && activeDMUser === friend.id
                        ? isDarkMode 
                          ? "bg-gradient-to-r from-purple-900/40 to-violet-900/30 border-purple-600/30 shadow-md shadow-purple-500/10 ring-1 ring-purple-600/20"
                          : "bg-gradient-to-r from-indigo-50/80 to-purple-50/50 border-indigo-100/60 shadow-md shadow-indigo-100/40 ring-1 ring-indigo-100/50"
                        : isDarkMode 
                          ? "bg-slate-800/50 border-transparent hover:bg-slate-800 hover:border-slate-700"
                          : "bg-white/60 border-transparent hover:bg-white/90 hover:border-slate-200/40 hover:shadow-md"
                    }`}
                  >
                    <div className="relative">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg shadow-md border-2 overflow-hidden ring-2 ${isDarkMode ? 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600 ring-slate-700/50' : 'bg-gradient-to-br from-white to-slate-50 border-white ring-slate-100/50'}`}>
                        {renderAvatar(friend, 40)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 shadow-sm ${
                          friend.status === "online"
                            ? "bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-emerald-300/50"
                            : "bg-gradient-to-br from-slate-300 to-slate-400"
                        } ${isDarkMode ? 'border-slate-800' : 'border-white'}`}
                      ></span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {friend.name}
                      </div>
                      <div className={`text-xs truncate ${friend.status === "online" ? "text-emerald-500 font-medium" : isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                        {friend.status === "online" ? "Online" : "Offline"}
                      </div>
                    </div>
                    <div className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-700 hover:text-purple-400 text-slate-500' : 'hover:bg-white hover:text-indigo-600 text-slate-300'}`}>
                      <MessageSquare className="w-4 h-4" />
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            /* Collapsed view - only friend icons */
            <div className="flex flex-col items-center gap-4 mt-2 animate-fade-in">
              {friends.length === 0 ? (
                <button
                  onClick={() => setShowAddFriendModal(true)}
                  className={`p-3 rounded-2xl border-2 border-dashed transition-all ${isDarkMode ? 'border-slate-700 text-slate-500 hover:border-purple-500 hover:text-purple-400' : 'border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-500'}`}
                  title="Add Friend"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              ) : (
                <>
                  {friends.map(friend => (
                    <button
                      key={friend.id}
                      className={`relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 overflow-hidden ${
                        activeView === "dm" && activeDMUser === friend.id
                          ? isDarkMode 
                            ? "ring-2 ring-purple-500 shadow-lg shadow-purple-500/30" 
                            : "ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/30"
                          : isDarkMode
                            ? "hover:ring-2 hover:ring-slate-600 hover:shadow-md"
                            : "hover:ring-2 hover:ring-slate-200 hover:shadow-md"
                      }`}
                      title={friend.name}
                      onClick={() => {
                        setActiveDMUser(friend.id)
                        setActiveView("dm")
                        // Collapse spaces sidebar when opening friends chat
                        setSidebarCollapsed(true)
                        justSwitchedThreadRef.current = true
                        if (isMobile) setMobileView("chat")
                      }}
                    >
                      {renderAvatar(friend, 48)}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 shadow-sm ${
                          friend.status === "online"
                            ? "bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-emerald-300/50"
                            : "bg-gradient-to-br from-slate-300 to-slate-400"
                        } ${isDarkMode ? 'border-slate-800' : 'border-white'}`}
                      ></span>
                    </button>
                  ))}
                  <button
                    onClick={() => setShowAddFriendModal(true)}
                    className={`p-3 rounded-2xl border-2 border-dashed transition-all ${isDarkMode ? 'border-slate-700 text-slate-500 hover:border-purple-500 hover:text-purple-400' : 'border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-500'}`}
                    title="Add Friend"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Add Friend Confirmation Modal */}
      {showAddFriendConfirm && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-fade-in ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/30'}`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-sm text-center`}>
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-sm ${isDarkMode ? 'bg-purple-900/50 text-purple-400' : 'bg-indigo-100/80 text-indigo-600'}`}>
              <UserPlus className="w-8 h-8" />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Add Friend?
            </h3>
            <p className={`text-sm mb-8 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Do you want to send a friend request to{" "}
              <span className="font-bold">
                {users.find(u => u.id === showAddFriendConfirm)?.name}
              </span>
              ?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowAddFriendConfirm(null)}
                className={`flex-1 py-3 px-6 rounded-2xl font-bold transition-colors border ${isDarkMode ? 'text-slate-300 border-slate-600 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100 border-slate-200'}`}
              >
                No
              </button>
              <button
                onClick={() => {
                  if (showAddFriendConfirm)
                    sendFriendRequest(showAddFriendConfirm)
                  setShowAddFriendConfirm(null)
                }}
                className={`flex-1 py-3 px-6 rounded-2xl font-bold text-white shadow-lg transition-all ${isDarkMode ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20' : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'}`}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Denied Modal */}
      {showAccessDeniedModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-fade-in ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/40'}`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-sm`}>
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-sm ${isDarkMode ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-600'}`}>
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className={`text-xl font-bold text-center mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Access Restricted
            </h3>
            <p className={`text-center text-sm mb-8 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              The admin has not allowed you to view/message this channel. Please
              ask for an invite.
            </p>
            <button
              onClick={() => {
                setShowAccessDeniedModal(false)
                // Switch to a different view or channel to avoid repeated access attempts
                setActiveView("calendar")
              }}
              className={`w-full py-3.5 px-6 rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${isDarkMode ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-500/20' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/40'}`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-sm`}>
            <h3 className={`text-xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Rename {showRenameModal.type === "space" ? "Space" : "Channel"}
            </h3>
            <input
              type="text"
              className={`w-full p-4 rounded-2xl mb-6 outline-none focus:ring-2 ${isDarkMode ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:ring-violet-500 border' : 'bg-slate-50 border border-slate-200 focus:ring-indigo-500'}`}
              placeholder={showRenameModal.currentName}
              defaultValue={showRenameModal.currentName}
              onChange={e => setNewNameInput(e.target.value)}
              autoFocus
            />
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowRenameModal(null)
                  setNewNameInput("")
                }}
                className={`flex-1 py-3 rounded-2xl font-bold border transition-colors ${isDarkMode ? 'text-slate-300 border-slate-600 hover:bg-slate-700' : 'text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className={`flex-1 py-3 rounded-2xl font-bold text-white shadow-lg ${isDarkMode ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20' : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'}`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/40'}`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-sm`}>
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto ${isDarkMode ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-600'}`}>
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className={`text-xl font-bold text-center mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Are you sure?
            </h3>
            <p className={`text-center text-sm mb-8 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              You are about to delete this {showDeleteConfirm.type}. This action
              cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className={`flex-1 py-3 px-6 rounded-2xl font-bold transition-colors border ${isDarkMode ? 'text-slate-300 border-slate-600 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100 border-slate-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className={`flex-1 py-3 px-6 rounded-2xl font-bold text-white shadow-lg transition-all ${isDarkMode ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-red-600 shadow-red-200 hover:bg-red-700'}`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {showRemoveMemberConfirm && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/40'}`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-sm`}>
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto ${isDarkMode ? 'bg-yellow-900/40 text-yellow-400' : 'bg-yellow-100 text-yellow-600'}`}>
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className={`text-xl font-bold text-center mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Remove member?
            </h3>
            <p className={`text-center text-sm mb-8 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              You are about to remove <strong className={isDarkMode ? 'text-slate-200' : ''}>{showRemoveMemberConfirm.name}</strong> from <strong className={isDarkMode ? 'text-slate-200' : ''}>{getActiveViewName().replace('# ', '')}</strong>. They will receive a notification about this.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowRemoveMemberConfirm(null)}
                className={`flex-1 py-3 px-6 rounded-2xl font-bold transition-colors border ${isDarkMode ? 'text-slate-300 border-slate-600 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100 border-slate-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveMember}
                className={`flex-1 py-3 px-6 rounded-2xl font-bold text-white shadow-lg transition-all ${isDarkMode ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-red-600 shadow-red-200 hover:bg-red-700'}`}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal (Day Details + Create) */}
      {showEventModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/30'}`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/30' : 'bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-200/50'}`}>
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Day Details'}
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {selectedDate ? new Date(selectedDate).getFullYear() : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowNewEventForm(prev => !prev)} 
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                    showNewEventForm 
                      ? isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                      : isDarkMode ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {showNewEventForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {showNewEventForm ? 'Cancel' : 'New Event'}
                </button>
                <button 
                  onClick={() => setShowEventModal(false)} 
                  className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className={`text-sm font-bold flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  <Calendar className="w-4 h-4" /> Events
                </h4>
                <div className={`rounded-2xl border p-4 max-h-96 overflow-y-auto ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/80 border-slate-200/60'}`}>
                  {((events || []).filter(e => e.startDate === (selectedDate ? toLocalDateStr(selectedDate) : '')) || []).length === 0 ? (
                    <div className={`text-center py-8 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      <Calendar className={`w-10 h-10 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                      <p className="text-sm font-medium">No events for this day</p>
                      <p className="text-xs mt-1">Click "New Event" to create one</p>
                    </div>
                  ) : (
                    (events || []).filter(e => e.startDate === (selectedDate ? toLocalDateStr(selectedDate) : '')).map(ev => (
                      <div key={ev.id} className={`p-4 rounded-xl border mb-3 last:mb-0 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-purple-600/30' : 'bg-white border-slate-200/60 hover:border-indigo-200 hover:shadow-sm'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{ev.title}</div>
                            <div className={`text-xs mt-1 flex items-center gap-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              <Clock className="w-3 h-3" />
                              {ev.startDateTime ? new Date(ev.startDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All day'}
                            </div>
                          </div>
                        </div>
                        {ev.description && <div className={`text-sm mt-3 pt-3 border-t ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-600 border-slate-100'}`}>{ev.description}</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                {showNewEventForm ? (
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Event Title</label>
                      <input 
                        type="text" 
                        value={newEvent.title} 
                        onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} 
                        className={`w-full px-5 py-3.5 rounded-xl focus:outline-none focus:ring-2 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:ring-purple-500/30 focus:border-purple-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-indigo-500/30 focus:border-indigo-400'} border`}
                        placeholder="Enter event title" 
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Time</label>
                      <input 
                        type="time" 
                        value={newEvent.time} 
                        onChange={e => setNewEvent({ ...newEvent, time: e.target.value })} 
                        className={`w-full px-5 py-3.5 rounded-xl focus:outline-none focus:ring-2 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-purple-500/30 focus:border-purple-500' : 'bg-white border-slate-200 text-slate-800 focus:ring-indigo-500/30 focus:border-indigo-400'} border`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Description</label>
                      <textarea 
                        value={newEvent.description} 
                        onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} 
                        className={`w-full px-5 py-3.5 rounded-xl h-28 focus:outline-none focus:ring-2 transition-all resize-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:ring-purple-500/30 focus:border-purple-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-indigo-500/30 focus:border-indigo-400'} border`}
                        placeholder="Add a description (optional)"
                      />
                    </div>
                    <div className="flex gap-3 justify-end pt-2">
                      <button 
                        onClick={() => setShowNewEventForm(false)} 
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-100'} border`}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={saveCalendarEvent} 
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all ${isDarkMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                      >
                        Save Event
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`flex flex-col items-center justify-center h-full text-center py-12 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <Plus className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-medium">Create a new event</p>
                    <p className="text-xs mt-1">Click "New Event" to add a calendar entry</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Apps Menu - Mobile Full Screen Modal */}
      {isMobile && showGoogleAppsMenu && (
        <div className={`fixed inset-0 z-[60] backdrop-blur-sm animate-fade-in ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/50'}`}>
          <div className={`fixed inset-x-0 bottom-0 rounded-t-3xl shadow-2xl mobile-slide-in-bottom p-6 max-h-[80vh] overflow-y-auto ${isDarkMode ? 'bg-slate-800/98 border-t border-slate-700/50' : 'bg-white'}`}>
            {/* Handle bar */}
            <div className={`w-10 h-1 rounded-full mx-auto mb-4 ${isDarkMode ? 'bg-slate-600' : 'bg-slate-300'}`}></div>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-gradient-to-br from-violet-600 to-purple-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                  <Grid3x3 className="w-5 h-5 text-white" />
                </div>
                Google Apps
              </h3>
              <button
                onClick={() => setShowGoogleAppsMenu(false)}
                className={`p-2.5 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {GoogleService.GOOGLE_APPS.map((app) => (
                <a
                  key={app.name}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all touch-active ${isDarkMode ? 'hover:bg-slate-700/50 active:bg-slate-700' : 'hover:bg-slate-50 active:bg-slate-100'}`}
                  onClick={() => setShowGoogleAppsMenu(false)}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${app.color} shadow-sm`}>
                    <img 
                      src={app.icon} 
                      alt={app.name} 
                      className="w-7 h-7 object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.parentElement.innerHTML = '<span class="text-xl">' + (app.name.charAt(0)) + '</span>'
                      }}
                    />
                  </div>
                  <span className={`text-[10px] font-semibold text-center ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{app.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      {isMobile && (
        <div className={`mobile-bottom-nav ${
          isDarkMode 
            ? 'bg-slate-900/95 border-slate-700/60' 
            : 'bg-white/95 border-slate-200/60'
        }`}>
          <div className="flex items-center justify-around h-16 px-2">
            <button
              onClick={() => setMobileView("spaces")}
              className={`mobile-nav-item ${mobileView === "spaces" ? "active" : ""} ${
                mobileView === "spaces"
                  ? isDarkMode ? "text-violet-400" : "text-indigo-600"
                  : isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              <Sparkles className={`w-5 h-5 transition-transform duration-200`} />
              <span className="text-[10px] font-semibold">Spaces</span>
            </button>
            <button
              onClick={() => setMobileView("chat")}
              className={`mobile-nav-item ${mobileView === "chat" ? "active" : ""} ${
                mobileView === "chat"
                  ? isDarkMode ? "text-violet-400" : "text-indigo-600"
                  : isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              <MessageCircle className={`w-5 h-5 transition-transform duration-200`} />
              <span className="text-[10px] font-semibold">Chat</span>
            </button>
            <button
              onClick={() => setMobileView("friends")}
              className={`mobile-nav-item ${mobileView === "friends" ? "active" : ""} ${
                mobileView === "friends"
                  ? isDarkMode ? "text-violet-400" : "text-indigo-600"
                  : isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              <Users className={`w-5 h-5 transition-transform duration-200`} />
              <span className="text-[10px] font-semibold">Friends</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Space Modal */}
      {showCreateSpaceModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in ${
          isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/30'
        }`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-sm`}>
            <h3 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
              Create Space
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                value={newSpaceName}
                onChange={e => setNewSpaceName(e.target.value)}
                className={`w-full px-5 py-4 rounded-2xl border focus:outline-none focus:ring-2 ${
                  isDarkMode 
                    ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:ring-violet-500' 
                    : 'bg-slate-50 border-slate-200 focus:ring-indigo-500'
                }`}
                placeholder="Space Name"
                autoFocus
              />
              <div className="flex gap-4">
                <button
                  onClick={() => setShowCreateSpaceModal(false)}
                  className={`flex-1 py-3.5 font-bold rounded-2xl border transition-colors ${
                    isDarkMode 
                      ? 'text-slate-300 border-slate-600 hover:bg-slate-700' 
                      : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={createSpace}
                  className={`flex-1 py-3.5 font-bold rounded-2xl text-white shadow-lg transition-all ${
                    isDarkMode 
                      ? 'bg-violet-600 shadow-violet-500/20 hover:bg-violet-700' 
                      : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'
                  }`}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Friend Modal - UPDATED FOR BULK SELECTION */}
      {showAddFriendModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in ${
          isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/30'
        }`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-8">
              <h3 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Add Friends</h3>
              <button
                onClick={() => setShowAddFriendModal(false)}
                className={`p-2 rounded-full transition-colors ${
                  isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {!inviteSent ? (
              <div className="space-y-6">
                <div className="relative">
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Find People
                  </label>
                  <div className="relative">
                    <Search className={`absolute left-5 top-4 w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                    <input
                      type="text"
                      value={inviteSearchQuery}
                      onChange={e => {
                        setInviteSearchQuery(e.target.value)
                      }}
                      placeholder="Search by name..."
                      className={`w-full pl-12 pr-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent font-medium ${
                        isDarkMode 
                          ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:ring-violet-500/50' 
                          : 'bg-slate-50 border border-slate-200 text-slate-800 focus:ring-pink-500/50'
                      }`}
                    />
                  </div>
                  {inviteSearchResults.length > 0 && (
                    <div className={`absolute z-10 w-full mt-2 rounded-2xl shadow-xl max-h-48 overflow-y-auto py-2 ${
                      isDarkMode 
                        ? 'bg-slate-800 border border-slate-700' 
                        : 'bg-white border border-slate-100'
                    }`}>
                      {inviteSearchResults.map(u => {
                        const isSelected = selectedFriendInvitees.includes(u.id)
                        return (
                          <div
                            key={u.id}
                            onClick={() => toggleFriendSelection(u.id)}
                            className={`px-5 py-3 cursor-pointer flex items-center justify-between gap-3 transition-colors border-l-4 ${
                              isSelected
                                ? isDarkMode 
                                  ? "border-violet-500 bg-violet-500/20" 
                                  : "border-indigo-500 bg-indigo-50"
                                : isDarkMode 
                                  ? "border-transparent hover:bg-slate-700" 
                                  : "border-transparent hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`text-xl rounded-full w-9 h-9 flex items-center justify-center overflow-hidden ${
                                isDarkMode ? 'bg-slate-700' : 'bg-slate-50'
                              }`}>
                                {renderAvatar(u, 36)}
                              </div>
                              <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                {u.name}
                              </span>
                            </div>
                            {isSelected && (
                              <CheckCircle className={`w-5 h-5 ${isDarkMode ? 'text-violet-400' : 'text-indigo-500'}`} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                {selectedFriendInvitees.length > 0 && (
                  <div className={`p-4 rounded-2xl border ${
                    isDarkMode 
                      ? 'bg-violet-500/20 border-violet-500/30' 
                      : 'bg-indigo-50 border-indigo-100'
                  }`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${
                      isDarkMode ? 'text-violet-400' : 'text-indigo-500'
                    }`}>
                      Selected ({selectedFriendInvitees.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedFriendInvitees.map(id => {
                        const u =
                          inviteSearchResults.find(r => r.id === id) ||
                          users.find(us => us.id === id)
                        return (
                          <div
                            key={id}
                            className={`text-xs px-2 py-1 rounded-lg border font-bold flex items-center gap-1 ${
                              isDarkMode 
                                ? 'bg-slate-700 border-violet-500/30 text-violet-300' 
                                : 'bg-white border-indigo-100 text-indigo-800'
                            }`}
                          >
                            {u?.name}
                            <X
                              className="w-3 h-3 cursor-pointer"
                              onClick={() => toggleFriendSelection(id)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <button
                  onClick={handleBulkFriendInvite}
                  disabled={selectedFriendInvitees.length === 0}
                  className={`w-full py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white shadow-lg transition-all transform hover:scale-[1.02] ${
                    isDarkMode 
                      ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  }`}
                >
                  <UserPlus className="w-5 h-5" />
                  Send {selectedFriendInvitees.length} Request
                  {selectedFriendInvitees.length !== 1 ? "s" : ""}
                </button>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border animate-bounce ${
                  isDarkMode 
                    ? 'bg-emerald-500/20 border-emerald-500/30' 
                    : 'bg-emerald-100 border-emerald-200'
                }`}>
                  <Check className={`w-12 h-12 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <h4 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Sent!
                </h4>
                <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                  Friend requests delivered successfully.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add To Channel Modal - Invite Member logic */}
      {showAddToSpaceModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in ${
          isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/40'
        }`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-md max-h-[90vh] flex flex-col`}>
            <div className="flex items-center justify-between mb-8 flex-shrink-0">
              <h3 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Invite Members
              </h3>
              <button
                onClick={() => setShowAddToSpaceModal(false)}
                className={`p-2 rounded-full transition-colors ${
                  isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {!inviteSent ? (
              <div className="space-y-6 flex-1 overflow-hidden flex flex-col">
                {friends.length === 0 ? (
                  <div className="text-center py-8">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                      isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Users className="w-8 h-8" />
                    </div>
                    <p className={`text-sm font-medium mb-6 px-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      You need to be friends with people before inviting them to
                      this channel.
                    </p>
                    <button
                      onClick={() => {
                        setShowAddToSpaceModal(false)
                        setShowAddFriendModal(true)
                      }}
                      className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                        isDarkMode 
                          ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20' 
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      <UserPlus className="w-5 h-5" /> Find Friends
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        Search Friends
                      </label>
                      <div className="relative">
                        <Search className={`absolute left-5 top-4 w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                        <input
                          type="text"
                          value={inviteSearchQuery}
                          onChange={e => setInviteSearchQuery(e.target.value)}
                          placeholder="Search by name..."
                          className={`w-full pl-12 pr-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent font-medium ${
                            isDarkMode 
                              ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:ring-violet-500/50' 
                              : 'bg-slate-50 border border-slate-200 text-slate-800 focus:ring-pink-500/50'
                          }`}
                        />
                      </div>
                      {inviteSearchResults.length > 0 && (
                        <div className={`absolute z-10 w-full mt-2 rounded-2xl shadow-xl max-h-48 overflow-y-auto py-2 ${
                          isDarkMode 
                            ? 'bg-slate-800 border border-slate-700' 
                            : 'bg-white border border-slate-100'
                        }`}>
                          {inviteSearchResults.map(u => {
                            const isSelected = selectedInviteUsers.includes(
                              u.id
                            )
                            return (
                              <div
                                key={u.id}
                                onClick={() => toggleInviteSelection(u.id)}
                                className={`px-5 py-3 cursor-pointer flex items-center justify-between gap-3 transition-colors border-l-4 ${
                                  isSelected
                                    ? isDarkMode 
                                      ? "border-violet-500 bg-violet-500/20" 
                                      : "border-indigo-500 bg-indigo-50"
                                    : isDarkMode 
                                      ? "border-transparent hover:bg-slate-700" 
                                      : "border-transparent hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`text-xl rounded-full w-9 h-9 flex items-center justify-center overflow-hidden ${
                                    isDarkMode ? 'bg-slate-700' : 'bg-slate-50'
                                  }`}>
                                    {renderAvatar(u, 36)}
                                  </div>
                                  <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                    {u.name}
                                  </span>
                                </div>
                                {isSelected && (
                                  <CheckCircle className={`w-5 h-5 ${isDarkMode ? 'text-violet-400' : 'text-indigo-500'}`} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    {selectedInviteUsers.length > 0 && (
                      <div className={`p-4 rounded-2xl border max-h-32 overflow-y-auto flex-shrink-0 ${
                        isDarkMode 
                          ? 'bg-violet-500/20 border-violet-500/30' 
                          : 'bg-indigo-50 border-indigo-100'
                      }`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${
                          isDarkMode ? 'text-violet-400' : 'text-indigo-500'
                        }`}>
                          Selected ({selectedInviteUsers.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedInviteUsers.map(id => {
                            const u =
                              inviteSearchResults.find(r => r.id === id) ||
                              users.find(us => us.id === id)
                            return (
                              <div
                                key={id}
                                className={`text-xs px-2 py-1 rounded-lg border font-bold flex items-center gap-1 ${
                                  isDarkMode 
                                    ? 'bg-slate-700 border-violet-500/30 text-violet-300' 
                                    : 'bg-white border-indigo-100 text-indigo-800'
                                }`}
                              >
                                {u?.name}
                                <X
                                  className="w-3 h-3 cursor-pointer"
                                  onClick={() => toggleInviteSelection(id)}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={addFriendsToChannel}
                      disabled={selectedInviteUsers.length === 0}
                      className={`w-full py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white shadow-lg transition-all transform hover:scale-[1.02] flex-shrink-0 ${
                        isDarkMode 
                          ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20' 
                          : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                      }`}
                    >
                      <UserPlus className="w-5 h-5" />
                      Add {selectedInviteUsers.length} Member
                      {selectedInviteUsers.length !== 1 ? "s" : ""}
                    </button>

                    <div className="text-center mt-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          setShowAddToSpaceModal(false)
                          setShowAddFriendModal(true)
                        }}
                        className={`text-xs font-bold transition-colors ${
                          isDarkMode ? 'text-slate-500 hover:text-violet-400' : 'text-slate-400 hover:text-indigo-600'
                        }`}
                      >
                        Don't see them? Find new friends
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border animate-bounce ${
                  isDarkMode 
                    ? 'bg-emerald-500/20 border-emerald-500/30' 
                    : 'bg-emerald-100 border-emerald-200'
                }`}>
                  <Check className={`w-12 h-12 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <h4 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Added!
                </h4>
                <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                  Members successfully added to the channel.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in ${
          isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/40'
        }`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-md flex flex-col max-h-[80vh]`}>
            <div className="flex items-center justify-between mb-8">
              <h3 className={`text-3xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                <Bell className={`w-8 h-8 ${isDarkMode ? 'text-violet-400' : 'text-indigo-500'}`} /> Notifications
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAllNotifications}
                  disabled={!((currentUser?.notifications || []).some(n => n.type === 'info'))}
                  className={`text-sm font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    isDarkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Clear all
                </button>
                <button
                  onClick={() => setShowNotificationsModal(false)}
                  className={`p-2 rounded-full transition-colors ${
                    isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {(currentUser?.notifications?.length || 0) === 0 ? (
                <div className={`text-center py-16 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  <Bell className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">No new notifications</p>
                </div>
              ) : (
                currentUser?.notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`p-5 border rounded-2xl transition-all group ${
                      isDarkMode 
                        ? 'border-slate-700 bg-slate-700/50 hover:bg-slate-700 hover:shadow-lg' 
                        : 'border-slate-100 bg-slate-50 hover:bg-white hover:shadow-lg'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className={`p-3 rounded-full h-fit shadow-sm border ${
                        isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-100'
                      }`}>
                        {notif.type === "friend_request" ? (
                          <UserPlus className={`w-5 h-5 ${isDarkMode ? 'text-violet-400' : 'text-indigo-600'}`} />
                        ) : notif.type === "info" ? (
                          <Info className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`} />
                        ) : (
                          <Mail className={`w-5 h-5 ${isDarkMode ? 'text-pink-400' : 'text-pink-500'}`} />
                        )}
                      </div>
                      <div className="flex-1">
                        {notif.type === "friend_request" ? (
                          <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {notif.from}
                            </span>{" "}
                            sent you a friend request.
                          </p>
                        ) : notif.type === "info" ? (
                          <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                            {notif.message}
                          </p>
                        ) : (
                          <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {notif.from}
                            </span>{" "}
                            invited you to{" "}
                            <span className={`font-bold ${isDarkMode ? 'text-violet-400' : 'text-indigo-600'}`}>
                              {notif.spaceName}
                            </span>
                          </p>
                        )}



                        {notif.type === "info" ? (
                          <button
                            onClick={() => dismissNotification(notif.id)}
                            className={`mt-3 text-xs font-bold ${
                              isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            Dismiss
                          </button>
                        ) : (
                          <div className="flex gap-3 mt-4">
                            <button
                              onClick={() =>
                                handleNotificationAction(notif.id, notif.type)
                              }
                              className={`flex-1 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-95 text-white ${
                                isDarkMode 
                                  ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20' 
                                  : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                            >
                              <CheckCircle className="w-4 h-4" /> Accept
                            </button>
                            <button
                              onClick={() =>
                                handleRejectNotification(notif.id, notif.type)
                              }
                              className={`flex-1 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 border transition-all ${
                                isDarkMode 
                                  ? 'border-slate-600 hover:bg-slate-600 text-slate-300' 
                                  : 'border-slate-200 hover:bg-slate-100 text-slate-500'
                              }`}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showChannelModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in ${
          isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/40'
        }`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-sm`}>
            <h3 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              New Channel
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                className={`w-full px-5 py-4 rounded-2xl border focus:outline-none focus:ring-2 ${
                  isDarkMode 
                    ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:ring-violet-500' 
                    : 'bg-slate-50 border-slate-200 focus:ring-indigo-500'
                }`}
                placeholder="Channel Name"
                autoFocus
              />
              <div className="flex gap-4">
                <button
                  onClick={() => setShowChannelModal(false)}
                  className={`flex-1 py-3.5 font-bold rounded-2xl border transition-colors ${
                    isDarkMode 
                      ? 'text-slate-300 border-slate-600 hover:bg-slate-700' 
                      : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={createChannel}
                  className={`flex-1 py-3.5 font-bold rounded-2xl text-white shadow-lg transition-all ${
                    isDarkMode 
                      ? 'bg-violet-600 shadow-violet-500/20 hover:bg-violet-700' 
                      : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'
                  }`}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Docs Modal */}
      {showDocsModal && (
        <div className={`fixed inset-0 backdrop-blur-xl flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 animate-fade-in ${
          isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/50'
        }`}>
          <div className={`rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 md:p-8 w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] shadow-2xl backdrop-blur-2xl ring-1 flex flex-col ${
            isDarkMode 
              ? 'bg-slate-800/95 ring-slate-700/50 shadow-violet-500/10' 
              : 'bg-white/95 ring-white/50 shadow-purple-200/30'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-8 gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg flex-shrink-0 ${
                  isDarkMode 
                    ? 'bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 shadow-purple-500/30' 
                    : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-purple-300/50'
                }`}>
                  <FileText className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className={`text-xl sm:text-3xl font-bold bg-clip-text text-transparent ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-white to-violet-400' 
                      : 'bg-gradient-to-r from-slate-800 to-indigo-700'
                  }`}>
                    My Documents
                  </h3>
                  <p className={`text-xs sm:text-sm mt-0.5 hidden sm:block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Access your Google Drive files and Gmail attachments</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {googleAccessToken && (
                  <>
                    <button
                      onClick={() => {
                        // Show Drive files quickly when clicked (connect if needed)
                        if (!googleAccessToken) {
                          handleConnectGoogleDocs()
                        } else {
                          setSelectedAppFilter('drive')
                          loadGoogleDocs(googleAccessToken, 'drive')
                        }
                      }}
                      className={`px-3 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-700/50 text-slate-200' : 'bg-slate-50 text-slate-700'}`}
                      title="Show Drive Files"
                    >
                      <img src="/google-drive.png" alt="Drive" className="w-5 h-5" />
                      <span className="hidden sm:inline">Drive</span>
                    </button>
                    <button
                      onClick={() => setShowConnectAppsModal(true)}
                      className={`px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-300 flex items-center gap-1.5 sm:gap-2 border shadow-sm ${
                        isDarkMode 
                          ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/20' 
                          : 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 hover:from-indigo-100 hover:to-purple-100 border-indigo-100 hover:shadow-lg hover:shadow-indigo-100/50'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Connect More Apps</span>
                      <span className="sm:hidden">Connect</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowDocsModal(false)}
                  className={`p-2 sm:p-2.5 rounded-xl transition-all duration-300 hover:rotate-90 hover:shadow-md flex-shrink-0 ${
                    isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            {!googleAccessToken ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 border-2 ${
                  isDarkMode 
                    ? 'bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-violet-500/30' 
                    : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100'
                }`}>
                  <FileText className={`w-12 h-12 ${isDarkMode ? 'text-violet-400' : 'text-indigo-600'}`} />
                </div>
                <h4 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Connect Your Google Account</h4>
                <p className={`mb-6 text-center max-w-md ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Connect your Google account to access <strong>Gmail attachments</strong> and <strong>Google Drive files</strong> in one unified view.
                </p>
                <p className={`text-xs mb-4 text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  You'll be asked to grant permissions for Gmail and Drive access.
                </p>
                <button
                  onClick={handleConnectGoogleDocs}
                  className={`px-8 py-4 font-bold rounded-2xl transition-all flex items-center gap-3 text-white shadow-lg ${
                    isDarkMode 
                      ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  }`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Connect Google Account
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {loadingDocs ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 ${
                        isDarkMode ? 'border-violet-500' : 'border-indigo-600'
                      }`}></div>
                      <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading documents...</p>
                    </div>
                  </div>
                ) : docsError ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center px-4">
                      <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                        isDarkMode ? 'bg-red-500/20' : 'bg-red-50'
                      }`}>
                        <XCircle className={`w-7 h-7 sm:w-8 sm:h-8 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                      </div>
                      <p className={`font-medium mb-4 text-sm sm:text-base ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{docsError}</p>
                      <button
                        onClick={() => {
                          // If token expired, re-authenticate
                          if (docsError.includes('expired') || docsError.includes('Invalid')) {
                            setGoogleAccessToken(null)
                            GoogleService.removeGoogleAccessToken()
                            setDocsError(null)
                            handleConnectGoogleDocs()
                          } else {
                            loadGoogleDocs(googleAccessToken)
                          }
                        }}
                        className={`px-6 py-3 font-bold rounded-xl text-white ${
                          isDarkMode ? 'bg-violet-600 hover:bg-violet-700' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Filter Tabs - Compact */}
                    <div className={`flex flex-wrap gap-2 mb-4 pb-2 border-b ${
                      isDarkMode ? 'border-slate-700' : 'border-slate-100'
                    }`}>
                      <button
                        onClick={() => {
                          setSelectedAppFilter('all')
                          loadGoogleDocs(googleAccessToken)
                        }}
                        className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${
                          selectedAppFilter === 'all'
                            ? isDarkMode ? 'bg-violet-600 text-white' : 'bg-indigo-600 text-white'
                            : isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All
                      </button>
                      {googleDocs.some(doc => GoogleService.getAppTypeFromMime(doc.mimeType) === 'docs') && (
                        <button
                          onClick={() => {
                            setSelectedAppFilter('docs')
                            loadGoogleDocs(googleAccessToken, 'docs')
                          }}
                          className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 ${
                            selectedAppFilter === 'docs'
                              ? 'bg-blue-600 text-white'
                              : isDarkMode ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          }`}
                        >
                          <img src="/google-docs.png" alt="Docs" className="w-4 h-4" /> Docs
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedAppFilter('shared')
                        }}
                        className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 ${
                          selectedAppFilter === 'shared'
                            ? isDarkMode ? 'bg-violet-600 text-white' : 'bg-indigo-600 text-white'
                            : isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        >
                        <img src="/shared.png.png" alt="Shared" className="w-4 h-4" /> Shared
                      </button>
                      {googleDocs.some(doc => GoogleService.getAppTypeFromMime(doc.mimeType) === 'sheets') && (
                        <button
                          onClick={() => {
                            setSelectedAppFilter('sheets')
                            loadGoogleDocs(googleAccessToken, 'sheets')
                          }}
                          className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 ${
                            selectedAppFilter === 'sheets'
                              ? 'bg-green-600 text-white'
                              : isDarkMode ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          <img src="/google-sheets.png" alt="Sheets" className="w-4 h-4" /> Sheets
                        </button>
                      )}
                      {googleDocs.some(doc => GoogleService.getAppTypeFromMime(doc.mimeType) === 'slides') && (
                        <button
                          onClick={() => {
                            setSelectedAppFilter('slides')
                            loadGoogleDocs(googleAccessToken, 'slides')
                          }}
                          className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 ${
                            selectedAppFilter === 'slides'
                              ? 'bg-yellow-600 text-white'
                              : isDarkMode ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                          }`}
                          >
                          <img src="/slides.png" alt="Slides" className="w-4 h-4" /> Slides
                        </button>
                      )}
                      {gmailAttachments.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedAppFilter('gmail')
                            loadGoogleDocs(googleAccessToken, 'gmail')
                          }}
                          className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 ${
                            selectedAppFilter === 'gmail'
                              ? 'bg-red-600 text-white'
                              : isDarkMode ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        >
                          <img src="/gmail.png" alt="Gmail" className="w-4 h-4" /> Gmail
                        </button>
                      )}
                    </div>

                    {/* Documents Grid */}
                    <div className="flex-1 overflow-y-auto pr-2">
                      {/* Shared Files View */}
                      {selectedAppFilter === 'shared' && (
                        <div className="mb-6">
                          <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            <FileText className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-indigo-500'}`} /> Shared Files
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {sharedChatDocs.map((attachment, idx) => {
                                    const attAppType = GoogleService.getAppTypeFromMime(attachment.mimeType || attachment.type)
                                    const attAppIcon = GoogleService.getAppIcon(attAppType)
                                    return (
                                      <div 
                                        key={attachment.id || `${attachment.name}-${idx}`} 
                                        className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isDarkMode ? 'border-slate-700 bg-slate-800/50 hover:border-purple-600/40 hover:shadow-md hover:shadow-purple-500/10' : 'border-slate-200/60 bg-white/80 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/30'}`}
                                        onClick={() => openAttachment(attachment)}
                                      >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${attAppIcon.color}`}>
                                          <img src={attachment.iconLink || attAppIcon.iconUrl} alt="file" className="w-6 h-6" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'block'); }} />
                                          <span className="text-xl hidden">{attAppIcon.emoji}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <h5 className={`font-medium text-sm truncate ${isDarkMode ? 'text-slate-200 group-hover:text-purple-300' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                                            {attachment.name || 'Attachment'}
                                          </h5>
                                          <p className={`text-[10px] truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {attachment.source === 'drive' ? 'Drive' : attachment.source === 'gmail' ? 'Gmail' : 'Chat'}
                                            {attachment.timestamp && ` • ${new Date(attachment.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                          </p>
                                        </div>
                                        <button
                                          onClick={async (e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            // If this is a Gmail attachment, always upload to backend first
                                            if (attachment.source === 'gmail' && googleAccessToken) {
                                              try {
                                                const bytes = await GoogleService.downloadGmailAttachmentWithFallback(googleAccessToken, attachment.gmailMessageId || attachment.messageId, attachment.gmailAttachmentId || attachment.id, attachment.name)
                                                if (bytes) {
                                                  const blob = new Blob([bytes], { type: attachment.mimeType })
                                                  const fd = new FormData()
                                                  fd.append('file', blob, attachment.name)
                                                  const resp = await fetch(`${API_BASE}/upload/file`, {
                                                    method: 'POST',
                                                    body: fd
                                                  })
                                                  if (resp.ok) {
                                                    const j = await resp.json()
                                                    addDocumentAsAttachment({
                                                      id: j.file_id || `${Date.now()}`,
                                                      name: attachment.name,
                                                      mimeType: attachment.mimeType,
                                                      size: attachment.size,
                                                      source: 'upload',
                                                      fileId: j.file_id,
                                                      url: j.file_id ? `${API_BASE}/upload/file/${j.file_id}/download` : null,
                                                      public_url: j.file_id ? `${API_BASE}/upload/file/${j.file_id}/download` : null,
                                                    })
                                                    return
                                                  }
                                                }
                                              } catch (err) {
                                                console.error('Failed to upload gmail attachment to server:', err)
                                                // fallthrough to add as gmail-only attachment
                                              }
                                            }
                                            // For all other cases, or if upload fails, attach as normal
                                            addDocumentAsAttachment({
                                              id: attachment.id,
                                              name: attachment.name,
                                              mimeType: attachment.mimeType,
                                              url: attachment.url || attachment.webViewLink,
                                              source: attachment.source || 'chat',
                                              gmailMessageId: attachment.gmailMessageId,
                                              gmailAttachmentId: attachment.gmailAttachmentId
                                            })
                                          }}
                                          className={`p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${isDarkMode ? 'bg-purple-900/50 text-purple-400 hover:bg-purple-800' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
                                          title="Add to message"
                                        >
                                          <Plus className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )
                                  })}
                          </div>
                        </div>
                      )}

                      {(selectedAppFilter === 'all' || selectedAppFilter === 'drive' || selectedAppFilter === 'docs' || selectedAppFilter === 'sheets' || selectedAppFilter === 'slides') && googleDocs.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
                          {[...googleDocs].sort((a, b) => {
                            const timeA = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0
                            const timeB = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0
                            return timeB - timeA
                          }).map((doc) => {
                            const appType = GoogleService.getAppTypeFromMime(doc.mimeType)
                            const appIcon = GoogleService.getAppIcon(appType)
                            
                            return (
                              <div
                                key={doc.id}
                                className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isDarkMode ? 'border-slate-700 bg-slate-800/50 hover:border-purple-600/40 hover:shadow-md hover:shadow-purple-500/10' : 'border-slate-200/60 bg-white/80 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/30'}`}
                                onClick={() => window.open(doc.webViewLink, '_blank')}
                              >
                                {/* Icon */}
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${appIcon.color}`}>
                                  <img src={doc.iconLink || appIcon.iconUrl} alt={appType} className="w-6 h-6" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'block'); }} />
                                  <span className="text-xl hidden">{appIcon.emoji}</span>
                                </div>
                                
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <h5 className={`font-medium text-sm truncate ${isDarkMode ? 'text-slate-200 group-hover:text-purple-300' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                                    {doc.name}
                                  </h5>
                                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {new Date(doc.modifiedTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </p>
                                </div>
                                
                                {/* Add Button */}
                                <button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    addDocumentAsAttachment(doc)
                                  }}
                                  className={`p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${isDarkMode ? 'bg-purple-900/50 text-purple-400 hover:bg-purple-800' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
                                  title="Add to message"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}



                      {/* Shared Chat Documents */}
                      {selectedAppFilter === 'all' && sharedChatDocs.length > 0 && (
                        <div className="mb-6">
                          <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            <FileText className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-indigo-500'}`} /> Shared in Chats
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {sharedChatDocs.map((attachment, idx) => {
                              const attAppType = GoogleService.getAppTypeFromMime(attachment.mimeType || attachment.type)
                              const attAppIcon = GoogleService.getAppIcon(attAppType)
                              return (
                              <div 
                                key={attachment.id || `${attachment.name}-${idx}`} 
                                className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isDarkMode ? 'border-slate-700 bg-slate-800/50 hover:border-purple-600/40 hover:shadow-md hover:shadow-purple-500/10' : 'border-slate-200/60 bg-white/80 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/30'}`}
                                onClick={() => openAttachment(attachment)}
                              >
                                {/* Icon */}
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${attAppIcon.color}`}>
                                  <img src={attachment.iconLink || attAppIcon.iconUrl} alt="file" className="w-6 h-6" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'block'); }} />
                                  <span className="text-xl hidden">{attAppIcon.emoji}</span>
                                </div>
                                
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <h5 className={`font-medium text-sm truncate ${isDarkMode ? 'text-slate-200 group-hover:text-purple-300' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                                    {attachment.name || 'Attachment'}
                                  </h5>
                                  <p className={`text-[10px] truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {attachment.source === 'drive' ? 'Drive' : attachment.source === 'gmail' ? 'Gmail' : 'Chat'}
                                    {attachment.timestamp && ` • ${new Date(attachment.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                  </p>
                                </div>
                                
                                {/* Add Button */}
                                <button
                                  onClick={(e) => { 
                                    e.preventDefault()
                                    e.stopPropagation()
                                    addDocumentAsAttachment({ 
                                      id: attachment.id, 
                                      name: attachment.name, 
                                      mimeType: attachment.mimeType, 
                                      url: attachment.url || attachment.webViewLink, 
                                      source: attachment.source || 'chat',
                                      gmailMessageId: attachment.gmailMessageId,
                                      gmailAttachmentId: attachment.gmailAttachmentId
                                    }) 
                                  }}
                                  className={`p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${isDarkMode ? 'bg-purple-900/50 text-purple-400 hover:bg-purple-800' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
                                  title="Add to message"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Gmail Attachments Grid */}
                      {(selectedAppFilter === 'all' || selectedAppFilter === 'gmail') && gmailAttachments.length > 0 && (
                        <div className="mb-6">
                          {selectedAppFilter === 'all' && googleDocs.length > 0 && (
                            <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              <Mail className="w-4 h-4 text-red-500" /> Gmail Attachments
                            </h4>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {gmailAttachments.map((attachment, idx) => {
                              const gmailAppType = GoogleService.getAppTypeFromMime(attachment.mimeType)
                              const gmailAppIcon = GoogleService.getAppIcon(gmailAppType)
                              return (
                              <div
                                key={`gmail-${attachment.messageId}-${attachment.id}-${idx}`}
                                className="group flex items-center gap-3 p-3 rounded-xl border border-red-100 bg-white hover:border-red-300 hover:shadow-md transition-all"
                              >
                                {/* File Icon */}
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${gmailAppIcon.color}`}>
                                  <img src={gmailAppIcon.iconUrl} alt="file" className="w-6 h-6" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'block'); }} />
                                  <span className="text-xl hidden">{gmailAppIcon.emoji}</span>
                                </div>
                                
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-medium text-sm text-slate-800 truncate group-hover:text-red-600">
                                    {attachment.filename}
                                  </h5>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <span className="truncate max-w-[100px]">{attachment.senderName || 'Unknown'}</span>
                                    <span>•</span>
                                    <span>{attachment.size > 1048576 ? `${(attachment.size / 1048576).toFixed(1)}MB` : `${(attachment.size / 1024).toFixed(0)}KB`}</span>
                                  </div>
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={async (e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      // Try to download the attachment using the user's Google token and upload to backend
                                          if (googleAccessToken) {
                                        try {
                                          const bytes = await GoogleService.downloadGmailAttachmentWithFallback(googleAccessToken, attachment.messageId, attachment.id, attachment.filename)
                                          if (bytes) {
                                            const blob = new Blob([bytes], { type: attachment.mimeType })
                                            const fd = new FormData()
                                            fd.append('file', blob, attachment.filename)

                                            const resp = await fetch(`${API_BASE}/upload/file`, {
                                              method: 'POST',
                                              body: fd
                                            })
                                            if (resp.ok) {
                                              const j = await resp.json()
                                              // Attach uploaded file metadata so other users can access via backend
                                              addDocumentAsAttachment({
                                                id: j.file_id || `${Date.now()}`,
                                                name: attachment.filename,
                                                mimeType: attachment.mimeType,
                                                size: attachment.size,
                                                source: 'upload',
                                                fileId: j.file_id,
                                                url: j.file_id ? `${API_BASE}/upload/file/${j.file_id}/download` : null,
                                                public_url: j.file_id ? `${API_BASE}/upload/file/${j.file_id}/download` : null,
                                              })
                                              return
                                            }
                                          }
                                        } catch (err) {
                                          console.error('Failed to upload gmail attachment to server:', err)
                                          // fallthrough to add as gmail-only attachment
                                        }
                                      }

                                      // Fallback: attach as gmail source (viewer may not be able to download)
                                      addDocumentAsAttachment({
                                        id: attachment.id,
                                        name: attachment.filename,
                                        mimeType: attachment.mimeType,
                                        size: attachment.size,
                                        source: 'gmail',
                                        gmailMessageId: attachment.messageId,
                                        gmailAttachmentId: attachment.id,
                                        webViewLink: `https://mail.google.com/mail/u/0/#inbox/${attachment.messageId}`
                                      })
                                    }}
                                    className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                    title="Add to chat"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      try {
                                        const blobUrl = await GoogleService.getGmailAttachmentPreviewUrl(
                                          googleAccessToken,
                                          attachment.messageId,
                                          attachment.id,
                                          attachment.mimeType,
                                          attachment.filename
                                        )
                                        if (blobUrl) {
                                          const a = document.createElement('a')
                                          a.href = blobUrl
                                          a.download = attachment.filename
                                          document.body.appendChild(a)
                                          a.click()
                                          document.body.removeChild(a)
                                          URL.revokeObjectURL(blobUrl)
                                        }
                                      } catch (err) {
                                        console.error('Download failed:', err)
                                      }
                                    }}
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                    title="Download"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {googleDocs.length === 0 && gmailAttachments.length === 0 && (
                        <div className="flex-1 flex items-center justify-center py-16">
                          <div className="text-center">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-slate-50">
                              <FileText className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-slate-500 font-medium">No documents found</p>
                            <p className="text-xs text-slate-400 mt-2">Try connecting more apps or changing filters</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connect More Apps Modal */}
      {showConnectAppsModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-[60] p-6 animate-fade-in ${
          isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/40'
        }`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Connect More Apps</h3>
              <button
                onClick={() => setShowConnectAppsModal(false)}
                className={`p-2 rounded-full transition-colors ${
                  isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Connect additional Google apps to access more documents
            </p>
            <div className="space-y-3">
              {[
                { id: 'docs', name: 'Google Docs', emoji: '📄', lightColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200', darkColor: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30' },
                { id: 'sheets', name: 'Google Sheets', emoji: '📊', lightColor: 'bg-green-50 hover:bg-green-100 border-green-200', darkColor: 'bg-green-500/20 hover:bg-green-500/30 border-green-500/30' },
                { id: 'slides', name: 'Google Slides', emoji: '📽️', lightColor: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200', darkColor: 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30' },
                { id: 'gmail', name: 'Gmail Attachments', emoji: '📧', lightColor: 'bg-red-50 hover:bg-red-100 border-red-200', darkColor: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30' }
              ].map((app) => (
                <button
                  key={app.id}
                  onClick={() => handleConnectSpecificApp(app.id)}
                  disabled={connectedApps.includes(app.id)}
                  className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                    connectedApps.includes(app.id)
                      ? isDarkMode 
                        ? 'bg-slate-700/50 border-slate-600 opacity-60 cursor-not-allowed' 
                        : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : `${isDarkMode ? app.darkColor : app.lightColor} cursor-pointer transform hover:scale-[1.02]`
                  }`}
                >
                  {
                    (() => {
                      const imgSrc = app.id === 'docs' ? '/google-docs.png' : app.id === 'sheets' ? '/google-sheets.png' : app.id === 'slides' ? '/slides.png' : app.id === 'gmail' ? '/gmail.png' : '/google-drive.png'
                      return <img src={imgSrc} alt={app.name} className="w-8 h-8 rounded-md" />
                    })()
                  }
                  <div className="flex-1 text-left">
                    <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{app.name}</h4>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {connectedApps.includes(app.id) ? 'Already connected' : 'Click to connect'}
                    </p>
                  </div>
                  {connectedApps.includes(app.id) && (
                    <CheckCircle className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Google Calendar Connection Modal */}
      {showCalendarConnectModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-[60] p-6 animate-fade-in ${
          isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/40'
        }`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                <Calendar className={`w-7 h-7 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                Connect Google Calendar
              </h3>
              <button
                onClick={() => setShowCalendarConnectModal(false)}
                className={`p-2 rounded-full transition-colors ${
                  isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 mx-auto border-2 ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30' 
                  : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100'
              }`}>
                <Calendar className={`w-10 h-10 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              </div>
              <p className={`text-center mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Connect your Google Calendar to view and sync your events in real-time.
              </p>
              <p className={`text-xs text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                You'll be asked to grant calendar access permissions.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleConnectGoogleCalendar}
                className={`w-full px-6 py-4 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 text-white shadow-lg ${
                  isDarkMode 
                    ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20' 
                    : 'bg-purple-600 hover:bg-purple-700 shadow-purple-200'
                }`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Google Calendar
              </button>
              <button
                onClick={() => setShowCalendarConnectModal(false)}
                className={`w-full px-6 py-3 font-medium rounded-2xl transition-all ${
                  isDarkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast Notification */}
      {showSuccessToast && (
        <div className="fixed bottom-8 right-8 z-[70] animate-fade-in">
          <div className={`rounded-2xl p-4 shadow-2xl flex items-center gap-3 min-w-[300px] ${
            isDarkMode ? 'bg-emerald-600 text-white' : 'bg-green-600 text-white'
          }`}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">Added Successfully!</p>
              <p className="text-xs text-white/80 mt-0.5">{successMessage}</p>
            </div>
            <button
              onClick={() => setShowSuccessToast(false)}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
