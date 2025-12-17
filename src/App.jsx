import React, { useState, useEffect, useRef } from "react"
import {
  Send,
  Hash,
  Users,
  Search,
  Plus,
  Bell,
  Paperclip,
  MessageSquare,
  X,
  ChevronDown,
  ChevronRight,
  Menu,
  Mail,
  UserPlus,
  Check,
  Sparkles,
  GraduationCap,
  Briefcase,
  User as UserIcon,
  LogIn,
  UserPlus as UserPlusIcon,
  CheckCircle,
  XCircle,
  File as FileIcon
} from "lucide-react"
import * as Storage from "./services/storage"
import { getToken, getStoredUser, logout, saveAuth } from "./services/auth"

export default function CollaborationApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [authMode, setAuthMode] = useState("login")
  const [authData, setAuthData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: ""
  })
  const [authError, setAuthError] = useState("")
  const [authSuccess, setAuthSuccess] = useState("")

  // --- Restore auth from localStorage on mount ---
  useEffect(() => {
    const restore = async () => {
      const token = getToken()
      const storedUser = getStoredUser()
      if (token && storedUser) {
        // Immediately set stored user so UI doesn't flash to auth page
        setCurrentUser(storedUser)
        setIsAuthenticated(true)

        // Background validation/refresh from server (best-effort)
        try {
          const users = await Storage.getUsers()
          const fresh = Array.isArray(users) ? users.find(u => u.id === storedUser.id) : null
          if (fresh) {
            setCurrentUser(fresh)
            localStorage.setItem("spaces_user", JSON.stringify(fresh))
          }
        } catch (err) {
          console.error("Auth refresh failed:", err)
        }
      }
    }

    restore()
  }, [])

  // Main Data State
  const [spaces, setSpaces] = useState([])
  const [users, setUsers] = useState([])
  const [friends, setFriends] = useState([])
  // Presence: list of online user IDs (updated via WebSocket presence_update)
  const [onlineUserIds, setOnlineUserIds] = useState([])

  // UI State
  const [activeSpace, setActiveSpace] = useState(null)
  const [activeChannel, setActiveChannel] = useState(1)
  const [activeView, setActiveView] = useState("channel")
  const [activeDMUser, setActiveDMUser] = useState(null)

  const [messages, setMessages] = useState({})
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Modals & Panels
  const [messageInput, setMessageInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelType, setNewChannelType] = useState("public")
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false)
  const [showAddFriendModal, setShowAddFriendModal] = useState(false)
  const [showAddToSpaceModal, setShowAddToSpaceModal] = useState(false)
  const [showNotificationsModal, setShowNotificationsModal] = useState(false)
  const [showMemberDetails, setShowMemberDetails] = useState(false)

  // Invite/Friend System State
  const [inviteSearchQuery, setInviteSearchQuery] = useState("")
  const [inviteSearchResults, setInviteSearchResults] = useState([])
  const [selectedInviteUser, setSelectedInviteUser] = useState(null)
  const [newSpaceName, setNewSpaceName] = useState("")
  const [inviteSent, setInviteSent] = useState(false)

  // File Attachment State
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const wsRef = useRef(null)

  // --- Initialization & Data Loading ---

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return

    const pollUser = async () => {
      try {
        const storedUsers = await Storage.getUsers()
        const freshUser = Array.isArray(storedUsers)
          ? storedUsers.find(u => u.id === currentUser.id)
          : null

        if (freshUser) {
          setCurrentUser(prev => {
            // Check if anything actually changed to avoid unnecessary re-renders
            const hasSpaceChange = JSON.stringify(prev.spaces) !== JSON.stringify(freshUser.spaces)
            const hasFriendChange = JSON.stringify(prev.friends) !== JSON.stringify(freshUser.friends)
            const hasNotificationChange = JSON.stringify(prev.notifications) !== JSON.stringify(freshUser.notifications)

            if (!hasSpaceChange && !hasFriendChange && !hasNotificationChange) {
              return prev
            }

            // Be conservative about overwriting spaces: only accept server spaces if there are more or equal items.
            let newSpaces = prev.spaces
            if (Array.isArray(freshUser.spaces)) {
              if ((freshUser.spaces.length || 0) >= (prev.spaces?.length || 0)) {
                newSpaces = freshUser.spaces
              } else {
                // Server reports fewer spaces (likely eventual consistency); keep local state to avoid flicker
                newSpaces = prev.spaces
              }
            }

            return {
              ...prev,
              spaces: newSpaces,
              friends: freshUser.friends || prev.friends,
              notifications: freshUser.notifications || prev.notifications
            }
          })
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }

    const interval = setInterval(pollUser, 2000)
    return () => clearInterval(interval)
  }, [isAuthenticated, currentUser?.id])

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return

    const loadSpaces = async () => {
      const userSpaces = await Storage.getSpacesForUser(currentUser.spaces)

      const enrichedSpaces = userSpaces.map(s => ({
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
    }

    loadSpaces()
  }, [isAuthenticated, currentUser?.spaces, currentUser?.friends])

  // Load friends list for the current user (keeps `friends` state in sync)
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return

    const loadFriends = async () => {
      if (currentUser?.friends && currentUser.friends.length > 0) {
        try {
          const friendsList = await Storage.getFriends(currentUser.friends)
          setFriends(Array.isArray(friendsList) ? friendsList : [])
        } catch (error) {
          console.error("Error loading friends:", error)
          setFriends([])
        }
      } else {
        setFriends([])
      }
    }

    loadFriends()
  }, [isAuthenticated, currentUser?.friends])

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return

    const chatId = getActiveChatId()
    if (!chatId) return

    // Load existing messages for this chat first
    const loadHistory = async () => {
      try {
        const history = await Storage.getMessages(chatId)
        setMessages(prev => ({ ...prev, [chatId]: history || [] }))
      } catch (err) {
        console.error("Failed to load chat history:", err)
      }
    }

    loadHistory()

    // Clean up previous connection if present
    if (wsRef.current) {
      try {
        wsRef.current.close()
      } catch (err) {
        console.error("Error closing previous websocket:", err)
      }
      wsRef.current = null
    }

    // Create new WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const token = getToken()
    // Include both token and explicit userId as query params (backend prefers token if present)
    const wsUrl = `${protocol}//127.0.0.1:8000/ws/chat/${chatId}?token=${token}&userId=${currentUser.id}`

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log("WebSocket connected")
      }

      // Use an async handler so we can perform data refreshes when 'system' events arrive
    const handleWsEvent = async data => {
      switch (data.type) {
        case "presence_update":
          setOnlineUserIds(Array.isArray(data.online_users) ? data.online_users : [])
          break

        case "sync_spaces":
          // Refresh current user from server and update localStorage so UI updates immediately
          try {
            const allUsers = await Storage.getUsers()
            const freshUser = Array.isArray(allUsers) ? allUsers.find(u => u.id === currentUser.id) : null
            if (freshUser) {
              setCurrentUser(freshUser)
              localStorage.setItem("spaces_user", JSON.stringify(freshUser))
            }
          } catch (e) {
            console.error("sync_spaces failed:", e)
          }
          break

        case "new_message":
          // Append incoming messages consistently using a defined payload
          setMessages(prev => ({
            ...prev,
            [data.chatId]: [...(prev[data.chatId] || []), data.message]
          }))
          break

        default:
          // Fallback: if it's a message-like payload without explicit type
          if (!data.type || data.type === "message") {
            setMessages(prev => ({
              ...prev,
              [chatId]: [...(prev[chatId] || []), data]
            }))
          } else {
            console.log("Other event:", data)
          }
      }
    }

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data)
        handleWsEvent(data)
      } catch (err) {
        console.error("Error parsing WebSocket message:", err)
      }
    }

      ws.onerror = error => {
        console.error("WebSocket error:", error)
      }

      ws.onclose = () => {
        console.log("WebSocket disconnected")
        // Clear local presence state until a fresh presence_update arrives (if any)
        setOnlineUserIds([])
      }

      wsRef.current = ws
    } catch (error) {
      console.error("Error creating WebSocket:", error)
    }

    // Cleanup on unmount or when deps change
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch (err) {
          console.error("Error closing websocket on cleanup:", err)
        }
        wsRef.current = null
      }
    }
  }, [isAuthenticated, activeChannel, activeView, activeDMUser])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, activeChannel, activeView, activeDMUser])

  useEffect(() => {
    if (showAddFriendModal && inviteSearchQuery.length > 0) {
      const fetchResults = async () => {
        const res = await Storage.searchUsersByName(inviteSearchQuery)
        const list = Array.isArray(res) ? res : []
        const results = list.filter(
          u => u.id !== currentUser?.id && !currentUser?.friends?.includes(u.id)
        )
        setInviteSearchResults(results)
      }
      fetchResults()
    } else {
      setInviteSearchResults([])
    }
  }, [inviteSearchQuery, showAddFriendModal, currentUser])

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

      const newUser = {
        id: Date.now(),
        name: authData.name,
        email: authData.email,
        password: authData.password,
        avatar: "👤",
        status: "online",
        spaces: [],
        dms: [],
        friends: [],
        notifications: []
      }

      const res = await Storage.saveUser(newUser)
      if (res && res.user) {
        setCurrentUser(res.user)
        setIsAuthenticated(true)
        setAuthSuccess("Account created successfully!")
        // Persist auth info if server returned a token, otherwise at least save user
        if (res.token) {
          saveAuth(res.user, res.token)
        } else {
          localStorage.setItem("spaces_user", JSON.stringify(res.user))
        }
      } else {
        setAuthError("Signup failed")
      }
    } else {
      if (!authData.email || !authData.password) {
        setAuthError("Please fill in all fields")
        return
      }
      const res = await Storage.login({
        email: authData.email,
        password: authData.password
      })

      if (res && res.user) {
        setCurrentUser(res.user)
        setIsAuthenticated(true)
        setAuthSuccess("Logged in successfully!")
        // Ensure auth is saved (Storage.login normally does this, but be defensive)
        if (res.token) {
          saveAuth(res.user, res.token)
        } else {
          localStorage.setItem("spaces_user", JSON.stringify(res.user))
        }
      } else {
        setAuthError(res?.error || "Invalid credentials")
      }
    }
  }

  const handleLogout = () => {
    // Clear persisted auth immediately
    logout()
    setIsAuthenticated(false)
    setCurrentUser(null)
    setSpaces([])
    setFriends([])
    setOnlineUserIds([])
    setActiveSpace(null)
    setActiveView("channel")
    setAuthData({ email: "", password: "", confirmPassword: "", name: "" })
    setAuthError("")
    setAuthSuccess("")
  }

  // --- Helpers ---
  const formatTime = timestamp => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch (e) {
      return ""
    }
  }

  const getCurrentSpace = () => spaces.find(s => s.id === activeSpace)
  const getCurrentChannels = () => getCurrentSpace()?.channels || []

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
    const data = chatId ? messages[chatId] : []
    return Array.isArray(data) ? data : []
  }

  const getUser = (userId, fallbackName = "Unknown User") => {
    if (currentUser?.id === userId) return currentUser

    // Look in the users and friends state you already loaded
    let found = users.find(u => u.id === userId)
    if (!found) found = friends.find(u => u.id === userId)

    return found || { name: fallbackName, avatar: "👤" }
  }

  // Presence helper: normalize IDs as strings when checking presence
  const isUserOnline = userId => onlineUserIds.includes(String(userId))

  const getActiveMembers = () => {
    if (activeView === "channel") {
      const channel = getCurrentChannels().find(c => c.id === activeChannel)
      if (!channel) return []
      return channel.members.map(id => getUser(id)).filter(u => u !== undefined)
    } else if (activeView === "dm" && activeDMUser && currentUser) {
      const partner = getUser(activeDMUser)
      return partner ? [currentUser, partner] : [currentUser]
    }
    return []
  }

  const getActiveViewName = () => {
    if (activeView === "channel") {
      const channels = getCurrentChannels()
      const channel = channels.find(c => c.id === activeChannel)
      return channel ? `# ${channel.name}` : ""
    } else if (activeView === "dm" && activeDMUser) {
      const user = getUser(activeDMUser)
      return user ? user.name : "Unknown User"
    }
    return ""
  }

  // --- Actions ---
  const handleFileSelect = async e => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true)
      const files = Array.from(e.target.files)
      const newAttachments = []

      for (const file of files) {
        const reader = new FileReader()
        const base64Promise = new Promise(resolve => {
          reader.onload = () => resolve(reader.result)
        })
        reader.readAsDataURL(file)

        const base64 = await base64Promise
        newAttachments.push({
          id: Date.now() + Math.random(),
          name: file.name,
          size: file.size,
          type: file.type,
          data: base64
        })
      }

      setSelectedFiles(prev => [...prev, ...newAttachments])
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const removeAttachment = id => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id))
  }

  const sendMessage = async () => {
    if ((!messageInput.trim() && selectedFiles.length === 0) || !currentUser) return
    const chatId = getActiveChatId()
    if (!chatId) return

    const newMsg = {
      id: Date.now(),
      text: messageInput,
      senderId: currentUser.id,
      senderName: currentUser.name,
      timestamp: new Date().toISOString(),
      attachments: selectedFiles
    }

    // 1. Send via WebSocket (the backend will broadcast this back to you)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(newMsg))
      } catch (e) {
        console.error("ws send error", e)
      }
    }

    // 2. Save to storage (persist for later)
    try {
      await Storage.saveMessage(chatId, newMsg)
    } catch (e) {
      console.error("failed to save message", e)
    }

    // 3. Clear input and attachments
    setMessageInput("")
    setSelectedFiles([])

    // NOTE: Do NOT update local messages state here — the websocket listener
    // will receive the broadcasted message and update `messages` for all clients.
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
          members: [currentUser.id]
        },
        {
          id: Date.now() + 2,
          name: "random",
          type: "public",
          members: [currentUser.id]
        }
      ],
      expanded: true,
      ownerId: currentUser.id
    }

    // 1. Optimistic UI: update local spaces so the UI shows the new space immediately
    setSpaces(prev => [...prev, newSpace])
    setCurrentUser(prev => ({ ...prev, spaces: [...(prev.spaces || []), newSpace.id] }))

    // 2. Persist to storage / backend
    await Storage.saveSpace(newSpace)
    const updatedUser = {
      ...currentUser,
      spaces: [...(currentUser.spaces || []), newSpace.id]
    }
    await Storage.saveUser(updatedUser)

    // Ensure local state reflects persisted user
    setCurrentUser(updatedUser)

    setShowCreateSpaceModal(false)
    setNewSpaceName("")
  }

  const createChannel = () => {
    if (!newChannelName.trim() || !currentUser || !activeSpace) return
    const newChannel = {
      id: Date.now(),
      name: newChannelName.toLowerCase().replace(/\s+/g, "-"),
      type: newChannelType,
      members: [currentUser.id]
    }
    const space = spaces.find(s => s.id === activeSpace)
    if (space) {
      const updatedSpace = {
        ...space,
        channels: [...space.channels, newChannel]
      }
      Storage.saveSpace(updatedSpace)
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

  // --- Friend & Invite System ---

  const sendFriendRequest = () => {
    if (!selectedInviteUser || !currentUser) return
    Storage.sendFriendRequest(
      currentUser.id,
      currentUser.name,
      selectedInviteUser.id
    )
    setInviteSent(true)
    setTimeout(() => {
      setShowAddFriendModal(false)
      setInviteSearchQuery("")
      setSelectedInviteUser(null)
      setInviteSent(false)
    }, 2000)
  }

  const addFriendToSpace = () => {
    if (!selectedInviteUser || !currentUser || !activeSpace) return
    Storage.addMemberToSpace(selectedInviteUser.id, activeSpace)

    setInviteSent(true)
    setTimeout(() => {
      setShowAddToSpaceModal(false)
      setSelectedInviteUser(null)
      setInviteSent(false)
      // Refresh current space
      const updatedSpace = Storage.getSpaces().find(s => s.id === activeSpace)
      if (updatedSpace) {
        setSpaces(prev =>
          prev.map(s => (s.id === activeSpace ? updatedSpace : s))
        )
      }
    }, 1500)
  }

  const handleNotificationAction = async (notificationId, type) => {
    try {
      if (!currentUser) return

      if (type === "friend_request") {
        // 1. Locate the notification to extract the friend's id
        const notification = (currentUser.notifications || []).find(
          n => n.id === notificationId
        )
        if (!notification) return

        // 2. Call backend to accept the friend request (include notificationId so backend can remove it)
        const result = await Storage.acceptFriendRequest(
          notification.fromId,
          notification.id
        )

        if (result && !result.error) {
          // 3. Locally update the user to remove the notification and add the friend
          const updatedNotifications = (currentUser.notifications || []).filter(
            n => n.id !== notificationId
          )
          const updatedFriends = Array.from(
            new Set([...(currentUser.friends || []), notification.fromId])
          )

          const updatedUser = {
            ...currentUser,
            notifications: updatedNotifications,
            friends: updatedFriends
          }

          setCurrentUser(updatedUser)
          // Keep localStorage in sync with the updated user
          localStorage.setItem("spaces_user", JSON.stringify(updatedUser))
        }
      } else {
        // Space invite: accept via backend and refresh user state
        const joinedSpace = await Storage.acceptInvite(currentUser.id, notificationId)
        if (joinedSpace) {
          const users = await Storage.getUsers()
          const updatedUser = users.find(u => u.id === currentUser.id)
          if (updatedUser) {
            setCurrentUser(updatedUser)
            localStorage.setItem("spaces_user", JSON.stringify(updatedUser))
            setActiveSpace(joinedSpace.id)
            setActiveView("channel")
            if (joinedSpace.channels && joinedSpace.channels.length > 0) {
              setActiveChannel(joinedSpace.channels[0].id)
            }
          }
        }
      }

      setShowNotificationsModal(false)
    } catch (error) {
      console.error("Failed to handle notification:", error)
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-3xl mb-6 shadow-xl shadow-indigo-200 transform rotate-3 hover:rotate-6 transition-transform">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
              Spaces
            </h1>
            <p className="text-slate-500 text-lg">
              Your new favorite place to collaborate.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
            {/* Auth Form */}
            <div className="flex border-b border-slate-100 p-1 bg-slate-50/50">
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-3 px-6 text-center font-bold text-sm rounded-xl transition-all duration-300 ${
                  authMode === "login"
                    ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthMode("signup")}
                className={`flex-1 py-3 px-6 text-center font-bold text-sm rounded-xl transition-all duration-300 ${
                  authMode === "signup"
                    ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Sign Up
              </button>
            </div>
            <form onSubmit={handleAuthSubmit} className="p-8 space-y-6">
              {authSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-sm flex items-center gap-3">
                  <CheckCircle className="w-5 h-5" />
                  {authSuccess}
                </div>
              )}
              {authError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm flex items-center gap-3">
                  <XCircle className="w-5 h-5" />
                  {authError}
                </div>
              )}

              {authMode === "signup" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={authData.name}
                    onChange={e =>
                      setAuthData({ ...authData, name: e.target.value })
                    }
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all font-medium"
                    placeholder="Jane Doe"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={authData.email}
                  onChange={e =>
                    setAuthData({ ...authData, email: e.target.value })
                  }
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all font-medium"
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={authData.password}
                  onChange={e =>
                    setAuthData({ ...authData, password: e.target.value })
                  }
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
              {authMode === "signup" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
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
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all font-medium"
                    placeholder="••••••••"
                  />
                </div>
              )}
              <button
                type="submit"
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all hover:shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2 transform active:scale-[0.98]"
              >
                {authMode === "login" ? (
                  <>
                    <LogIn className="w-5 h-5" /> Sign In
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="w-5 h-5" /> Create Account
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // --- Authenticated App UI ---
  const filteredSpaces = spaces.filter(space =>
    space.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredFriends = (friends || []).filter(u =>
    u && u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const activeMembers = getActiveMembers()

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Left Sidebar - SPACES */}
      <div
        className={`${
          sidebarCollapsed ? "w-20" : "w-72"
        } glass-panel flex flex-col border-r border-slate-200/60 transition-all duration-300 z-20 flex-shrink-0`}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between h-[72px]">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="font-extrabold text-lg tracking-tight text-slate-800">
                Spaces
              </h1>
            </div>
          )}
          <div className="flex gap-1 ml-auto">
            {!sidebarCollapsed && (
              <button
                onClick={() => setShowCreateSpaceModal(true)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!sidebarCollapsed && (
          <div className="px-5 pt-4 pb-2 animate-fade-in">
            <div className="relative group">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Find a space..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border border-slate-200/50 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-4">
          {!sidebarCollapsed ? (
            <div className="animate-fade-in">
              <div className="px-3 mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Your Spaces
                </span>
                <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {spaces.length}
                </span>
              </div>

              {filteredSpaces.length > 0 ? (
                filteredSpaces.map(space => (
                  <div key={space.id} className="mb-2">
                    <div
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 group ${
                        activeView === "channel" && activeSpace === space.id
                          ? "bg-white shadow-md shadow-indigo-100 border border-indigo-50"
                          : "hover:bg-slate-100/80 border border-transparent"
                      }`}
                      onClick={() => {
                        setActiveSpace(space.id)
                        setActiveView("channel")
                        if (space.channels.length > 0)
                          setActiveChannel(space.channels[0].id)
                      }}
                    >
                      <div
                        className={`p-2 rounded-lg transition-colors ${
                          activeSpace === space.id
                            ? "bg-indigo-100 text-indigo-600"
                            : "bg-slate-100 text-slate-500 group-hover:bg-white"
                        }`}
                      >
                        {space.icon}
                      </div>
                      <span
                        className={`font-semibold text-sm truncate flex-1 ${
                          activeSpace === space.id
                            ? "text-slate-900"
                            : "text-slate-600"
                        }`}
                      >
                        {space.name}
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          toggleSpaceExpansion(space.id)
                        }}
                        className="p-1 hover:bg-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        {space.expanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </button>
                    </div>

                    {space.expanded && (
                      <div className="ml-5 pl-4 border-l-2 border-slate-100 mt-1 space-y-0.5">
                        {space.channels.map(channel => (
                          <button
                            key={channel.id}
                            onClick={() => {
                              setActiveChannel(channel.id)
                              setActiveView("channel")
                              setActiveSpace(space.id)
                            }}
                            className={`flex items-center gap-2.5 w-full px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                              activeView === "channel" &&
                              activeChannel === channel.id
                                ? "bg-indigo-50 text-indigo-600"
                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                            }`}
                          >
                            <Hash
                              className={`w-3.5 h-3.5 ${
                                activeChannel === channel.id
                                  ? "text-indigo-400"
                                  : "text-slate-300"
                              }`}
                            />
                            <span className="truncate">{channel.name}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setActiveSpace(space.id)
                            setShowChannelModal(true)
                          }}
                          className="flex items-center gap-2.5 w-full px-3 py-1.5 rounded-lg text-[13px] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all group"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add channel</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  No spaces found
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 mt-2 animate-fade-in">
              {spaces.map(s => (
                <button
                  key={s.id}
                  className={`p-3 rounded-2xl transition-all duration-300 ${
                    activeSpace === s.id
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                      : "bg-slate-100 text-slate-500 hover:bg-white hover:shadow-md"
                  }`}
                  title={s.name}
                  onClick={() => {
                    setActiveSpace(s.id)
                    setActiveView("channel")
                    if (s.channels.length > 0)
                      setActiveChannel(s.channels[0].id)
                  }}
                >
                  {s.icon}
                </button>
              ))}
              <button
                onClick={() => setShowCreateSpaceModal(true)}
                className="p-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative z-0">
        {/* Header */}
        <div className="h-[72px] bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 border-b border-slate-200/50 shadow-sm">
          <div
            onClick={() => setShowMemberDetails(prev => !prev)}
            className="flex items-center gap-4 cursor-pointer group p-1.5 -ml-2 rounded-xl hover:bg-slate-50 transition-all"
          >
            {activeView === "dm" ? (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center text-lg shadow-sm border border-white">
                    {getUser(activeDMUser)?.avatar}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                      getUser(activeDMUser)?.status === "online"
                        ? "bg-emerald-500"
                        : "bg-slate-300"
                    }`}
                  ></span>
                </div>
                <div>
                  <h2 className="font-bold text-lg text-slate-800 leading-tight">
                    {getActiveViewName()}
                  </h2>
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{" "}
                    Online
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 border border-slate-200">
                  <Hash className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-slate-800 leading-tight">
                    {getActiveViewName().replace("#", "")}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {activeMembers.length}{" "}
                      members
                    </span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500">
                      • View details
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeView === "channel" && (
              <button
                onClick={() => {
                  setInviteSearchQuery("")
                  setSelectedInviteUser(null)
                  setShowAddToSpaceModal(true)
                }}
                className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-slate-200 active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Member</span>
              </button>
            )}

            <div className="h-8 w-px bg-slate-200 mx-2"></div>

            {/* User Menu */}
            <div className="relative group z-40">
              <button className="flex items-center gap-3 pl-2 pr-1 py-1.5 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100 hover:shadow-sm">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-700">
                    {currentUser?.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    Available
                  </div>
                </div>
                <div className="relative">
                  <div className="w-9 h-9 bg-indigo-50 rounded-full flex items-center justify-center text-lg border border-indigo-100">
                    {currentUser?.avatar}
                  </div>
                  {currentUser?.notifications?.length ? (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                    </span>
                  ) : null}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-300" />
              </button>

              <div className="absolute right-0 top-full mt-2 w-72 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-100 py-2 hidden group-hover:block animate-fade-in origin-top-right">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl bg-white p-2 rounded-full shadow-sm border border-slate-100">
                      {currentUser?.avatar}
                    </span>
                    <div className="overflow-hidden">
                      <div className="font-bold text-slate-800 truncate">
                        {currentUser?.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {currentUser?.email}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => setShowNotificationsModal(true)}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl flex items-center justify-between transition-colors font-medium"
                  >
                    <div className="flex items-center gap-3">
                      <Bell className="w-4 h-4" /> Notifications
                    </div>
                    {currentUser?.notifications?.length ? (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm shadow-red-200">
                        {currentUser?.notifications?.length}
                      </span>
                    ) : null}
                  </button>
                  <div className="h-px bg-slate-100 my-1 mx-2"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors font-medium"
                  >
                    <LogIn className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages / Chat Area */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin">
              {getCurrentMessages().length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <MessageSquare className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="font-semibold text-slate-400">
                    No messages yet.
                  </p>
                  <p className="text-sm">Start the conversation!</p>
                </div>
              ) : (
                getCurrentMessages().map((msg, idx) => {
                  const senderId = msg.senderId ?? msg.userId
                  const senderName = msg.senderName ?? msg.sender ?? msg.name ?? "Unknown User"
                  const user = getUser(senderId, senderName)
                  const isMe = senderId === currentUser?.id

                  // Check if previous message was same user to group them
                  const prevMsg = idx > 0 ? getCurrentMessages()[idx - 1] : null
                  const prevSenderId = prevMsg ? (prevMsg.senderId ?? prevMsg.userId) : null
                  const isSequence = prevMsg && prevSenderId === senderId

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-4 ${
                        isMe ? "flex-row-reverse" : ""
                      } ${isSequence ? "mt-1" : "mt-6"} group animate-fade-in`}
                    >
                      <div className="flex-shrink-0 w-10 flex flex-col items-center">
                        {!isSequence ? (
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm border border-white ${
                              isMe ? "bg-indigo-50" : "bg-white"
                            }`}
                          >
                            {user?.avatar}
                          </div>
                        ) : (
                          <div className="w-10" />
                        )}
                      </div>

                      <div
                        className={`flex flex-col max-w-[75%] sm:max-w-[60%] ${
                          isMe ? "items-end" : "items-start"
                        }`}
                      >
                        {!isSequence && (
                          <div className="flex items-baseline gap-2 mb-1 px-1">
                            <span className="text-xs font-bold text-slate-700">
                              {user?.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {msg.timestamp
                                ? formatTime(msg.timestamp)
                                : "now"}
                            </span>
                          </div>
                        )}

                        {msg.text && (
                          <div
                            className={`px-4 py-2.5 shadow-sm text-[15px] leading-relaxed break-words relative group-hover:shadow-md transition-shadow ${
                              isMe
                                ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm"
                                : "bg-white text-slate-800 rounded-2xl rounded-tl-sm border border-slate-100"
                            }`}
                          >
                            {msg.text}
                          </div>
                        )}

                        {msg.attachments && msg.attachments.length > 0 && (
                          <div
                            className={`flex flex-wrap gap-2 mt-2 ${
                              isMe ? "justify-end" : ""
                            }`}
                          >
                            {msg.attachments.map(att => (
                              <div
                                key={att.id}
                                className="relative rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm transition-transform hover:scale-[1.02]"
                              >
                                {att.type.startsWith("image/") && att.data ? (
                                  <img
                                    src={att.data}
                                    alt={att.name}
                                    className="max-w-[200px] max-h-[200px] object-cover"
                                  />
                                ) : (
                                  <div className="p-3 flex items-center gap-3 min-w-[180px]">
                                    <div className="bg-indigo-50 p-2 rounded-lg text-indigo-500">
                                      <FileIcon className="w-5 h-5" />
                                    </div>
                                    <div className="overflow-hidden">
                                      <div className="text-xs font-bold text-slate-700 truncate">
                                        {att.name}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {(att.size / 1024).toFixed(1)} KB
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 sm:p-6 pt-2">
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-2 relative transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400">
                {/* Attachments Preview */}
                {selectedFiles.length > 0 && (
                  <div className="flex gap-2 p-3 border-b border-slate-100 mb-2 overflow-x-auto">
                    {selectedFiles.map(file => (
                      <div
                        key={file.id}
                        className="relative group bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center gap-2 flex-shrink-0"
                      >
                        {file.type.startsWith("image/") && file.data ? (
                          <img
                            src={file.data}
                            className="w-8 h-8 rounded-lg object-cover"
                            alt=""
                          />
                        ) : (
                          <FileIcon className="w-5 h-5 text-indigo-500" />
                        )}
                        <span className="text-xs font-medium max-w-[80px] truncate">
                          {file.name}
                        </span>
                        <button
                          onClick={() => removeAttachment(file.id)}
                          className="absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-md border border-slate-200 hover:text-red-500"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 px-2 pb-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 mb-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
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
                    className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400 py-3.5 max-h-32 resize-none leading-relaxed"
                    style={{ minHeight: "48px" }}
                  />

                  <button
                    onClick={sendMessage}
                    disabled={
                      (!messageInput.trim() && selectedFiles.length === 0) ||
                      isUploading
                    }
                    className="p-3 mb-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-90"
                  >
                    <Send className="w-5 h-5 ml-0.5" />
                  </button>
                </div>
              </div>
              <div className="text-center mt-2 text-[10px] text-slate-400 font-medium">
                Press <strong>Enter</strong> to send
              </div>
            </div>
          </div>

          {/* Member Details Sidebar */}
          <div
            className={`border-l border-slate-200 bg-white transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col shadow-2xl z-30 ${
              showMemberDetails
                ? "w-80 translate-x-0"
                : "w-0 translate-x-full opacity-0 overflow-hidden"
            }`}
          >
            <div className="h-[72px] flex items-center justify-between px-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Details</h3>
              <button
                onClick={() => setShowMemberDetails(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              <div className="text-center mb-8">
                <div className="inline-block relative mb-4">
                  {activeView === "dm" ? (
                    <span className="text-7xl drop-shadow-md filter">
                      {getUser(activeDMUser)?.avatar}
                    </span>
                  ) : (
                    <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl mx-auto flex items-center justify-center text-slate-400 shadow-inner">
                      <Hash className="w-10 h-10" />
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {getActiveViewName().replace("#", "")}
                </h2>
                {activeView === "channel" && (
                  <p className="text-sm font-medium text-slate-500 mt-1">
                    {activeMembers.length} members in this channel
                  </p>
                )}
              </div>

              {activeView === "channel" && (
                <div className="mb-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Topic
                  </h4>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-sm text-slate-600 leading-relaxed">
                    Welcome to the{" "}
                    <span className="font-bold text-indigo-600">
                      #{getActiveViewName().replace("# ", "")}
                    </span>{" "}
                    channel. This is the beginning of your collaboration journey
                    in {getCurrentSpace()?.name}.
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                  Members
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
                    {activeMembers.length}
                  </span>
                </h4>
                <div className="space-y-1">
                  {activeMembers.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl transition-colors cursor-default group border border-transparent hover:border-slate-100"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm border border-slate-100">
                          {member.avatar}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            member.status === "online"
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          }`}
                        ></span>
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-sm font-bold text-slate-800 truncate">
                          {member.name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {member.email}
                        </div>
                      </div>
                      {member.id === currentUser?.id && (
                        <span className="ml-auto text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md font-bold tracking-wide">
                          YOU
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - FRIENDS & DMs */}
      <div className="w-64 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 z-20">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between h-[72px]">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            Friends{" "}
            <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-xs">
              {filteredFriends.length}
            </span>
          </h2>
          <button
            onClick={() => {
              setInviteSearchQuery("")
              setInviteSearchResults([])
              setShowAddFriendModal(true)
            }}
            className="p-2 hover:bg-indigo-50 rounded-xl text-indigo-600 transition-all hover:scale-105"
            title="Add Friend"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
          {filteredFriends.length > 0 ? (
            filteredFriends.map(friend => {
              const isOnline = isUserOnline(friend.id)
              return (
                <button
                  key={friend.id}
                  onClick={() => {
                    setActiveView("dm")
                    setActiveDMUser(friend.id)
                    setActiveSpace(null)
                  }}
                  className={`flex items-center gap-3 w-full p-2.5 rounded-xl transition-all group ${
                    activeView === "dm" && activeDMUser === friend.id
                      ? "bg-indigo-50/50 border border-indigo-100 shadow-sm"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className="relative">
                    <div className="w-9 h-9 bg-slate-50 rounded-full flex items-center justify-center text-lg border border-slate-100 group-hover:bg-white transition-colors">
                      {friend.avatar}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                        isOnline ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    ></span>
                  </div>
                  <div className="text-left overflow-hidden">
                    <div className="text-sm font-semibold text-slate-700 truncate group-hover:text-indigo-700 transition-colors">
                      {friend.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {isOnline ? "Online" : "Offline"}
                    </div>
                  </div>
                </button>
              )
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-slate-300">
                <UserPlus className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-500 font-medium mb-1">
                No friends yet
              </p>
              <p className="text-[10px] text-slate-400">
                Add people to start chatting!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Generic Modal Wrapper */}
      {showCreateSpaceModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-800">
                Create Space
              </h3>
              <button
                onClick={() => setShowCreateSpaceModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Space Name
                </label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={e => setNewSpaceName(e.target.value)}
                  placeholder="e.g. Design Team"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium"
                  autoFocus
                />
              </div>
              <button
                onClick={createSpace}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 transition-all"
              >
                Create Space
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Friend Modal */}
      {showAddFriendModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-800">Add Friend</h3>
              <button
                onClick={() => setShowAddFriendModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            {!inviteSent ? (
              <div className="space-y-6">
                <div className="relative">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Find People
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={inviteSearchQuery}
                      onChange={e => {
                        setInviteSearchQuery(e.target.value)
                        setSelectedInviteUser(null)
                      }}
                      placeholder="Search by name..."
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium"
                    />
                  </div>
                  {inviteSearchResults.length > 0 && !selectedInviteUser && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto py-2">
                      {inviteSearchResults.map(u => (
                        <div
                          key={u.id}
                          onClick={() => setSelectedInviteUser(u)}
                          className="px-4 py-3 hover:bg-indigo-50 cursor-pointer flex items-center gap-3 transition-colors border-l-2 border-transparent hover:border-indigo-500"
                        >
                          <span className="text-xl bg-slate-50 rounded-full w-8 h-8 flex items-center justify-center">
                            {u.avatar}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {u.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedInviteUser && (
                  <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div className="text-2xl bg-white p-2 rounded-full shadow-sm">
                      {selectedInviteUser.avatar}
                    </div>
                    <div>
                      <p className="text-xs text-indigo-500 font-bold uppercase tracking-wide">
                        Selected
                      </p>
                      <p className="font-bold text-slate-800">
                        {selectedInviteUser.name}
                      </p>
                    </div>
                    <CheckCircle className="w-6 h-6 text-indigo-500 ml-auto" />
                  </div>
                )}
                <button
                  onClick={sendFriendRequest}
                  disabled={!selectedInviteUser}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white shadow-lg shadow-indigo-200 transition-all"
                >
                  <UserPlus className="w-5 h-5" />
                  Send Request
                </button>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <Check className="w-10 h-10 text-emerald-600" />
                </div>
                <h4 className="text-2xl font-bold mb-2 text-slate-800">
                  Sent!
                </h4>
                <p className="text-slate-500">
                  Friend request delivered successfully.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add To Space Modal */}
      {showAddToSpaceModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-800">Add Member</h3>
              <button
                onClick={() => setShowAddToSpaceModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {currentUser?.friends.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium mb-4">
                  You need friends to add them to a space.
                </p>
                <button
                  onClick={() => {
                    setShowAddToSpaceModal(false)
                    setShowAddFriendModal(true)
                  }}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Find Friends
                </button>
              </div>
            ) : !inviteSent ? (
              <div className="space-y-6">
                <div className="max-h-60 overflow-y-auto pr-2 space-y-2 scrollbar-thin">
                  {friends.map(friend => {
                    const currentSpaceObj = spaces.find(
                      s => s.id === activeSpace
                    )
                    const isMember = currentSpaceObj?.members.includes(
                      friend.id
                    )
                    if (isMember) return null

                    const isSelected = selectedInviteUser?.id === friend.id

                    return (
                      <div
                        key={friend.id}
                        onClick={() => setSelectedInviteUser(friend)}
                        className={`p-3 rounded-2xl cursor-pointer flex items-center justify-between border-2 transition-all ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-500 shadow-md"
                            : "bg-white border-slate-100 hover:border-indigo-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl bg-white p-1 rounded-full border border-slate-100">
                            {friend.avatar}
                          </span>
                          <span
                            className={`font-bold ${
                              isSelected ? "text-indigo-900" : "text-slate-700"
                            }`}
                          >
                            {friend.name}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-6 h-6 text-indigo-500" />
                        )}
                      </div>
                    )
                  })}
                  {friends.every(f =>
                    spaces
                      .find(s => s.id === activeSpace)
                      ?.members.includes(f.id)
                  ) && (
                    <p className="text-center text-slate-400 italic py-4">
                      All your friends are already here!
                    </p>
                  )}
                </div>

                <button
                  onClick={addFriendToSpace}
                  disabled={!selectedInviteUser}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg transition-all"
                >
                  Add to {getCurrentSpace()?.name}
                </button>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-10 h-10 text-emerald-600" />
                </div>
                <h4 className="text-2xl font-bold mb-2 text-slate-800">
                  Added!
                </h4>
                <p className="text-slate-500">Member added successfully.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl ring-1 ring-slate-900/5 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <Bell className="w-6 h-6 text-indigo-500" /> Notifications
              </h3>
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {currentUser?.notifications?.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No new notifications</p>
                </div>
              ) : (
                currentUser?.notifications?.map(notif => (
                  <div
                    key={notif.id}
                    className="p-5 border border-slate-100 rounded-2xl bg-slate-50 hover:bg-white hover:shadow-lg transition-all group"
                  >
                    <div className="flex gap-4">
                      <div className="bg-white p-3 rounded-full h-fit shadow-sm border border-slate-100">
                        {notif.type === "friend_request" ? (
                          <UserPlus className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Mail className="w-5 h-5 text-pink-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        {notif.type === "friend_request" ? (
                          <p className="text-sm text-slate-600 leading-relaxed">
                            <span className="font-bold text-slate-900">
                              {notif.from}
                            </span>{" "}
                            sent you a friend request.
                          </p>
                        ) : (
                          <p className="text-sm text-slate-600 leading-relaxed">
                            <span className="font-bold text-slate-900">
                              {notif.from}
                            </span>{" "}
                            invited you to{" "}
                            <span className="font-bold text-indigo-600">
                              {notif.spaceName}
                            </span>
                          </p>
                        )}

                        <p className="text-xs text-slate-400 mt-2 font-medium">
                          {new Date(notif.timestamp).toLocaleDateString()}
                        </p>
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={() =>
                              handleNotificationAction(notif.id, notif.type)
                            }
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                          >
                            <CheckCircle className="w-4 h-4" /> Accept
                          </button>
                        </div>
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-800">New Channel</h3>
              <button
                onClick={() => setShowChannelModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Channel Name
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400 font-bold">
                    #
                  </span>
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value)}
                    placeholder="announcements"
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Visibility
                </label>
                <div className="flex gap-4">
                  <label
                    className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      newChannelType === "public"
                        ? "border-indigo-500 bg-indigo-50/50"
                        : "border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="channelType"
                      checked={newChannelType === "public"}
                      onChange={() => setNewChannelType("public")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-bold text-slate-700">
                      Public
                    </span>
                  </label>
                  <label
                    className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      newChannelType === "private"
                        ? "border-indigo-500 bg-indigo-50/50"
                        : "border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="channelType"
                      checked={newChannelType === "private"}
                      onChange={() => setNewChannelType("private")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-bold text-slate-700">
                      Private
                    </span>
                  </label>
                </div>
              </div>

              <button
                onClick={createChannel}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-white shadow-lg transition-all"
              >
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}