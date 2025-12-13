import React, { useState, useEffect, useRef } from "react"
import {
  Send,
  Hash,
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
  GraduationCap,
  Briefcase,
  User as UserIcon,
  MessageCircle,
  LogIn,
  UserPlus as UserPlusIcon,
  CheckCircle,
  File as FileIcon
} from "lucide-react"
import * as Storage from "./services/storage"

export default function CollaborationApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [authMode, setAuthMode] = useState("login") // 'login' or 'signup'
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
  const [users, setUsers] = useState([]) // For lookups
  const [dmUsers, setDmUsers] = useState([]) // Users we have open DMs with

  // UI State
  const [activeSpace, setActiveSpace] = useState(null)
  const [activeChannel, setActiveChannel] = useState(1)
  const [activeView, setActiveView] = useState("channel")
  const [activeDMUser, setActiveDMUser] = useState(null) // userId of person we are chatting with

  const [messages, setMessages] = useState({})
  const [chats, setChats] = useState([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)

  // Modals & Panels
  const [messageInput, setMessageInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showThreadPanel, setShowThreadPanel] = useState(false)
  const [activeThread, setActiveThread] = useState(null)
  const [threadReply, setThreadReply] = useState("")
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelType, setNewChannelType] = useState("public")
  const [editingMessage, setEditingMessage] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(null)
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showNotificationsModal, setShowNotificationsModal] = useState(false)
  const [showDMModal, setShowDMModal] = useState(false)

  // Invite System State
  const [inviteType, setInviteType] = useState(null)
  const [inviteSearchQuery, setInviteSearchQuery] = useState("")
  const [inviteSearchResults, setInviteSearchResults] = useState([])
  const [selectedInviteUser, setSelectedInviteUser] = useState(null)
  const [newSpaceName, setNewSpaceName] = useState("")
  const [copiedCode, setCopiedCode] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)

  // File Attachment State
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const emojis = ["😀", "😂", "❤️", "👍", "👎", "🎉", "🔥", "✅", "👀", "🚀"]

  // --- Initialization & Data Loading ---

  // 1. Polling for User Data (Notifications/Space/DM changes)
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return

    const pollUser = () => {
      const storedUsers = Storage.getUsers()
      const freshUser = storedUsers.find(u => u.id === currentUser.id)

      if (freshUser) {
        // Deep compare roughly or just check key lengths/content to avoid excessive re-renders
        const dmsChanged =
          (freshUser.dms?.length || 0) !== (currentUser.dms?.length || 0)
        const notifsChanged =
          freshUser.notifications.length !== currentUser.notifications.length
        const spacesChanged =
          freshUser.spaces.length !== currentUser.spaces.length

        if (dmsChanged || notifsChanged || spacesChanged) {
          setCurrentUser(freshUser)
        }
      }
    }

    const interval = setInterval(pollUser, 2000)
    return () => clearInterval(interval)
  }, [isAuthenticated, currentUser])

  // 2. Load Spaces and DMs
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      // Load Spaces
      const userSpaces = Storage.getSpacesForUser(currentUser.spaces)
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

      // Load DM Users
      const dms = Storage.getDMUsers(currentUser.dms || [])
      setDmUsers(dms)

      // Set default active space if needed
      if (
        enrichedSpaces.length > 0 &&
        !activeSpace &&
        activeView === "channel"
      ) {
        setActiveSpace(enrichedSpaces[0].id)
        if (enrichedSpaces[0].channels.length > 0) {
          setActiveChannel(enrichedSpaces[0].channels[0].id)
        }
      }
    }
  }, [isAuthenticated, currentUser?.spaces, currentUser?.dms])

  // 3. Load Messages for Active View & Poll
  useEffect(() => {
    if (!isAuthenticated) return

    let chatId = null

    if (activeView === "channel" && activeChannel) {
      chatId = Number(activeChannel)
    } else if (activeView === "dm" && activeDMUser && currentUser) {
      // Generate stable DM ID: dm_min_max
      const ids = [currentUser.id, activeDMUser].sort((a, b) => a - b)
      chatId = `dm_${ids[0]}_${ids[1]}`
    }

    if (!chatId) return

    const loadMessages = () => {
      const storedMessages = Storage.getMessages(chatId)
      setMessages(prev => {
        if ((prev[chatId]?.length || 0) !== storedMessages.length) {
          return { ...prev, [chatId]: storedMessages }
        }
        return prev
      })
    }

    loadMessages()
    const interval = setInterval(loadMessages, 1000)
    return () => clearInterval(interval)
  }, [isAuthenticated, activeChannel, activeView, activeDMUser, currentUser])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, activeChannel, activeView, activeDMUser])

  // Autocomplete
  useEffect(() => {
    if ((showInviteModal || showDMModal) && inviteSearchQuery.length > 0) {
      const results = Storage.searchUsersByName(inviteSearchQuery).filter(
        u => u.id !== currentUser?.id
      )
      setInviteSearchResults(results)
    } else {
      setInviteSearchResults([])
    }
  }, [inviteSearchQuery, showInviteModal, showDMModal, currentUser])

  // --- Auth & Logout ---
  const handleAuthSubmit = e => {
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
      const existingUser = Storage.findUserByEmail(authData.email)
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
        notifications: []
      }
      Storage.saveUser(newUser)
      setCurrentUser(newUser)
      setIsAuthenticated(true)
      setAuthSuccess("Account created successfully!")
    } else {
      if (!authData.email || !authData.password) {
        setAuthError("Please fill in all fields")
        return
      }
      const user = Storage.findUserByEmail(authData.email)
      if (user && user.password === authData.password) {
        setCurrentUser(user)
        setIsAuthenticated(true)
        setAuthSuccess("Logged in successfully!")
      } else {
        setAuthError("Invalid credentials")
      }
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setCurrentUser(null)
    setSpaces([])
    setDmUsers([])
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
    return chatId ? messages[chatId] || [] : []
  }

  const getUser = userId => {
    if (currentUser?.id === userId) return currentUser
    let found = users.find(u => u.id === userId)
    if (!found) found = dmUsers.find(u => u.id === userId)
    if (!found) found = Storage.getUsers().find(u => u.id === userId)
    return found
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
        // Convert to Base64
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
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const removeAttachment = id => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id))
  }

  const sendMessage = () => {
    if ((!messageInput.trim() && selectedFiles.length === 0) || !currentUser)
      return
    const chatId = getActiveChatId()
    if (!chatId) return

    const newMsg = {
      id: Date.now(),
      userId: currentUser.id,
      text: messageInput,
      timestamp: new Date().toISOString(),
      reactions: {},
      thread: [],
      attachments: selectedFiles
    }

    Storage.saveMessage(chatId, newMsg)
    setMessages(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), newMsg]
    }))

    setMessageInput("")
    setSelectedFiles([])
  }

  const createSpace = () => {
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
    Storage.saveSpace(newSpace)
    const updatedUser = {
      ...currentUser,
      spaces: [...currentUser.spaces, newSpace.id]
    }
    Storage.saveUser(updatedUser)
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

  const startDirectMessage = () => {
    if (!selectedInviteUser || !currentUser) return
    Storage.startDM(currentUser.id, selectedInviteUser.id)

    // Refresh Local
    const updatedUser = Storage.getUsers().find(u => u.id === currentUser.id)
    if (updatedUser) setCurrentUser(updatedUser)

    // Set Active
    setActiveView("dm")
    setActiveDMUser(selectedInviteUser.id)

    setShowDMModal(false)
    setSelectedInviteUser(null)
    setInviteSearchQuery("")
  }

  // --- Invite System ---
  const openInviteModal = type => {
    setInviteType(type)
    setShowInviteModal(true)
    setInviteSearchQuery("")
    setInviteSearchResults([])
    setSelectedInviteUser(null)
    setInviteSent(false)
  }

  const selectInviteUser = user => {
    setSelectedInviteUser(user)
    setInviteSearchQuery(user.name)
    setInviteSearchResults([])
  }

  const sendInvites = () => {
    if (!selectedInviteUser || !currentUser || !activeSpace) return
    if (inviteType === "space") {
      const space = getCurrentSpace()
      if (space) {
        Storage.sendInvite(
          currentUser.name,
          [selectedInviteUser.id],
          space.id,
          space.name
        )
      }
    }
    setInviteSent(true)
    setTimeout(() => {
      setShowInviteModal(false)
      setInviteSearchQuery("")
      setSelectedInviteUser(null)
      setInviteSent(false)
    }, 2000)
  }

  const handleAcceptInvite = notificationId => {
    if (!currentUser) return
    const joinedSpace = Storage.acceptInvite(currentUser.id, notificationId)
    if (joinedSpace) {
      const updatedUser = Storage.getUsers().find(u => u.id === currentUser.id)
      if (updatedUser) {
        setCurrentUser(updatedUser)
        setActiveSpace(joinedSpace.id)
        setActiveView("channel")
        if (joinedSpace.channels.length > 0) {
          setActiveChannel(joinedSpace.channels[0].id)
        }
      }
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Spaces</h1>
            <p className="text-gray-600">
              Connect, collaborate, and communicate
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-200 ${
                  authMode === "login"
                    ? "text-blue-600 bg-blue-50 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthMode("signup")}
                className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-200 ${
                  authMode === "signup"
                    ? "text-blue-600 bg-blue-50 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="p-8 space-y-6">
              {authSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {authSuccess}
                </div>
              )}

              {authError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <X className="w-4 h-4" />
                  {authError}
                </div>
              )}

              {authMode === "signup" && (
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={authData.name}
                    onChange={e =>
                      setAuthData({ ...authData, name: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
                    placeholder="Enter your full name"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={authData.email}
                  onChange={e =>
                    setAuthData({ ...authData, email: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={authData.password}
                  onChange={e =>
                    setAuthData({ ...authData, password: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
                  placeholder="••••••••"
                />
              </div>

              {authMode === "signup" && (
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={authData.confirmPassword}
                    onChange={e =>
                      setAuthData({
                        ...authData,
                        confirmPassword: e.target.value
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all hover:scale-105 shadow-lg flex items-center justify-center gap-2"
              >
                {authMode === "login" ? (
                  <>
                    <LogIn className="w-4 h-4" /> Sign In
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="w-4 h-4" /> Create Account
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
  const filteredChannels = getCurrentChannels().filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredDMs = dmUsers.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-screen bg-white text-gray-800">
      {/* Left Sidebar */}
      <div
        className={`${
          sidebarCollapsed ? "w-16" : "w-80"
        } bg-white flex flex-col border-r border-gray-200 transition-all duration-300 shadow-sm`}
      >
        <div className="p-4 border-b border-gray-200">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-bold text-lg text-blue-600">Spaces</h1>
              <button
                onClick={() => setShowCreateSpaceModal(true)}
                className="p-2 hover:bg-blue-100 rounded-lg transition-all duration-200 hover:scale-105"
                title="Add space"
              >
                <Plus className="w-5 h-5 text-blue-600" />
              </button>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-105 w-full flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="p-4">
            <div className="relative group">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {!sidebarCollapsed ? (
            <div className="h-full flex flex-col">
              {/* Spaces List */}
              <div className="px-3 py-2">
                <div className="text-xs font-semibold text-gray-500 mb-2 px-2 uppercase tracking-wide">
                  Spaces
                </div>
                {filteredSpaces.length > 0 ? (
                  filteredSpaces.map(space => (
                    <div key={space.id} className="mb-3">
                      <div
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${
                          activeView === "channel" && activeSpace === space.id
                            ? "bg-blue-100 text-blue-700 shadow-sm"
                            : "hover:bg-gray-100"
                        }`}
                        onClick={() => {
                          setActiveSpace(space.id)
                          setActiveView("channel")
                          if (space.channels.length > 0)
                            setActiveChannel(space.channels[0].id)
                        }}
                      >
                        <div className="bg-yellow-100 p-2 rounded-lg">
                          {space.icon}
                        </div>
                        <span className="font-medium text-sm">
                          {space.name}
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            toggleSpaceExpansion(space.id)
                          }}
                          className="ml-auto p-1 hover:bg-gray-200 rounded-lg"
                        >
                          {space.expanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      </div>

                      {space.expanded &&
                        (searchQuery === "" || filteredChannels.length > 0) && (
                          <div className="ml-7 mt-1 space-y-1">
                            {(searchQuery === ""
                              ? space.channels
                              : filteredChannels
                            ).map(channel => (
                              <div key={channel.id} className="group relative">
                                <button
                                  onClick={() => {
                                    setActiveChannel(channel.id)
                                    setActiveView("channel")
                                    setShowThreadPanel(false)
                                    setActiveSpace(space.id)
                                  }}
                                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs transition-all duration-200 ${
                                    activeView === "channel" &&
                                    activeChannel === channel.id
                                      ? "bg-blue-100 text-blue-700 shadow-sm"
                                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                                  }`}
                                >
                                  <Hash className="w-3.5 h-3.5" />
                                  <span className="truncate flex-1 text-sm">
                                    {channel.name}
                                  </span>
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                setActiveSpace(space.id)
                                setShowChannelModal(true)
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-blue-600 hover:bg-blue-50 transition-all duration-200 group"
                            >
                              <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
                              <span className="text-sm">Add channel</span>
                            </button>
                          </div>
                        )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500 text-xs">
                    No spaces found
                  </div>
                )}
              </div>

              {/* Direct Messages List */}
              <div className="px-3 py-2 mt-2 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-2 px-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Direct Messages
                  </div>
                  <button
                    onClick={() => {
                      setShowDMModal(true)
                      setInviteSearchQuery("")
                      setInviteSearchResults([])
                    }}
                    className="hover:bg-gray-200 p-1 rounded"
                  >
                    <Plus className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
                {filteredDMs.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setActiveView("dm")
                      setActiveDMUser(user.id)
                      setActiveSpace(null)
                    }}
                    className={`flex items-center gap-3 w-full p-2 rounded-xl mb-1 transition-all ${
                      activeView === "dm" && activeDMUser === user.id
                        ? "bg-blue-100 text-blue-700 shadow-sm"
                        : "hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <div className="relative">
                      <span className="text-lg">{user.avatar}</span>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          user.status === "online"
                            ? "bg-green-500"
                            : "bg-gray-400"
                        }`}
                      ></span>
                    </div>
                    <span className="text-sm font-medium">{user.name}</span>
                  </button>
                ))}
                {filteredDMs.length === 0 && (
                  <div className="text-center py-2 text-gray-400 text-xs">
                    No conversations yet
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 mt-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Hash className="w-5 h-5 text-blue-600" />
              </div>
              <div className="w-full border-t border-gray-200 my-2"></div>
              {dmUsers.map(u => (
                <div
                  key={u.id}
                  className="text-lg cursor-pointer hover:scale-110 transition-transform"
                  onClick={() => {
                    setActiveView("dm")
                    setActiveDMUser(u.id)
                  }}
                >
                  {u.avatar}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-3">
            {activeView === "dm" ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {getUser(activeDMUser)?.avatar}
                </span>
                <h2 className="font-bold text-lg text-gray-800">
                  {getActiveViewName()}
                </h2>
              </div>
            ) : (
              <>
                <h2 className="font-bold text-lg text-blue-600">
                  {getActiveViewName()}
                </h2>
                <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200">
                  {getCurrentChannels().find(c => c.id === activeChannel)
                    ?.members.length || 0}{" "}
                  members
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeView === "channel" && (
              <button
                onClick={() => openInviteModal("space")}
                className="p-2 hover:bg-blue-100 rounded-xl transition-all duration-200 hover:scale-105 group bg-blue-50 text-blue-600 font-medium text-xs flex items-center gap-2 px-3"
              >
                <UserPlus className="w-4 h-4" />
                Invite
              </button>
            )}

            <div className="relative group z-20">
              <button className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 hover:scale-105">
                <div className="relative">
                  <span className="text-xl">{currentUser?.avatar}</span>
                  {currentUser?.notifications.length ? (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  ) : null}
                </div>
                <span className="hidden sm:inline text-sm font-medium">
                  {currentUser?.name}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500 hidden sm:block" />
              </button>

              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 hidden group-hover:block z-50">
                {/* Dropdown Content */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{currentUser?.avatar}</span>
                    <div className="overflow-hidden">
                      <div className="font-semibold text-gray-800 truncate">
                        {currentUser?.name}
                      </div>
                      <div className="text-sm text-gray-600 truncate">
                        {currentUser?.email}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => setShowNotificationsModal(true)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Bell className="w-4 h-4" /> Notifications
                    </div>
                    {currentUser?.notifications.length ? (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {currentUser.notifications.length}
                      </span>
                    ) : null}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                  >
                    <LogIn className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin bg-gray-50">
          {getCurrentMessages().length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            getCurrentMessages().map(msg => {
              const user = getUser(msg.userId)
              return (
                <div
                  key={msg.id}
                  className="group hover:bg-gray-100 p-3 rounded-xl transition-all duration-200"
                >
                  <div className="flex gap-3">
                    <div className="relative">
                      <span className="text-2xl">{user?.avatar || "👤"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1.5">
                        <span className="font-semibold text-sm text-gray-800">
                          {user?.name}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                          {msg.timestamp ? formatTime(msg.timestamp) : "now"}
                        </span>
                      </div>

                      {/* Text Content */}
                      {msg.text && (
                        <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap break-words">
                          {msg.text}
                        </p>
                      )}

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {msg.attachments.map(att => (
                            <div
                              key={att.id}
                              className="group relative border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow max-w-[200px]"
                            >
                              {att.type.startsWith("image/") && att.data ? (
                                <div className="relative">
                                  <img
                                    src={att.data}
                                    alt={att.name}
                                    className="w-full h-32 object-cover"
                                  />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate px-2">
                                    {att.name}
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 flex items-center gap-2">
                                  <div className="bg-gray-100 p-2 rounded">
                                    <FileIcon className="w-5 h-5 text-gray-500" />
                                  </div>
                                  <div className="overflow-hidden">
                                    <div className="text-xs font-medium truncate">
                                      {att.name}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
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
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-6 border-t border-gray-200 bg-white">
          {/* File Previews */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedFiles.map(file => (
                <div
                  key={file.id}
                  className="relative bg-gray-100 border border-gray-200 rounded-lg p-2 flex items-center gap-2 pr-8"
                >
                  {file.type.startsWith("image/") && file.data ? (
                    <img
                      src={file.data}
                      className="w-8 h-8 rounded object-cover"
                      alt=""
                    />
                  ) : (
                    <FileIcon className="w-5 h-5 text-gray-500" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium truncate max-w-[150px]">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    onClick={() => removeAttachment(file.id)}
                    className="absolute top-1 right-1 p-0.5 hover:bg-gray-300 rounded-full"
                  >
                    <X className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all duration-200 shadow-sm">
            <input
              type="file"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-gray-200 rounded-lg transition-all text-gray-500 hover:text-blue-600"
              title="Attach files"
            >
              <Paperclip className="w-4.5 h-4.5" />
            </button>
            <input
              type="text"
              placeholder={`Message ${getActiveViewName()}`}
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyPress={e => e.key === "Enter" && sendMessage()}
              className="flex-1 bg-transparent focus:outline-none text-sm text-gray-800 placeholder-gray-500"
            />
            <button
              onClick={sendMessage}
              disabled={isUploading}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 rounded-lg text-white shadow-sm transition-colors"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Create Space Modal */}
      {showCreateSpaceModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-blue-600">
                Create a space
              </h3>
              <button
                onClick={() => setShowCreateSpaceModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2 text-gray-700">
                  Space name
                </label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={e => setNewSpaceName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                  autoFocus
                />
              </div>
              <button
                onClick={createSpace}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-white shadow-sm text-sm"
              >
                Create Space
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal (Space) */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-blue-600">
                Invite to{" "}
                {inviteType === "space" ? getCurrentSpace()?.name : "Channel"}
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {!inviteSent ? (
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-xs font-medium mb-2 text-gray-700">
                    Search User by Name
                  </label>
                  <input
                    type="text"
                    value={inviteSearchQuery}
                    onChange={e => {
                      setInviteSearchQuery(e.target.value)
                      setSelectedInviteUser(null)
                    }}
                    placeholder="Start typing a name..."
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                  />
                  {inviteSearchResults.length > 0 && !selectedInviteUser && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {inviteSearchResults.map(u => (
                        <div
                          key={u.id}
                          onClick={() => selectInviteUser(u)}
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm flex items-center gap-2"
                        >
                          <span>{u.avatar}</span>
                          <span>{u.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedInviteUser && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-100 text-sm">
                    <UserIcon className="w-4 h-4" />
                    <span>
                      Selected: <strong>{selectedInviteUser.name}</strong>
                    </span>
                  </div>
                )}
                <button
                  onClick={sendInvites}
                  disabled={!selectedInviteUser}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-white shadow-sm text-sm"
                >
                  <Mail className="w-4 h-4" />
                  Send Invitation
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
                  <Check className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold mb-2 text-green-600">
                  Invitation sent!
                </h4>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start DM Modal */}
      {showDMModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">New Message</h3>
              <button
                onClick={() => setShowDMModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-medium mb-2 text-gray-700">
                  To:
                </label>
                <input
                  type="text"
                  value={inviteSearchQuery}
                  onChange={e => {
                    setInviteSearchQuery(e.target.value)
                    setSelectedInviteUser(null)
                  }}
                  placeholder="Search for a user..."
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                />
                {inviteSearchResults.length > 0 && !selectedInviteUser && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {inviteSearchResults.map(u => (
                      <div
                        key={u.id}
                        onClick={() => selectInviteUser(u)}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm flex items-center gap-2"
                      >
                        <span>{u.avatar}</span>
                        <span>{u.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedInviteUser && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 text-gray-800 rounded-lg border border-gray-200 text-sm">
                  <span className="text-lg">{selectedInviteUser.avatar}</span>
                  <span>
                    <strong>{selectedInviteUser.name}</strong>
                  </span>
                </div>
              )}
              <button
                onClick={startDirectMessage}
                disabled={!selectedInviteUser}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm text-sm"
              >
                Start Chatting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Bell className="w-5 h-5" /> Notifications
              </h3>
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {currentUser?.notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No new notifications
                </div>
              ) : (
                currentUser?.notifications.map(notif => (
                  <div
                    key={notif.id}
                    className="p-4 border border-gray-200 rounded-xl bg-gray-50"
                  >
                    <div className="flex gap-3">
                      <div className="bg-blue-100 p-2 rounded-full h-fit">
                        <Mail className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">
                          <strong>{notif.from}</strong> invited you to join{" "}
                          <strong>{notif.spaceName}</strong>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notif.timestamp).toLocaleDateString()}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleAcceptInvite(notif.id)}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" /> Accept
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Create a channel
              </h3>
              <button
                onClick={() => setShowChannelModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2 text-gray-700">
                  Channel name
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">
                    #
                  </span>
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value)}
                    placeholder="new-channel"
                    className="w-full pl-8 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 text-gray-700">
                  Visibility
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="channelType"
                      checked={newChannelType === "public"}
                      onChange={() => setNewChannelType("public")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Public</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="channelType"
                      checked={newChannelType === "private"}
                      onChange={() => setNewChannelType("private")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Private</span>
                  </label>
                </div>
              </div>

              <button
                onClick={createChannel}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-white shadow-sm text-sm"
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
