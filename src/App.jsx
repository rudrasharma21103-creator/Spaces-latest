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
  Lock,
  ExternalLink,
  ShieldAlert
} from "lucide-react"
import * as Storage from "./services/storage"
import { getStoredUser, getToken, logout as authLogout } from "./services/auth"

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

  // Main Data State
  const [spaces, setSpaces] = useState([])
  const [users, setUsers] = useState([])
  const [friends, setFriends] = useState([])
  const [events, setEvents] = useState([])

  // UI State
  const [activeSpace, setActiveSpace] = useState(null)
  const [activeChannel, setActiveChannel] = useState(1)
  const [activeView, setActiveView] = useState("channel")
  const [activeDMUser, setActiveDMUser] = useState(null)

  const [messages, setMessages] = useState({})
  const [unreadChannels, setUnreadChannels] = useState([]) // Track unread channel IDs
  const [messageCounts, setMessageCounts] = useState({}) // Track counts to detect changes

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false)
  const [showAddFriendConfirm, setShowAddFriendConfirm] = useState(null) // ID of user to add

  // Management Modals
  const [showRenameModal, setShowRenameModal] = useState(null)
  const [newNameInput, setNewNameInput] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState(null)

  // Invite/Friend System State
  const [inviteSearchQuery, setInviteSearchQuery] = useState("")
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
    }
  }, [])

  // File Attachment State
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date())
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    time: "09:00",
    type: "meeting"
  })
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Video Meeting State
  const [isMicOn, setIsMicOn] = useState(true)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [activeMeetingTitle, setActiveMeetingTitle] = useState("Meeting")
  const [activeCallId, setActiveCallId] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const videoRef = useRef(null)

  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const messageInputRef = useRef(null)
  const justSwitchedThreadRef = useRef(false)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // --- Debounce Logic ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDmSearchQuery(dmSearchQuery)
    }, 300)
    return () => clearTimeout(handler)
  }, [dmSearchQuery])

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
            icon: <div className="text-xl">{friend.avatar}</div>
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
                icon: <div className="text-sm">{friend.avatar}</div>
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

        // Poll for Unread Messages in Channels
        const allSpaces = await Storage.getSpaces()
        for (const space of allSpaces) {
          for (const ch of (space.channels || [])) {
            try {
              const msgs = await Storage.getMessages(ch.id)
              const count = (msgs && msgs.length) || 0
              const prevCount = messageCounts[ch.id] || 0

              // If new message AND channel not active, mark unread
              if (
                count > prevCount &&
                (activeView !== "channel" || activeChannel !== ch.id)
              ) {
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
                console.error("Failed to poll messages for channel", ch.id, e)
              }
            }
          }
        }
        setMessageCounts({ ...messageCounts })

        // Update Events
        const storedEvents = await Storage.getEvents()
        if ((storedEvents?.length || 0) !== events.length) {
          setEvents(storedEvents || [])
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

    const interval = setInterval(pollData, 1500)
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

  useEffect(() => {
    // Clear unread when entering a channel
    if (activeView === "channel" && activeChannel) {
      setUnreadChannels(prev => prev.filter(id => id !== activeChannel))
      // Update current count reference
      ;(async () => {
        try {
          const msgs = await Storage.getMessages(activeChannel)
          messageCounts[activeChannel] = (msgs && msgs.length) || 0
          setMessageCounts({ ...messageCounts })
        } catch (e) {
          if (e && e.status === 403) {
            // restricted channel — skip
            messageCounts[activeChannel] = 0
            setMessageCounts({ ...messageCounts })
          } else {
            console.error("Failed to update message counts", e)
          }
        }
      })()
    }
  }, [activeChannel, activeView])

  useEffect(() => {
    let userSocket = null

    if (isAuthenticated && currentUser) {
      ;(async () => {
        // Await async storage helpers to ensure we get actual arrays (not Promises)
        const userSpaces = await Storage.getSpacesForUser(currentUser.spaces)
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

        try {
            const allUsers = await Storage.getUsers()
          setUsers(Array.isArray(allUsers) ? allUsers : [])
        } catch (e) {
          console.error("Failed to load users", e)
          setUsers([])
        }

        try {
          const friendsList = await Storage.getFriends(currentUser.friends || [])
          setFriends(friendsList)
        } catch (e) {
          console.error("Failed to load friends", e)
          setFriends([])
        }

        try {
          const evts = await Storage.getEvents()
          setEvents(evts || [])
        } catch (e) {
          console.error("Failed to load events", e)
          setEvents([])
        }

        if (
          enrichedSpaces.length > 0 &&
          !activeSpace &&
          activeView === "channel"
        ) {
          // Find first accessible channel
          const firstSpace = enrichedSpaces[0]
          const accessibleChannel = firstSpace.channels.find(
            c =>
              c.members.includes(currentUser.id) ||
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
      })()

      // Open a background user socket to receive notifications in real-time
      import("./services/ws")
        .then(({ connectUserSocket }) => {
          userSocket = connectUserSocket(data => {
            if (!data || !data.type) return

            // Only react to 'notification' messages
            if (data.type === "notification" && data.notification) {
              const incoming = data.notification

              // Normalize timestamp (server sends seconds sometimes)
              if (incoming.timestamp && incoming.timestamp < 1e12) {
                incoming.timestamp = incoming.timestamp * 1000
              }

              // Ignore if user previously dismissed this id
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
        })
        .catch(e => {
          console.error('Failed to connect user socket', e)
        })
    }

    return () => {
      try {
        if (userSocket) userSocket.close()
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
    const loadMessages = async () => {
      try {
        const storedMessages = await Storage.getMessages(chatId)
        setMessages(prev => {
          if ((prev[chatId]?.length || 0) !== (storedMessages?.length || 0)) {
            return { ...prev, [chatId]: storedMessages }
          }
          return prev
        })
      } catch (e) {
        console.error("loadMessages failed", e)
        if (e && e.status === 403) {
          setShowAccessDeniedModal(true)
          // Clear any messages for this channel
          setMessages(prev => ({ ...prev, [chatId]: [] }))
        }
      }
    }
    loadMessages()
    const interval = setInterval(loadMessages, 1000)
    return () => clearInterval(interval)
  }, [isAuthenticated, activeChannel, activeView, activeDMUser, currentUser])

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

    // 4) Default behavior: smooth-scroll to latest (useful when new messages arrive while already at bottom)
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    setIsAtBottom(true)
  }, [messages, activeChannel, activeView, activeDMUser, targetMessageId, pinnedMessageId])

  useEffect(() => {
    ;(async () => {
      // 1. "Add Friend" Modal: Global Search for NEW friends
      if (showAddFriendModal && inviteSearchQuery.length > 0) {
        try {
          const users = await Storage.searchUsersByName(inviteSearchQuery)
          const safeUsers = Array.isArray(users) ? users : []
          const results = safeUsers.filter(
            u => u.id !== currentUser?.id && !currentUser?.friends?.includes(u.id)
          )
          setInviteSearchResults(results)
        } catch (e) {
          console.error("searchUsersByName failed", e)
          setInviteSearchResults([])
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
    if (currentUser?.id === userId) return currentUser
    const found = users.find(u => u.id === userId) || friends.find(u => u.id === userId)
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

    // Access Check: Member of channel OR Owner of space
    const hasAccess =
      channel.members.includes(currentUser.id) ||
      space.ownerId === currentUser.id

  if (hasAccess) {
    setActiveSpace(spaceId)
    setActiveChannel(channelId)
    setActiveView("channel")
    // Indicate a manual thread switch so scroll logic jumps directly to latest (no long smooth animation)
    justSwitchedThreadRef.current = true
  } else {
    setShowAccessDeniedModal(true)
  }
}

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
          data: base64,
          source: "local"
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

  const sendMessage = async () => {
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
    try {
      await Storage.saveMessage(chatId, newMsg)
      setMessages(prev => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), newMsg]
      }))
      setMessageInput("")
      setSelectedFiles([])
    } catch (e) {
      console.error("sendMessage failed", e)
      if (e && e.status === 403) {
        setShowAccessDeniedModal(true)
      }
    }
  }

  // Helper to open or download attachments
  const openAttachment = att => {
    if (!att) return
    if (att.source === "drive" && att.url) {
      window.open(att.url, "_blank")
      return
    }

    if (att.data) {
      // open in new tab (works for images and other data-urls)
      window.open(att.data, "_blank")
      return
    }
  }

  const downloadAttachment = async att => {
    if (!att) return
    if (att.source === "drive" && att.url) {
      // For drive links just open in new tab where user can download
      window.open(att.url, "_blank")
      return
    }

    if (att.data) {
      try {
        const res = await fetch(att.data)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = att.name || "attachment"
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch (e) {
        console.error("downloadAttachment failed", e)
      }
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
    await Storage.saveSpace(newSpace)
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
      members: [currentUser.id]
    }
    const space = spaces.find(s => s.id === activeSpace)
    if (space) {
      const updatedSpace = {
        ...space,
        channels: [...space.channels, newChannel]
      }
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
    const dateStr = selectedDate.toISOString().split("T")[0]
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
    setNewEvent({ title: "", description: "", time: "09:00", type: "meeting" })
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
      await Storage.updateCallStatus(incomingCall.id, "accepted")
      setActiveCallId(incomingCall.id)
      setActiveMeetingTitle(`Call with ${incomingCall.fromName}`)
      setActiveView("meeting")
      setIncomingCall(null)
    }
  }

  const declineCall = async () => {
    if (incomingCall) {
      await Storage.updateCallStatus(incomingCall.id, "rejected")
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
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
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
            if (
              firstChannel.members.includes(currentUser.id) ||
              joinedSpace.ownerId === currentUser.id
            ) {
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 font-sans relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-slate-900">
        <div className="w-full max-w-md animate-fade-in relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] mb-6 shadow-2xl transform hover:scale-105 hover:rotate-6 transition-all duration-300 bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-200">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-5xl font-extrabold mb-3 tracking-tight text-slate-900">
              Spaces
            </h1>
            <p className="text-lg font-medium text-slate-500">
              Where squads and pros collide.
            </p>
          </div>

          <div className="rounded-[2rem] overflow-hidden p-1 bg-white/80 backdrop-blur-xl shadow-2xl border border-white/50">
            <div className="flex p-1 rounded-[1.8rem] mb-2 bg-slate-100">
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-3 px-6 text-center font-bold text-sm rounded-3xl transition-all duration-300 ${
                  authMode === "login"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthMode("signup")}
                className={`flex-1 py-3 px-6 text-center font-bold text-sm rounded-3xl transition-all duration-300 ${
                  authMode === "signup"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Sign Up
              </button>
            </div>
            <form onSubmit={handleAuthSubmit} className="p-8 space-y-5">
              {authSuccess && (
                <div className="px-4 py-3 rounded-2xl text-sm flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <CheckCircle className="w-5 h-5" />
                  {authSuccess}
                </div>
              )}
              {authError && (
                <div className="px-4 py-3 rounded-2xl text-sm flex items-center gap-3 bg-red-50 border border-red-200 text-red-700">
                  <XCircle className="w-5 h-5" />
                  {authError}
                </div>
              )}

              {authMode === "signup" && (
                <div className="group">
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 ml-1 text-slate-400">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={authData.name}
                    onChange={e =>
                      setAuthData({ ...authData, name: e.target.value })
                    }
                    className="w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent transition-all font-medium bg-slate-50 border border-slate-200 text-slate-800"
                    placeholder="Jane Doe"
                  />
                </div>
              )}
              <div className="group">
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 ml-1 text-slate-400">
                  Email
                </label>
                <input
                  type="email"
                  value={authData.email}
                  onChange={e =>
                    setAuthData({ ...authData, email: e.target.value })
                  }
                  className="w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent transition-all font-medium bg-slate-50 border border-slate-200 text-slate-800"
                  placeholder="jane@example.com"
                />
              </div>
              <div className="group">
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 ml-1 text-slate-400">
                  Password
                </label>
                <input
                  type="password"
                  value={authData.password}
                  onChange={e =>
                    setAuthData({ ...authData, password: e.target.value })
                  }
                  className="w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent transition-all font-medium bg-slate-50 border border-slate-200 text-slate-800"
                  placeholder="••••••••"
                />
              </div>
              {authMode === "signup" && (
                <div className="group">
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 ml-1 text-slate-400">
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
                    className="w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent transition-all font-medium bg-slate-50 border border-slate-200 text-slate-800"
                    placeholder="••••••••"
                  />
                </div>
              )}
              <button
                type="submit"
                className="w-full py-4 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 transform active:scale-[0.98] mt-4 bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg hover:shadow-indigo-500/30"
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
            </form>
          </div>
        </div>
      </div>
    )
  }

  // --- Authenticated App UI ---
  const activeMembers = getActiveMembers()

  return (
    <div className="flex h-screen overflow-hidden font-sans transition-colors duration-300 text-slate-900 bg-slate-50">
      {/* ... (Incoming Call Modal) ... */}
      {incomingCall && (
        <div className="fixed inset-0 z-[60] backdrop-blur-xl flex flex-col items-center justify-center animate-fade-in bg-slate-900/80">
          <div className="text-center mb-12">
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 bg-pink-500 rounded-full animate-ping opacity-50 blur-xl"></div>
              <div className="relative w-32 h-32 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-6xl shadow-2xl border-4 border-white/20">
                {incomingCall.fromAvatar}
              </div>
            </div>
            <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">
              {incomingCall.fromName}
            </h2>
            <p className="text-pink-300 text-lg font-medium animate-pulse">
              Incoming Video Call...
            </p>
          </div>
          <div className="flex items-center gap-10">
            <button
              onClick={declineCall}
              className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center shadow-lg backdrop-blur-md transition-all hover:scale-110"
            >
              <PhoneOff className="w-8 h-8" />
            </button>
            <button
              onClick={answerCall}
              className="w-24 h-24 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/30 transition-all hover:scale-110 animate-bounce"
            >
              <Video className="w-10 h-10" />
            </button>
          </div>
        </div>
      )}

      {/* Left Sidebar - SPACES */}
      <div
        className={`${
          sidebarCollapsed ? "w-20" : "w-80"
        } flex flex-col transition-all duration-300 z-20 flex-shrink-0 bg-white border-r border-slate-200/60`}
      >
        {/* ... (Sidebar Content) ... */}
        <div className="p-6 flex items-center justify-between h-[80px] border-b border-slate-100">
          {!sidebarCollapsed && (
            <div
              className="flex items-center gap-3 animate-fade-in cursor-pointer group"
              onClick={() => {
                setActiveView("calendar")
                setActiveSpace(null)
              }}
            >
              <div className="p-2 rounded-xl shadow-lg transition-all bg-indigo-600 shadow-indigo-200">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-extrabold text-xl tracking-tight text-slate-800">
                Spaces
              </h1>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            {!sidebarCollapsed && (
              <button
                onClick={() => setShowCreateSpaceModal(true)}
                className="p-2 rounded-xl transition-colors hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-xl transition-colors hover:bg-slate-100 text-slate-400"
            >
              <Menu className="w-5 h-5" />
            </button>
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
                className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none transition-all bg-slate-100/50 border border-slate-200/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
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
                <>
                  <button
                    onClick={() => {
                      setActiveView("calendar")
                      setActiveSpace(null)
                    }}
                    className={`w-full flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all duration-200 mb-6 group ${
                      activeView === "calendar"
                        ? "bg-white shadow-md shadow-indigo-100 border border-indigo-50 text-indigo-600"
                        : "hover:bg-slate-100/80 border border-transparent text-slate-600"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl transition-colors ${
                        activeView === "calendar"
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 text-slate-500 group-hover:bg-white"
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
                        className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 group ${
                          activeView === "channel" && activeSpace === space.id
                            ? "bg-white shadow-md shadow-indigo-100 border border-indigo-50"
                            : "hover:bg-slate-100/80 border border-transparent"
                        }`}
                        onClick={() => {
                          setActiveSpace(space.id)
                          // Don't auto-switch channel unless user has access to current active, handled by effect
                          // Just set view to channel
                          setActiveView("channel")
                        }}
                      >
                        <div
                          className={`p-2.5 rounded-xl transition-colors ${
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
                                className="p-1 hover:text-indigo-600 text-slate-400"
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
                                className="p-1 hover:text-red-500 text-slate-400"
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
                          {space.channels.map(channel => (
                            <div
                              key={channel.id}
                              className="relative group/channel"
                            >
                              <button
                                onClick={() =>
                                  handleChannelNavigation(space.id, channel.id)
                                }
                                className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                                  activeView === "channel" &&
                                  activeChannel === channel.id
                                    ? "bg-indigo-50 text-indigo-600"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                }`}
                              >
                                <Hash
                                  className={`w-4 h-4 ${
                                    activeChannel === channel.id
                                      ? "text-indigo-400"
                                      : "text-slate-300"
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
                                      className="p-1 hover:text-indigo-600 text-slate-400"
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
                                      className="p-1 hover:text-red-600 text-slate-400"
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
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 mt-2 animate-fade-in">
              <button
                onClick={() => {
                  setActiveView("calendar")
                  setActiveSpace(null)
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
                  className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 font-bold text-lg ${
                    activeSpace === s.id
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                      : "bg-slate-100 text-slate-600 hover:bg-white hover:shadow-md"
                  }`}
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
                  }}
                >
                  {s.name.charAt(0).toUpperCase()}
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
      <div className="flex-1 flex flex-col min-w-0 relative z-0">
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
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* ... (Calendar UI) ... */}
            <div className="h-[80px] flex items-center justify-between px-8 border-b border-slate-200">
              <h2 className="text-3xl font-bold flex items-center gap-3 text-slate-800">
                <Calendar className="w-8 h-8 text-indigo-600" /> Calendar
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex rounded-2xl p-1 border bg-slate-100 border-transparent">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="p-2 rounded-xl transition-all hover:bg-white shadow-sm"
                  >
                    <ChevronDown className="w-5 h-5 rotate-90 text-slate-600" />
                  </button>
                  <span className="px-6 font-bold flex items-center text-slate-700">
                    {currentDate.toLocaleString("default", {
                      month: "long",
                      year: "numeric"
                    })}
                  </span>
                  <button
                    onClick={() => changeMonth(1)}
                    className="p-2 rounded-xl transition-all hover:bg-white shadow-sm"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    setSelectedDate(new Date())
                    setShowEventModal(true)
                  }}
                  className="px-6 py-3 rounded-2xl font-bold text-sm shadow-lg hover:scale-105 transition-all flex items-center gap-2 bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700"
                >
                  <Plus className="w-5 h-5" /> New Event
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              {/* ... (Calendar Grid) ... */}
              <div className="grid grid-cols-7 gap-4 mb-4">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                  <div
                    key={d}
                    className="text-center text-xs font-bold uppercase tracking-widest text-slate-400"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-4 auto-rows-[140px]">
                {Array.from({
                  length: getDaysInMonth(currentDate).firstDay
                }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="rounded-3xl bg-slate-50/50"
                  ></div>
                ))}
                {Array.from({
                  length: getDaysInMonth(currentDate).daysInMonth
                }).map((_, i) => {
                  const day = i + 1
                  const dateStr = new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth(),
                    day
                  )
                    .toISOString()
                    .split("T")[0]
                  const dayEvents = events.filter(e => e.startDate === dateStr)
                  const isToday =
                    new Date().toISOString().split("T")[0] === dateStr

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
                      className={`p-4 rounded-3xl border transition-all cursor-pointer flex flex-col gap-2 group ${
                        isToday
                          ? "bg-indigo-50 border-indigo-200"
                          : "bg-white border-slate-100 hover:shadow-md hover:border-indigo-300"
                      }`}
                    >
                      <span
                        className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full ${
                          isToday
                            ? "bg-indigo-600 text-white"
                            : "text-slate-700"
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
                              if (ev.type === "meeting") startMeeting(ev.title)
                            }}
                            className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold truncate flex items-center gap-1.5 ${
                              ev.type === "meeting"
                                ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {ev.type === "meeting" && (
                              <Video className="w-3 h-3" />
                            )}
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
        ) : (
          /* VIEW: CHANNEL / DM */
          <>
            {/* Header */}
            <div className="h-[80px] sticky top-0 z-30 flex items-center justify-between px-8 border-b bg-white/80 backdrop-blur-md border-slate-200/50 shadow-sm">
              {/* ... (Header Content) ... */}
              <div
                onClick={() => setShowMemberDetails(prev => !prev)}
                className="flex items-center gap-4 cursor-pointer group py-2 px-3 -ml-3 rounded-2xl transition-all hover:bg-slate-50"
              >
                {activeView === "dm" ? (
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl shadow-lg border bg-gradient-to-br from-indigo-100 to-purple-100 border-white text-slate-700">
                        {getUser(activeDMUser)?.avatar}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                          getUser(activeDMUser)?.status === "online"
                            ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                            : "bg-slate-500"
                        }`}
                      ></span>
                    </div>
                    <div>
                      <h2 className="font-bold text-xl leading-tight tracking-tight text-slate-800">
                        {getActiveViewName()}
                      </h2>
                      <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>{" "}
                        Online
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors bg-slate-100 text-slate-500 border border-slate-200">
                      <Hash className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-bold text-xl leading-tight tracking-tight text-slate-800 flex items-center gap-2">
                        {/* Header Breadcrumb Context */}
                        <span className="text-slate-400 font-medium">
                          {getCurrentSpace()?.name}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                        <span>{getActiveViewName().replace("#", "")}</span>
                      </h2>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                        <span className="flex items-center gap-1 text-slate-500">
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

              <div className="flex items-center gap-3">
                {activeView === "channel" && (
                  <button
                    onClick={() => {
                      setInviteSearchQuery("")
                      setSelectedInviteUsers([])
                      setShowAddToSpaceModal(true)
                    }}
                    className="hidden md:flex items-center gap-2 px-5 py-3 text-xs font-extrabold uppercase tracking-wide rounded-2xl transition-all shadow-lg active:scale-95 bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Invite Members</span>
                  </button>
                )}

                <div className="h-8 w-px mx-3 bg-slate-200"></div>

                {/* User Menu */}
                {/* ... (User Menu) ... */}
                <div className="relative z-50">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`flex items-center gap-3 pl-3 pr-2 py-2 rounded-2xl transition-all border ${
                      showUserMenu
                        ? "bg-white border-slate-100 shadow-sm"
                        : "border-transparent hover:bg-white hover:border-slate-100 hover:shadow-sm"
                    }`}
                  >
                    <div className="text-right hidden sm:block">
                      <div className="text-xs font-bold text-slate-700">
                        {currentUser?.name}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Available
                      </div>
                    </div>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-md bg-indigo-50 border border-indigo-100">
                        {currentUser?.avatar}
                      </div>
                      {currentUser?.notifications.length ? (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                        </span>
                      ) : null}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-300 transition-transform ${
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
                      <div className="absolute right-0 top-full mt-3 w-72 rounded-3xl shadow-2xl py-2 animate-fade-in origin-top-right ring-1 ring-black/5 bg-white/95 backdrop-blur-xl border border-slate-100 z-50">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl p-2 rounded-full bg-white shadow-sm border border-slate-100">
                              {currentUser?.avatar}
                            </span>
                            <div className="overflow-hidden">
                              <div className="font-bold truncate text-slate-800">
                                {currentUser?.name}
                              </div>
                              <div className="text-xs truncate text-slate-500">
                                {currentUser?.email}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-2 space-y-1">
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
                            {currentUser?.notifications.length ? (
                              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/30">
                                {currentUser.notifications.length}
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

            {/* Messages / Chat Area */}
            {/* ... (Chat Area Code) ... */}
            <div className="flex-1 flex overflow-hidden bg-slate-50/50">
              <div className="flex-1 flex flex-col min-w-0">
                {/* Updated Container with Custom Pattern Background */}
                {/* day label computed above via `messageDateLabel` */}

                <div
                  ref={messagesContainerRef}
                  onScroll={() => {
                    const el = messagesContainerRef.current
                    if (!el) return
                    const threshold = (messageInputRef.current?.offsetHeight || 64) + 16
                    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold)
                  }}
                  className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 scrollbar-thin chat-background relative"
                >
                  {/* ... (Existing Message Rendering) ... */}
                  {getCurrentMessages().length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <div className="p-10 rounded-[2.5rem] text-center max-w-sm bg-white/80 backdrop-blur-sm shadow-sm border border-white/50">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] mb-6 relative shadow-lg transform rotate-3 hover:rotate-6 transition-transform bg-indigo-100 text-indigo-600">
                          <MessageCircle className="w-12 h-12" />
                          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full border-4 animate-bounce bg-yellow-400 border-white"></div>
                        </div>
                        <h3 className="text-2xl font-extrabold mb-3 text-slate-800">
                          Say Hello!
                        </h3>
                        <p className="text-sm leading-relaxed mb-6 text-slate-500">
                          This is the start of something epic in{" "}
                          <span className="font-bold text-indigo-600">
                            {getActiveViewName()}
                          </span>
                          . Send a message to break the ice.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest bg-yellow-50/80 border-yellow-100 text-yellow-800">
                          <Lock className="w-3 h-3" /> End-to-End Encrypted
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {pinnedMessageId && (
                        <div className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-4 bg-white/90 rounded-xl px-4 py-3 border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            <div className="text-sm font-bold">Pinned Search Result</div>
                            <div className="text-xs text-slate-500">Reviewing highlighted message</div>
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
                          {messageDateLabel || 'Today'}
                        </span>
                      </div>

                      {getCurrentMessages().map((msg, idx) => {
                        const user = getUser(msg.userId)
                        const isMe = user?.id === currentUser?.id
                        const prevMsg =
                          idx > 0 ? getCurrentMessages()[idx - 1] : null
                        const isSequence =
                          prevMsg && prevMsg.userId === msg.userId

                        return (
                          <div
                            key={msg.id}
                            id={`msg-${msg.id}`}
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
                                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-lg border-2 ${
                                    isMe
                                      ? "bg-indigo-50 border-white"
                                      : "bg-white border-white text-sm"
                                  } ${isMe ? "text-indigo-600" : ""}`}
                                >
                                  {user?.avatar}
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
                                  <span className="text-xs font-bold text-slate-500">
                                    {user?.name}
                                  </span>
                                  <span className="text-[10px] font-medium text-slate-400">
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
                              className={`relative px-5 py-3 text-[15px] leading-relaxed break-words shadow-lg backdrop-blur-sm ${
                                  isMe
                                    ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm"
                                    : "bg-white text-slate-800 rounded-2xl rounded-tl-sm"
                                } ${pinnedMessageId === msg.id ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
                              >
                                {msg.text && (
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
                                        className="px-2 py-1 rounded-full text-sm bg-slate-100 flex items-center gap-2"
                                      >
                                        <span className="text-lg">{emoji}</span>
                                        <span className="ml-1 text-xs text-slate-600 font-bold">{uids.length}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Emoji picker - hover or explicit open */}
                                {(hoveredMessageId === msg.id || showEmojiPickerFor === msg.id) && (
                                  <div
                                    className="absolute flex gap-1 bg-white p-2 rounded-xl shadow-lg z-20 animate-fade-in"
                                    style={{ left: '-72px', top: '50%', transform: 'translateY(-50%)' }}
                                  >
                                    {EMOJIS.map(e => (
                                      <button
                                        key={e}
                                        onClick={() => { toggleReaction(getActiveChatId(), msg.id, e); setShowEmojiPickerFor(null) }}
                                        className="p-1 text-lg"
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
                                        style={{ cursor: att.data || att.source === "drive" ? "pointer" : "default" }}
                                        className={`relative rounded-xl overflow-hidden transition-transform hover:scale-[1.02] ${
                                          att.source === "drive"
                                            ? "bg-blue-50 border border-blue-100"
                                            : "bg-black/5"
                                        }`}
                                      >
                                        {/* Download overlay */}
                                        {(att.data || att.source === "drive") && (
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
                                        {att.source === "drive" ? (
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
                                        ) : att.type.startsWith("image/") &&
                                          att.data ? (
                                          <img
                                            src={att.data}
                                            alt={att.name}
                                            className="max-w-[240px] max-h-[240px] object-cover"
                                          />
                                        ) : (
                                          <div className="p-3 flex items-center gap-3 rounded-xl min-w-[160px] bg-white/90">
                                            <div className="p-2 rounded-lg text-slate-500">
                                              <FileIcon className="w-5 h-5" />
                                            </div>
                                            <div className="overflow-hidden">
                                              <span className="text-xs font-bold truncate block text-slate-700">
                                                {att.name}
                                              </span>
                                              <span className="text-[10px] text-slate-400">
                                                {(att.size / 1024).toFixed(1)}{" "}
                                                KB
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              
                                {/* Timestamp for Me inside bubble, slightly cleaner */}
                                {isMe && (
                                  <div className="text-[9px] text-right mt-1 font-bold flex justify-end items-center gap-1 text-indigo-100">
                                    {msg.timestamp
                                      ? formatTime(msg.timestamp)
                                      : "now"}
                                    <Check className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
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
                      className="absolute z-30 p-3 rounded-full bg-white shadow-lg border hover:bg-indigo-50 transition-transform transition-opacity animate-fade-in hover:-translate-y-1"
                      aria-label="Scroll to latest messages"
                    >
                      <ChevronDown className="w-5 h-5 text-indigo-600" />
                    </button>
                  )}
                </div>

                {/* Message Input */}
                <div ref={messageInputRef} className="p-6 pt-2 bg-slate-50/50 backdrop-blur-sm">
                  {/* ... (Input UI) ... */}
                  <div className="rounded-[2rem] p-2 relative transition-all focus-within:ring-2 bg-white shadow-xl shadow-slate-200/50 border border-slate-100 focus-within:ring-indigo-500/20 focus-within:border-indigo-400">
                    {/* Attachments Preview */}
                    {selectedFiles.length > 0 && (
                      <div className="flex gap-3 p-3 mb-2 overflow-x-auto border-b border-slate-100">
                        {selectedFiles.map(file => (
                          <div
                            key={file.id}
                            className="relative group border rounded-2xl p-2 flex items-center gap-3 flex-shrink-0 pr-8 bg-slate-50 border-slate-200"
                          >
                            {file.source === "drive" ? (
                              <img
                                src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg"
                                className="w-6 h-6"
                                alt="Drive"
                              />
                            ) : file.type.startsWith("image/") && file.data ? (
                              <img
                                src={file.data}
                                className="w-10 h-10 rounded-xl object-cover"
                                alt=""
                              />
                            ) : (
                              <FileIcon className="w-6 h-6 text-indigo-500" />
                            )}
                            <span className="text-xs font-bold max-w-[100px] truncate">
                              {file.name}
                            </span>
                            <button
                              onClick={() => removeAttachment(file.id)}
                              className="absolute -top-2 -right-2 rounded-full p-1 shadow-md hover:scale-110 transition-transform bg-white border border-slate-200 hover:text-red-500"
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
                          className="p-3 mb-1 rounded-full transition-colors hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setShowEmojiPickerFor('input')}
                          className="p-3 mb-1 ml-1 rounded-full transition-colors hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
                        >
                          <span className="text-lg">😀</span>
                        </button>

                        {showEmojiPickerFor === 'input' && (
                          <div className="absolute left-0 top-12 flex gap-1 bg-white p-2 rounded-xl shadow-lg z-30">
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
                        className="flex-1 bg-transparent border-none focus:ring-0 py-3.5 max-h-32 resize-none leading-relaxed font-medium text-slate-800 placeholder-slate-400"
                        style={{ minHeight: "48px" }}
                      />

                      <button
                        onClick={sendMessage}
                        disabled={
                          (!messageInput.trim() &&
                            selectedFiles.length === 0) ||
                          isUploading
                        }
                        className="p-3 mb-1 rounded-2xl shadow-lg transition-all active:scale-90 transform bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white shadow-indigo-200"
                      >
                        <Send className="w-5 h-5 ml-0.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-center mt-3 text-[10px] font-bold uppercase tracking-widest opacity-50 text-slate-400">
                    Press <strong>Enter</strong> to send
                  </div>
                </div>
              </div>

              {/* Member Details Sidebar - Added Logic for Add Friend */}
              <div
                className={`border-l transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col z-30 border-slate-200 bg-white shadow-2xl ${
                  showMemberDetails
                    ? "w-80 translate-x-0"
                    : "w-0 translate-x-full opacity-0 overflow-hidden"
                }`}
              >
                <div className="h-[80px] flex items-center justify-between px-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-lg text-slate-800">Details</h3>
                  <button
                    onClick={() => setShowMemberDetails(false)}
                    className="p-2 rounded-full transition-colors hover:bg-slate-200 text-slate-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                  <div className="text-center mb-10">
                    <div className="inline-block relative mb-5">
                      {activeView === "dm" ? (
                        <span className="text-7xl drop-shadow-2xl filter text-slate-700">
                          {getUser(activeDMUser)?.avatar}
                        </span>
                      ) : (
                        <div className="w-24 h-24 rounded-[2rem] mx-auto flex items-center justify-center shadow-lg bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 shadow-inner">
                          <Hash className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold mb-1 text-slate-900">
                      {getActiveViewName().replace("#", "")}
                    </h2>
                    {activeView === "channel" && (
                      <p className="text-sm font-medium text-slate-500">
                        {activeMembers.length} members in this channel
                      </p>
                    )}
                  </div>

                  {activeView === "channel" && (
                    <div className="mb-8">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3 text-slate-400">
                        Topic
                      </h4>
                      <div className="rounded-2xl p-5 border text-sm leading-relaxed bg-slate-50 border-slate-100 text-slate-600">
                        Welcome to the{" "}
                        <span className="font-bold text-indigo-600">
                          #{getActiveViewName().replace("# ", "")}
                        </span>{" "}
                        channel. This is the beginning of your collaboration
                        journey in {getCurrentSpace()?.name}.
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center justify-between text-slate-400">
                      Members
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {activeMembers.length}
                      </span>
                    </h4>
                    <div className="space-y-2">
                      {activeMembers.map(member => {
                        const isMe = member.id === currentUser?.id
                        const isFriend = currentUser?.friends.includes(
                          member.id
                        )
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
                            className="flex items-center gap-3 p-3 rounded-2xl transition-colors cursor-default group border border-transparent hover:bg-slate-50 hover:border-slate-100"
                          >
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm border bg-white border-slate-100">
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
                            <div className="overflow-hidden flex-1">
                              <div className="text-sm font-bold truncate text-slate-800">
                                {member.name}
                              </div>
                              <div className="text-xs truncate text-slate-400">
                                {member.email}
                              </div>
                            </div>
                            {isMe ? (
                              <span className="text-[10px] px-2 py-1 rounded-md font-bold tracking-wide bg-indigo-50 text-indigo-600">
                                YOU
                              </span>
                            ) : (
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
                                        ? "text-slate-300 cursor-default"
                                        : "hover:bg-indigo-100 text-slate-400 hover:text-indigo-600"
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

                                {/* Remove member (visible to main space or channel creator) */}
                                {(currentUser?.id === getCurrentSpace()?.ownerId || currentUser?.id === (getCurrentChannels().find(c => c.id === activeChannel)?.ownerId)) && !isMe && (
                                  <button
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="p-1.5 rounded-lg transition-all hover:bg-red-100 text-slate-400 hover:text-red-600"
                                    title="Remove member"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
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
      <div className="hidden lg:flex flex-col w-80 border-l border-slate-200/60 bg-white z-20">
        <div className="p-6 h-[80px] border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-extrabold text-lg text-slate-800">Friends</h3>
          <button
            onClick={() => {
              setInviteSearchQuery("")
              setSelectedFriendInvitees([])
              setShowAddFriendModal(true)
            }}
            className="p-2 rounded-xl transition-all hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-6 pb-2">
          <div className="relative group">
            <Search className="absolute left-4 top-3.5 w-4 h-4 transition-colors text-slate-400 group-focus-within:text-indigo-500" />
            <input
              type="text"
              placeholder="Filter friends..."
              value={dmSearchQuery}
              onChange={e => setDmSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none transition-all bg-slate-100/50 border border-slate-200/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-2">
          {dmSearchResults.length > 0 ? (
            dmSearchResults.map(result => (
              <div
                key={result.id}
                onClick={() => {
                  if (result.userId) {
                    setActiveDMUser(result.userId)
                    setActiveView("dm")
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
                    ? "bg-indigo-50 border-indigo-100"
                    : "bg-white border-transparent hover:bg-slate-50"
                }`}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm bg-white border border-slate-100">
                    {result.icon}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm font-bold truncate ${
                        activeView === "dm" && activeDMUser === result.userId
                          ? "text-indigo-900"
                          : "text-slate-700"
                      }`}
                    >
                      {result.title}
                    </span>
                    {result.timestamp && (
                      <span className="text-[10px] text-slate-400">
                        {formatTime(result.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
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
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Users className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-slate-500 mb-4">
                No friends yet.
              </p>
              <button
                onClick={() => setShowAddFriendModal(true)}
                className="text-xs font-bold text-indigo-600 hover:underline"
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
                  justSwitchedThreadRef.current = true
                }}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                  activeView === "dm" && activeDMUser === friend.id
                    ? "bg-indigo-50 border-indigo-100"
                    : "bg-white border-transparent hover:bg-slate-50"
                }`}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm bg-white border border-slate-100">
                    {friend.avatar}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      friend.status === "online"
                        ? "bg-emerald-500"
                        : "bg-slate-300"
                    }`}
                  ></span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-bold truncate text-slate-700">
                    {friend.name}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {friend.status === "online" ? "Online" : "Offline"}
                  </div>
                </div>
                <div className="p-1.5 rounded-lg hover:bg-white hover:text-indigo-600 text-slate-300 transition-colors">
                  <MessageSquare className="w-4 h-4" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Add Friend Confirmation Modal */}
      {showAddFriendConfirm && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-fade-in bg-slate-900/40">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100 text-center">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-sm">
              <UserPlus className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-slate-900">
              Add Friend?
            </h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Do you want to send a friend request to{" "}
              <span className="font-bold">
                {users.find(u => u.id === showAddFriendConfirm)?.name}
              </span>
              ?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowAddFriendConfirm(null)}
                className="flex-1 py-3 px-6 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
              >
                No
              </button>
              <button
                onClick={() => {
                  if (showAddFriendConfirm)
                    sendFriendRequest(showAddFriendConfirm)
                  setShowAddFriendConfirm(null)
                }}
                className="flex-1 py-3 px-6 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Denied Modal */}
      {showAccessDeniedModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-fade-in bg-slate-900/40">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2 text-slate-900">
              Access Restricted
            </h3>
            <p className="text-slate-500 text-center text-sm mb-8 leading-relaxed">
              The admin has not allowed you to view/message this channel. Please
              ask for an invite.
            </p>
            <button
              onClick={() => setShowAccessDeniedModal(false)}
              className="w-full py-3.5 px-6 rounded-2xl font-bold bg-slate-900 text-white shadow-lg hover:bg-slate-800 transition-all active:scale-95"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in bg-slate-900/40">
          <div className="rounded-[2rem] p-8 w-full max-w-sm shadow-2xl bg-white ring-1 ring-slate-900/5">
            <h3 className="text-xl font-bold mb-6 text-slate-900">
              Rename {showRenameModal.type === "space" ? "Space" : "Channel"}
            </h3>
            <input
              type="text"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6 outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="flex-1 py-3 rounded-2xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="flex-1 py-3 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in bg-slate-900/40">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2 text-slate-900">
              Are you sure?
            </h3>
            <p className="text-slate-500 text-center text-sm mb-8 leading-relaxed">
              You are about to delete this {showDeleteConfirm.type}. This action
              cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 px-6 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 px-6 rounded-2xl font-bold bg-red-600 text-white shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {showRemoveMemberConfirm && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in bg-slate-900/40">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100">
            <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2 text-slate-900">
              Remove member?
            </h3>
            <p className="text-slate-500 text-center text-sm mb-8 leading-relaxed">
              You are about to remove <strong>{showRemoveMemberConfirm.name}</strong> from <strong>{getActiveViewName().replace('# ', '')}</strong>. They will receive a notification about this.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowRemoveMemberConfirm(null)}
                className="flex-1 py-3 px-6 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveMember}
                className="flex-1 py-3 px-6 rounded-2xl font-bold bg-red-600 text-white shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in bg-slate-900/40">
          <div className="rounded-[2rem] p-8 w-full max-w-md shadow-2xl bg-white ring-1 ring-slate-900/5">
            <h3 className="text-2xl font-bold mb-6 text-slate-800">
              New Event
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={e =>
                    setNewEvent({ ...newEvent, title: e.target.value })
                  }
                  className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Strategy Meeting"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={e =>
                      setNewEvent({ ...newEvent, time: e.target.value })
                    }
                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Type
                  </label>
                  <div className="flex p-1 rounded-2xl bg-slate-50 border border-slate-200">
                    <button
                      onClick={() =>
                        setNewEvent({ ...newEvent, type: "meeting" })
                      }
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                        newEvent.type === "meeting"
                          ? "bg-white shadow-sm text-indigo-600"
                          : "text-slate-400"
                      }`}
                    >
                      Meeting
                    </button>
                    <button
                      onClick={() => setNewEvent({ ...newEvent, type: "note" })}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                        newEvent.type === "note"
                          ? "bg-white shadow-sm text-indigo-600"
                          : "text-slate-400"
                      }`}
                    >
                      Note
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Description
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={e =>
                    setNewEvent({ ...newEvent, description: e.target.value })
                  }
                  className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                  placeholder="Details..."
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 py-3.5 font-bold rounded-2xl text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCalendarEvent}
                  className="flex-1 py-3.5 font-bold rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                >
                  Save Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Space Modal */}
      {showCreateSpaceModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in bg-slate-900/40">
          <div className="rounded-[2rem] p-8 w-full max-w-sm shadow-2xl bg-white ring-1 ring-slate-900/5">
            <h3 className="text-2xl font-bold mb-6 text-slate-800">
              Create Space
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                value={newSpaceName}
                onChange={e => setNewSpaceName(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Space Name"
                autoFocus
              />
              <div className="flex gap-4">
                <button
                  onClick={() => setShowCreateSpaceModal(false)}
                  className="flex-1 py-3.5 font-bold rounded-2xl text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createSpace}
                  className="flex-1 py-3.5 font-bold rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
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
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in bg-slate-900/40">
          <div className="rounded-[2rem] p-8 w-full max-w-md shadow-2xl bg-white ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-bold text-slate-800">Add Friends</h3>
              <button
                onClick={() => setShowAddFriendModal(false)}
                className="p-2 rounded-full transition-colors hover:bg-slate-100 text-slate-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {!inviteSent ? (
              <div className="space-y-6">
                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Find People
                  </label>
                  <div className="relative">
                    <Search className="absolute left-5 top-4 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      value={inviteSearchQuery}
                      onChange={e => {
                        setInviteSearchQuery(e.target.value)
                      }}
                      placeholder="Search by name..."
                      className="w-full pl-12 pr-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent font-medium bg-slate-50 border border-slate-200 text-slate-800"
                    />
                  </div>
                  {inviteSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 rounded-2xl shadow-xl max-h-48 overflow-y-auto py-2 bg-white border border-slate-100">
                      {inviteSearchResults.map(u => {
                        const isSelected = selectedFriendInvitees.includes(u.id)
                        return (
                          <div
                            key={u.id}
                            onClick={() => toggleFriendSelection(u.id)}
                            className={`px-5 py-3 cursor-pointer flex items-center justify-between gap-3 transition-colors border-l-4 ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-50"
                                : "border-transparent hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl rounded-full w-9 h-9 flex items-center justify-center bg-slate-50">
                                {u.avatar}
                              </span>
                              <span className="font-bold text-slate-700">
                                {u.name}
                              </span>
                            </div>
                            {isSelected && (
                              <CheckCircle className="w-5 h-5 text-indigo-500" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                {selectedFriendInvitees.length > 0 && (
                  <div className="p-4 rounded-2xl border bg-indigo-50 border-indigo-100">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500 mb-2">
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
                            className="text-xs bg-white px-2 py-1 rounded-lg border border-indigo-100 font-bold text-indigo-800 flex items-center gap-1"
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
                  className="w-full py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white shadow-lg transition-all transform hover:scale-[1.02] bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                >
                  <UserPlus className="w-5 h-5" />
                  Send {selectedFriendInvitees.length} Request
                  {selectedFriendInvitees.length !== 1 ? "s" : ""}
                </button>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border animate-bounce bg-emerald-100 border-emerald-200">
                  <Check className="w-12 h-12 text-emerald-600" />
                </div>
                <h4 className="text-2xl font-bold mb-2 text-slate-800">
                  Sent!
                </h4>
                <p className="text-slate-500">
                  Friend requests delivered successfully.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add To Channel Modal - Invite Member logic */}
      {showAddToSpaceModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in bg-slate-900/40">
          <div className="rounded-[2rem] p-8 w-full max-w-md shadow-2xl bg-white ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-bold text-slate-800">
                Invite Members
              </h3>
              <button
                onClick={() => setShowAddToSpaceModal(false)}
                className="p-2 rounded-full transition-colors hover:bg-slate-100 text-slate-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {!inviteSent ? (
              <div className="space-y-6">
                {friends.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <Users className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 mb-6 px-4">
                      You need to be friends with people before inviting them to
                      this channel.
                    </p>
                    <button
                      onClick={() => {
                        setShowAddToSpaceModal(false)
                        setShowAddFriendModal(true)
                      }}
                      className="w-full py-4 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-5 h-5" /> Find Friends
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                        Search Friends
                      </label>
                      <div className="relative">
                        <Search className="absolute left-5 top-4 w-5 h-5 text-slate-500" />
                        <input
                          type="text"
                          value={inviteSearchQuery}
                          onChange={e => setInviteSearchQuery(e.target.value)}
                          placeholder="Search by name..."
                          className="w-full pl-12 pr-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent font-medium bg-slate-50 border border-slate-200 text-slate-800"
                        />
                      </div>
                      {inviteSearchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-2 rounded-2xl shadow-xl max-h-48 overflow-y-auto py-2 bg-white border border-slate-100">
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
                                    ? "border-indigo-500 bg-indigo-50"
                                    : "border-transparent hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xl rounded-full w-9 h-9 flex items-center justify-center bg-slate-50">
                                    {u.avatar}
                                  </span>
                                  <span className="font-bold text-slate-700">
                                    {u.name}
                                  </span>
                                </div>
                                {isSelected && (
                                  <CheckCircle className="w-5 h-5 text-indigo-500" />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    {selectedInviteUsers.length > 0 && (
                      <div className="p-4 rounded-2xl border bg-indigo-50 border-indigo-100">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500 mb-2">
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
                                className="text-xs bg-white px-2 py-1 rounded-lg border border-indigo-100 font-bold text-indigo-800 flex items-center gap-1"
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
                      className="w-full py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white shadow-lg transition-all transform hover:scale-[1.02] bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                    >
                      <UserPlus className="w-5 h-5" />
                      Add {selectedInviteUsers.length} Member
                      {selectedInviteUsers.length !== 1 ? "s" : ""}
                    </button>

                    <div className="text-center mt-2">
                      <button
                        onClick={() => {
                          setShowAddToSpaceModal(false)
                          setShowAddFriendModal(true)
                        }}
                        className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        Don't see them? Find new friends
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border animate-bounce bg-emerald-100 border-emerald-200">
                  <Check className="w-12 h-12 text-emerald-600" />
                </div>
                <h4 className="text-2xl font-bold mb-2 text-slate-800">
                  Added!
                </h4>
                <p className="text-slate-500">
                  Members successfully added to the channel.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in bg-slate-900/40">
          <div className="rounded-[2rem] p-8 w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] bg-white ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-bold flex items-center gap-3 text-slate-800">
                <Bell className="w-8 h-8 text-indigo-500" /> Notifications
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAllNotifications}
                  disabled={!((currentUser?.notifications || []).some(n => n.type === 'info'))}
                  className="text-sm font-bold px-3 py-2 rounded-xl transition-colors text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear all
                </button>
                <button
                  onClick={() => setShowNotificationsModal(false)}
                  className="p-2 rounded-full transition-colors hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {currentUser?.notifications.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Bell className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">No new notifications</p>
                </div>
              ) : (
                currentUser?.notifications.map(notif => (
                  <div
                    key={notif.id}
                    className="p-5 border rounded-2xl transition-all group border-slate-100 bg-slate-50 hover:bg-white hover:shadow-lg"
                  >
                    <div className="flex gap-4">
                      <div className="p-3 rounded-full h-fit shadow-sm bg-white border border-slate-100">
                        {notif.type === "friend_request" ? (
                          <UserPlus className="w-5 h-5 text-indigo-600" />
                        ) : notif.type === "info" ? (
                          <Info className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Mail className="w-5 h-5 text-pink-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        {notif.type === "friend_request" ? (
                          <p className="text-sm leading-relaxed text-slate-600">
                            <span className="font-bold text-slate-900">
                              {notif.from}
                            </span>{" "}
                            sent you a friend request.
                          </p>
                        ) : notif.type === "info" ? (
                          <p className="text-sm leading-relaxed text-slate-600">
                            {notif.message}
                          </p>
                        ) : (
                          <p className="text-sm leading-relaxed text-slate-600">
                            <span className="font-bold text-slate-900">
                              {notif.from}
                            </span>{" "}
                            invited you to{" "}
                            <span className="font-bold text-indigo-600">
                              {notif.spaceName}
                            </span>
                          </p>
                        )}



                        {notif.type === "info" ? (
                          <button
                            onClick={() => dismissNotification(notif.id)}
                            className="mt-3 text-xs font-bold text-slate-400 hover:text-slate-600"
                          >
                            Dismiss
                          </button>
                        ) : (
                          <div className="flex gap-3 mt-4">
                            <button
                              onClick={() =>
                                handleNotificationAction(notif.id, notif.type)
                              }
                              className="flex-1 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-95 bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                              <CheckCircle className="w-4 h-4" /> Accept
                            </button>
                            <button
                              onClick={() =>
                                handleRejectNotification(notif.id, notif.type)
                              }
                              className="flex-1 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-slate-200 transition-all hover:bg-slate-100 text-slate-500"
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
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in bg-slate-900/40">
          <div className="rounded-[2rem] p-8 w-full max-w-sm shadow-2xl bg-white ring-1 ring-slate-900/5">
            <h3 className="text-2xl font-bold mb-6 text-slate-800">
              New Channel
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Channel Name"
                autoFocus
              />
              <div className="flex gap-4">
                <button
                  onClick={() => setShowChannelModal(false)}
                  className="flex-1 py-3.5 font-bold rounded-2xl text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createChannel}
                  className="flex-1 py-3.5 font-bold rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
