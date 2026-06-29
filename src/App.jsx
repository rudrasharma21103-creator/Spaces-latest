import React, { startTransition, useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from "react"
import {
  Send,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link,
  ListOrdered,
  List,
  AlignLeft,
  AtSign,
  Code2,
  Braces,
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
  GraduationCap,
  Briefcase,
  User as UserIcon,
  MessageCircle,
  Star,
  Pin,
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
  LayoutGrid,
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
  LogOut,
  Zap,
  Home as HomeIcon,
  Loader2
} from "lucide-react"
import { createPortal } from "react-dom"
import * as Storage from "./services/storage"
import { getStoredUser, getToken, logout as authLogout, saveAuth } from "./services/auth"
import * as GoogleService from "./services/google"
import { connectChatSocket, connectUserSocket } from "./services/ws"
import TaskModal from "./components/TaskModal"
import SmartImage from "./components/SmartImage"
import HomeHub from "./components/HomeHub"
import ProductLandingPage from "./components/ProductLandingPage"
import TasksHub from "./components/TasksHub"
import ContextsHub from "./components/ContextsHub"
import DocumentsHub from "./components/DocumentsHub"
import ConnectHub from "./components/ConnectHub"
import {
  AddToContextPopover,
  ChannelFilesGallery,
  ChannelTabs,
  ContextBadge,
  ContextsTabView,
  CreateContextModal,
  DecisionList,
  LivingContextPanel,
  MessageActionButton,
  MessageActionsMenu,
} from "./components/LivingContext"
import { CHANNEL_TABS, FRIEND_CHAT_TABS, createContextRecord } from "./components/LivingContext.helpers"
import * as TasksService from "./services/tasks"
import * as RolesService from "./services/roles"
import * as DraftsService from "./services/drafts"
import AdminDashboard from "./AdminDashboard"

const COMPOSER_FORMAT_ACTIONS = [
  { key: "bold", label: "Bold", icon: Bold },
  { key: "italic", label: "Italic", icon: Italic },
  { key: "underline", label: "Underline", icon: Underline },
  { key: "strike", label: "Strikethrough", icon: Strikethrough },
  { key: "link", label: "Link", icon: Link, dividerBefore: true },
  { key: "ordered-list", label: "Numbered list", icon: ListOrdered },
  { key: "bullet-list", label: "Bulleted list", icon: List },
  { key: "quote", label: "Quote", icon: AlignLeft, dividerBefore: true },
  { key: "inline-code", label: "Inline code", icon: Code2 },
  { key: "code-block", label: "Code block", icon: Braces },
]

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

const CONTEXT_ROUTE_STATE_KEY = "spacexyz_context_route_state"
const NAVIGATION_STATE_KEY = "spacexyz_navigation_state"
const READ_MESSAGE_COUNTS_KEY = "spacexyz_read_message_counts"

const getChannelIconButtonClass = (isDarkMode, { active = false, disabled = false, hiddenOnMobile = false } = {}) => [
  hiddenOnMobile ? "hidden md:inline-flex" : "inline-flex",
  "liquid-glass-nav-item workspace-premium-icon-button group relative shrink-0 items-center justify-center rounded-xl p-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40",
  active
    ? isDarkMode
      ? "active text-blue-300"
      : "active text-sky-700"
    : isDarkMode
      ? "text-slate-400 hover:text-slate-100"
      : "text-slate-500 hover:text-slate-700",
  disabled ? "disabled:cursor-not-allowed disabled:opacity-50" : ""
].filter(Boolean).join(" ")

const getMobileIconButtonClass = (isDarkMode, { active = false, disabled = false } = {}) => [
  "workspace-mobile-action workspace-premium-mobile-action inline-flex shrink-0 items-center justify-center rounded-xl p-0 transition-colors duration-150 touch-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40",
  active
    ? isDarkMode
      ? "bg-blue-500/15 text-blue-300"
      : "bg-blue-100 text-sky-700"
    : isDarkMode
      ? "bg-white/[0.06] text-slate-400 hover:bg-white/10 hover:text-slate-100 active:bg-white/10"
      : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:bg-blue-50",
  disabled ? "disabled:cursor-not-allowed disabled:opacity-50" : ""
].filter(Boolean).join(" ")

const getReadMessageCountsStorageKey = userId => `${READ_MESSAGE_COUNTS_KEY}_${userId || "anonymous"}`

const readStoredMessageCounts = userId => {
  if (!userId || typeof window === "undefined") return {}
  try {
    const stored = window.localStorage.getItem(getReadMessageCountsStorageKey(userId))
    const parsed = stored ? JSON.parse(stored) : {}
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const writeStoredMessageCounts = (userId, counts) => {
  if (!userId || typeof window === "undefined") return
  try {
    window.localStorage.setItem(getReadMessageCountsStorageKey(userId), JSON.stringify(counts || {}))
  } catch {}
}

const slugifyRoutePart = value => {
  const text = String(value ?? "").trim()
  if (!text) return ""
  return text
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const routePartMatches = (routePart, ...values) => {
  if (routePart === undefined || routePart === null) return false
  const decoded = decodeURIComponent(String(routePart)).trim()
  const decodedLower = decoded.toLowerCase()
  return values.some(value => {
    if (value === undefined || value === null || value === "") return false
    const raw = String(value).trim()
    return decodedLower === raw.toLowerCase() || decodedLower === slugifyRoutePart(raw)
  })
}

const normalizeWorkspaceSearchValue = value =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()

const getWorkspaceSearchTokens = value =>
  normalizeWorkspaceSearchValue(value).split(" ").filter(Boolean)

const workspaceSearchMatches = (searchText, tokens) => {
  if (!tokens.length) return false
  const haystack = normalizeWorkspaceSearchValue(searchText)
  return tokens.every(token => haystack.includes(token))
}

const scoreWorkspaceSearchItem = (item, tokens) => {
  const title = normalizeWorkspaceSearchValue(item?.title)
  const context = normalizeWorkspaceSearchValue(item?.contextPath || item?.sourceLabel || "")
  const text = normalizeWorkspaceSearchValue(item?.subtitle || item?.searchText || "")
  let score = 0

  tokens.forEach(token => {
    if (title === token) score += 80
    else if (title.startsWith(token)) score += 48
    else if (title.includes(token)) score += 28

    if (context.includes(token)) score += 14
    if (text.includes(token)) score += 8
  })

  const timestamp = item?.timestamp ? new Date(item.timestamp).getTime() : 0
  return score + (Number.isFinite(timestamp) ? Math.min(timestamp / 10000000000000, 1) : 0)
}

const getWorkspaceSearchDateMs = item => {
  if (!item?.timestamp) return 0
  const dateMs = new Date(item.timestamp).getTime()
  return Number.isFinite(dateMs) ? dateMs : 0
}

const passesWorkspaceSearchDateFilter = (item, filter, now = Date.now()) => {
  if (!filter || filter === "all") return true
  const dateMs = getWorkspaceSearchDateMs(item)
  if (!dateMs) return false

  const oneDay = 24 * 60 * 60 * 1000
  if (filter === "today") {
    const itemDate = new Date(dateMs)
    const today = new Date(now)
    return (
      itemDate.getFullYear() === today.getFullYear() &&
      itemDate.getMonth() === today.getMonth() &&
      itemDate.getDate() === today.getDate()
    )
  }
  if (filter === "week") return now - dateMs <= 7 * oneDay
  if (filter === "month") return now - dateMs <= 30 * oneDay
  return true
}

const getStarredItemKey = item =>
  `${item?.chatId || item?.channelId || item?.spaceId || "starred"}:${item?.messageId || item?.id || "message"}`

const isProtectedAppPath = pathname => {
  const normalized = String(pathname || "/").replace(/\/+$/, "") || "/"
  return (
    normalized === "/documents" ||
    normalized === "/connect" ||
    normalized === "/tasks" ||
    normalized === "/notifications" ||
    normalized === "/starred" ||
    normalized === "/contexts" ||
    normalized.startsWith("/contexts/") ||
    normalized.startsWith("/space/") ||
    normalized.startsWith("/dm/")
  )
}

const getInitialAuthBootState = () => {
  const storedUser = getStoredUser()
  const hasStoredAuth = Boolean(getToken() || storedUser?.id)
  const isProtectedPath = typeof window !== "undefined" && isProtectedAppPath(window.location.pathname)
  let cachedSpaces = []
  let cachedFriends = []
  let cachedDrafts = []
  let cachedTasks = []

  if (storedUser?.id) {
    try {
      cachedSpaces = Storage.peekSpacesForUser?.(storedUser.spaces || []) || []
    } catch {
      cachedSpaces = []
    }
    try {
      const friendIds = Array.isArray(storedUser.friends) ? storedUser.friends.map(id => String(id)) : []
      const usersById = new Map((Storage.peekUsers?.() || []).map(user => [String(user?.id), user]))
      cachedFriends = friendIds.map(id => usersById.get(id)).filter(Boolean)
    } catch {
      cachedFriends = []
    }
    try {
      cachedDrafts = DraftsService.peekDrafts?.() || []
    } catch {
      cachedDrafts = []
    }
    try {
      cachedTasks = TasksService.peekTasksForUser?.() || []
    } catch {
      cachedTasks = []
    }
  }

  return {
    storedUser,
    cachedSpaces,
    cachedFriends,
    cachedDrafts,
    cachedTasks,
    hasStoredAuth,
    isProtectedPath,
    shouldVerifySession: hasStoredAuth,
    showRestoreSplash: false,
  }
}

const SPACE_IMAGE_ICON_NUMBERS = [2, 3, 4, 5, 6, 7, 8]

const getSpaceImageIconType = index => `image-${SPACE_IMAGE_ICON_NUMBERS[index % SPACE_IMAGE_ICON_NUMBERS.length]}`

const getSpaceImageIconSrc = (space, index = 0) => {
  const iconType = String(space?.iconType || "")
  const match = iconType.match(/^image-([2-8])$/)
  const imageNumber = match
    ? Number(match[1])
    : SPACE_IMAGE_ICON_NUMBERS[index % SPACE_IMAGE_ICON_NUMBERS.length]

  return `/image%20${imageNumber}.png`
}

const createSpaceIconElement = iconType => {
  const imageMatch = String(iconType || "").match(/^image-([2-8])$/)
  if (imageMatch) {
    return (
      <SmartImage
        src={`/image%20${imageMatch[1]}.png`}
        alt="Space icon"
        className="h-5 w-5 object-contain"
      />
    )
  }
  if (iconType === "graduation") return <GraduationCap className="w-5 h-5" />
  if (iconType === "briefcase") return <Briefcase className="w-5 h-5" />
  return <UserIcon className="w-5 h-5" />
}

const SpaceImageIcon = ({ space, index = 0, className = "h-6 w-6" }) => (
  <SmartImage
    src={getSpaceImageIconSrc(space, index)}
    alt={`${space?.name || "Space"} icon`}
    className={`${className} object-contain`}
  />
)

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
])

const ADMIN_DASHBOARD_ROLES = new Set(["admin", "org_admin", "owner"])

const getEmailDomain = email => {
  const match = String(email || "").trim().toLowerCase().match(/@([A-Za-z0-9.-]+)$/)
  return match ? match[1] : ""
}

const isVerifiedOrg = org => (
  org?.verified === true ||
  String(org?.verified || "").toLowerCase() === "true" ||
  String(org?.status || "").toLowerCase() === "verified"
)

const createClientId = prefix => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const dedupeMessagesById = messages => {
  if (!Array.isArray(messages) || messages.length < 2) return Array.isArray(messages) ? messages : []

  const byId = new Map()
  const withoutIds = []
  messages.forEach(message => {
    if (!message?.id) {
      withoutIds.push(message)
      return
    }

    const key = String(message.id)
    const existing = byId.get(key)
    if (!existing) {
      byId.set(key, message)
      return
    }

    byId.set(key, {
      ...existing,
      ...message,
      attachments: Array.isArray(message.attachments) ? message.attachments : existing.attachments,
      status: message.status || existing.status,
      optimistic: Boolean(existing.optimistic && message.optimistic),
    })
  })

  return [...byId.values(), ...withoutIds]
}

const isRenderableChatMessagePayload = data => {
  if (!data || typeof data !== "object") return false

  const hasMessageId = data.id != null || data._id != null || data.localId != null
  const hasSender = data.userId != null || data.senderId != null || data.createdBy != null
  const hasMessageContent =
    typeof data.text === "string" ||
    Array.isArray(data.attachments) ||
    Boolean(data.meetLink) ||
    Boolean(data.task) ||
    data.type === "meet-invite"

  return Boolean(hasMessageId && (hasSender || hasMessageContent))
}

function getAttachmentCacheKey(att) {
  if (!att) return null

  return (
    att.fileId ||
    att.drive_file_id ||
    att.gmailAttachmentId ||
    att.id ||
    att.url ||
    att.public_url ||
    att.webViewLink ||
    null
  )
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
  const showMobileAccountSidebar = showMobileDrawer === "account"

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

  const [initialAuthBoot] = useState(getInitialAuthBootState)
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(initialAuthBoot.storedUser?.id))
  const [authInitializing, setAuthInitializing] = useState(false)
  const [currentUser, setCurrentUser] = useState(() => initialAuthBoot.storedUser || null)
  const [showLandingPage, setShowLandingPage] = useState(
    () => !initialAuthBoot.hasStoredAuth && !initialAuthBoot.isProtectedPath
  ) // Landing page state
  const [authMode, setAuthMode] = useState("login")
  const [authData, setAuthData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: ""
  })
  const [authError, setAuthError] = useState("")
  const [authSuccess, setAuthSuccess] = useState("")
  const [authBootError, setAuthBootError] = useState("")
  const [appDataReady, setAppDataReady] = useState(
    () =>
      Boolean(initialAuthBoot.storedUser?.id) &&
      (
        (Array.isArray(initialAuthBoot.cachedSpaces) && initialAuthBoot.cachedSpaces.length > 0) ||
        !Array.isArray(initialAuthBoot.storedUser?.spaces) ||
        initialAuthBoot.storedUser.spaces.length === 0
      )
  )
  const [routeReady, setRouteReady] = useState(false)
  const [restoreSplashVisible, setRestoreSplashVisible] = useState(initialAuthBoot.showRestoreSplash)
  const [restoreSplashEnabled, setRestoreSplashEnabled] = useState(initialAuthBoot.showRestoreSplash)
  const [authPending, setAuthPending] = useState(false)
  const [googleAuthPending, setGoogleAuthPending] = useState(false)

  // Main Data State
  const [spaces, setSpaces] = useState(() =>
    (Array.isArray(initialAuthBoot.cachedSpaces) ? initialAuthBoot.cachedSpaces : []).map(space => ({
      ...space,
      icon: createSpaceIconElement(space.iconType),
      expanded: false,
    }))
  )
  const [users, setUsers] = useState([])
  const [friends, setFriends] = useState(() => initialAuthBoot.cachedFriends || [])
  const [events, setEvents] = useState([])

  // UI State
  const [activeSpace, setActiveSpace] = useState(null)
  const [activeChannel, setActiveChannel] = useState(null)
  const [activeView, setActiveView] = useState("home")
  const [activeDMUser, setActiveDMUser] = useState(null)
  const [homeSection, setHomeSection] = useState("overview")
  const [dedicatedPageReturn, setDedicatedPageReturn] = useState(null)
  const [contextsSourceView, setContextsSourceView] = useState(null)
  const [connectPreferredPane, setConnectPreferredPane] = useState("discover")
  const [homeActiveDMUser, setHomeActiveDMUser] = useState(null)
  const [homeDMInput, setHomeDMInput] = useState("")
  const [homeDMSending, setHomeDMSending] = useState(false)
  const [drafts, setDrafts] = useState(() => initialAuthBoot.cachedDrafts || [])
  const [activeDraftId, setActiveDraftId] = useState(null)
  const [starredMessages, setStarredMessages] = useState([])
  const [activeStarredMessageId, setActiveStarredMessageId] = useState(null)
  const [activeNotificationId, setActiveNotificationId] = useState(null)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState("")
  const [focusedTaskId, setFocusedTaskId] = useState(null)
  const [pinnedChannels, setPinnedChannels] = useState([])
  const [, setTimesaversLoading] = useState(false)
  const authResolvedAtRef = useRef(0)
  const authLookupCacheRef = useRef(new Map())
  const googleAuthInFlightRef = useRef(false)
  const restoreSplashStartedAtRef = useRef(0)

  const [messages, setMessages] = useState({})
  const [unreadChannels, setUnreadChannels] = useState([]) // Track unread channel IDs
  const [, setMessageCounts] = useState({}) // Track counts to detect changes
  const readMessageCountsRef = useRef({})
  const pendingReactionOverridesRef = useRef(new Map())

  const getReactionOverrideKey = React.useCallback((chatId, messageId) => `${String(chatId)}::${String(messageId)}`, [])

  const cloneReactions = React.useCallback(reactions => {
    const next = {}
    Object.entries(reactions || {}).forEach(([emoji, userIds]) => {
      if (!Array.isArray(userIds) || userIds.length === 0) return
      next[emoji] = [...userIds]
    })
    return next
  }, [])

  const setUserReactionState = React.useCallback((reactions, emoji, userId, shouldHaveReaction) => {
    const normalizedUserId = String(userId)
    const existing = Array.isArray(reactions?.[emoji]) ? reactions[emoji] : []
    const withoutUser = existing.filter(id => String(id) !== normalizedUserId)

    if (shouldHaveReaction) {
      reactions[emoji] = [...withoutUser, userId]
      return reactions
    }

    if (withoutUser.length > 0) reactions[emoji] = withoutUser
    else delete reactions[emoji]
    return reactions
  }, [])

  const applyPendingReactionOverrides = React.useCallback((chatId, items) => {
    if (!currentUser?.id || !chatId || !Array.isArray(items) || items.length === 0) return items

    const now = Date.now()
    const ttl = 20000

    return items.map(message => {
      const messageId = message?.id
      if (!messageId) return message

      const key = getReactionOverrideKey(chatId, messageId)
      const pending = pendingReactionOverridesRef.current.get(key)
      if (!pending) return message

      if (now - pending.updatedAt > ttl) {
        pendingReactionOverridesRef.current.delete(key)
        return message
      }

      const reactions = cloneReactions(message.reactions)

      Object.entries(pending.emojiStates || {}).forEach(([emoji, shouldHaveReaction]) => {
        setUserReactionState(reactions, emoji, currentUser.id, shouldHaveReaction)
      })

      return { ...message, reactions }
    })
  }, [cloneReactions, currentUser?.id, getReactionOverrideKey, setUserReactionState])

  const markChannelRead = React.useCallback((channelId, count = 0) => {
    if (!channelId || !currentUser?.id) return
    const key = String(channelId)
    const normalizedCount = Math.max(Number(count) || 0, 0)
    const nextReadCounts = {
      ...readMessageCountsRef.current,
      [key]: normalizedCount,
    }

    readMessageCountsRef.current = nextReadCounts
    writeStoredMessageCounts(currentUser.id, nextReadCounts)
    setMessageCounts(prev => ({ ...prev, [key]: normalizedCount }))
    setUnreadChannels(prev => prev.filter(id => String(id) !== key))
  }, [currentUser?.id])

  const protectedAppBooting = isAuthenticated && (!currentUser?.id || !appDataReady || !routeReady)
  const restoreSplashActive = restoreSplashEnabled && (authInitializing || authPending || protectedAppBooting)
  const cachedBootUserRef = useRef(initialAuthBoot.storedUser || null)

  useEffect(() => {
    let hideTimer = null

    if (!restoreSplashEnabled) {
      setRestoreSplashVisible(false)
      restoreSplashStartedAtRef.current = 0
      return undefined
    }

    if (restoreSplashActive) {
      if (!restoreSplashStartedAtRef.current) {
        restoreSplashStartedAtRef.current = Date.now()
      }
      setRestoreSplashVisible(true)
    } else if (restoreSplashVisible) {
      const elapsed = Date.now() - restoreSplashStartedAtRef.current
      const remaining = Math.max(0, 450 - elapsed)
      hideTimer = window.setTimeout(() => {
        setRestoreSplashVisible(false)
        setRestoreSplashEnabled(false)
        restoreSplashStartedAtRef.current = 0
      }, remaining)
    }

    return () => {
      if (hideTimer) window.clearTimeout(hideTimer)
    }
  }, [restoreSplashActive, restoreSplashEnabled, restoreSplashVisible])

  useEffect(() => {
    if (!currentUser?.id) {
      readMessageCountsRef.current = {}
      setMessageCounts({})
      setUnreadChannels([])
      return
    }

    const storedReadCounts = readStoredMessageCounts(currentUser.id)
    readMessageCountsRef.current = storedReadCounts
    setMessageCounts(storedReadCounts)
    setUnreadChannels([])
  }, [currentUser?.id])

  const [sidebarCollapsed] = useState(false)
  const [friendsSidebarCollapsed, setFriendsSidebarCollapsed] = useState(true)
  const [collapsedSpaceMenu, setCollapsedSpaceMenu] = useState(null)
  const [sidebarSectionOpen, setSidebarSectionOpen] = useState({
    spaces: true,
    dms: true
  })

  // Search State
  const [searchQuery, setSearchQuery] = useState("") // Sidebar Search Input
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [spaceSearchResults, setSpaceSearchResults] = useState([])
  const [dmSearchResults, setDmSearchResults] = useState([])
  const [fileSearchResults, setFileSearchResults] = useState([])
  const [workspaceSearchTab, setWorkspaceSearchTab] = useState("messages")
  const [workspaceSearchFromFilter, setWorkspaceSearchFromFilter] = useState("all")
  const [workspaceSearchDateFilter, setWorkspaceSearchDateFilter] = useState("all")
  const [workspaceSearchDismissed, setWorkspaceSearchDismissed] = useState(false)
  const [channelActionMenu, setChannelActionMenu] = useState(null)

  // Search Highlighting & Navigation
  const [highlightTerm, setHighlightTerm] = useState("")
  const [targetMessageId, setTargetMessageId] = useState(null)
  const [pinnedMessageId, setPinnedMessageId] = useState(null)
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState(null)
  const [activeChannelTab, setActiveChannelTab] = useState("messages")
  const [selectedMessageIds, setSelectedMessageIds] = useState([])
  const [messageActionMenu, setMessageActionMenu] = useState(null)
  const [messageContextPicker, setMessageContextPicker] = useState(null)
  const [composerAttachMenuOpen, setComposerAttachMenuOpen] = useState(false)
  const [composerContextPickerOpen, setComposerContextPickerOpen] = useState(false)
  const [selectedComposerContextId, setSelectedComposerContextId] = useState(null)
  const [contextItems, setContextItems] = useState([])
  const [contextDecisions, setContextDecisions] = useState([])
  const [contextTasks, setContextTasks] = useState([])
  const [openContextId, setOpenContextId] = useState(null)
  const [contextDraft, setContextDraft] = useState(null)
  const [editingContextId, setEditingContextId] = useState(null)
  const [taskModalDraft, setTaskModalDraft] = useState(null)

  const pushAppRoute = path => {
    if (typeof window === "undefined" || window.location.pathname === path) return
    try {
      window.history.pushState({}, "", path)
    } catch (error) {
      console.warn("Route navigation fallback", error)
    }
  }

  const readContextRouteState = React.useCallback(() => {
    if (typeof window === "undefined") return null
    try {
      const stored = window.sessionStorage.getItem(CONTEXT_ROUTE_STATE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      return null
    }
  }, [])

  const writeContextRouteState = React.useCallback(state => {
    if (typeof window === "undefined") return
    try {
      window.sessionStorage.setItem(CONTEXT_ROUTE_STATE_KEY, JSON.stringify(state))
    } catch (error) {}
  }, [])

  const readNavigationState = React.useCallback(() => {
    if (typeof window === "undefined") return null
    for (const storage of [window.sessionStorage, window.localStorage]) {
      try {
        const stored = storage.getItem(NAVIGATION_STATE_KEY)
        if (stored) return JSON.parse(stored)
      } catch (error) {}
    }
    return null
  }, [])

  const writeNavigationState = React.useCallback(state => {
    if (typeof window === "undefined") return
    const payload = JSON.stringify({ ...state, updatedAt: Date.now() })
    try {
      window.sessionStorage.setItem(NAVIGATION_STATE_KEY, payload)
    } catch (error) {}
    try {
      window.localStorage.setItem(NAVIGATION_STATE_KEY, payload)
    } catch (error) {}
  }, [])

  const restoreFromDedicatedPage = React.useCallback(({ allowDedicated = true } = {}) => {
    if (dedicatedPageReturn?.view === "channel" || dedicatedPageReturn?.view === "dm") {
      setOpenContextId(null)
      setActiveView(dedicatedPageReturn.view)
      setActiveChannelTab(dedicatedPageReturn.channelTab || "messages")
      return "/"
    }
    if (allowDedicated && dedicatedPageReturn?.view === "tasks") {
      setOpenContextId(null)
      setActiveView("tasks")
      return "/tasks"
    }
    if (allowDedicated && dedicatedPageReturn?.view === "documents") {
      setOpenContextId(null)
      setActiveView("documents")
      return "/documents"
    }
    if (allowDedicated && dedicatedPageReturn?.view === "connect") {
      setOpenContextId(null)
      setHomeSection("connect")
      setActiveView("connect")
      return "/connect"
    }
    if (allowDedicated && dedicatedPageReturn?.view === "contexts") {
      const targetContextId = dedicatedPageReturn.openContextId || null
      setContextsSourceView(dedicatedPageReturn.contextsSourceView || "channel")
      setOpenContextId(targetContextId)
      setActiveChannelTab("messages")
      setActiveView("contexts")
      return targetContextId ? `/contexts/${encodeURIComponent(String(targetContextId))}` : "/contexts"
    }
    setOpenContextId(null)
    setActiveView("home")
    setHomeSection(dedicatedPageReturn?.homeSection || "overview")
    return "/"
  }, [dedicatedPageReturn])

  const openTasksPage = React.useCallback(() => {
    if (typeof window !== "undefined" && activeView === "tasks" && window.location.pathname === "/tasks") return
    setCollapsedSpaceMenu(null)
    setShowMobileDrawer(false)
    setFocusedTaskId(null)
    setDedicatedPageReturn({
      view: activeView,
      channelTab: activeChannelTab,
      homeSection,
      openContextId,
      contextsSourceView,
    })
    setOpenContextId(null)
    setActiveView("tasks")
    pushAppRoute("/tasks")
    if (isMobile) setMobileView("chat")
  }, [activeChannelTab, activeView, contextsSourceView, homeSection, isMobile, openContextId])

  const openContextsPage = React.useCallback((contextId = null) => {
    const targetPath = contextId ? `/contexts/${encodeURIComponent(String(contextId))}` : "/contexts"
    if (
      typeof window !== "undefined" &&
      activeView === "contexts" &&
      window.location.pathname === targetPath &&
      String(openContextId || "") === String(contextId || "")
    ) return
    const sourceView = activeView === "contexts" ? contextsSourceView || "channel" : activeView === "dm" ? "dm" : "channel"
    if (activeView !== "contexts") {
      setDedicatedPageReturn({
        view: activeView,
        channelTab: activeChannelTab,
        homeSection,
        openContextId,
        contextsSourceView,
      })
    }
    setContextsSourceView(sourceView)
    writeContextRouteState({
      sourceView,
      activeDMUser,
      activeChannel,
      activeSpace,
    })
    setActiveChannelTab("messages")
    setOpenContextId(contextId)
    setActiveView("contexts")
    pushAppRoute(targetPath)
  }, [activeChannel, activeChannelTab, activeDMUser, activeSpace, activeView, contextsSourceView, homeSection, openContextId, writeContextRouteState])

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.location.pathname.startsWith("/admin") ||
      authInitializing ||
      !appDataReady ||
      !isAuthenticated
    ) return undefined

    const applySavedNavigation = savedState => {
      if (!savedState) return
      if (savedState.activeSpace !== undefined) setActiveSpace(savedState.activeSpace)
      if (savedState.activeChannel !== undefined) setActiveChannel(savedState.activeChannel)
      if (savedState.activeDMUser !== undefined) {
        setActiveDMUser(savedState.activeDMUser)
        setHomeActiveDMUser(savedState.activeDMUser)
      }
      if (savedState.activeChannelTab) setActiveChannelTab(savedState.activeChannelTab)
      if (savedState.homeSection) setHomeSection(savedState.homeSection)
      if (savedState.contextsSourceView) setContextsSourceView(savedState.contextsSourceView)
      if (savedState.openContextId !== undefined) setOpenContextId(savedState.openContextId)
      if (["home", "channel", "dm", "tasks", "documents", "connect", "contexts", "starred", "notifications"].includes(savedState.activeView)) {
        setActiveView(savedState.activeView)
      }
    }

    const applyRoute = ({ fromPopState = false } = {}) => {
      const pathname = window.location.pathname.replace(/\/+$/, "") || "/"
      const savedState = readNavigationState()

      if (!fromPopState && initialRouteAppliedRef.current && lastAppliedRoutePathRef.current === pathname) {
        return true
      }

      if (!fromPopState && initialRouteAppliedRef.current && pathname === "/") {
        return true
      }

      if (pathname === "/tasks") {
        applySavedNavigation(savedState)
        setOpenContextId(null)
        setActiveView("tasks")
        return true
      }

      if (pathname === "/documents") {
        applySavedNavigation(savedState)
        setOpenContextId(null)
        setShowDocsModal(false)
        setActiveView("documents")
        return true
      }

      if (pathname === "/connect") {
        applySavedNavigation(savedState)
        setOpenContextId(null)
        setHomeSection("connect")
        setActiveView("connect")
        return true
      }

      if (pathname === "/starred") {
        applySavedNavigation(savedState)
        setOpenContextId(null)
        setActiveView("starred")
        return true
      }

      if (pathname === "/notifications") {
        applySavedNavigation(savedState)
        setOpenContextId(null)
        setShowNotificationsModal(false)
        setActiveView("notifications")
        return true
      }

      if (pathname === "/contexts" || pathname.startsWith("/contexts/")) {
        const contextId = pathname.startsWith("/contexts/") ? decodeURIComponent(pathname.slice("/contexts/".length)) : null
        const routeState = readContextRouteState() || savedState
        if (routeState?.activeDMUser) {
          setActiveDMUser(routeState.activeDMUser)
          setHomeActiveDMUser(routeState.activeDMUser)
        }
        if (routeState?.activeChannel) setActiveChannel(routeState.activeChannel)
        if (routeState?.activeSpace) setActiveSpace(routeState.activeSpace)
        setContextsSourceView(prev => prev || routeState?.sourceView || routeState?.contextsSourceView || (activeDMUser ? "dm" : activeChannel ? "channel" : prev))
        setActiveChannelTab(routeState?.activeChannelTab || "messages")
        setOpenContextId(contextId || null)
        setActiveView("contexts")
        return true
      }

      if (pathname.startsWith("/dm/")) {
        const dmPart = pathname.slice("/dm/".length).split("/")[0]
        const matchedFriend =
          friends.find(friend => routePartMatches(dmPart, friend.id, friend.name, friend.email)) ||
          (savedState?.activeDMUser && routePartMatches(dmPart, savedState.activeDMUser) ? { id: savedState.activeDMUser } : null)
        const targetUserId = matchedFriend?.id || decodeURIComponent(dmPart)
        if (targetUserId) {
          setActiveDMUser(targetUserId)
          setHomeActiveDMUser(targetUserId)
          setActiveChannelTab(savedState?.activeChannelTab || "messages")
          setActiveView("dm")
          return true
        }
      }

      if (pathname.startsWith("/space/")) {
        const [spacePart, channelPart] = pathname.slice("/space/".length).split("/")
        if (!spacePart || spaces.length === 0) return false

        const savedSpaceMatches = savedState?.activeSpace && routePartMatches(spacePart, savedState.activeSpace)
        const targetSpace =
          spaces.find(space => routePartMatches(spacePart, space.id, space.name)) ||
          (savedSpaceMatches ? spaces.find(space => String(space.id) === String(savedState.activeSpace)) : null)

        if (!targetSpace) return false

        const accessible = (targetSpace.channels || []).filter(channel => {
          const userId = currentUser?.id
          if (!userId) return true
          return (
            String(targetSpace.ownerId) === String(userId) ||
            (targetSpace.members || []).some(memberId => String(memberId) === String(userId)) ||
            (channel.members || []).some(memberId => String(memberId) === String(userId))
          )
        })
        const candidateChannels = accessible.length > 0 ? accessible : (targetSpace.channels || [])
        const savedChannelMatches = savedState?.activeChannel && channelPart && routePartMatches(channelPart, savedState.activeChannel)
        const targetChannel =
          (channelPart
            ? candidateChannels.find(channel => routePartMatches(channelPart, channel.id, channel.name))
            : null) ||
          (savedChannelMatches
            ? candidateChannels.find(channel => String(channel.id) === String(savedState.activeChannel))
            : null) ||
          candidateChannels[0] ||
          null

        setActiveSpace(targetSpace.id)
        if (!targetChannel) {
          setActiveChannel(null)
          setOpenContextId(null)
          setHomeSection("overview")
          setActiveView("home")
          return true
        }
        setActiveChannel(targetChannel.id)
        setActiveChannelTab(savedState?.activeChannelTab || "messages")
        setOpenContextId(null)
        setActiveView("channel")
        return true
      }

      if (pathname === "/") {
        if (fromPopState) {
          setOpenContextId(null)
          setActiveView("home")
          setHomeSection(savedState?.homeSection || "overview")
        } else {
          applySavedNavigation(savedState)
        }
        return true
      }

      if (activeView === "tasks" || activeView === "documents" || activeView === "connect" || activeView === "contexts") {
        restoreFromDedicatedPage({ allowDedicated: false })
      }
      return true
    }

    const applied = applyRoute()
    if (applied) {
      initialRouteAppliedRef.current = true
      lastAppliedRoutePathRef.current = window.location.pathname.replace(/\/+$/, "") || "/"
    }
    setRouteReady(true)
    const handlePopState = () => {
      const appliedFromPopState = applyRoute({ fromPopState: true })
      if (appliedFromPopState) {
        lastAppliedRoutePathRef.current = window.location.pathname.replace(/\/+$/, "") || "/"
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [
    activeChannel,
    activeDMUser,
    activeView,
    appDataReady,
    authInitializing,
    currentUser?.id,
    friends,
    isAuthenticated,
    readContextRouteState,
    readNavigationState,
    restoreFromDedicatedPage,
    spaces,
  ])

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.location.pathname.startsWith("/admin") ||
      authInitializing ||
      !appDataReady ||
      !routeReady ||
      !isAuthenticated
    ) return

    writeNavigationState({
      activeView,
      activeSpace,
      activeChannel,
      activeDMUser,
      activeChannelTab,
      homeSection,
      contextsSourceView,
      openContextId,
    })

    const currentPathname = window.location.pathname.replace(/\/+$/, "") || "/"
    const currentSpace = spaces.find(space => String(space.id) === String(activeSpace))
    const currentChannel = (currentSpace?.channels || []).find(channel => String(channel.id) === String(activeChannel))
    const dmUser = friends.find(friend => String(friend.id) === String(activeDMUser))

    const targetPath =
      activeView === "tasks"
        ? "/tasks"
        : activeView === "documents"
          ? "/documents"
          : activeView === "connect"
            ? "/connect"
            : activeView === "starred"
              ? "/starred"
              : activeView === "notifications"
                ? "/notifications"
                : activeView === "contexts"
                ? openContextId
                  ? `/contexts/${encodeURIComponent(String(openContextId))}`
                  : "/contexts"
                : activeView === "channel" && currentSpace && currentChannel
                  ? `/space/${encodeURIComponent(slugifyRoutePart(currentSpace.name) || String(currentSpace.id))}/${encodeURIComponent(slugifyRoutePart(currentChannel.name) || String(currentChannel.id))}`
                  : activeView === "dm" && activeDMUser
                    ? `/dm/${encodeURIComponent(slugifyRoutePart(dmUser?.name) || String(activeDMUser))}`
                    : "/"

    const currentIsEquivalentChannel =
      activeView === "channel" &&
      currentPathname.startsWith("/space/") &&
      currentSpace &&
      currentChannel &&
      (() => {
        const [spacePart, channelPart] = currentPathname.slice("/space/".length).split("/")
        return routePartMatches(spacePart, currentSpace.id, currentSpace.name) && routePartMatches(channelPart, currentChannel.id, currentChannel.name)
      })()

    const currentIsEquivalentDM =
      activeView === "dm" &&
      currentPathname.startsWith("/dm/") &&
      activeDMUser &&
      routePartMatches(currentPathname.slice("/dm/".length).split("/")[0], activeDMUser, dmUser?.name, dmUser?.email)

    if (currentPathname !== targetPath && !currentIsEquivalentChannel && !currentIsEquivalentDM) {
      try {
        window.history.replaceState({}, "", targetPath)
      } catch (error) {
        console.warn("Route replace fallback", error)
      }
    }
    lastAppliedRoutePathRef.current = window.location.pathname.replace(/\/+$/, "") || "/"
  }, [
    activeChannel,
    activeChannelTab,
    activeDMUser,
    activeSpace,
    activeView,
    appDataReady,
    authInitializing,
    contextsSourceView,
    friends,
    homeSection,
    isAuthenticated,
    openContextId,
    routeReady,
    spaces,
    writeNavigationState,
  ])

  // Modals & Panels
  const [messageInput, setMessageInput] = useState("")
  const [composerIsEmpty, setComposerIsEmpty] = useState(true)
  const [showComposerFormatting, setShowComposerFormatting] = useState(true)
  const [activeComposerFormats, setActiveComposerFormats] = useState({})
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editingMessageText, setEditingMessageText] = useState("")
  const [isSavingEditedMessage, setIsSavingEditedMessage] = useState(false)
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
  const [showDemoModal, setShowDemoModal] = useState(false) // Demo video modal for landing page
  const [tasksList, setTasksList] = useState(() => initialAuthBoot.cachedTasks || [])
  const [completingTaskId, setCompletingTaskId] = useState(null)
  const alertedScheduledRef = useRef(new Set())
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
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
      const res = await fetch(`${API_BASE}/users/set-password`, { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: setPasswordEmail, password: setPasswordValue, setupToken: orgPasswordSetupToken }) })
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
        setAuthInitializing(false)
        setShowLandingPage(false)
        setActiveView("home")
        setHomeSection("overview")
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
  const [orgPasswordSetupToken, setOrgPasswordSetupToken] = useState(null)
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [adminUsers, setAdminUsers] = useState([])
  const [adminSearch, setAdminSearch] = useState("")
  const adminSocketRef = useRef(null)
  const [adminOnlineSet, setAdminOnlineSet] = useState(new Set())
  const currentUserEmail = String(currentUser?.email || "").trim().toLowerCase()
  const currentUserDomain = getEmailDomain(currentUserEmail)
  const orgDomain = String(orgInfo?.domain || "").trim().toLowerCase()
  const orgAdminEmail = String(orgInfo?.adminEmail || "").trim().toLowerCase()
  const userOrganizationId = String(currentUser?.organizationId || "").trim().toLowerCase()
  const hasAdminDashboardRole = ADMIN_DASHBOARD_ROLES.has(currentUser?.role)
  const hasCompanyEmailDomain = Boolean(currentUserDomain && !PUBLIC_EMAIL_DOMAINS.has(currentUserDomain))
  const isRegisteredCompanyAdmin =
    Boolean(orgAdminEmail && currentUserEmail === orgAdminEmail) ||
    Boolean(userOrganizationId && orgDomain && userOrganizationId === orgDomain)
  const hasVerifiedOrgAccess = orgInfo ? isVerifiedOrg(orgInfo) : hasAdminDashboardRole && hasCompanyEmailDomain
  const canOpenAdminDashboard = Boolean(
    currentUser?.id &&
    hasVerifiedOrgAccess &&
    (hasAdminDashboardRole || isRegisteredCompanyAdmin) &&
    (
      currentUser?.role === "admin" ||
      isRegisteredCompanyAdmin ||
      (hasAdminDashboardRole && hasCompanyEmailDomain) ||
      currentUserDomain === orgDomain ||
      !orgDomain
    )
  )
  const openAdminDashboard = useCallback(() => {
    if (!canOpenAdminDashboard) return
    try {
      window.location.assign("/admin/dashboard")
    } catch (e) {
      setShowAdminDashboard(true)
    }
  }, [canOpenAdminDashboard])

  // Load organization info when currentUser changes (by domain)
  useEffect(() => {
    (async () => {
      try {
        if (!currentUser || !currentUser.email) { setOrgInfo(null); return }
        const m = (currentUser.email.match(/@([A-Za-z0-9.-]+)$/) || [])
        const domain = m[1]
        if (!domain) { setOrgInfo(null); return }
        if (PUBLIC_EMAIL_DOMAINS.has(domain.toLowerCase())) { setOrgInfo(null); return }
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
      try { setActiveView("home") } catch (e) {}
      try { setHomeSection("overview") } catch (e) {}
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
            const promptEmail = (orgForm && orgForm.adminEmail) || (oj && oj.adminEmail) || ''
            if (promptEmail && orgPasswordSetupToken) {
              try { setSetPasswordEmail(promptEmail) } catch (e) {}
              try { setShowSetPasswordModal(true) } catch (e) {}
              return
            }

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
  }, [orgStage, orgPasswordSetupToken])
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false)
  const [showAddFriendConfirm, setShowAddFriendConfirm] = useState(null) // ID of user to add
  const pendingFriendRequestIdsRef = useRef(new Set())
  const [pendingFriendRequestIds, setPendingFriendRequestIds] = useState([])
  const pendingNotificationActionIdsRef = useRef(new Set())
  const [pendingNotificationActionIds, setPendingNotificationActionIds] = useState([])

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

  // --- Persistent Login: restore trusted auth state from backend session
  useEffect(() => {
    let cancelled = false
    if (!initialAuthBoot.shouldVerifySession) {
      setAuthInitializing(false)
      setAppDataReady(false)
      setRouteReady(false)
      setRestoreSplashEnabled(false)
      return () => {
        cancelled = true
      }
    }

    const hasCachedWorkspace =
      Array.isArray(initialAuthBoot.cachedSpaces) &&
      (
        initialAuthBoot.cachedSpaces.length > 0 ||
        !Array.isArray(initialAuthBoot.storedUser?.spaces) ||
        initialAuthBoot.storedUser.spaces.length === 0
      )
    setAuthInitializing(false)
    if (!hasCachedWorkspace) {
      setAppDataReady(false)
      setRouteReady(false)
    }
    setRestoreSplashEnabled(false)
    setRestoreSplashVisible(false)
    setAuthBootError("")

    if (cachedBootUserRef.current?.id) {
      const safeCachedUser = filterDismissedUser(cachedBootUserRef.current)
      authResolvedAtRef.current = Date.now()
      const cachedSpaces = hydrateCachedSpacesForUser(safeCachedUser, { selectFirst: false })
      setCurrentUser(safeCachedUser)
      setIsAuthenticated(true)
      setShowLandingPage(false)
      if (cachedSpaces.length > 0 || !Array.isArray(safeCachedUser.spaces) || safeCachedUser.spaces.length === 0) {
        setAppDataReady(true)
      }
      setAuthInitializing(false)
    }

    ;(async () => {
      try {
        const user = await Storage.getCurrentUser({ forceRefresh: true })
        if (cancelled || !user?.id) return
        authResolvedAtRef.current = Date.now()
        const safeUser = filterDismissedUser(user)
        setCurrentUser(safeUser)
        setIsAuthenticated(true)
        setShowLandingPage(false)
        hydrateCachedSpacesForUser(safeUser, { selectFirst: false })
      } catch (error) {
        if (cancelled) return
        setIsAuthenticated(false)
        setCurrentUser(null)
        setAppDataReady(false)
        setRouteReady(false)
        if (error?.status === 401) {
          authLogout()
          setShowLandingPage(true)
          setAuthMode("login")
        } else {
          console.warn("Session verification failed without an auth rejection", error)
          setAuthBootError("We couldn't verify your session. Check the connection and try again.")
          setShowLandingPage(false)
        }
      } finally {
        if (!cancelled) setAuthInitializing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Keep only in-memory auth state synced; persistent identity comes from /users/me.
  useEffect(() => {
    if (currentUser && isAuthenticated) {
      const existingToken = getToken()
      saveAuth(currentUser, existingToken)
    }
  }, [currentUser, isAuthenticated])

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const handleAuthCleared = () => {
      setAuthBootError("")
      setIsAuthenticated(false)
      setCurrentUser(null)
      setAppDataReady(false)
      setRouteReady(false)
      setSpaces([])
      setFriends([])
      setEvents([])
      setActiveSpace(null)
      setActiveChannel(null)
      setActiveDMUser(null)
      setHomeActiveDMUser(null)
      setDrafts([])
      setActiveDraftId(null)
      setRestoreSplashEnabled(false)
      setRestoreSplashVisible(false)
      setShowLandingPage(true)
      setAuthMode("login")
    }
    window.addEventListener("spacexyz-auth-cleared", handleAuthCleared)
    return () => window.removeEventListener("spacexyz-auth-cleared", handleAuthCleared)
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      setDrafts([])
      return
    }

    const cachedDrafts = DraftsService.peekDrafts?.() || []
    if (cachedDrafts.length > 0) {
      setDrafts(cachedDrafts)
    }

    DraftsService.getDrafts()
      .then(items => setDrafts(Array.isArray(items) ? items : []))
      .catch(error => console.warn("Failed to load drafts", error))
  }, [isAuthenticated, currentUser?.id])

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
  const [callerCountdown, setCallerCountdown] = useState(30) // 30 second countdown for caller (only while waiting for answer)
  const [callParticipants, setCallParticipants] = useState([]) // Array of participants in the call
  const [pendingCallParticipants, setPendingCallParticipants] = useState([]) // Friends being called
  const [pinnedParticipant, setPinnedParticipant] = useState(null) // Pinned user in video call
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const pendingIceCandidatesRef = useRef([])
  const callSocketRef = useRef(null)
  const userSocketRef = useRef(null)
  const callTimerRef = useRef(null)
  const callerCountdownRef = useRef(null)
  const workspaceSearchHydratedChatsRef = useRef(new Set())
  const channelMemberHydrationKeyRef = useRef("")
  const currentUserRef = useRef(currentUser)
  const orgInfoRef = useRef(orgInfo)
  const orgFormRef = useRef(orgForm)

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
  const [attachmentPreview, setAttachmentPreview] = useState(null)
  const [attachmentPreviewMenuOpen, setAttachmentPreviewMenuOpen] = useState(false)

  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const prevScrollHeightRef = useRef(0)
  const messageScrollPositionsRef = useRef({})
  const messageScrollStateRef = useRef({})
  const pendingTabScrollRestoreRef = useRef(null)
  const chatSocketRef = useRef(null)
  const chatSocketKeyRef = useRef(null)
  const fileInputRef = useRef(null)
  const messageInputRef = useRef(null)
  const composerEditorRef = useRef(null)
  const composerLastValueRef = useRef("")
  const previousActiveChatIdRef = useRef(null)
  const previousChannelTabRef = useRef("messages")
  const restoreMessageScrollRef = useRef(false)
  const contextSaveTimeoutRef = useRef(null)
  const activeContextStateRef = useRef({ chatId: null, loaded: false })
  const initialRouteAppliedRef = useRef(false)
  const lastAppliedRoutePathRef = useRef(null)
  const collapsedSpaceMenuRef = useRef(null)
  const protectedFileUrlCacheRef = useRef(new Map())
  const protectedFileInflightRef = useRef(new Map())
  const missingAttachmentIdsRef = useRef(new Set())
  const messageActionButtonRefs = useRef({})
  const composerAttachButtonRef = useRef(null)

  const refreshComposerFormatState = useCallback(() => {
    const editor = composerEditorRef.current
    if (!editor || typeof window === "undefined" || typeof document === "undefined") return

    const selection = window.getSelection?.()
    const selectionInComposer = Boolean(
      selection?.rangeCount &&
      editor.contains(selection.anchorNode) &&
      editor.contains(selection.focusNode)
    )

    if (!selectionInComposer && document.activeElement !== editor) {
      setActiveComposerFormats(prev => (Object.keys(prev).length ? {} : prev))
      return
    }

    const queryState = command => {
      try {
        return document.queryCommandState(command)
      } catch {
        return false
      }
    }

    const anchorNode = selection?.anchorNode
    const anchorElement =
      anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement

    const hasAncestor = selector => {
      const match = anchorElement?.closest?.(selector)
      return Boolean(match && editor.contains(match))
    }

    const next = {
      bold: queryState("bold") || hasAncestor("b,strong"),
      italic: queryState("italic") || hasAncestor("i,em"),
      underline: queryState("underline") || hasAncestor("u"),
      strike: queryState("strikeThrough") || hasAncestor("s,strike,del"),
      link: hasAncestor("a"),
      "ordered-list": queryState("insertOrderedList") || hasAncestor("ol"),
      "bullet-list": queryState("insertUnorderedList") || hasAncestor("ul"),
      quote: hasAncestor("blockquote"),
      "inline-code": hasAncestor("code") && !hasAncestor("pre"),
      "code-block": hasAncestor("pre"),
    }

    setActiveComposerFormats(prev => {
      const keys = Object.keys(next)
      const changed = keys.some(key => Boolean(prev[key]) !== Boolean(next[key]))
      return changed ? next : prev
    })
  }, [])

  useEffect(() => {
    document.addEventListener("selectionchange", refreshComposerFormatState)
    return () => document.removeEventListener("selectionchange", refreshComposerFormatState)
  }, [refreshComposerFormatState])

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  useEffect(() => {
    orgInfoRef.current = orgInfo
  }, [orgInfo])

  useEffect(() => {
    orgFormRef.current = orgForm
  }, [orgForm])
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isAtBottomRef = useRef(true)
  const messageScrollRafRef = useRef(null)

  const setIsAtBottomFast = value => {
    const nextValue = Boolean(value)
    isAtBottomRef.current = nextValue
    setIsAtBottom(prev => (prev === nextValue ? prev : nextValue))
  }

  useEffect(() => {
    return () => {
      if (messageScrollRafRef.current) {
        cancelAnimationFrame(messageScrollRafRef.current)
        messageScrollRafRef.current = null
      }
      for (const objectUrl of protectedFileUrlCacheRef.current.values()) {
        URL.revokeObjectURL(objectUrl)
      }
      protectedFileUrlCacheRef.current.clear()
      protectedFileInflightRef.current.clear()
      missingAttachmentIdsRef.current.clear()
    }
  }, [])

  // --- Initialize Google API on mount ---
  useEffect(() => {
    GoogleService.initGoogleAuth()
    
    // Check if user already has Google access token
    const savedToken = GoogleService.getGoogleAccessToken()
    if (savedToken) {
      setGoogleAccessToken(savedToken)
    }
    loadCachedGoogleWorkspaceDocs()
    
    // Check if user already has Google Calendar token
    const savedCalendarToken = GoogleService.getGoogleCalendarToken()
    if (savedCalendarToken) {
      setGoogleCalendarToken(savedCalendarToken)
      loadGoogleCalendarEvents(savedCalendarToken)
    }
  }, [])

  const getBackendRelativeImageApiBase = src =>
    typeof src === "string" && /^\/(?:upload|files|api)\//.test(src) ? API_BASE : undefined

  // Helper: render avatar for a user object
  const renderAvatar = (user, size = 40, options = {}) => {
    if (!user) return null
    let url =
      user.avatar_url ||
      user.avatarUrl ||
      user.avatarImage ||
      user.avatar_image ||
      user.profileImage ||
      user.profile_image ||
      user.photoURL ||
      user.photoUrl ||
      user.picture
    const preset = user.avatar_preset
    const emojiAvatar =
      typeof user.avatar === "string" && user.avatar.trim().length > 0
        ? user.avatar
        : null
    const name = user.name || "?"
    const initial = (name && name[0]) ? name[0].toUpperCase() : "?"

    const sizeStyle = { width: size, height: size, lineHeight: `${size}px`, fontSize: Math.floor(size/2) }
    const colors = ["#ff9a9e","#fad0c4","#f6d365","#f093fb","#a1c4fd","#c2e9fb","#d4fc79","#96fbc4"]
    const idx = (String(user.id || user._id || name).length) % colors.length
    const grad = `linear-gradient(135deg, ${colors[idx]} 0%, ${colors[(idx+3)%colors.length]} 100%)`
    const initialsFallback = (
      <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ ...sizeStyle, background: grad }}>
        {initial}
      </div>
    )
    const imageLoading = options.loading || (size <= 36 ? "lazy" : "eager")
    const imageFetchPriority =
      options.fetchPriority || (imageLoading === "eager" ? "high" : undefined)
    const avatarCacheKey =
      user.avatar_version ||
      user.avatarVersion ||
      user.avatar_updated_at ||
      user.avatarUpdatedAt ||
      user.updated_at ||
      user.updatedAt ||
      ""
    const backendImageApiBase = getBackendRelativeImageApiBase(url)

    // Backend upload paths need the API origin; public preset paths should stay on the frontend.
    if (url && typeof url === 'string') {
      if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('blob:')) {
        return (
          <SmartImage
            src={url}
            alt={name}
            apiBase={API_BASE}
            cacheKey={avatarCacheKey}
            className="rounded-full object-cover"
            style={sizeStyle}
            fallback={initialsFallback}
            showFallbackWhileLoading
            loading={imageLoading}
            fetchPriority={imageFetchPriority}
          />
        )
      }
      if (url.startsWith('/')) {
        return (
          <SmartImage
            src={url}
            alt={name}
            apiBase={backendImageApiBase}
            cacheKey={avatarCacheKey}
            className="rounded-full object-cover"
            style={sizeStyle}
            fallback={initialsFallback}
            showFallbackWhileLoading
            loading={imageLoading}
            fetchPriority={imageFetchPriority}
          />
        )
      }
    }

    if (preset) {
      if (Array.isArray(preset) && preset.length >= 2) {
        const grad = `linear-gradient(135deg, ${preset[0]} 0%, ${preset[1]} 100%)`
        return (
          <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ ...sizeStyle, background: grad }}>
            {initial}
          </div>
        )
      }
      if (typeof preset === "string" && preset.startsWith("/")) {
        return (
          <SmartImage
            src={preset}
            alt={name}
            apiBase={getBackendRelativeImageApiBase(preset)}
            cacheKey={avatarCacheKey}
            className="rounded-full object-cover"
            style={sizeStyle}
            fallback={initialsFallback}
            showFallbackWhileLoading
            loading={imageLoading}
            fetchPriority={imageFetchPriority}
          />
        )
      }
    }
    // fallback: emoji avatar or letter avatar with generated gradient
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
    { id: "ellipse-2", url: "/Ellipse%202.png", label: "Ellipse 2" },
    { id: "ellipse-3", url: "/Ellipse%203.png", label: "Ellipse 3" },
    { id: "ellipse-4", url: "/Ellipse%204.png", label: "Ellipse 4" },
    { id: "ellipse-5", url: "/Ellipse%205.png", label: "Ellipse 5" },
    { id: "ellipse-6", url: "/Ellipse%206.png", label: "Ellipse 6" },
    { id: "ellipse-7", url: "/Ellipse%207.png", label: "Ellipse 7" },
    { id: "ellipse-8", url: "/Ellipse%208.png", label: "Ellipse 8" },
    { id: "ellipse-9", url: "/Ellipse%209.png", label: "Ellipse 9" }
  ]

  const waitForUploadedFile = async fileId => {
    if (!fileId) return

    const token = getToken()
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetch(`${API_BASE}/upload/file/${fileId}`, { credentials: "include", headers })
      if (response.ok) {
        const payload = await response.json().catch(() => null)
        if (!payload || payload.status === "done" || payload.status === undefined) return
      }
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }

  const uploadAvatarFile = async file => {
    if (!file) return null

    const form = new FormData()
    form.append("file", file)

    const token = getToken()
    const response = await fetch(`${API_BASE}/upload/file`, {
      method: "POST",
      credentials: "include",
      body: form,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.file_id) {
      throw new Error(payload?.detail || payload?.error || "Avatar upload failed")
    }

    await waitForUploadedFile(payload.file_id)
    return `/upload/file/${payload.file_id}/download`
  }

  const syncUserCollections = updatedUser => {
    if (!updatedUser) return
    const updatedId = getUserIdValue(updatedUser)
    if (!updatedId) return
    const normalizedUpdate = Object.fromEntries(
      Object.entries(updatedUser).filter(([, value]) => value !== undefined)
    )
    try {
      Storage.invalidateUsersCache?.()
    } catch (e) {}

    setCurrentUser(prev => {
      if (!prev || getUserIdValue(prev) !== updatedId) return prev
      const merged = { ...prev, ...normalizedUpdate }
      try {
        saveAuth(merged, getToken())
      } catch (e) {}
      return merged
    })

    setUsers(prev => {
      if (!Array.isArray(prev)) return [normalizedUpdate]
      const exists = prev.some(u => getUserIdValue(u) === updatedId)
      if (exists) {
        return prev.map(user =>
          getUserIdValue(user) === updatedId ? { ...user, ...normalizedUpdate } : user
        )
      }
      return [...prev, normalizedUpdate]
    })
    setFriends(prev => {
      if (!Array.isArray(prev)) return prev
      const exists = prev.some(f => getUserIdValue(f) === updatedId)
      if (exists) {
        return prev.map(friend =>
          getUserIdValue(friend) === updatedId ? { ...friend, ...normalizedUpdate } : friend
        )
      }
      // If this updated user is in the current user's friend list but missing from `friends` state, append it
      try {
        const myFriends = Array.isArray(currentUser?.friends) ? currentUser.friends.map(String) : []
        if (myFriends.includes(String(updatedId))) {
          return [...prev, normalizedUpdate]
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
            getUserIdValue(m) === updatedId ? { ...m, ...normalizedUpdate } : m
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
                getUserIdValue(m) === updatedId ? { ...m, ...normalizedUpdate } : m
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
            return { ...u, ...normalizedUpdate }
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
      setDebouncedInviteSearchQuery(inviteSearchQuery)
    }, 100)
    return () => clearTimeout(handler)
  }, [inviteSearchQuery])


  useEffect(() => {
    if (debouncedSearchQuery.trim()) return
    setSpaceSearchResults([])
    setDmSearchResults([])
    setFileSearchResults([])
    setHighlightTerm("")
    setPinnedMessageId(null)
    setTargetMessageId(null)
  }, [debouncedSearchQuery])

  // --- Initialization & Data Loading ---

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return

    const pollData = async () => {
      try {
        const isPageHidden = typeof document !== "undefined" && document.hidden
        const justAuthenticated = authResolvedAtRef.current && Date.now() - authResolvedAtRef.current < 12000
        const [bootstrap, storedEvents] = await Promise.all([
          Storage.getBootstrap({ forceRefresh: !justAuthenticated, cacheTtl: justAuthenticated ? 15000 : 5000 }).catch(() => null),
          isPageHidden ? Promise.resolve(events) : Storage.getEvents()
        ])
        const expectedSpaceIds = bootstrap?.user?.spaces || currentUser.spaces || []
        let availableSpaces = Array.isArray(bootstrap?.spaces) ? bootstrap.spaces : []
        if (availableSpaces.length === 0 && expectedSpaceIds.length > 0 && (activeSpace || !isPageHidden)) {
          availableSpaces = await Storage.getSpacesForUser(
            expectedSpaceIds,
            { forceRefresh: true, cacheTtl: 0 }
          ).catch(() => [])
        }
        const freshUser = bootstrap?.user || null

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

        if (activeSpace) {
          const freshActiveSpace = availableSpaces.find(s => s.id === activeSpace)
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
                      icon: s.icon,
                      expanded: s.expanded
                    }
                  }
                  return s
                })
              )
            }
          }
        }

        if (!isPageHidden) {
          const channelsToCheck = []
          for (const space of availableSpaces) {
            for (const ch of (space.channels || [])) {
              if (activeView === "channel" && activeChannel === ch.id) continue
              channelsToCheck.push(ch)
            }
          }

          const maxChannelsPerPoll = 5
          const channelsThisCycle = channelsToCheck.slice(0, maxChannelsPerPoll)
          const channelCounts = await Promise.all(
            channelsThisCycle.map(async ch => {
              try {
                const count = await Storage.getMessageCount(ch.id)
                return { channelId: ch.id, count }
              } catch (e) {
                return { channelId: ch.id, count: null }
              }
            })
          )

          for (const { channelId, count } of channelCounts) {
            if (!Number.isFinite(count)) continue
            const key = String(channelId)
            const nextReadCounts = { ...readMessageCountsRef.current }
            const readCount = Number(nextReadCounts[key])

            if (!Number.isFinite(readCount)) {
              nextReadCounts[key] = count
              readMessageCountsRef.current = nextReadCounts
              writeStoredMessageCounts(currentUser.id, nextReadCounts)
            } else if (count < readCount) {
              nextReadCounts[key] = count
              readMessageCountsRef.current = nextReadCounts
              writeStoredMessageCounts(currentUser.id, nextReadCounts)
            } else if (count > readCount) {
              setUnreadChannels(prev =>
                prev.some(id => String(id) === key)
                  ? prev
                  : [...prev, key]
              )
            }
          }
          if (channelCounts.length > 0) {
            setMessageCounts(prev => {
              const next = { ...prev }
              channelCounts.forEach(({ channelId, count }) => {
                if (Number.isFinite(count)) next[String(channelId)] = count
              })
              return next
            })
          }
        }

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

        const stored = storedEvents || []
        const dedupedGoogle = mappedGoogle.filter(g => !stored.some(s => String(s.id) === String(g.id)))
        const merged = [...stored, ...dedupedGoogle]

        if ((merged?.length || 0) !== events.length) {
          setEvents(merged)
        }

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
          if (myCall && (myCall.status === "rejected" || myCall.status === "ended")) {
            setActiveView("channel")
            setActiveCallId(null)
            setIncomingCall(null)
          }
        }
      } catch (e) {
        console.error("pollData failed", e)
      }
    }

    pollData()
    const interval = setInterval(pollData, 10000)
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
    activeChannel
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
      const inMemory = messages[activeChannel]
      if (Array.isArray(inMemory)) {
        markChannelRead(activeChannel, inMemory.length)
        return
      }
      // Update current count reference
      ;(async () => {
        try {
          const count = await Storage.getMessageCount(activeChannel, { forceRefresh: true })
          markChannelRead(activeChannel, count)
        } catch (e) {
          if (e && e.status === 403) {
            // restricted channel — skip silently
            markChannelRead(activeChannel, 0)
          }
          // Silently ignore other errors during initial load
        }
      })()
    }
  }, [activeChannel, activeView, currentUser, markChannelRead, messages])

  useEffect(() => {
    let userSocket = null
    let refreshTimeout = null
    let cancelled = false

    if (isAuthenticated && currentUser) {
      const cachedFriends = (() => {
        try {
          const friendIds = Array.isArray(currentUser.friends) ? currentUser.friends.map(id => String(id)) : []
          const usersById = new Map((Storage.peekUsers?.() || []).map(user => [String(user?.id), user]))
          return friendIds.map(id => usersById.get(id)).filter(Boolean)
        } catch {
          return []
        }
      })()
      if (cachedFriends.length > 0 && friends.length === 0) {
        setFriends(cachedFriends)
      }

      const cachedTasks = TasksService.peekTasksForUser?.() || []
      if (cachedTasks.length > 0 && tasksList.length === 0) {
        setTasksList(cachedTasks)
      }

      const hasPaintableWorkspace =
        spaces.length > 0 ||
        !Array.isArray(currentUser?.spaces) ||
        currentUser.spaces.length === 0
      if (!hasPaintableWorkspace) {
        setAppDataReady(false)
        setRouteReady(false)
      }
      const loadInitialData = async () => {
        const currentUserSpaceIds = Array.isArray(currentUser?.spaces) ? currentUser.spaces : []
        const bootstrapPromise = Storage.getBootstrap()
        const eagerSpacesPromise = currentUserSpaceIds.length > 0
          ? Storage.getSpacesForUser(currentUserSpaceIds)
          : Promise.resolve([])

        if (!appDataReady && currentUserSpaceIds.length > 0) {
          const quickSpaces = await eagerSpacesPromise.catch(() => [])
          if (!cancelled && Array.isArray(quickSpaces) && quickSpaces.length > 0) {
            setSpaces(enrichSpacesForUi(quickSpaces))
            setAppDataReady(true)
          }
        }

        const bootstrap = await bootstrapPromise
        const effectiveUser = filterDismissedUser(bootstrap?.user || currentUser)
        const bootstrapUsers = Array.isArray(bootstrap?.users) ? bootstrap.users : []
        const friendsPromise = Array.isArray(bootstrap?.friends) && bootstrap.friends.length > 0
          ? Promise.resolve(bootstrap.friends)
          : Storage.getFriends(effectiveUser.friends || [])
        const expectedSpaceIds = Array.isArray(effectiveUser.spaces) ? effectiveUser.spaces : []
        const expectedMatchesCurrent =
          expectedSpaceIds.length === currentUserSpaceIds.length &&
          expectedSpaceIds.every(id => currentUserSpaceIds.map(String).includes(String(id)))
        const spacesPromise = Array.isArray(bootstrap?.spaces) && (bootstrap.spaces.length > 0 || expectedSpaceIds.length === 0)
          ? Promise.resolve(bootstrap.spaces)
          : expectedMatchesCurrent
            ? eagerSpacesPromise
            : Storage.getSpacesForUser(expectedSpaceIds)

        setCurrentUser(prev => {
          if (!prev) return effectiveUser
          return String(prev.id) === String(effectiveUser?.id)
            && (prev.friends?.length || 0) === (effectiveUser?.friends?.length || 0)
            && (prev.notifications?.length || 0) === (effectiveUser?.notifications?.length || 0)
            && (prev.spaces?.length || 0) === (effectiveUser?.spaces?.length || 0)
            ? prev
            : effectiveUser
        })

        const friendsList = await friendsPromise
        const safeFriends = Array.isArray(friendsList) ? friendsList : []
        setFriends(safeFriends)
        setUsers(prev => {
          const merged = new Map()
          ;(Array.isArray(prev) ? prev : []).forEach(user => {
            if (user?.id === undefined || user?.id === null) return
            merged.set(String(user.id), user)
          })
          ;[effectiveUser, ...safeFriends, ...bootstrapUsers].forEach(user => {
            if (user?.id === undefined || user?.id === null) return
            merged.set(String(user.id), { ...(merged.get(String(user.id)) || {}), ...user })
          })
          return Array.from(merged.values())
        })

        // Load spaces separately so friends/DM UI paints first.
        const userSpaces = await spacesPromise
        
        const safeUserSpaces = Array.isArray(userSpaces) ? userSpaces : []
        if (expectedSpaceIds.length > 0 && safeUserSpaces.length === 0) {
          throw new Error("Workspace data was not available during boot")
        }
        const cachedFallbackSpaces = safeUserSpaces.length > 0 ? [] : Storage.peekSpacesForUser?.(expectedSpaceIds) || []
        const spacesForPaint = safeUserSpaces.length > 0 ? safeUserSpaces : cachedFallbackSpaces
        const enrichedSpaces = enrichSpacesForUi(spacesForPaint)

        if (spacesForPaint.length > 0 || expectedSpaceIds.length === 0) {
          setSpaces(enrichedSpaces)
        }
        setFriends(safeFriends)

        // Non-blocking: load secondary data after core UI is ready.
        Storage.getEvents()
          .then(evts => setEvents(evts || []))
          .catch(() => {})
        TasksService.getTasksForUser(getUserIdValue(currentUser))
          .then(t => setTasksList(Array.isArray(t) ? t : []))
          .catch(e => console.warn('Failed to load tasks', e))

        return enrichedSpaces
      }

      ;(async () => {
        try {
        const enrichedSpaces = await loadInitialData()
        if (cancelled) return

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
        setAppDataReady(true)
        
        // Refresh once shortly after first paint to pick up background-cached updates.
        refreshTimeout = setTimeout(async () => {
          const refreshedSpaces = await loadInitialData()
          if (cancelled) return
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
        }, 600)
        } catch (error) {
          if (cancelled) return
          console.error("Initial app data load failed", error)
          if (error?.status === 401) {
            authLogout()
          } else {
            setAuthBootError("We couldn't load your workspace. Check the connection and try again.")
          }
        }
      })()

      // Open a background user socket to receive notifications in real-time
      import("./services/ws")
        .then(({ connectUserSocket }) => {
          userSocket = connectUserSocket(async data => {
              const latestUser = currentUserRef.current
              const latestOrgInfo = orgInfoRef.current
              const latestOrgForm = orgFormRef.current
              if (!data || !data.type) return

              console.log('User socket received message:', data.type, data)

              if (data.type === "timesavers_updated") {
                applyStarredRealtimeUpdate(data)
                return
              }

              // When backend notifies that a domain was verified, try to auto-login the org admin
              if (data.type === 'org_verified') {
                try {
                  const domain = data.domain
                  if (!domain) return

                  // refresh org info
                  let oj = latestOrgInfo
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

                      const adminEmail = (latestOrgForm && latestOrgForm.adminEmail) || (oj && oj.adminEmail) || ''
                      let adminUser = null
                      if (adminEmail) adminUser = usersList.find(u => String(u.email).toLowerCase() === String(adminEmail).toLowerCase())
                      if (!adminUser) adminUser = usersList.find(u => u.role === 'org_admin' || u.role === 'admin')
                      if (!adminUser && usersList.length > 0) adminUser = usersList[0]

                      const promptEmail = (latestOrgForm && latestOrgForm.adminEmail) || (oj && oj.adminEmail) || ''
                      if (promptEmail) {
                        try { setSetPasswordEmail(promptEmail) } catch (e) {}
                        try { if (adminUser) setPendingAdminUserId(adminUser.id) } catch (e) {}
                        // Only show the Set Password modal to the registering admin (when they're the unauthenticated
                        // user who submitted the org form) or to a connected user whose email matches the org admin email.
                        try {
                          const loggedEmail = (latestUser && latestUser.email) ? String(latestUser.email).toLowerCase() : ''
                          const registeringEmail = (latestOrgForm && latestOrgForm.adminEmail) ? String(latestOrgForm.adminEmail).toLowerCase() : ''
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
                if (String(data.targetUserId) === String(latestUser?.id)) {
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
            if (data.type === 'task_deleted') {
              const deletedTaskId = String(data.taskId || data.id || "")
              if (deletedTaskId) {
                setTasksList(prev =>
                  (prev || []).filter(task => String(task?.id || task?.taskId || task?._id || task?.timestamp || "") !== deletedTaskId)
                )
                setMessages(prev =>
                  Object.fromEntries(
                    Object.entries(prev || {}).map(([chatId, list]) => [
                      chatId,
                      Array.isArray(list)
                        ? list.flatMap(message => {
                            const messageTaskId = String(message?.taskId || (message?.type === "task" ? message?.id : "") || "")
                            if (messageTaskId !== deletedTaskId) return [message]
                            if (message?.type === "task") return []
                            const rest = { ...message }
                            delete rest.taskId
                            delete rest.taskStatus
                            return [rest]
                          })
                        : list,
                    ])
                  )
                )
              }
            }

            // Handle global profile updates emitted by server
            if (data.type === 'profileUpdated' && data.userId) {
              const updatedUser = {
                id: data.userId,
                avatar_url: data.avatar_url,
                avatar_preset: data.avatar_preset,
                avatar_version: data.avatar_version,
                avatar_updated_at: data.avatar_updated_at
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

            if (data.type === "friends_updated") {
              refreshRelationshipState(latestUser?.id).catch(e => {
                console.error("Failed to refresh friend state", e)
              })
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
                  avatar_version: incoming.avatarData.avatar_version,
                  avatar_updated_at: incoming.avatarData.avatar_updated_at,
                  name: incoming.avatarData.name
                }
                syncUserCollections(updatedUser)
                // Also refresh users and friends list to ensure real-time avatar sync
                ;(async () => {
                  try {
                    const allUsers = await Storage.getUsers({ forceRefresh: true })
                    if (Array.isArray(allUsers)) setUsers(allUsers)
                    if (latestUser?.friends?.length > 0) {
                      const friendsList = await Storage.getFriends(latestUser.friends, { forceRefresh: true })
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

              if (isNotificationDismissed(latestUser?.id, incoming.id)) return

              setCurrentUser(prev => {
                if (!prev) return prev
                const already = (prev.notifications || []).some(n => n.id === incoming.id)
                if (already) return prev
                return { ...prev, notifications: [...(prev.notifications || []), incoming] }
              })

              if (incoming.id?.startsWith("fr-accept-") || incoming.type === "friend_request") {
                refreshRelationshipState(latestUser?.id).catch(e => {
                  console.error('Failed to refresh users after incoming friend notification', e)
                })
              } else {
                // Also refresh users list so friend lists / counts stay in sync
                ;(async () => {
                  try {
                    const allUsers = await Storage.getUsers({ forceRefresh: true })
                    setUsers(Array.isArray(allUsers) ? allUsers : [])
                  } catch (e) {
                    console.error('Failed to refresh users after incoming notification', e)
                  }
                })()
              }
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
    if (!isAuthenticated || !currentUser) {
      setAppDataReady(false)
      setRouteReady(false)
    }

    return () => {
      cancelled = true
      try {
        if (userSocket) {
          userSocket.close()
          if (userSocketRef.current === userSocket) userSocketRef.current = null
        }
      } catch (e) {}
      try {
        if (refreshTimeout) clearTimeout(refreshTimeout)
      } catch (e) {}
    }
  }, [isAuthenticated, currentUser?.id])

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

    const resolvedView = activeView === "contexts" ? contextsSourceView : activeView
    const chatId = getActiveChatId()
    
    if (!chatId) return
    
    // Don't try to load messages if spaces haven't been loaded yet
    if (resolvedView === "channel" && spaces.length === 0) return
    
    const cachedMessages = Storage.peekMessages(chatId)
    if (Array.isArray(cachedMessages) && cachedMessages.length > 0) {
      const cachedWithPendingReactions = applyPendingReactionOverrides(
        chatId,
        cachedMessages.map(msg => ({ ...msg, status: "sent", optimistic: false }))
      )
      setMessages(prev => {
        if (prev[chatId] === cachedMessages) return prev
        return {
          ...prev,
          [chatId]: cachedWithPendingReactions
        }
      })
    }

    const loadMessages = async (forceRefresh = false) => {
      try {
        const storedMessages = await Storage.getMessages(chatId, { forceRefresh, cacheTtl: 15000 })
        const normalized = Array.isArray(storedMessages)
          ? storedMessages.map(msg => ({ ...msg, status: "sent", optimistic: false }))
          : []
        const normalizedWithPendingReactions = applyPendingReactionOverrides(chatId, normalized)

        setMessages(prev => {
          const existing = prev[chatId] || []
          const serverIds = new Set(normalizedWithPendingReactions.map(m => m.id))
          const optimisticOnly = existing.filter(m => m.optimistic && !serverIds.has(m.id))
          return {
            ...prev,
            [chatId]: dedupeMessagesById([...normalizedWithPendingReactions, ...optimisticOnly])
          }
        })
        if (resolvedView === "channel") {
          markChannelRead(chatId, normalized.length)
        } else {
          setMessageCounts(prev => ({ ...prev, [chatId]: normalized.length }))
        }
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
    loadMessages(true)
    // Use a slower fallback refresh; real-time delivery is handled by WebSocket.
    const interval = setInterval(() => loadMessages(true), 15000)
    return () => clearInterval(interval)
  }, [isAuthenticated, activeChannel, activeView, activeDMUser, contextsSourceView, currentUser, spaces.length, markChannelRead, applyPendingReactionOverrides])


  // Chat websocket connection for real-time message delivery
  useEffect(() => {
    if (!isAuthenticated) {
      try {
        chatSocketRef.current?.close?.()
      } catch (e) {}
      chatSocketRef.current = null
      chatSocketKeyRef.current = null
      return
    }

    const chatId = getActiveChatId()

    if (!chatId) {
      try {
        chatSocketRef.current?.close?.()
      } catch (e) {}
      chatSocketRef.current = null
      chatSocketKeyRef.current = null
      return
    }
    const chatKey = String(chatId)

    const handleSocketMessage = data => {
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
            return { ...prev, [key]: dedupeMessagesById([...filtered, normalized]) }
          })
        } catch (e) { console.warn('failed to normalize task broadcast', e) }
        return
      }

      if (data.type === 'message_deleted' && data.messageId) {
        setMessages(prev => ({
          ...prev,
          [chatId]: (prev[chatId] || []).filter(
            message => String(message.id) !== String(data.messageId)
          )
        }))
        if (String(editingMessageId) === String(data.messageId)) {
          cancelEditingMessage()
        }
        if (String(pinnedMessageId) === String(data.messageId)) {
          setPinnedMessageId(null)
        }
        if (String(targetMessageId) === String(data.messageId)) {
          setTargetMessageId(null)
        }
        setSelectedMessageIds(prev =>
          prev.filter(messageId => String(messageId) !== String(data.messageId))
        )
        return
      }

      if (data.type === "timesavers_updated") {
        applyStarredRealtimeUpdate(data)
        return
      }

      if (!isRenderableChatMessagePayload(data)) {
        return
      }

      const normalized = applyPendingReactionOverrides(chatId, [{ ...data, status: "sent", optimistic: false }])[0]

      setMessages(prev => {
        const key = chatId
        const existing = prev[key] || []
        const filtered = normalized.id
          ? existing.filter(m => m.id !== normalized.id)
          : existing
        return { ...prev, [key]: dedupeMessagesById([...filtered, normalized]) }
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
    }

    if (chatSocketRef.current && chatSocketKeyRef.current === chatKey) {
      chatSocketRef.current._wrapper?.setOnMessage?.(handleSocketMessage)
      return
    }

    // Close the previous chat only when the actual chat target changes.
    try {
      chatSocketRef.current?.close?.()
    } catch (e) {}

    const ws = connectChatSocket(chatId, handleSocketMessage)

    chatSocketRef.current = ws
    chatSocketKeyRef.current = chatKey
    ws.onopen = () => console.log("Chat socket connected", chatId)
    ws.onclose = () => console.log("Chat socket closed", chatId)
    ws.onerror = e => console.error("Chat socket error", e)

    return () => {
      // React can re-run this effect for handler freshness. Keep the socket
      // alive unless a later render has already moved to another chat.
      if (chatSocketKeyRef.current !== chatKey) {
        try {
          ws.close()
        } catch (e) {}
      }
    }
  }, [isAuthenticated, activeView, activeChannel, activeDMUser, contextsSourceView, currentUser?.id])

  // --- Scroll to Message Logic ---
  useEffect(() => {
    // 1) If a specific message is targeted (search -> result), center it
    if (targetMessageId) {
      // Small timeout to allow render
      const timer = setTimeout(() => {
        const element = document.getElementById(`msg-${targetMessageId}`)
        if (element) {
          element.scrollIntoView({ behavior: "auto", block: "center" })
          setTargetMessageId(null)
        }
      }, 500)
      return () => clearTimeout(timer)
    }

    // 2) If the user is reviewing a pinned search result, DO NOT auto-scroll away
    if (pinnedMessageId) {
      return
    }

    // 3) When restoring from another section or thread, don't auto-jump.
    if (restoreMessageScrollRef.current || pendingTabScrollRestoreRef.current) {
      return
    }

    // 4) If user is at bottom, move to latest immediately when messages change.
    // If user is NOT at bottom, preserve their scroll position instead of forcing them to the latest message.
    const el = messagesContainerRef.current
    if (!el) return

    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
      setIsAtBottomFast(true)
      // record current height so future incoming messages can preserve scroll position
      try { prevScrollHeightRef.current = el.scrollHeight } catch (e) {}
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
      const existingFriendIds = new Set([
        ...(Array.isArray(currentUser?.friends) ? currentUser.friends : []),
        ...(Array.isArray(friends) ? friends.map(friend => friend.id).filter(Boolean) : [])
      ])

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
                  !existingFriendIds.has(u.id)
              )
            : []
          // show a limited set immediately to avoid UI jank
          setInviteSearchResults(localMatches.slice(0, 50))

          // For longer queries, fetch server-side results to improve coverage
          if (q.length >= 3) {
            const remote = await Storage.searchUsersByName(debouncedInviteSearchQuery)
            const safeUsers = Array.isArray(remote) ? remote : []
            const results = safeUsers.filter(
              u => u.id !== currentUser?.id && !existingFriendIds.has(u.id)
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

  const getSpaceIconElement = React.useCallback(iconType => {
    return createSpaceIconElement(iconType)
  }, [])

  const enrichSpacesForUi = React.useCallback(
    list =>
      (Array.isArray(list) ? list : []).map(space => ({
        ...space,
        icon: getSpaceIconElement(space.iconType),
        expanded:
          activeView === "channel" &&
          Boolean(activeChannel) &&
          String(space.id) === String(activeSpace),
      })),
    [activeChannel, activeSpace, activeView, getSpaceIconElement]
  )

  useEffect(() => {
    if (!isAuthenticated || !routeReady || !appDataReady || activeView !== "channel" || !activeSpace || !activeChannel) return

    setSpaces(prev => {
      if (!Array.isArray(prev) || prev.length === 0) return prev
      let changed = false
      const next = prev.map(space => {
        if (String(space.id) !== String(activeSpace) || space.expanded) return space
        changed = true
        return { ...space, expanded: true }
      })
      return changed ? next : prev
    })
  }, [activeChannel, activeSpace, activeView, appDataReady, isAuthenticated, routeReady, spaces.length])

  const getFirstReadableChannel = React.useCallback((space, user) => {
    if (!space || !user) return null
    const userId = user.id
    const channels = Array.isArray(space.channels) ? space.channels : []
    return (
      channels.find(channel => {
        const channelMembers = Array.isArray(channel?.members) ? channel.members : []
        if (channelMembers.length > 0) {
          return channelMembers.some(memberId => String(memberId) === String(userId)) || String(space.ownerId) === String(userId)
        }
        const spaceMembers = Array.isArray(space.members) ? space.members : []
        return String(space.ownerId) === String(userId) || spaceMembers.some(memberId => String(memberId) === String(userId))
      }) ||
      channels[0] ||
      null
    )
  }, [])

  const hydrateCachedSpacesForUser = React.useCallback((user, options = {}) => {
    if (!user) return []
    let cachedSpaces = []
    try {
      cachedSpaces = Storage.peekSpacesForUser?.(user.spaces || []) || []
    } catch (error) {
      console.warn("Failed to read cached spaces", error)
      cachedSpaces = []
    }

    if (!cachedSpaces.length) return []

    const enriched = enrichSpacesForUi(cachedSpaces)
    setSpaces(enriched)

    if (options.selectFirst !== false) {
      const hasCurrentSpace = activeSpace && enriched.some(space => String(space.id) === String(activeSpace))
      if (!hasCurrentSpace) {
        const firstSpace = enriched[0]
        const firstChannel = getFirstReadableChannel(firstSpace, user)
        setActiveSpace(firstSpace.id)
        setActiveChannel(firstChannel?.id || "")
      }
    }

    return enriched
  }, [activeSpace, enrichSpacesForUi, getFirstReadableChannel])

  const buildDefaultSpace = React.useCallback(userId => ({
    id: userId + 1,
    name: "Space 1",
    iconType: "briefcase",
    members: [userId],
    inviteCode: `SPACE1-${Math.floor(1000 + Math.random() * 9000)}`,
    channels: [
      {
        id: userId + 2,
        name: "general",
        type: "public",
        members: [userId],
      },
      {
        id: userId + 3,
        name: "random",
        type: "public",
        members: [userId],
      },
    ],
    expanded: true,
    ownerId: userId,
  }), [])

  const lookupUserByEmailCached = React.useCallback(async email => {
    const normalizedEmail = String(email || "").trim().toLowerCase()
    if (!normalizedEmail) return null

    if (authLookupCacheRef.current.has(normalizedEmail)) {
      return await authLookupCacheRef.current.get(normalizedEmail)
    }

    const request = Storage.findUserByEmail(normalizedEmail).catch(() => null)
    authLookupCacheRef.current.set(normalizedEmail, request)
    const result = await request
    authLookupCacheRef.current.set(normalizedEmail, result)
    return result
  }, [])

  const applyAuthenticatedSession = React.useCallback((user, token, options = {}) => {
    if (!user) return

    const safeUser = filterDismissedUser(user)
    const seededSpaces = options.seedSpaces ? enrichSpacesForUi(options.seedSpaces) : null

    authResolvedAtRef.current = Date.now()
    saveAuth(safeUser, token)

    startTransition(() => {
      setCurrentUser(safeUser)
      setIsAuthenticated(true)
      setAppDataReady(false)
      setRouteReady(false)
      setAuthInitializing(false)
      setAuthBootError("")
      setShowLandingPage(false)
      setActiveView("home")
      setHomeSection("overview")
      if (seededSpaces) {
        setSpaces(seededSpaces)
        if (seededSpaces.length > 0 || !Array.isArray(safeUser.spaces) || safeUser.spaces.length === 0) {
          setAppDataReady(true)
        }
      } else {
        const hydratedSpaces = hydrateCachedSpacesForUser(safeUser)
        if (hydratedSpaces.length > 0 || !Array.isArray(safeUser.spaces) || safeUser.spaces.length === 0) {
          setAppDataReady(true)
        }
      }
      if (options.activeSpaceId !== undefined) setActiveSpace(options.activeSpaceId)
      if (options.activeChannelId !== undefined) setActiveChannel(options.activeChannelId)
      setAuthSuccess(options.successMessage || "")
    })

    setUsers(prev => {
      const next = new Map((Array.isArray(prev) ? prev : []).map(item => [String(item.id), item]))
      next.set(String(safeUser.id), { ...(next.get(String(safeUser.id)) || {}), ...safeUser })
      return Array.from(next.values())
    })

    if (options.cacheLookupEmail) {
      authLookupCacheRef.current.set(String(options.cacheLookupEmail).trim().toLowerCase(), safeUser)
    }
  }, [enrichSpacesForUi, hydrateCachedSpacesForUser])

  // --- Auth & Logout ---
  const handleAuthSubmit = async e => {
    e.preventDefault()
    if (authPending) return
    setAuthError("")
    setAuthSuccess("")
    setAuthBootError("")
    setAppDataReady(false)
    setRouteReady(false)
    setRestoreSplashEnabled(false)
    setRestoreSplashVisible(false)
    setAuthPending(true)

    try {
      if (authMode === "signup") {
      if (!authData.name || !authData.email || !authData.password) {
        setAuthError("Please fill in all fields")
        setAuthPending(false)
        return
      }
      if (authData.password !== authData.confirmPassword) {
        setAuthError("Passwords do not match")
        setAuthPending(false)
        return
      }
      const existingUser = await lookupUserByEmailCached(authData.email)
      if (existingUser) {
        setAuthError("Email already registered")
        setAuthPending(false)
        return
      }

      const newUserId = Date.now()
      const defaultSpace = buildDefaultSpace(newUserId)
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
      const signupData = await Storage.saveUser(newUser)
      const savedUser = {
        ...(signupData?.user || newUser),
        spaces:
          (Array.isArray(signupData?.user?.spaces) && signupData.user.spaces.length > 0)
            ? signupData.user.spaces
            : newUser.spaces,
      }
      const savedToken = signupData?.token || getToken() || null

      applyAuthenticatedSession(savedUser, savedToken, {
        activeSpaceId: defaultSpace.id,
        activeChannelId: defaultSpace.channels[0]?.id || null,
        seedSpaces: [defaultSpace],
        successMessage: "Account created successfully!",
        cacheLookupEmail: authData.email,
      })
      setAuthPending(false)
    } else {
      if (!authData.email || !authData.password) {
        setAuthError("Please fill in all fields")
        setAuthPending(false)
        return
      }
      setRestoreSplashEnabled(true)
      setRestoreSplashVisible(true)
      restoreSplashStartedAtRef.current = Date.now()
      try {
        const data = await Storage.login({ email: authData.email, password: authData.password })
        if (data?.user && data?.token) {
          applyAuthenticatedSession(data.user, data.token, {
            successMessage: "Logged in successfully!",
            cacheLookupEmail: authData.email,
          })
        } else {
          setAuthError(data?.error || "Invalid credentials")
        }
      } catch (e) {
        console.error("Login failed", e)
        setAuthInitializing(false)
        setAuthError("Invalid credentials")
      }
      setAuthPending(false)
    }
    } catch (e) {
      console.error("Authentication failed", e)
      setAuthInitializing(false)
      setAuthError(authMode === "login" ? "Invalid credentials" : "Unable to complete signup right now.")
      setAuthPending(false)
    }
  }

  const handleLogout = () => {
    // Clear backend HttpOnly session cookie and local in-memory auth.
    void Storage.logoutSession()
    authLogout()

    setIsAuthenticated(false)
    setCurrentUser(null)
    setAppDataReady(false)
    setRouteReady(false)
    setSpaces([])
    setFriends([])
    setEvents([])
    setActiveSpace(null)
    setActiveView("home")
    setHomeSection("overview")
    setHomeActiveDMUser(null)
    setHomeDMInput("")
    setDrafts([])
    setActiveDraftId(null)
    setAuthData({ email: "", password: "", confirmPassword: "", name: "" })
    setAuthError("")
    setAuthSuccess("")
    setAuthBootError("")
    setAuthPending(false)
    setGoogleAuthPending(false)
    setSearchQuery("")
    setShowMobileDrawer(false)
    
    // Clear Google data
    GoogleService.removeGoogleAccessToken()
    setGoogleAccessToken(null)
    setGoogleDocs([])
    setGmailAttachments([])
  }

  // --- Google OAuth Handlers ---
  const handleGoogleLogin = () => {
    if (googleAuthInFlightRef.current || authPending || googleAuthPending) return

    googleAuthInFlightRef.current = true
    setGoogleAuthPending(true)
    setAuthPending(true)
    setRestoreSplashEnabled(true)
    setRestoreSplashVisible(true)
    restoreSplashStartedAtRef.current = Date.now()
    setAuthError("")
    setAuthSuccess("")

    // Ensure org modal is closed if present before starting Google flow
    try { setShowOrgModal(false); setOrgStage('form') } catch (e) {}
    GoogleService.handleGoogleSignIn(
      async (userInfo, credential) => {
        try {
          const normalizedEmail = String(userInfo?.email || "").trim().toLowerCase()
          if (!normalizedEmail) {
            setAuthError("Google account did not return an email address.")
            return
          }

          const authResult = await Storage.loginWithGoogle(credential)
          if (!authResult?.user) {
            throw new Error(authResult?.error || "Google authentication failed")
          }

          let defaultSpace = null
          const savedUser = {
            ...authResult.user,
            spaces:
              (Array.isArray(authResult.user?.spaces) && authResult.user.spaces.length > 0)
                ? authResult.user.spaces
                : [],
          }
          const savedToken = authResult.token || getToken() || null
          const existingSpaceIds = Array.isArray(savedUser.spaces) ? savedUser.spaces : []
          if (authResult.isNew || existingSpaceIds.length === 0) {
            defaultSpace = buildDefaultSpace(savedUser.id)
            await Storage.saveSpace(defaultSpace)
            savedUser.spaces = [defaultSpace.id]
          }

          applyAuthenticatedSession(savedUser, savedToken, {
            activeSpaceId: defaultSpace?.id,
            activeChannelId: defaultSpace?.channels?.[0]?.id || null,
            seedSpaces: defaultSpace ? [defaultSpace] : null,
            successMessage: authResult.isNew ? "Account created with Google successfully!" : "Logged in with Google successfully!",
            cacheLookupEmail: normalizedEmail,
          })

          if (credential) {
            GoogleService.setGoogleAccessToken(credential)
            setGoogleAccessToken(credential)
          }
          try { setShowOrgModal(false); setOrgStage('form') } catch (e) {}
          return

          const existingUser = await lookupUserByEmailCached(normalizedEmail)

          if (existingUser) {
            const token = getToken() || null
            applyAuthenticatedSession(existingUser, token, {
              successMessage: "Logged in with Google successfully!",
              cacheLookupEmail: normalizedEmail,
            })
          } else {
          // Create new user from Google data
          const newUserId = Date.now()
          
          // Create default space
          const defaultSpace = buildDefaultSpace(newUserId)
          await Storage.saveSpace(defaultSpace)
          
          // Create new user
          const newUser = {
            id: newUserId,
            name: userInfo.name || normalizedEmail.split('@')[0],
            email: normalizedEmail,
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
                email: normalizedEmail
              }
            }
          }
          const signupData = await Storage.saveUser(newUser)
          const savedUser = signupData?.user || newUser
          const savedToken = signupData?.token || getToken() || null

          applyAuthenticatedSession(savedUser, savedToken, {
            activeSpaceId: defaultSpace.id,
            activeChannelId: defaultSpace.channels[0]?.id || null,
            seedSpaces: [defaultSpace],
            successMessage: "Account created with Google successfully!",
            cacheLookupEmail: normalizedEmail,
          })

          if (credential) {
            GoogleService.setGoogleAccessToken(credential)
            setGoogleAccessToken(credential)
          }
          // Make sure org modal remains closed after Google signup
          try { setShowOrgModal(false); setOrgStage('form') } catch (e) {}
          }
        } catch (error) {
          console.error('Google Sign-In Error:', error)
          setAuthInitializing(false)
          setAuthError("Google sign-in temporarily unavailable. Please use email/password login.")
        } finally {
          googleAuthInFlightRef.current = false
          setGoogleAuthPending(false)
          setAuthPending(false)
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
        googleAuthInFlightRef.current = false
        setGoogleAuthPending(false)
        setAuthPending(false)
      }
    )
  }

  function loadCachedGoogleWorkspaceDocs() {
    try {
      const cachedDrive = JSON.parse(localStorage.getItem('google_drive_cache') || 'null')
      if (cachedDrive && Array.isArray(cachedDrive.files)) {
        setGoogleDocs(cachedDrive.files)
      }
      const cachedGmail = JSON.parse(localStorage.getItem('google_gmail_cache') || 'null')
      if (cachedGmail && Array.isArray(cachedGmail.attachments)) {
        setGmailAttachments(GoogleService.dedupeGmailAttachmentsByFilename(cachedGmail.attachments))
        if (cachedGmail.time) setGmailLastCheckTime(cachedGmail.time)
      }
    } catch (e) {
      // Cached Google Workspace data is optional.
    }
  }

  const handleConnectGoogleDocs = () => {
    GoogleService.requestGoogleDocsAccess(
      (accessToken) => {
        setGoogleAccessToken(accessToken)
        GoogleService.setGoogleAccessToken(accessToken)
        setConnectedApps(['drive', 'docs', 'sheets', 'slides', 'gmail'])
        // Load cached docs quickly for immediate UI responsiveness
        loadCachedGoogleWorkspaceDocs()
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
    loadGoogleDocs(googleAccessToken)
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
      setLoadingDocs(false)
      
      // Fetch Gmail attachments (fetch all when no specific app or when gmail is requested)
      if (!specificApp || specificApp === 'gmail' || specificApp === 'all') {
        GoogleService.fetchGmailAttachments(token)
          .then(gmailFiles => {
            const dedupedGmailFiles = GoogleService.dedupeGmailAttachmentsByFilename(gmailFiles)
            setGmailAttachments(prev => (dedupedGmailFiles.length > 0 || prev.length === 0 ? dedupedGmailFiles : GoogleService.dedupeGmailAttachmentsByFilename(prev)))
            setGmailLastCheckTime(Date.now()) // Track last fetch time for real-time sync
          })
          .catch(gmailError => {
            console.warn('Gmail fetch error:', gmailError)
            // Keep any cached Gmail files visible if a background refresh fails.
          })
      }
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

  const openDocumentsPage = () => {
    setActiveDraftId(null)
    setCollapsedSpaceMenu(null)
    setShowMobileDrawer(false)
    setShowDocsModal(false)
    setShowGoogleAppsMenu(false)
    setOpenContextId(null)
    setActiveView("documents")
    setSharedChatDocs(extractSharedChatDocs(messages))
    loadCachedGoogleWorkspaceDocs()
    if (googleAccessToken) {
      loadGoogleDocs(googleAccessToken)
    }
    pushAppRoute("/documents")
    if (isMobile) setMobileView("chat")
  }

  const closeDocumentsPage = () => {
    setOpenContextId(null)
    setActiveView("home")
    setHomeSection("overview")
    pushAppRoute("/")
  }

  // Keep shared chat docs up-to-date while the document surface is open
  useEffect(() => {
    if (!showDocsModal && activeView !== "documents") return
    setSharedChatDocs(extractSharedChatDocs(messages))
  }, [activeView, showDocsModal, messages])

  // Real-time Gmail sync - periodically check for new attachments
  useEffect(() => {
    if (!googleAccessToken || (!showDocsModal && activeView !== "documents")) return
    
    const checkNewGmail = async () => {
      try {
        const result = await GoogleService.checkNewGmailAttachments(googleAccessToken, gmailLastCheckTime)
        if (result.hasNew && result.attachments.length > 0) {
          // Merge new attachments with existing ones, avoiding duplicates
          setGmailAttachments(prev => {
            const existingNames = new Set(GoogleService.dedupeGmailAttachmentsByFilename(prev).map(a => a.normalizedFileName || GoogleService.normalizeGmailFilename(a.filename || a.name)))
            const newOnes = GoogleService.dedupeGmailAttachmentsByFilename(result.attachments).filter(a => !existingNames.has(a.normalizedFileName || GoogleService.normalizeGmailFilename(a.filename || a.name)))
            if (newOnes.length > 0) {
              // Show toast for new attachments
              setSuccessMessage(`${newOnes.length} new Gmail attachment${newOnes.length > 1 ? 's' : ''} found`)
              setShowSuccessToast(true)
              setTimeout(() => setShowSuccessToast(false), 3000)
              return GoogleService.dedupeGmailAttachmentsByFilename([...newOnes, ...prev])
            }
            return GoogleService.dedupeGmailAttachmentsByFilename(prev)
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
  }, [activeView, googleAccessToken, showDocsModal, gmailLastCheckTime])

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

  const addChannelFileAsAttachment = file => {
    if (!file) return

    const identity = String(file.fileId || file.id || file.url || file.name || "")
    const alreadyAdded = selectedFiles.some(existing => {
      const existingIdentity = String(existing.fileId || existing.id || existing.url || existing.name || "")
      return existingIdentity && existingIdentity === identity
    })

    if (alreadyAdded) {
      setSuccessMessage(`"${file.name}" is already attached`)
      setShowSuccessToast(true)
      setTimeout(() => setShowSuccessToast(false), 3000)
      return
    }

    const newAttachment = {
      id: file.id || Date.now() + Math.random(),
      fileId: file.fileId || null,
      name: file.name || "Attachment",
      size: file.size || 0,
      type: file.mimeType || file.type || "",
      mimeType: file.mimeType || file.type || "",
      url: file.url || file.public_url || file.webViewLink || null,
      source: file.sourceLabel || file.source || "chat",
      public_url: file.public_url || null,
      webViewLink: file.webViewLink || null,
      previewUrl: file.previewUrl || null,
      drive_file_id: file.drive_file_id || null,
      gmailMessageId: file.gmailMessageId || null,
      gmailAttachmentId: file.gmailAttachmentId || null,
    }

    setSelectedFiles(prev => [...prev, newAttachment])
    setSuccessMessage(`"${newAttachment.name}" added to message`)
    setShowSuccessToast(true)
    setTimeout(() => setShowSuccessToast(false), 3000)
  }

  const sortedGoogleDocs = useMemo(() => {
    return [...googleDocs].sort((a, b) => {
      const timeA = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0
      const timeB = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0
      return timeB - timeA
    })
  }, [googleDocs])

  const dedupedGmailAttachments = useMemo(
    () => GoogleService.dedupeGmailAttachmentsByFilename(gmailAttachments),
    [gmailAttachments]
  )

  const docsOverview = useMemo(() => {
    const docsCount = googleDocs.filter(doc => GoogleService.getAppTypeFromMime(doc.mimeType) === 'docs').length
    const sheetsCount = googleDocs.filter(doc => GoogleService.getAppTypeFromMime(doc.mimeType) === 'sheets').length
    const slidesCount = googleDocs.filter(doc => GoogleService.getAppTypeFromMime(doc.mimeType) === 'slides').length

    return {
      total: googleDocs.length + dedupedGmailAttachments.length + sharedChatDocs.length,
      drive: googleDocs.length,
      docs: docsCount,
      sheets: sheetsCount,
      slides: slidesCount,
      gmail: dedupedGmailAttachments.length,
      shared: sharedChatDocs.length,
    }
  }, [googleDocs, dedupedGmailAttachments, sharedChatDocs])

  const formatDocsDate = value => {
    if (!value) return "No recent activity"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return String(value)

    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: parsed.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    })
  }

  const formatDocsSize = value => {
    const size = Number(value)
    if (!Number.isFinite(size) || size <= 0) return "Unknown size"
    if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
    if (size >= 1024) return `${Math.round(size / 1024)} KB`
    return `${size} B`
  }

  const docsCollectionSummary = useMemo(() => {
    const summaryMap = {
      all: {
        label: "Workspace library",
        detail: "A clean browser for Drive files, shared chat docs, and Gmail attachments in one place.",
        count: docsOverview.total,
      },
      drive: {
        label: "Drive files",
        detail: "Browse the latest synced documents from Google Drive and the wider workspace stack.",
        count: docsOverview.drive,
      },
      docs: {
        label: "Google Docs",
        detail: "Writing surfaces, specs, and long-form documents from your connected Google account.",
        count: docsOverview.docs,
      },
      sheets: {
        label: "Google Sheets",
        detail: "Trackers, tables, and structured files ready to reuse in conversations.",
        count: docsOverview.sheets,
      },
      slides: {
        label: "Google Slides",
        detail: "Presentation decks and review material connected to the workspace.",
        count: docsOverview.slides,
      },
      shared: {
        label: "Shared in chats",
        detail: "Files already circulating through channels and direct messages.",
        count: docsOverview.shared,
      },
      gmail: {
        label: "Gmail attachments",
        detail: "Recent email files that can move straight into your workspace threads.",
        count: docsOverview.gmail,
      },
    }

    return summaryMap[selectedAppFilter] || summaryMap.all
  }, [docsOverview, selectedAppFilter])

  const handleDocumentsReconnect = () => {
    setGoogleAccessToken(null)
    GoogleService.removeGoogleAccessToken()
    setDocsError(null)
    handleConnectGoogleDocs()
  }

  const handleDocumentsRefresh = () => {
    setSharedChatDocs(extractSharedChatDocs(messages))
    if (!googleAccessToken) {
      loadCachedGoogleWorkspaceDocs()
      return
    }
    loadGoogleDocs(googleAccessToken)
  }

  const handleDocumentsFilterSelect = filter => {
    setSelectedAppFilter(filter)
    if (!googleAccessToken) {
      loadCachedGoogleWorkspaceDocs()
      return
    }
    loadGoogleDocs(googleAccessToken)
  }

  const handleHubAddDocument = async doc => {
    if (!doc) return

    const fileName = doc.name || doc.filename || "Attachment"
    const gmailMessageId = doc.gmailMessageId || doc.messageId || null
    const gmailAttachmentId = doc.gmailAttachmentId || doc.id || null

    if (doc.source === "gmail" && googleAccessToken && gmailMessageId && gmailAttachmentId) {
      try {
        const bytes = await GoogleService.downloadGmailAttachmentWithFallback(
          googleAccessToken,
          gmailMessageId,
          gmailAttachmentId,
          fileName
        )

        if (bytes) {
          const blob = new Blob([bytes], { type: doc.mimeType })
          const formData = new FormData()
          formData.append("file", blob, fileName)

          const response = await fetch(`${API_BASE}/upload/file`, {
            method: "POST",
            body: formData,
          })

          if (response.ok) {
            const payload = await response.json()
            addDocumentAsAttachment({
              id: payload.file_id || `${Date.now()}`,
              name: fileName,
              mimeType: doc.mimeType,
              size: doc.size,
              source: "upload",
              fileId: payload.file_id,
              url: payload.file_id ? `${API_BASE}/upload/file/${payload.file_id}/download` : null,
              public_url: payload.file_id ? `${API_BASE}/upload/file/${payload.file_id}/download` : null,
            })
            return
          }
        }
      } catch (error) {
        console.error("Failed to upload Gmail attachment to server:", error)
      }
    }

    addDocumentAsAttachment({
      ...doc,
      name: fileName,
      gmailMessageId,
      gmailAttachmentId,
    })
  }

  const handleMarkTaskComplete = async task => {
    if (!task) return

    const taskId = String(task.id || task.taskId || task._id || task.timestamp || "")
    if (!taskId || task.status === "completed" || completingTaskId === taskId) return
    const currentUserId = String(getUserIdValue(currentUser) || "")
    const assignedIds = (task.assigned_to || task.assigneeIds || []).map(String)
    if (assignedIds.length > 0 && !assignedIds.includes(currentUserId)) return
    if (assignedIds.length === 0 && String(task.created_by || task.createdBy || "") !== currentUserId) return

    const completeTaskForUser = item => {
      const itemAssignedIds = (item.assigned_to || item.assigneeIds || []).map(String)
      const assigneeStatuses = { ...(item.assignee_statuses || item.assigneeStatuses || {}) }
      if (itemAssignedIds.length > 0) {
        assigneeStatuses[currentUserId] = {
          ...(assigneeStatuses[currentUserId] || {}),
          status: "completed",
          completedAt: new Date().toISOString(),
        }
      }
      const allComplete = itemAssignedIds.length === 0
        ? true
        : itemAssignedIds.every(id => (assigneeStatuses[id] || {}).status === "completed")
      return {
        ...item,
        assignee_statuses: assigneeStatuses,
        status: allComplete ? "completed" : "pending",
      }
    }

    let didUpdateLocalTask = false
    setCompletingTaskId(taskId)
    setTasksList(prev =>
      (prev || []).map(item => {
        const itemId = String(item?.id || item?.taskId || item?._id || item?.timestamp || "")
        if (itemId !== taskId) return item
        didUpdateLocalTask = true
        return completeTaskForUser(item)
      })
    )
    setMessages(prev =>
      Object.fromEntries(
        Object.entries(prev || {}).map(([chatId, list]) => [
          chatId,
          Array.isArray(list)
            ? list.map(message => {
                const messageTaskId = String(message?.taskId || (message?.type === "task" ? message?.id : "") || "")
                if (messageTaskId !== taskId) return message
                const updated = completeTaskForUser(message)
                return { ...updated, taskStatus: updated.status }
              })
            : list,
        ])
      )
    )

    try {
      await TasksService.updateTask(task.id || task.taskId || task._id || task.timestamp, { status: "completed" })
    } catch (error) {
      console.warn("task update failed", error)
      if (didUpdateLocalTask) {
        setTasksList(prev =>
          (prev || []).map(item => {
            const itemId = String(item?.id || item?.taskId || item?._id || item?.timestamp || "")
            return itemId === taskId
              ? {
                  ...item,
                  status: task.status || "pending",
                  assignee_statuses: task.assignee_statuses || task.assigneeStatuses || {},
                }
              : item
          })
        )
      }
      setMessages(prev =>
        Object.fromEntries(
          Object.entries(prev || {}).map(([chatId, list]) => [
            chatId,
            Array.isArray(list)
              ? list.map(message => {
                  const messageTaskId = String(message?.taskId || (message?.type === "task" ? message?.id : "") || "")
                  return messageTaskId === taskId
                    ? {
                        ...message,
                        status: task.status || "pending",
                        taskStatus: task.status || "pending",
                        assignee_statuses: task.assignee_statuses || task.assigneeStatuses || {},
                      }
                    : message
                })
              : list,
          ])
        )
      )
    } finally {
      setCompletingTaskId(null)
    }
  }

  const handleDeleteCompletedTasks = async completedTasks => {
    const ids = Array.from(
      new Set(
        (Array.isArray(completedTasks) ? completedTasks : [])
          .map(task => String(task?.id || task?.taskId || task?._id || task?.timestamp || ""))
          .filter(Boolean)
      )
    )
    if (ids.length === 0) return

    const idSet = new Set(ids)
    setTasksList(prev =>
      (prev || []).filter(task => !idSet.has(String(task?.id || task?.taskId || task?._id || task?.timestamp || "")))
    )
    setMessages(prev =>
      Object.fromEntries(
        Object.entries(prev || {}).map(([chatId, list]) => [
          chatId,
          Array.isArray(list)
            ? list.flatMap(message => {
                const messageTaskId = String(message?.taskId || (message?.type === "task" ? message?.id : "") || "")
                if (!idSet.has(messageTaskId)) return [message]
                if (message?.type === "task") return []
                const rest = { ...message }
                delete rest.taskId
                delete rest.taskStatus
                return [rest]
              })
            : list,
        ])
      )
    )

    const results = await Promise.allSettled(ids.map(taskId => TasksService.deleteTask(taskId)))
    const failed = results.filter(result => result.status === "rejected")
    if (failed.length > 0) {
      console.warn("failed to delete completed tasks", failed)
    }
  }

  const homeFiles = useMemo(() => {
    const sharedFiles = extractSharedChatDocs(messages).map(file => ({
      ...file,
      source: file.source || "chat",
      modifiedTime: file.timestamp || null,
    }))

    const driveFiles = sortedGoogleDocs.map(file => ({
      ...file,
      source: "drive",
    }))

    const gmailFiles = dedupedGmailAttachments.map(file => ({
      id: `gmail-${file.messageId}-${file.id}`,
      name: file.filename,
      source: "gmail",
      messageId: file.messageId,
      gmailMessageId: file.messageId,
      gmailAttachmentId: file.id,
      mimeType: file.mimeType,
      size: file.size,
      modifiedTime: file.internalDate || file.timestamp || null,
      timestamp: file.internalDate || file.timestamp || null,
    }))

    return [...sharedFiles, ...driveFiles, ...gmailFiles]
  }, [messages, sortedGoogleDocs, dedupedGmailAttachments])

  const workspaceSearchChatTargets = useMemo(() => {
    const targets = []
    const seen = new Set()
    const userSpaceIds = new Set((currentUser?.spaces || []).map(id => String(id)))

    const addTarget = chatId => {
      if (chatId === undefined || chatId === null || chatId === "") return
      const key = String(chatId)
      if (seen.has(key)) return
      seen.add(key)
      targets.push({ chatId, key })
    }

    const canReadChannel = (space, channel) => {
      if (!space || !channel || !currentUser) return false
      const userId = String(currentUser.id)
      const ownsSpace = String(space.ownerId) === userId
      const hasSpace = userSpaceIds.has(String(space.id))
      const inSpace = (space.members || []).some(memberId => String(memberId) === userId)
      const channelMembers = channel.members || []

      if (channelMembers.length > 0) {
        return ownsSpace || channelMembers.some(memberId => String(memberId) === userId)
      }

      return ownsSpace || hasSpace || inSpace
    }

    ;(spaces || []).forEach(space => {
      ;(space.channels || []).forEach(channel => {
        if (canReadChannel(space, channel)) addTarget(channel.id)
      })
    })

    ;(friends || []).forEach(friend => addTarget(getDMChatId(friend?.id)))

    return targets
  }, [spaces, friends, currentUser])

  useEffect(() => {
    workspaceSearchHydratedChatsRef.current = new Set()
  }, [currentUser?.id])

  useEffect(() => {
    if (!debouncedSearchQuery.trim() || !currentUser) return undefined

    const pendingTargets = workspaceSearchChatTargets.filter(target => {
      if (workspaceSearchHydratedChatsRef.current.has(target.key)) return false
      workspaceSearchHydratedChatsRef.current.add(target.key)
      return true
    })

    if (!pendingTargets.length) return undefined

    let cancelled = false
    ;(async () => {
      const loadedEntries = await Promise.all(
        pendingTargets.map(async target => {
          try {
            const loadedMessages = await Storage.getMessages(target.chatId, { cacheTtl: 60000 })
            return { ...target, messages: Array.isArray(loadedMessages) ? loadedMessages : [] }
          } catch (error) {
            if (error && error.status !== 403) {
              console.warn("Workspace search message hydration failed", error)
            }
            return { ...target, messages: [] }
          }
        })
      )

      if (cancelled) return

      setMessages(prev => {
        let changed = false
        const next = { ...(prev || {}) }

        loadedEntries.forEach(entry => {
          if (!Array.isArray(entry.messages) || entry.messages.length === 0) return
          const existing = Array.isArray(next[entry.chatId])
            ? next[entry.chatId]
            : Array.isArray(next[entry.key])
              ? next[entry.key]
              : []
          const optimisticOnly = existing.filter(message => message?.optimistic)
          const normalized = entry.messages.map(message => ({
            ...message,
            status: message.status || "sent",
            optimistic: Boolean(message.optimistic && !message.status),
          }))
          const merged = dedupeMessagesById([...normalized, ...optimisticOnly])
          const previousIds = existing.map(message => String(message?.id)).join("|")
          const nextIds = merged.map(message => String(message?.id)).join("|")
          if (previousIds !== nextIds || existing.length !== merged.length) {
            next[entry.chatId] = merged
            changed = true
          }
        })

        return changed ? next : prev
      })
    })()

    return () => {
      cancelled = true
    }
  }, [debouncedSearchQuery, workspaceSearchChatTargets, currentUser])

  const workspaceSearchCatalog = useMemo(() => {
    const userLookup = new Map()
    ;[currentUser, ...(users || []), ...(friends || [])].forEach(user => {
      if (user?.id === undefined || user?.id === null) return
      userLookup.set(String(user.id), user)
    })

    const messageResults = []
    const spaceResults = []
    const filesByKey = new Map()
    const currentUserId = currentUser?.id === undefined || currentUser?.id === null ? "" : String(currentUser.id)
    const userSpaceIds = new Set((currentUser?.spaces || []).map(id => String(id)))

    const canReadChannel = (space, channel) => {
      if (!space || !channel || !currentUser) return false
      const ownsSpace = String(space.ownerId) === currentUserId
      const hasSpace = userSpaceIds.has(String(space.id))
      const inSpace = (space.members || []).some(memberId => String(memberId) === currentUserId)
      const channelMembers = channel.members || []

      if (channelMembers.length > 0) {
        return ownsSpace || channelMembers.some(memberId => String(memberId) === currentUserId)
      }

      return ownsSpace || hasSpace || inSpace
    }

    const readSearchMessages = chatId => {
      if (chatId === undefined || chatId === null || chatId === "") return []
      const key = String(chatId)
      const activeMessages = Array.isArray(messages?.[chatId])
        ? messages[chatId]
        : Array.isArray(messages?.[key])
          ? messages[key]
          : []
      const cachedMessages = Storage.peekMessages(chatId)
      return dedupeMessagesById([...(cachedMessages || []), ...(activeMessages || [])])
    }

    const addFileResult = (file, defaults = {}) => {
      if (!file) return
      const title = file.name || file.filename || defaults.title || "Untitled file"
      const key = String(
        file.webViewLink ||
        file.url ||
        file.public_url ||
        file.drive_file_id ||
        file.fileId ||
        file.id ||
        `${title}-${file.size || ""}-${defaults.contextPath || ""}`
      )
      if (!key || filesByKey.has(key)) return

      const mimeType = file.mimeType || file.type || ""
      const appType = GoogleService.getAppTypeFromMime(mimeType)
      const appIcon = GoogleService.getAppIcon(appType)
      const sourceLabel =
        defaults.sourceLabel ||
        (file.source === "gmail" ? "Gmail" : file.source === "drive" ? "Drive" : file.source === "chat" ? "Chat" : "File")
      const timestamp = file.modifiedTime || file.timestamp || file.internalDate || file.emailDate || defaults.timestamp || null
      const sizeLabel = file.size ? formatDocsSize(file.size) : ""
      const dateLabel = timestamp ? formatDocsDate(timestamp) : ""
      const subtitle = [sourceLabel, sizeLabel, dateLabel, defaults.contextPath].filter(Boolean).join(" | ")

      filesByKey.set(key, {
        id: `file-${key}`,
        type: "file",
        title,
        subtitle: subtitle || sourceLabel,
        sourceLabel,
        timestamp,
        file: { ...file, name: title, mimeType },
        icon: file.iconLink || appIcon.iconUrl,
        emoji: appIcon.emoji,
        contextPath: defaults.contextPath || "",
        searchText: [
          title,
          sourceLabel,
          mimeType,
          file.senderName,
          file.senderEmail,
          file.subject,
          defaults.contextPath,
        ].filter(Boolean).join(" "),
      })
    }

    const addMessageResult = ({ chatId, message, contextPath, spaceId, channelId, userId, friend }) => {
      if (!message) return
      const text = String(message.text || "").replace(/\s+/g, " ").trim()
      const attachments = Array.isArray(message.attachments) ? message.attachments : []
      if (!text && attachments.length === 0) return

      const senderId = message.userId === undefined || message.userId === null ? "" : String(message.userId)
      const isCurrentUser = senderId && senderId === currentUserId
      const sender = userLookup.get(senderId) || (isCurrentUser ? currentUser : null) || friend || null
      const senderName = isCurrentUser ? `${currentUser?.name || "You"} (You)` : sender?.name || "Unknown"
      const preview = text || `${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`

      messageResults.push({
        id: `${chatId}-${message.id || message.timestamp || preview}`,
        type: "message",
        title: senderName,
        subtitle: preview,
        contextPath,
        timestamp: message.timestamp || message.date || null,
        messageId: message.id,
        chatId,
        spaceId,
        channelId,
        userId,
        senderId,
        avatarUser: sender,
        isCurrentUser,
        searchText: [senderName, preview, contextPath].filter(Boolean).join(" "),
        resultScope: channelId ? "channel" : "dm",
      })

      attachments.forEach(attachment => {
        addFileResult(attachment, {
          sourceLabel: attachment.source === "gmail" ? "Gmail" : "Chat",
          timestamp: message.timestamp || message.date || null,
          contextPath,
        })
      })
    }

    ;(homeFiles || []).forEach(file => {
      addFileResult(file, {
        sourceLabel: file.source === "gmail" ? "Gmail" : file.source === "drive" ? "Drive" : file.source === "chat" ? "Chat" : "File",
        timestamp: file.modifiedTime || file.timestamp || file.internalDate || null,
      })
    })

    ;(spaces || []).forEach((space, spaceIndex) => {
      if (!space) return
      const spaceName = space.name || "Untitled space"
      const channels = (space.channels || []).filter(channel => canReadChannel(space, channel))

      spaceResults.push({
        id: `space-${space.id}`,
        type: "space",
        title: spaceName,
        subtitle: `${channels.length} channel${channels.length === 1 ? "" : "s"}`,
        contextPath: "Space",
        spaceId: space.id,
        space,
        spaceIndex,
        searchText: [spaceName, "space"].join(" "),
      })

      channels.forEach(channel => {
        const channelName = channel.name || "channel"
        const contextPath = `${spaceName} > #${channelName}`

        spaceResults.push({
          id: `channel-${channel.id}`,
          type: "channel",
          title: `# ${channelName}`,
          subtitle: `Channel in ${spaceName}`,
          contextPath: spaceName,
          spaceId: space.id,
          channelId: channel.id,
          space,
          channel,
          spaceIndex,
          searchText: [channelName, spaceName, "channel"].join(" "),
        })

        readSearchMessages(channel.id).forEach(message => {
          addMessageResult({
            chatId: channel.id,
            message,
            contextPath,
            spaceId: space.id,
            channelId: channel.id,
          })
        })
      })
    })

    ;(friends || []).forEach(friend => {
      if (!friend?.id) return
      const chatId = getDMChatId(friend.id)
      const contextPath = `Direct message > ${friend.name || "Contact"}`
      readSearchMessages(chatId).forEach(message => {
        addMessageResult({
          chatId,
          message,
          contextPath,
          userId: friend.id,
          friend,
        })
      })
    })

    return {
      messages: messageResults,
      files: Array.from(filesByKey.values()),
      spaces: spaceResults,
    }
  }, [currentUser, users, friends, spaces, messages, homeFiles])

  useEffect(() => {
    const tokens = getWorkspaceSearchTokens(debouncedSearchQuery)
    if (!tokens.length) return

    const buildResults = items =>
      (items || [])
        .filter(item => workspaceSearchMatches(item.searchText || `${item.title || ""} ${item.subtitle || ""}`, tokens))
        .map(item => ({ ...item, searchScore: scoreWorkspaceSearchItem(item, tokens) }))
        .sort((a, b) => {
          if (b.searchScore !== a.searchScore) return b.searchScore - a.searchScore
          return getWorkspaceSearchDateMs(b) - getWorkspaceSearchDateMs(a)
        })
        .slice(0, 80)

    setDmSearchResults(buildResults(workspaceSearchCatalog.messages))
    setFileSearchResults(buildResults(workspaceSearchCatalog.files))
    setSpaceSearchResults(buildResults(workspaceSearchCatalog.spaces))
  }, [debouncedSearchQuery, workspaceSearchCatalog])

  const filteredMessageSearchResults = useMemo(() => {
    return (dmSearchResults || [])
      .filter(result => {
        if (workspaceSearchFromFilter === "you") return result.isCurrentUser
        if (workspaceSearchFromFilter === "others") return !result.isCurrentUser
        return true
      })
      .filter(result => passesWorkspaceSearchDateFilter(result, workspaceSearchDateFilter, Date.now()))
  }, [dmSearchResults, workspaceSearchFromFilter, workspaceSearchDateFilter])

  const filteredFileSearchResults = useMemo(() => {
    return (fileSearchResults || []).filter(result =>
      passesWorkspaceSearchDateFilter(result, workspaceSearchDateFilter, Date.now())
    )
  }, [fileSearchResults, workspaceSearchDateFilter])

  const workspaceSearchCounts = useMemo(
    () => ({
      messages: filteredMessageSearchResults.length,
      files: filteredFileSearchResults.length,
      spaces: spaceSearchResults.length,
    }),
    [filteredMessageSearchResults.length, filteredFileSearchResults.length, spaceSearchResults.length]
  )

  const homeDMChatId = useMemo(() => getDMChatId(homeActiveDMUser), [currentUser?.id, homeActiveDMUser])
  const homeDMMessages = useMemo(() => (homeDMChatId ? messages[homeDMChatId] || [] : []), [messages, homeDMChatId])

  const refreshHomeMail = () => {
    if (!googleAccessToken) return
    loadGoogleDocs(googleAccessToken, 'gmail').catch(error => console.warn("Failed to refresh home mail", error))
  }

  const handleHomeSectionChange = nextSection => {
    setActiveView("home")
    setHomeSection(nextSection)
    if (nextSection === "files" && googleAccessToken) {
      loadGoogleDocs(googleAccessToken).catch(error => console.warn("Failed to refresh home files", error))
    }
    if (nextSection === "mail") {
      refreshHomeMail()
    }
  }

  const openHomeFile = file => {
    if (!file) return
    if (file.webViewLink) {
      window.open(file.webViewLink, "_blank")
      return
    }
    openAttachment(file)
  }

  const openTaskDetailView = task => {
    setActiveSpace(null)
    openTasksPage()
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
        // Clear the caller countdown since call is now connected
        if (callerCountdownRef.current) {
          clearInterval(callerCountdownRef.current)
          callerCountdownRef.current = null
        }
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
    setPinnedParticipant(null) // Reset pinned participant
    setCallerCountdown(30) // Reset countdown to 30 seconds

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

      // Start countdown for caller (30 seconds) - only while waiting for answer
      if (callerCountdownRef.current) {
        clearInterval(callerCountdownRef.current)
      }
      callerCountdownRef.current = setInterval(() => {
        setCallerCountdown(prev => {
          if (prev <= 1) {
            clearInterval(callerCountdownRef.current)
            callerCountdownRef.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)

      // Backup timeout for unanswered call (30 seconds) - only ends if still in 'calling' state
      setTimeout(() => {
        // Check current status - the closure captures the old value, so we need to check via ref or state
        setWebrtcCallStatus(currentStatus => {
          if (currentStatus === 'calling') {
            if (callerCountdownRef.current) {
              clearInterval(callerCountdownRef.current)
              callerCountdownRef.current = null
            }
            setWebrtcError('Call not answered')
            // Delay the end call to allow error to show
            setTimeout(() => endWebRTCCall(), 100)
          }
          return currentStatus
        })
      }, 30000)

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
    
    // Clear caller countdown if still running
    if (callerCountdownRef.current) {
      clearInterval(callerCountdownRef.current)
      callerCountdownRef.current = null
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
    setPinnedParticipant(null)
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
          setCallerCountdown(30) // Reset to initial value
          
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

  const refreshRelationshipState = async (userId = currentUser?.id) => {
    if (!userId) return null
    const allUsers = await Storage.getUsers({ forceRefresh: true }).catch(() => [])
    const normalizedUsers = Array.isArray(allUsers) ? allUsers : []
    setUsers(normalizedUsers)
    const updatedUser = normalizedUsers.find(u => String(u.id) === String(userId))
    if (!updatedUser) return null
    const filteredUser = filterDismissedUser(updatedUser)
    setCurrentUser(filteredUser)
    const friendsList = await Storage.getFriends(filteredUser.friends || [], { forceRefresh: true }).catch(() => [])
    setFriends(Array.isArray(friendsList) ? friendsList : [])
    return filteredUser
  }

  const renderHighlightedText = (text, highlight, keyPrefix = "text") => {
    if (!highlight || !text) return text
    const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const parts = text.split(new RegExp(`(${escapedHighlight})`, "gi"))
    return parts.map((part, i) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <span
          key={`${keyPrefix}-${i}`}
          className="bg-yellow-300 text-slate-900 px-0.5 rounded shadow-sm"
        >
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  const renderFormattedInline = (text, highlight, keyPrefix = "inline") => {
    if (!text) return null
    const tokenPattern = /(\*\*[^*]+\*\*|~~[^~]+~~|<u>[\s\S]*?<\/u>|`[^`]+`|\[[^\]]+\]\([^)]+\)|_[^_]+_)/g
    const nodes = []
    let cursor = 0
    let match

    while ((match = tokenPattern.exec(text)) !== null) {
      if (match.index > cursor) {
        nodes.push(renderHighlightedText(text.slice(cursor, match.index), highlight, `${keyPrefix}-plain-${nodes.length}`))
      }

      const token = match[0]
      const key = `${keyPrefix}-fmt-${nodes.length}`
      if (token.startsWith("**") && token.endsWith("**")) {
        nodes.push(<strong key={key}>{renderHighlightedText(token.slice(2, -2), highlight, key)}</strong>)
      } else if (token.startsWith("~~") && token.endsWith("~~")) {
        nodes.push(<s key={key}>{renderHighlightedText(token.slice(2, -2), highlight, key)}</s>)
      } else if (token.startsWith("<u>") && token.endsWith("</u>")) {
        nodes.push(<u key={key}>{renderHighlightedText(token.slice(3, -4), highlight, key)}</u>)
      } else if (token.startsWith("`") && token.endsWith("`")) {
        nodes.push(
          <code key={key} className={`rounded px-1.5 py-0.5 text-[0.92em] ${isDarkMode ? "bg-white/10 text-sky-100" : "bg-slate-100 text-slate-800"}`}>
            {token.slice(1, -1)}
          </code>
        )
      } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
        const labelEnd = token.indexOf("](")
        const label = token.slice(1, labelEnd)
        const href = token.slice(labelEnd + 2, -1)
        const safeHref = /^(https?:\/\/|mailto:)/i.test(href) ? href : `https://${href.replace(/^\/+/, "")}`
        nodes.push(
          <a key={key} href={safeHref} target="_blank" rel="noreferrer" className={isDarkMode ? "text-sky-300 underline" : "text-sky-700 underline"}>
            {renderHighlightedText(label, highlight, key)}
          </a>
        )
      } else if (token.startsWith("_") && token.endsWith("_")) {
        nodes.push(<em key={key}>{renderHighlightedText(token.slice(1, -1), highlight, key)}</em>)
      }

      cursor = match.index + token.length
    }

    if (cursor < text.length) {
      nodes.push(renderHighlightedText(text.slice(cursor), highlight, `${keyPrefix}-plain-${nodes.length}`))
    }

    return nodes
  }

  const renderFormattedLine = (line, highlight, keyPrefix) => {
    const orderedMatch = line.match(/^\s*(\d+)\.\s+(.*)$/)
    if (orderedMatch) {
      return (
        <div key={keyPrefix} className="flex gap-2">
          <span className="min-w-5 text-right opacity-60">{orderedMatch[1]}.</span>
          <span>{renderFormattedInline(orderedMatch[2], highlight, `${keyPrefix}-ordered`)}</span>
        </div>
      )
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/)
    if (bulletMatch) {
      return (
        <div key={keyPrefix} className="flex gap-2">
          <span className="opacity-60">•</span>
          <span>{renderFormattedInline(bulletMatch[1], highlight, `${keyPrefix}-bullet`)}</span>
        </div>
      )
    }

    const quoteMatch = line.match(/^\s*>\s+(.*)$/)
    if (quoteMatch) {
      return (
        <div key={keyPrefix} className={`border-l-2 pl-3 ${isDarkMode ? "border-slate-600 text-slate-300" : "border-slate-300 text-slate-700"}`}>
          {renderFormattedInline(quoteMatch[1], highlight, `${keyPrefix}-quote`)}
        </div>
      )
    }

    return <div key={keyPrefix}>{renderFormattedInline(line, highlight, keyPrefix)}</div>
  }

  const renderWithHighlight = (text, highlight) => {
    if (!text) return text
    const segments = String(text).split(/```([\s\S]*?)```/g)

    return segments.map((segment, index) => {
      if (index % 2 === 1) {
        return (
          <pre key={`code-block-${index}`} className={`my-2 overflow-x-auto rounded-xl px-3 py-2 text-xs ${isDarkMode ? "bg-black/25 text-sky-100" : "bg-slate-100 text-slate-800"}`}>
            <code>{segment}</code>
          </pre>
        )
      }

      const lines = segment.split("\n")
      if (lines.length === 1) {
        return <React.Fragment key={`text-block-${index}`}>{renderFormattedInline(segment, highlight, `text-block-${index}`)}</React.Fragment>
      }

      return (
        <div key={`text-block-${index}`} className="space-y-1">
          {lines.map((line, lineIndex) => renderFormattedLine(line, highlight, `line-${index}-${lineIndex}`))}
        </div>
      )
    })
  }

  const currentSpace = useMemo(
    () => spaces.find(s => s.id === activeSpace) || null,
    [spaces, activeSpace]
  )

  const currentChannels = useMemo(
    () => currentSpace?.channels || [],
    [currentSpace]
  )

  const allWorkspaceChannels = useMemo(() => {
    const channelMap = new Map()

    ;(spaces || []).forEach(space => {
      ;(space?.channels || []).forEach(channel => {
        if (!channel?.id) return
        channelMap.set(String(channel.id), {
          ...channel,
          spaceId: space.id,
          spaceName: space.name,
        })
      })
    })

    return Array.from(channelMap.values())
  }, [spaces])

  const getCurrentSpace = () => currentSpace
  const getCurrentChannels = () => currentChannels

  const usersById = useMemo(() => {
    const lookup = {}
    ;[...friends, ...users].forEach(user => {
      if (!user?.id && user?.id !== 0) return
      lookup[String(user.id)] = {
        ...(lookup[String(user.id)] || {}),
        ...user,
      }
    })
    if (currentUser?.id !== undefined && currentUser?.id !== null) {
      lookup[String(currentUser.id)] = {
        ...(lookup[String(currentUser.id)] || {}),
        ...currentUser,
      }
    }
    return lookup
  }, [currentUser, users, friends])

  const getUser = userId => {
    if (userId === undefined || userId === null) return undefined
    return usersById[String(userId)]
  }

  const pendingFriendRequests = useMemo(
    () => (currentUser?.notifications || []).filter(notification =>
      ["friend_request", "connection_invite"].includes(notification.type) &&
      (notification.actionStatus || notification.status) !== "accepted" &&
      (notification.actionStatus || notification.status) !== "declined"
    ),
    [currentUser?.notifications]
  )

  const normalizedNotifications = useMemo(() => {
    const list = Array.isArray(currentUser?.notifications) ? currentUser.notifications : []
    return list
      .map(notification => {
        if (!notification) return null
        const legacyType = notification.type
        const type = legacyType === "friend_request" ? "connection_invite" : (legacyType || "info")
        const metadata = notification.metadata && typeof notification.metadata === "object" ? notification.metadata : {}
        const senderId = notification.senderId ?? notification.fromId ?? notification.from
        const sender = getUser(senderId)
        const createdAt = notification.createdAt || (() => {
          const timestamp = notification.timestamp
          if (!timestamp) return null
          if (typeof timestamp === "number") {
            return timestamp < 100000000000 ? new Date(timestamp * 1000).toISOString() : new Date(timestamp).toISOString()
          }
          return timestamp
        })()
        const actionStatus =
          notification.actionStatus ??
          (legacyType === "friend_request" ? "pending" : null)
        const status = notification.status === "read" ? "read" : "unread"

        return {
          ...notification,
          id: String(notification.id || notification._id || `${type}-${createdAt || Date.now()}`),
          type,
          status,
          actionStatus,
          senderId: senderId === undefined || senderId === null ? null : String(senderId),
          sender,
          senderName:
            metadata.senderName ||
            notification.fromName ||
            notification.from ||
            sender?.name ||
            sender?.email ||
            "Someone",
          message: notification.message || "",
          metadata,
          createdAt: createdAt || new Date().toISOString(),
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  }, [currentUser?.notifications, usersById])

  const selectedNotification = useMemo(() => {
    if (normalizedNotifications.length === 0) return null
    return normalizedNotifications.find(notification => notification.id === activeNotificationId) || normalizedNotifications[0]
  }, [activeNotificationId, normalizedNotifications])

  const unreadNotifications = useMemo(
    () => normalizedNotifications.filter(notification => notification.status !== "read"),
    [normalizedNotifications]
  )

  const unreadAssignedTaskNotifications = useMemo(
    () => unreadNotifications.filter(notification => notification.type === "task_assigned"),
    [unreadNotifications]
  )

  useEffect(() => {
    if (normalizedNotifications.length === 0) {
      setActiveNotificationId(null)
      return
    }
    setActiveNotificationId(currentId =>
      currentId && normalizedNotifications.some(notification => notification.id === currentId)
        ? currentId
        : normalizedNotifications[0].id
    )
  }, [normalizedNotifications])

  useEffect(() => {
    if (!currentUser?.id || activeView !== "notifications") return
    let cancelled = false
    setNotificationsLoading(true)
    setNotificationsError("")
    Storage.getNotifications()
      .then(items => {
        if (cancelled) return
        setCurrentUser(prev => prev ? { ...prev, notifications: Array.isArray(items) ? items : [] } : prev)
      })
      .catch(error => {
        if (!cancelled) setNotificationsError(error?.message || "Could not load notifications")
      })
      .finally(() => {
        if (!cancelled) setNotificationsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeView, currentUser?.id])

  const markNotificationReadLocal = useCallback(async notificationId => {
    if (!notificationId) return
    setCurrentUser(prev => {
      if (!prev) return prev
      return {
        ...prev,
        notifications: (prev.notifications || []).map(notification =>
          String(notification.id) === String(notificationId)
            ? {
                ...notification,
                status: "read",
                readAt: notification.readAt || new Date().toISOString(),
              }
            : notification
        ),
      }
    })
    try {
      await Storage.markNotificationRead(notificationId)
    } catch (error) {
      console.warn("Failed to mark notification read", error)
    }
  }, [])

  const markAssignedTaskNotificationsRead = useCallback(() => {
    unreadAssignedTaskNotifications.forEach(notification => {
      markNotificationReadLocal(notification.id)
    })
  }, [markNotificationReadLocal, unreadAssignedTaskNotifications])

  useEffect(() => {
    if (activeView !== "notifications" || !selectedNotification || selectedNotification.status === "read") return
    markNotificationReadLocal(selectedNotification.id)
  }, [activeView, markNotificationReadLocal, selectedNotification])

  function getDMChatId(partnerId) {
    if (!currentUser || partnerId === undefined || partnerId === null) return null
    const left = Number(currentUser.id)
    const right = Number(partnerId)
    if (Number.isFinite(left) && Number.isFinite(right)) {
      const ids = [left, right].sort((a, b) => a - b)
      return `dm_${ids[0]}_${ids[1]}`
    }
    const ids = [String(currentUser.id), String(partnerId)].sort()
    return `dm_${ids[0]}_${ids[1]}`
  }

  const refreshDrafts = async () => {
    try {
      const items = await DraftsService.getDrafts()
      setDrafts(Array.isArray(items) ? items : [])
    } catch (error) {
      console.warn("Failed to refresh drafts", error)
    }
  }

  const removeDraftLocally = draftId => {
    setDrafts(prev => prev.filter(item => String(item.id) !== String(draftId)))
    setActiveDraftId(prev => (String(prev) === String(draftId) ? null : prev))
  }

  const persistDraft = async payload => {
    const existingDraft = drafts.find(item => String(item.id) === String(activeDraftId))
    const saved = await DraftsService.saveDraft({
      ...payload,
      id: activeDraftId || undefined,
      createdAt: existingDraft?.createdAt,
    })
    setDrafts(prev => {
      const next = Array.isArray(prev) ? [...prev] : []
      const index = next.findIndex(item => String(item.id) === String(saved.id))
      if (index >= 0) next[index] = saved
      else next.unshift(saved)
      return next.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    })
    return saved
  }

  const deleteDraftById = async draftId => {
    if (!draftId) return
    try {
      await DraftsService.deleteDraft(draftId)
    } catch (error) {
      console.warn("Failed to delete draft", error)
    }
    removeDraftLocally(draftId)
  }

  const loadDMMessagesForUser = async partnerId => {
    const chatId = getDMChatId(partnerId)
    if (!chatId) return
    try {
      const items = await Storage.getMessages(chatId, { forceRefresh: true })
      setMessages(prev => ({ ...prev, [chatId]: applyPendingReactionOverrides(chatId, Array.isArray(items) ? items : []) }))
    } catch (error) {
      console.warn("Failed to load DM messages", error)
    }
  }

  const openHomePage = () => {
    setActiveDraftId(null)
    setShowMobileDrawer(false)
    setShowDocsModal(false)
    setShowGoogleAppsMenu(false)
    setOpenContextId(null)
    setActiveView("home")
    setHomeSection("overview")
    pushAppRoute("/")
    if (isMobile) setMobileView("chat")
  }

  const openDirectMessagesPage = () => {
    setActiveDraftId(null)
    setShowMobileDrawer(false)
    setShowDocsModal(false)
    setShowGoogleAppsMenu(false)
    setOpenContextId(null)
    const targetDMUser = homeActiveDMUser || activeDMUser || friends[0]?.id || null
    if (targetDMUser) {
      setActiveDMUser(targetDMUser)
      setHomeActiveDMUser(targetDMUser)
      setActiveChannelTab("messages")
      setActiveView("dm")
      pushAppRoute(`/dm/${encodeURIComponent(slugifyRoutePart(getUser(targetDMUser)?.name) || String(targetDMUser))}`)
      loadDMMessagesForUser(targetDMUser)
    } else {
      setActiveView("home")
      setHomeSection("dm")
      pushAppRoute("/")
    }
    if (isMobile) setMobileView("chat")
  }

  const openWorkspaceHome = () => {
    setActiveDraftId(null)
    setShowMobileDrawer(false)
    if (!appDataReady || !currentUser?.id || !Array.isArray(spaces) || spaces.length === 0) {
      setActiveView("home")
      setHomeSection("overview")
      return
    }

    const targetSpace =
      currentSpace && spaces.some(space => String(space.id) === String(currentSpace.id))
        ? currentSpace
        : spaces[0] || null
    if (!targetSpace) {
      setActiveView("home")
      setHomeSection("overview")
      return
    }

    const accessible = getAccessibleChannelsForSpace(targetSpace)
    const targetChannel =
      accessible.find(channel => String(channel.id) === String(activeChannel)) ||
      accessible[0] ||
      null

    if (!targetChannel) {
      setActiveSpace(targetSpace.id)
      setActiveChannel(null)
      setActiveView("home")
      setHomeSection("overview")
      return
    }

    setActiveSpace(targetSpace.id)
    setActiveChannel(targetChannel.id)
    setActiveChannelTab("messages")
    setOpenContextId(null)
    setActiveView("channel")
    setHomeSection("overview")
  }

  const openWorkspaceFriendsHome = () => {
    setActiveDraftId(null)
    setShowMobileDrawer(false)
    const targetDMUser = homeActiveDMUser || activeDMUser || friends[0]?.id || null
    if (targetDMUser) {
      setActiveDMUser(targetDMUser)
      setHomeActiveDMUser(targetDMUser)
      setActiveView("dm")
    } else {
      const targetSpace = currentSpace || spaces[0] || null
      if (targetSpace) {
        const accessible = getAccessibleChannelsForSpace(targetSpace)
        const targetChannel =
          accessible.find(channel => String(channel.id) === String(activeChannel)) ||
          accessible[0] ||
          null
        setActiveSpace(targetSpace.id)
        if (targetChannel) {
          setActiveChannel(targetChannel.id)
          setActiveView("channel")
        } else {
          setActiveChannel(null)
          setActiveView("home")
        }
      } else {
        setActiveView("home")
      }
    }
    setHomeSection("overview")
  }

  const openHomeConnect = () => {
    setActiveDraftId(null)
    setShowMobileDrawer(false)
    setCollapsedSpaceMenu(null)
    setInviteSearchQuery("")
    setSelectedFriendInvitees([])
    setShowAddFriendModal(false)
    setOpenContextId(null)
    setActiveView("connect")
    setHomeSection("connect")
    setConnectPreferredPane("discover")
    pushAppRoute("/connect")
    if (isMobile) setMobileView("chat")
  }

  const openHomeNetwork = () => {
    openHomeConnect()
    setConnectPreferredPane("network")
  }

  const openCalendarPage = () => {
    setActiveDraftId(null)
    setShowMobileDrawer(false)
    setCollapsedSpaceMenu(null)
    setOpenContextId(null)
    if (!googleCalendarToken) {
      setShowCalendarConnectModal(true)
      return
    }
    setActiveView("calendar")
    setActiveSpace(null)
    if (isMobile) setMobileView("chat")
  }

  const openHomeDM = async (partnerId, options = {}) => {
    if (options.clearDraft !== false) {
      setActiveDraftId(null)
    }
    setShowMobileDrawer(false)
    setActiveDMUser(partnerId)
    setHomeActiveDMUser(partnerId)
    setActiveView("dm")
    if (isMobile) setMobileView("chat")
    await loadDMMessagesForUser(partnerId)
  }

  const saveWorkspaceDraft = async () => {
    const text = syncComposerInputFromEditor().trim()
    if (!text || !currentUser) return

    if (activeView === "channel" && activeChannel) {
      const channel = currentChannels.find(item => String(item.id) === String(activeChannel))
      await persistDraft({
        text,
        chatId: String(activeChannel),
        chatType: "channel",
        chatName: channel?.name || "Channel",
        spaceId: activeSpace,
        channelId: activeChannel,
      })
      resetComposerEditor()
      setSelectedFiles([])
      setActiveDraftId(null)
      return
    }

    if (activeView === "dm" && activeDMUser) {
      const friend = friends.find(item => String(item.id) === String(activeDMUser))
      await persistDraft({
        text,
        chatId: getDMChatId(activeDMUser),
        chatType: "dm",
        chatName: friend?.name || "Direct message",
        recipientId: activeDMUser,
        recipientName: friend?.name || "",
      })
      resetComposerEditor()
      setSelectedFiles([])
      setActiveDraftId(null)
    }
  }

  const saveHomeDraft = async () => {
    const text = homeDMInput.trim()
    if (!text || !currentUser || !homeActiveDMUser) return
    const friend = friends.find(item => String(item.id) === String(homeActiveDMUser))
    await persistDraft({
      text,
      chatId: getDMChatId(homeActiveDMUser),
      chatType: "dm",
      chatName: friend?.name || "Direct message",
      recipientId: homeActiveDMUser,
      recipientName: friend?.name || "",
    })
    setHomeDMInput("")
    setActiveDraftId(null)
  }

  const openDraft = async draft => {
    if (!draft) return
    setActiveDraftId(draft.id)

    if (draft.chatType === "channel" && draft.channelId) {
      setActiveSpace(draft.spaceId || activeSpace)
      setActiveChannel(draft.channelId)
      setActiveView("channel")
      setMessageInput(draft.text || "")
      return
    }

    if (draft.recipientId) {
      setMessageInput(draft.text || "")
      setHomeDMInput(draft.text || "")
      await openHomeDM(draft.recipientId, { clearDraft: false })
    }
  }

  const sendHomeDM = async () => {
    const text = homeDMInput.trim()
    const chatId = getDMChatId(homeActiveDMUser)
    if (!text || !chatId || !currentUser || homeDMSending) return

    const message = {
      id: createClientId("home-dm"),
      userId: currentUser.id,
      text,
      timestamp: new Date().toISOString(),
      reactions: {},
      thread: [],
      attachments: [],
      status: "sent",
      optimistic: false,
    }

    setHomeDMSending(true)
    setMessages(prev => ({ ...prev, [chatId]: dedupeMessagesById([...(prev[chatId] || []), message]) }))
    setHomeDMInput("")

    try {
      await Storage.saveMessage(chatId, message)
      if (activeDraftId) await deleteDraftById(activeDraftId)
    } catch (error) {
      console.error("Failed to send home DM", error)
      setMessages(prev => ({
        ...prev,
        [chatId]: (prev[chatId] || []).filter(item => String(item.id) !== String(message.id)),
      }))
    } finally {
      setHomeDMSending(false)
    }
  }

  useEffect(() => {
    if (activeView === "home" && homeSection === "dm" && homeActiveDMUser) {
      loadDMMessagesForUser(homeActiveDMUser)
    }
  }, [activeView, homeSection, homeActiveDMUser])

  // Reactions / Emoji helpers
  const EMOJIS = ['👍','❤️','😂','😮','😢','🎉','🔥']
  const longPressTimerRef = useRef(null)

  const getAccessibleChannelsForSpace = space => {
    if (!space || !currentUser) return []
    return (space.channels || []).filter(channel => {
      const chMembers = channel?.members || []
      if (chMembers.length > 0) {
        return chMembers.includes(currentUser.id) || space.ownerId === currentUser.id
      }
      const spaceMembers = space?.members || []
      return space.ownerId === currentUser.id || spaceMembers.includes(currentUser.id)
    })
  }

  const openCollapsedSpaceMenu = (space, event) => {
    if (!space || !event?.currentTarget) return
    const buttonRect = event.currentTarget.getBoundingClientRect()
    const accessibleChannels = getAccessibleChannelsForSpace(space)

    setCollapsedSpaceMenu(prev => {
      if (prev?.spaceId === space.id) return null
      return {
        spaceId: space.id,
        spaceName: space.name,
        channels: accessibleChannels,
        top: Math.max(16, buttonRect.top),
        left: buttonRect.right + 12
      }
    })
  }

  useEffect(() => {
    if (!collapsedSpaceMenu) return undefined

    const handlePointerDown = event => {
      if (collapsedSpaceMenuRef.current && !collapsedSpaceMenuRef.current.contains(event.target)) {
        setCollapsedSpaceMenu(null)
      }
    }

    const handleEscape = event => {
      if (event.key === "Escape") {
        setCollapsedSpaceMenu(null)
      }
    }

    const handleViewportChange = () => {
      setCollapsedSpaceMenu(null)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    window.addEventListener("resize", handleViewportChange)
    window.addEventListener("scroll", handleViewportChange, true)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("scroll", handleViewportChange, true)
    }
  }, [collapsedSpaceMenu])

  useEffect(() => {
    if (!sidebarCollapsed || isMobile) {
      setCollapsedSpaceMenu(null)
    }
  }, [sidebarCollapsed, isMobile])

  const toggleReaction = async (chatId, messageId, emoji) => {
    if (!chatId || !currentUser) return
    const msgs = messages[chatId] || []
    const idx = msgs.findIndex(m => String(m.id) === String(messageId))
    if (idx === -1) return
    const previousMessage = {
      ...msgs[idx],
      reactions: cloneReactions(msgs[idx].reactions),
    }
    const reactions = cloneReactions(previousMessage.reactions)
    const current = Array.isArray(reactions[emoji]) ? reactions[emoji] : []
    const hasReacted = current.some(id => String(id) === String(currentUser.id))
    const shouldHaveReaction = !hasReacted
    setUserReactionState(reactions, emoji, currentUser.id, shouldHaveReaction)

    const msg = {
      ...previousMessage,
      reactions,
    }

    const overrideKey = getReactionOverrideKey(chatId, msg.id)
    const existingOverride = pendingReactionOverridesRef.current.get(overrideKey)
    pendingReactionOverridesRef.current.set(overrideKey, {
      emojiStates: {
        ...(existingOverride?.emojiStates || {}),
        [emoji]: shouldHaveReaction,
      },
      updatedAt: Date.now(),
    })

    setMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map(m => (String(m.id) === String(msg.id) ? msg : m))
    }))

    try {
      const updatedMessage = await Storage.updateMessageReaction(chatId, msg.id, emoji, shouldHaveReaction)
      if (updatedMessage) {
        setMessages(prev => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map(m =>
            String(m.id) === String(updatedMessage.id)
              ? { ...m, ...updatedMessage, status: updatedMessage.status || m.status || "sent", optimistic: false }
              : m
          )
        }))
      }
    } catch (e) {
      console.error('Failed to update reaction', e)
      pendingReactionOverridesRef.current.delete(overrideKey)
      setMessages(prev => ({
        ...prev,
        [chatId]: (prev[chatId] || []).map(m => (String(m.id) === String(previousMessage.id) ? previousMessage : m))
      }))
    }
  }

  const startEditingMessage = message => {
    if (!message || !currentUser) return
    if (String(message.userId) !== String(currentUser.id)) return
    setEditingMessageId(message.id)
    setEditingMessageText(message.text || "")
    setMessageActionMenu(null)
    setMessageContextPicker(null)
  }

  const cancelEditingMessage = () => {
    setEditingMessageId(null)
    setEditingMessageText("")
    setIsSavingEditedMessage(false)
  }

  const saveEditedMessage = async (chatId, message) => {
    if (!chatId || !message || !currentUser) return
    if (String(message.userId) !== String(currentUser.id)) return

    const trimmedText = editingMessageText.trim()
    if (!trimmedText || trimmedText === (message.text || "").trim()) {
      cancelEditingMessage()
      return
    }

    const updatedMessage = {
      ...message,
      text: trimmedText,
      editedAt: new Date().toISOString()
    }

    setIsSavingEditedMessage(true)
    setMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map(item =>
        item.id === message.id
          ? { ...item, text: trimmedText, editedAt: updatedMessage.editedAt }
          : item
      )
    }))

    try {
      await Storage.updateMessage(chatId, sanitizeMessagePayload(updatedMessage))
      cancelEditingMessage()
    } catch (e) {
      console.error("Failed to edit message", e)
      setMessages(prev => ({
        ...prev,
        [chatId]: (prev[chatId] || []).map(item =>
          item.id === message.id ? message : item
        )
      }))
      setIsSavingEditedMessage(false)
    }
  }

  const getActiveChatId = () => {
    const resolvedView = activeView === "contexts" ? contextsSourceView : activeView
    if (resolvedView === "channel") return Number(activeChannel)
    if (resolvedView === "dm" && activeDMUser && currentUser) return getDMChatId(activeDMUser)
    return null
  }

  const activeChatId = useMemo(() => {
    const resolvedView = activeView === "contexts" ? contextsSourceView : activeView
    if (resolvedView === "channel") return Number(activeChannel)
    if (resolvedView === "dm" && activeDMUser && currentUser) return getDMChatId(activeDMUser)
    return null
  }, [activeView, activeChannel, activeDMUser, contextsSourceView, currentUser])

  const currentMessages = useMemo(
    () => (activeChatId ? dedupeMessagesById(messages[activeChatId] || []) : []),
    [messages, activeChatId]
  )
  const isChannelFeed = activeView === "channel"

  useEffect(() => {
    const normalizedActiveChatId = activeChatId ? String(activeChatId) : null
    const previousActiveChatId = previousActiveChatIdRef.current

    if (!normalizedActiveChatId) {
      previousActiveChatIdRef.current = null
      return
    }

    if (previousActiveChatId !== normalizedActiveChatId) {
      restoreMessageScrollRef.current = true
      pendingTabScrollRestoreRef.current = normalizedActiveChatId
      prevScrollHeightRef.current = 0
      setTargetMessageId(null)
      setPinnedMessageId(null)
      if (activeChannelTab !== "messages") {
        setActiveChannelTab("messages")
      }
    }

    previousActiveChatIdRef.current = normalizedActiveChatId
  }, [activeChatId, activeChannelTab])

  useEffect(() => {
    cancelEditingMessage()
  }, [activeChatId])

  const getCurrentMessages = () => {
    return currentMessages
  }

  const homeFriends = useMemo(() => {
    if (!Array.isArray(friends)) return []
    return friends.map(friend => {
      const freshUser = getUserIdValue(friend) ? usersById[String(getUserIdValue(friend))] : null
      if (!freshUser) return friend
      return {
        ...friend,
        ...freshUser,
        status: friend.status || freshUser.status,
      }
    })
  }, [friends, usersById])

  const activeChannelData = useMemo(
    () => currentChannels.find(c => String(c.id) === String(activeChannel)) || null,
    [currentChannels, activeChannel]
  )

  const activeChannelMemberIds = useMemo(() => {
    const isChannelContext =
      activeView === "channel" ||
      (activeView === "contexts" && contextsSourceView === "channel")

    if (!isChannelContext || !activeChannelData) return []

    const memberIds = []
    const seen = new Set()
    const addMemberId = id => {
      const resolvedId =
        id && typeof id === "object"
          ? (id.id ?? id._id ?? id.userId ?? id.user_id)
          : id
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") return
      const key = String(resolvedId)
      if (seen.has(key)) return
      seen.add(key)
      memberIds.push(resolvedId)
    }

    if (activeChannelData.type === "public") {
      ;(currentSpace?.members || []).forEach(addMemberId)
    }
    ;(activeChannelData.members || []).forEach(addMemberId)
    addMemberId(activeChannelData.ownerId)
    addMemberId(currentSpace?.ownerId)
    Object.keys(activeChannelData.roles || {}).forEach(addMemberId)

    return memberIds
  }, [activeView, activeChannelData, contextsSourceView, currentSpace])

  const activeChannelMemberIdKey = useMemo(
    () => activeChannelMemberIds.map(id => String(id)).join(","),
    [activeChannelMemberIds]
  )

  useEffect(() => {
    if (!isAuthenticated || activeChannelMemberIds.length === 0) {
      channelMemberHydrationKeyRef.current = ""
      return
    }

    const missingMemberIds = activeChannelMemberIds.filter(id => !usersById[String(id)])
    const requestKey = missingMemberIds.map(id => String(id)).sort().join(",")
    if (!requestKey) {
      channelMemberHydrationKeyRef.current = ""
      return
    }
    if (channelMemberHydrationKeyRef.current === requestKey) return

    channelMemberHydrationKeyRef.current = requestKey

    Storage.getUsersByIds(missingMemberIds, { forceRefresh: true, cacheTtl: 0 })
      .then(memberProfiles => {
        if (!Array.isArray(memberProfiles) || memberProfiles.length === 0) return
        setUsers(prev => {
          const merged = new Map()
          ;(Array.isArray(prev) ? prev : []).forEach(user => {
            if (user?.id === undefined || user?.id === null) return
            merged.set(String(user.id), user)
          })
          memberProfiles.forEach(user => {
            if (user?.id === undefined || user?.id === null) return
            merged.set(String(user.id), { ...(merged.get(String(user.id)) || {}), ...user })
          })
          return Array.from(merged.values())
        })
      })
      .catch(error => {
        channelMemberHydrationKeyRef.current = ""
        console.warn("Failed to load channel member profiles", error)
      })
  }, [activeChannelMemberIdKey, activeChannelMemberIds, isAuthenticated, usersById])

  const activeMembers = useMemo(() => {
    if (activeView === "channel" || (activeView === "contexts" && contextsSourceView === "channel")) {
      if (!activeChannelData) return []
      const embeddedMembersById = {}
      const addEmbeddedProfile = member => {
        if (!member || typeof member !== "object") return
        const id =
          member.id !== undefined && member.id !== null
            ? String(member.id)
            : member.userId !== undefined && member.userId !== null
              ? String(member.userId)
              : member.user_id !== undefined && member.user_id !== null
                ? String(member.user_id)
                : member._id !== undefined && member._id !== null
                  ? String(member._id?.$oid || member._id)
                  : ""
        if (!id) return
        embeddedMembersById[id] = {
          ...(embeddedMembersById[id] || {}),
          ...member,
          id: member.id ?? id,
        }
      }

      ;(currentSpace?.members || []).forEach(addEmbeddedProfile)
      ;(currentSpace?.memberDetails || []).forEach(addEmbeddedProfile)
      ;(currentSpace?.memberProfiles || []).forEach(addEmbeddedProfile)
      ;(currentSpace?.memberUsers || []).forEach(addEmbeddedProfile)
      ;(currentSpace?.users || []).forEach(addEmbeddedProfile)
      ;(activeChannelData?.members || []).forEach(addEmbeddedProfile)
      ;(activeChannelData?.memberDetails || []).forEach(addEmbeddedProfile)
      ;(activeChannelData?.memberProfiles || []).forEach(addEmbeddedProfile)
      ;(activeChannelData?.memberUsers || []).forEach(addEmbeddedProfile)
      ;(activeChannelData?.users || []).forEach(addEmbeddedProfile)

      return activeChannelMemberIds.map(id => {
        const resolvedMember = usersById[String(id)] || embeddedMembersById[String(id)]
        if (resolvedMember) {
          return {
            ...resolvedMember,
            id: resolvedMember.id ?? resolvedMember.userId ?? resolvedMember.user_id ?? id,
          }
        }
        return {
          id,
          name: "Loading member...",
          email: "",
          status: "offline",
          unresolved: true,
        }
      })
    }
    if (activeView === "dm" && activeDMUser && currentUser) {
      const partner = usersById[String(activeDMUser)]
      return partner ? [currentUser, partner] : [currentUser]
    }
    return []
  }, [activeView, activeChannelData, activeChannelMemberIds, activeDMUser, contextsSourceView, currentSpace, currentUser, usersById])

  const taskCreationSource =
    taskModalDraft?.source ||
    (activeView === "channel" || (activeView === "contexts" && contextsSourceView === "channel")
      ? "channel"
      : "tasks_section")

  const taskAssignableMembers = useMemo(() => {
    const lookup = new Map()
    const addUser = user => {
      const id = getUserIdValue(user)
      if (id === undefined || id === null || id === "") return
      lookup.set(String(id), {
        ...(lookup.get(String(id)) || {}),
        ...user,
        id,
      })
    }

    addUser(currentUser)
    ;(activeMembers || []).forEach(addUser)
    if (taskCreationSource !== "channel") {
      ;(friends || []).forEach(addUser)
      ;(users || []).forEach(addUser)
    }
    return Array.from(lookup.values())
  }, [activeMembers, currentUser, friends, taskCreationSource, users])

  const getActiveMembers = () => activeMembers

  const getChannelRole = (memberId) => {
    if (!activeChannelData) return 'member'
    const roles = activeChannelData.roles || {}
    return roles[String(memberId)] || 'member'
  }

  const canModerateCurrentChannel = () => {
    if (!currentUser) return false
    const resolvedView = activeView === "contexts" ? contextsSourceView : activeView
    if (resolvedView !== "channel") return false
    const currentSpace = getCurrentSpace()
    if (currentSpace && String(currentSpace.ownerId) === String(currentUser.id)) return true
    const role = getChannelRole(currentUser.id)
    return role === "owner" || role === "admin"
  }

  const canDeleteMessage = message => {
    if (!message || !currentUser) return false
    if (String(message.userId) === String(currentUser.id)) return true
    return canModerateCurrentChannel()
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
        if ((attSource === 'gmail' || cleanAtt.source === 'gmail') && !cleanAtt.url) {
          cleanAtt.webViewLink = cleanAtt.webViewLink || (cleanAtt.gmailMessageId ? `https://mail.google.com/mail/u/0/#inbox/${cleanAtt.gmailMessageId}` : null)
        } else if (cleanAtt.fileId && !cleanAtt.url) {
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
      if (missingAttachmentIdsRef.current.has(String(fileId))) return null
      const token = getToken()
      const resp = await fetch(`${API_BASE}/upload/file/${fileId}`, { credentials: "include", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
      if (resp.status === 404) missingAttachmentIdsRef.current.add(String(fileId))
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
    const cacheKey = getAttachmentCacheKey(att)
    if (att?.previewUrl?.startsWith?.("blob:")) return att.previewUrl
    if (cacheKey && missingAttachmentIdsRef.current.has(String(cacheKey))) return null
    if (cacheKey && protectedFileUrlCacheRef.current.has(cacheKey)) {
      return protectedFileUrlCacheRef.current.get(cacheKey)
    }
    if (cacheKey && protectedFileInflightRef.current.has(cacheKey)) {
      return protectedFileInflightRef.current.get(cacheKey)
    }

    const request = (async () => {
      try {
        let url = att.url || att.public_url || null
        if (url && typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) {
          url = `${API_BASE}${url}`
        }
        const fid = (att.fileId || att.id) || null
        // Prefer explicit URL if available
        if (url) {
          const token = getToken()
          const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
          const resp = await fetch(url, { credentials: "include", headers })
          if (resp.status === 404 && cacheKey) missingAttachmentIdsRef.current.add(String(cacheKey))
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
            const resp = await fetch(realUrl, { credentials: "include", headers })
            if (resp.status === 404 && cacheKey) missingAttachmentIdsRef.current.add(String(cacheKey))
            if (!resp.ok) return null
            const blob = await resp.blob()
            return URL.createObjectURL(blob)
          }
        }
      } catch (e) {
        console.error('fetchProtectedUrl failed', e)
      } finally {
        if (cacheKey) {
          protectedFileInflightRef.current.delete(cacheKey)
        }
      }

      return null
    })()

    if (cacheKey) {
      protectedFileInflightRef.current.set(cacheKey, request)
    }

    const objectUrl = await request
    if (cacheKey && objectUrl) {
      protectedFileUrlCacheRef.current.set(cacheKey, objectUrl)
    }

    return objectUrl
  }

  const isAttachmentUrlProtected = att => {
    const url = att?.url || att?.public_url || att?.previewUrl || att?.webViewLink
    if (!url) return Boolean(att?.fileId || att?.drive_file_id)

    try {
      const parsed = new URL(url, window.location.href)
      const apiHost = (() => {
        try { return new URL(API_BASE).host } catch { return null }
      })()
      if (!parsed.protocol || parsed.origin === window.location.origin) return true
      if (apiHost && parsed.host && parsed.host.includes(apiHost)) return true
    } catch {
      return true
    }

    return Boolean(att?.fileId || att?.drive_file_id)
  }

  const isMissingAttachment = att => {
    const cacheKey = getAttachmentCacheKey(att)
    return cacheKey ? missingAttachmentIdsRef.current.has(String(cacheKey)) : false
  }

  const getAttachmentPreviewKind = att => {
    const mime = String(att?.type || att?.mimeType || att?.mimetype || "").toLowerCase()
    const name = String(att?.name || att?.filename || "").toLowerCase()
    if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(name)) return "image"
    if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/.test(name)) return "video"
    if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf"
    if (mime.includes("spreadsheet") || mime.includes("excel") || /\.(csv|xlsx?|ods)$/.test(name)) return "sheet"
    if (mime.includes("presentation") || mime.includes("powerpoint") || /\.(pptx?|odp)$/.test(name)) return "slides"
    if (mime.includes("document") || mime.includes("word") || mime.includes("text") || /\.(docx?|txt|rtf|md)$/.test(name)) return "doc"
    return "file"
  }

  const isGoogleDriveAttachment = att => {
    if (!att) return false
    const url = String(att.webViewLink || att.url || att.previewUrl || "")
    return att.source === "drive" || url.includes("drive.google.com") || url.includes("docs.google.com")
  }

  const getGoogleDrivePreviewUrl = att => {
    const fileId = att?.fileId || att?.drive_file_id || att?.id
    if (!fileId || !isGoogleDriveAttachment(att)) return null

    const encodedId = encodeURIComponent(String(fileId))
    const mime = String(att?.type || att?.mimeType || att?.mimetype || "").toLowerCase()
    if (mime === "application/vnd.google-apps.document") {
      return `https://docs.google.com/document/d/${encodedId}/preview`
    }
    if (mime === "application/vnd.google-apps.spreadsheet") {
      return `https://docs.google.com/spreadsheets/d/${encodedId}/preview`
    }
    if (mime === "application/vnd.google-apps.presentation") {
      return `https://docs.google.com/presentation/d/${encodedId}/preview`
    }
    return `https://drive.google.com/file/d/${encodedId}/preview`
  }

  const fetchGoogleDriveMediaPreviewUrl = async att => {
    const fileId = att?.fileId || att?.drive_file_id || att?.id
    const mime = String(att?.type || att?.mimeType || att?.mimetype || "").toLowerCase()
    if (!fileId || !googleAccessToken || mime.startsWith("application/vnd.google-apps.")) return null

    const cacheKey = `google-drive-media:${fileId}`
    if (protectedFileUrlCacheRef.current.has(cacheKey)) {
      return protectedFileUrlCacheRef.current.get(cacheKey)
    }
    if (protectedFileInflightRef.current.has(cacheKey)) {
      return protectedFileInflightRef.current.get(cacheKey)
    }

    const request = (async () => {
      try {
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(fileId))}?alt=media`, {
          headers: { Authorization: `Bearer ${googleAccessToken}` },
        })
        if (!resp.ok) return null
        const blob = await resp.blob()
        return URL.createObjectURL(blob)
      } catch (error) {
        console.error("Failed to fetch Google Drive preview media:", error)
        return null
      } finally {
        protectedFileInflightRef.current.delete(cacheKey)
      }
    })()

    protectedFileInflightRef.current.set(cacheKey, request)
    const objectUrl = await request
    if (objectUrl) protectedFileUrlCacheRef.current.set(cacheKey, objectUrl)
    return objectUrl
  }

  const openAttachmentPreview = async att => {
    if (!att) return

    const googleDrivePreviewUrl = getGoogleDrivePreviewUrl(att)
    const initialUrl = googleDrivePreviewUrl || att.url || att.public_url || att.previewUrl || att.webViewLink || null
    setAttachmentPreview({
      attachment: att,
      url: initialUrl,
      loading: true,
      error: "",
    })
    setAttachmentPreviewMenuOpen(false)

    try {
      let previewUrl = initialUrl

      if (googleDrivePreviewUrl) {
        previewUrl = await fetchGoogleDriveMediaPreviewUrl(att) || googleDrivePreviewUrl
      } else if (att.source === "gmail" && att.gmailMessageId && att.gmailAttachmentId && googleAccessToken) {
        previewUrl = await GoogleService.getGmailAttachmentPreviewUrl(
          googleAccessToken,
          att.gmailMessageId,
          att.gmailAttachmentId,
          att.type || att.mimeType,
          att.name
        )
      } else if (isAttachmentUrlProtected(att)) {
        previewUrl = await fetchProtectedUrlAndCreateObjectURL(att)
      } else if (!previewUrl && (att.fileId || att.id)) {
        const meta = await fetchFileMetadata(att.fileId || att.id)
        previewUrl = meta?.url || meta?.public_url || null
      }

      setAttachmentPreview(current =>
        current?.attachment === att
          ? { attachment: att, url: previewUrl || initialUrl, loading: false, error: previewUrl || initialUrl ? "" : "Preview is not available for this attachment." }
          : current
      )
    } catch (error) {
      console.error("Failed to prepare attachment preview:", error)
      setAttachmentPreview(current =>
        current?.attachment === att
          ? { ...current, loading: false, error: "Preview is not available for this attachment." }
          : current
      )
    }
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
          const delay = Math.min(1200, 300 * (attempt + 1))
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

  useEffect(() => {
    const chatId = getActiveChatId()
    const resolvedView = activeView === "contexts" ? contextsSourceView : activeView
    if (!chatId || (resolvedView !== "channel" && resolvedView !== "dm")) return undefined

    const normalizedChatId = String(chatId)
    if (
      activeContextStateRef.current.chatId === normalizedChatId &&
      activeContextStateRef.current.loaded
    ) {
      return undefined
    }

    activeContextStateRef.current = { chatId: normalizedChatId, loaded: false }

    let cancelled = false
    ;(async () => {
      try {
        const state = await Storage.getContextState(normalizedChatId)
        if (cancelled) return

        setContextItems(prev => {
          const remoteContexts = (state.contexts || []).map(context => ({
            ...context,
            channelId: context.channelId || normalizedChatId,
          }))
          const remoteIds = new Set(remoteContexts.map(context => String(context.id)))
          const localOnly = prev.filter(context =>
            String(context.channelId) === normalizedChatId && !remoteIds.has(String(context.id))
          )
          return [
            ...prev.filter(context => String(context.channelId) !== normalizedChatId),
            ...remoteContexts,
            ...localOnly,
          ]
        })
        setContextDecisions(prev => {
          const remoteDecisions = (state.decisions || []).map(item => ({
            ...item,
            channelId: item.channelId || normalizedChatId,
          }))
          const remoteIds = new Set(remoteDecisions.map(item => String(item.id)))
          const localOnly = prev.filter(item =>
            String(item.channelId) === normalizedChatId && !remoteIds.has(String(item.id))
          )
          return [
            ...prev.filter(item => String(item.channelId) !== normalizedChatId),
            ...remoteDecisions,
            ...localOnly,
          ]
        })
        setContextTasks(prev => {
          const remoteTasks = (state.tasks || []).map(item => ({
            ...item,
            channelId: item.channelId || normalizedChatId,
          }))
          const remoteIds = new Set(remoteTasks.map(item => String(item.id)))
          const localOnly = prev.filter(item =>
            String(item.channelId) === normalizedChatId && !remoteIds.has(String(item.id))
          )
          return [
            ...prev.filter(item => String(item.channelId) !== normalizedChatId),
            ...remoteTasks,
            ...localOnly,
          ]
        })
      } catch (e) {
        console.error("Failed to load context state", e)
        if (cancelled) return
        setContextItems(prev => prev.filter(context => String(context.channelId) !== normalizedChatId))
        setContextDecisions(prev => prev.filter(item => String(item.channelId) !== normalizedChatId))
        setContextTasks(prev => prev.filter(item => String(item.channelId) !== normalizedChatId))
      } finally {
        if (!cancelled) {
          activeContextStateRef.current = { chatId: normalizedChatId, loaded: true }
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeView, activeChannel, activeDMUser, contextsSourceView, currentUser])

  useEffect(() => {
    const chatId = getActiveChatId()
    const resolvedView = activeView === "contexts" ? contextsSourceView : activeView
    if (!chatId || (resolvedView !== "channel" && resolvedView !== "dm")) return undefined

    const normalizedChatId = String(chatId)
    if (
      activeContextStateRef.current.chatId !== normalizedChatId ||
      !activeContextStateRef.current.loaded
    ) {
      return undefined
    }

    const contexts = contextItems.filter(context => String(context.channelId) === normalizedChatId)
    const decisions = contextDecisions.filter(item => String(item.channelId) === normalizedChatId)
    const tasks = contextTasks.filter(item => String(item.channelId) === normalizedChatId)

    if (contextSaveTimeoutRef.current) {
      clearTimeout(contextSaveTimeoutRef.current)
    }

    Storage.cacheContextState(normalizedChatId, { contexts, decisions, tasks })

    contextSaveTimeoutRef.current = setTimeout(() => {
      Storage.saveContextState(normalizedChatId, { contexts, decisions, tasks }).catch(error => {
        console.error("Failed to save context state", error)
      })
    }, 400)

    return () => {
      if (contextSaveTimeoutRef.current) {
        clearTimeout(contextSaveTimeoutRef.current)
        contextSaveTimeoutRef.current = null
      }
    }
  }, [activeView, activeChannel, activeDMUser, contextsSourceView, currentUser, contextItems, contextDecisions, contextTasks])

  useEffect(() => {
    setSelectedMessageIds([])
    setMessageActionMenu(null)
    setMessageContextPicker(null)
    setComposerContextPickerOpen(false)
    setSelectedComposerContextId(null)
    setOpenContextId(null)
    setActiveChannelTab("messages")
  }, [activeChannel, activeView, activeDMUser])

  useEffect(() => {
    if (!openContextId) return undefined
    const handleEscape = event => {
      if (event.key === "Escape") {
        setOpenContextId(null)
        setMessageActionMenu(null)
        setMessageContextPicker(null)
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [openContextId])

  useEffect(() => {
    if (!messageActionMenu && !messageContextPicker && !composerContextPickerOpen && !composerAttachMenuOpen) return undefined
    const closeMenus = () => {
      setMessageActionMenu(null)
      setMessageContextPicker(null)
      setComposerAttachMenuOpen(false)
      setComposerContextPickerOpen(false)
    }
    document.addEventListener("click", closeMenus)
    return () => document.removeEventListener("click", closeMenus)
  }, [messageActionMenu, messageContextPicker, composerAttachMenuOpen, composerContextPickerOpen])

  useEffect(() => {
    if (!channelActionMenu) return undefined

    const closeMenu = () => setChannelActionMenu(null)
    const closeOnEscape = event => {
      if (event.key === "Escape") closeMenu()
    }

    document.addEventListener("click", closeMenu)
    document.addEventListener("keydown", closeOnEscape)
    window.addEventListener("resize", closeMenu)
    window.addEventListener("scroll", closeMenu, true)

    return () => {
      document.removeEventListener("click", closeMenu)
      document.removeEventListener("keydown", closeOnEscape)
      window.removeEventListener("resize", closeMenu)
      window.removeEventListener("scroll", closeMenu, true)
    }
  }, [channelActionMenu])

  const currentChannelContexts = useMemo(() => {
    const chatId = getActiveChatId()
    if (!chatId || !["channel", "dm", "contexts"].includes(activeView)) return []
    return contextItems.filter(context => String(context.channelId) === String(chatId))
  }, [activeView, activeChannel, activeDMUser, contextsSourceView, currentUser, contextItems])

  const contextsById = useMemo(
    () => Object.fromEntries(contextItems.map(context => [String(context.id), context])),
    [contextItems]
  )

  const getContextOwnerName = ownerId => getUser(ownerId)?.name || "Unknown"

  const formatContextTime = timestamp => {
    if (!timestamp) return "now"
    const time = new Date(timestamp).getTime()
    if (Number.isNaN(time)) return "now"
    const diffMinutes = Math.max(0, Math.round((Date.now() - time) / 60000))
    if (diffMinutes < 1) return "just now"
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.round(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.round(diffHours / 24)
    return `${diffDays}d ago`
  }

  const getMessageById = messageId => currentMessages.find(message => String(message.id) === String(messageId))
  const getTaskById = taskId => (tasksList || []).find(task => String(task.id) === String(taskId))

  const getMessageContexts = message =>
    (message?.contextIds || [])
      .map(contextId => contextsById[String(contextId)])
      .filter(Boolean)

  const selectedComposerContext = selectedComposerContextId
    ? contextsById[String(selectedComposerContextId)] || null
    : null

  const isContextManager = context => {
    if (!context || !currentUser) return false
    const managerView = activeView === "contexts" ? contextsSourceView : activeView
    if (managerView === "dm") {
      return String(context.ownerId) === String(currentUser.id)
    }
    const role = getChannelRole(currentUser.id)
    return String(context.ownerId) === String(currentUser.id) || role === "owner" || role === "admin"
  }

  const patchMessage = async (messageId, updater) => {
    const chatId = getActiveChatId()
    if (!chatId || !messageId) return null
    const current = (messages[chatId] || []).find(message => String(message.id) === String(messageId))
    if (!current) return null
    const updated = updater({
      ...current,
      contextIds: Array.isArray(current.contextIds) ? current.contextIds : [],
      attachments: Array.isArray(current.attachments) ? current.attachments : [],
    })
    setMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map(message =>
        String(message.id) === String(messageId) ? updated : message
      ),
    }))
    try {
      await Storage.updateMessage(chatId, sanitizeMessagePayload(updated))
    } catch (e) {
      console.error("Failed to update message metadata", e)
    }
    return updated
  }

  const appendContextActivity = (context, activity) => ({
    ...context,
    contributorIds: Array.from(new Set([...(context.contributorIds || []), activity.userId])),
    activity: [...(context.activity || []), activity],
    updatedAt: activity.timestamp,
  })

  const ensureDecisionForContext = (contextId, message) => {
    if (!contextId || !message || !message.isDecision) return null
    const existing = contextDecisions.find(
      item => String(item.contextId) === String(contextId) && String(item.messageId) === String(message.id)
    )
    if (existing) return existing.id
    const decision = {
      id: `decision-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      channelId: getActiveChatId(),
      contextId,
      messageId: message.id,
      text: message.text || "Decision captured",
      createdBy: currentUser?.id,
      createdAt: new Date().toISOString(),
    }
    setContextDecisions(prev => [...prev, decision])
    return decision.id
  }

  const ensureTaskForContext = (contextId, taskPayload) => {
    if (!contextId || !taskPayload?.id) return null
    const exists = contextTasks.find(
      item => String(item.contextId) === String(contextId) && String(item.id) === String(taskPayload.id)
    )
    if (exists) return exists.id
    const item = {
      id: taskPayload.id,
      channelId: getActiveChatId(),
      contextId,
      taskId: taskPayload.id,
      messageId: taskPayload.sourceMessageId || null,
      text: taskPayload.message,
      assigneeIds: taskPayload.assigned_to || [],
      status: taskPayload.status || "pending",
      createdBy: taskPayload.created_by,
      createdAt: taskPayload.timestamp || new Date().toISOString(),
    }
    setContextTasks(prev => [...prev, item])
    return item.id
  }

  const createOrUpdateContextFromDraft = async () => {
    if (!contextDraft?.title?.trim() || !currentUser || (activeView !== "channel" && activeView !== "dm")) return
    const now = new Date().toISOString()
    const messageIds = Array.from(new Set(contextDraft.messageIds || []))
    const activeChatId = getActiveChatId()
    if (!activeChatId) return
    if (editingContextId) {
      setContextItems(prev =>
        prev.map(context => {
          if (String(context.id) !== String(editingContextId)) return context
          if (!isContextManager(context)) return context
          const updated = { ...context }
          const statusChanged = updated.status !== contextDraft.status
          updated.title = contextDraft.title.trim()
          updated.summary = contextDraft.summary.trim()
          updated.status = contextDraft.status
          updated.ownerId = contextDraft.ownerId
          updated.updatedAt = now
          if (statusChanged) {
            updated.activity = [
              ...(updated.activity || []),
              {
                id: `activity-status-${Date.now()}`,
                type: "status_changed",
                userId: currentUser.id,
                from: context.status,
                to: contextDraft.status,
                timestamp: now,
              },
            ]
          }
          return updated
        })
      )
      setContextDraft(null)
      setEditingContextId(null)
      return
    }

    const created = createContextRecord({
      channelId: activeChatId,
      title: contextDraft.title.trim(),
      summary: contextDraft.summary.trim(),
      status: contextDraft.status,
      ownerId: contextDraft.ownerId,
      createdBy: currentUser.id,
      linkedMessageIds: messageIds,
    })

    let nextContext = { ...created }

    for (const messageId of messageIds) {
      const updatedMessage = await patchMessage(messageId, message => ({
        ...message,
        contextIds: Array.from(new Set([...(message.contextIds || []), created.id])),
        attachments: Array.isArray(message.attachments) ? message.attachments : [],
      }))
      if (!updatedMessage) continue
      const attachmentIds = (updatedMessage.attachments || []).map(att => getAttachmentCacheKey(att) || att.name).filter(Boolean)
      const decisionId = ensureDecisionForContext(created.id, updatedMessage)
      nextContext = appendContextActivity(nextContext, {
        id: `activity-message-${messageId}-${Date.now()}`,
        type: "message_added",
        userId: currentUser.id,
        messageId,
        timestamp: now,
      })
      attachmentIds.forEach(fileId => {
        nextContext = appendContextActivity(nextContext, {
          id: `activity-file-${fileId}-${Date.now()}`,
          type: "file_added",
          userId: currentUser.id,
          fileId,
          timestamp: now,
        })
      })
      nextContext.linkedFileIds = Array.from(new Set([...(nextContext.linkedFileIds || []), ...attachmentIds]))
      if (decisionId) {
        nextContext = appendContextActivity(nextContext, {
          id: `activity-decision-seed-${decisionId}-${Date.now()}`,
          type: "decision_added",
          userId: currentUser.id,
          decisionId,
          timestamp: now,
        })
        nextContext.decisionIds = Array.from(new Set([...(nextContext.decisionIds || []), decisionId]))
      }
      if (updatedMessage.taskId) {
        const sourceTask = getTaskById(updatedMessage.taskId)
        const taskId = ensureTaskForContext(created.id, sourceTask || {
          id: updatedMessage.taskId,
          message: updatedMessage.text || "Task captured from message",
          assigned_to: [],
          status: "pending",
          created_by: updatedMessage.userId,
          timestamp: updatedMessage.timestamp,
          sourceMessageId: updatedMessage.id,
        })
        if (taskId) {
          nextContext = appendContextActivity(nextContext, {
            id: `activity-task-seed-${taskId}-${Date.now()}`,
            type: "task_added",
            userId: currentUser.id,
            taskId,
            timestamp: now,
          })
          nextContext.taskIds = Array.from(new Set([...(nextContext.taskIds || []), taskId]))
        }
      }
    }

    setContextItems(prev => [...prev, nextContext])
    setContextDraft(null)
    setSelectedMessageIds([])
    setActiveChannelTab("messages")
    openContextsPage(created.id)
  }

  const addMessageToContext = async (contextId, messageId) => {
    const message = getMessageById(messageId)
    if (!message) return
    const now = new Date().toISOString()
    const updatedMessage = await patchMessage(messageId, current => ({
      ...current,
      contextIds: Array.from(new Set([...(current.contextIds || []), contextId])),
    }))
    const effectiveMessage = updatedMessage || message
    const decisionId = ensureDecisionForContext(contextId, effectiveMessage)
    setContextItems(prev =>
      prev.map(context => {
        if (String(context.id) !== String(contextId)) return context
        const next = appendContextActivity(context, {
          id: `activity-added-${messageId}-${Date.now()}`,
          type: "message_added",
          userId: currentUser.id,
          messageId,
          timestamp: now,
        })
        const attachmentIds = (effectiveMessage.attachments || []).map(att => getAttachmentCacheKey(att) || att.name).filter(Boolean)
        let withFiles = next
        attachmentIds.forEach(fileId => {
          withFiles = appendContextActivity(withFiles, {
            id: `activity-file-added-${fileId}-${Date.now()}`,
            type: "file_added",
            userId: currentUser.id,
            fileId,
            timestamp: now,
          })
        })
        let withDerived = withFiles
        if (decisionId) {
          withDerived = appendContextActivity(withDerived, {
            id: `activity-decision-added-${decisionId}-${Date.now()}`,
            type: "decision_added",
            userId: currentUser.id,
            decisionId,
            timestamp: now,
          })
        }
        let derivedTaskIds = withDerived.taskIds || []
        if (effectiveMessage.taskId) {
          const sourceTask = getTaskById(effectiveMessage.taskId)
          const taskId = ensureTaskForContext(contextId, sourceTask || {
            id: effectiveMessage.taskId,
            message: effectiveMessage.text || "Task captured from message",
            assigned_to: [],
            status: "pending",
            created_by: effectiveMessage.userId,
            timestamp: effectiveMessage.timestamp,
            sourceMessageId: effectiveMessage.id,
          })
          if (taskId) {
            withDerived = appendContextActivity(withDerived, {
              id: `activity-task-added-${taskId}-${Date.now()}`,
              type: "task_added",
              userId: currentUser.id,
              taskId,
              timestamp: now,
            })
            derivedTaskIds = Array.from(new Set([...(withDerived.taskIds || []), taskId]))
          }
        }
        return {
          ...withDerived,
          linkedMessageIds: Array.from(new Set([...(withDerived.linkedMessageIds || []), messageId])),
          linkedFileIds: Array.from(new Set([...(withDerived.linkedFileIds || []), ...attachmentIds])),
          decisionIds: decisionId ? Array.from(new Set([...(withDerived.decisionIds || []), decisionId])) : withDerived.decisionIds || [],
          taskIds: derivedTaskIds,
        }
      })
    )
    setMessageContextPicker(null)
    setSelectedMessageIds(prev => Array.from(new Set([...prev.filter(id => String(id) !== String(messageId)), messageId])))
  }

  useEffect(() => {
    const activeChatId = getActiveChatId()
    if (!activeChatId || (activeView !== "channel" && activeView !== "dm") || currentMessages.length === 0) return

    setContextItems(prev => {
      let changed = false
      const nextItems = prev.map(context => {
        if (String(context.channelId) !== String(activeChatId)) return context

        const linkedMessages = currentMessages.filter(message =>
          (message.contextIds || []).some(contextId => String(contextId) === String(context.id))
        )

        if (!linkedMessages.length) return context

        const linkedMessageIds = Array.from(new Set(linkedMessages.map(message => message.id)))
        const linkedFileIds = Array.from(new Set(
          linkedMessages.flatMap(message => (message.attachments || []).map(att => getAttachmentCacheKey(att) || att.name).filter(Boolean))
        ))
        const contributorIds = Array.from(new Set([
          ...(context.contributorIds || []),
          ...linkedMessages.map(message => message.userId).filter(Boolean),
        ]))

        const hasSameMessages =
          linkedMessageIds.length === (context.linkedMessageIds || []).length &&
          linkedMessageIds.every(messageId => (context.linkedMessageIds || []).some(existingId => String(existingId) === String(messageId)))
        const hasSameFiles =
          linkedFileIds.length === (context.linkedFileIds || []).length &&
          linkedFileIds.every(fileId => (context.linkedFileIds || []).some(existingId => String(existingId) === String(fileId)))
        const hasSameContributors =
          contributorIds.length === (context.contributorIds || []).length &&
          contributorIds.every(userId => (context.contributorIds || []).some(existingId => String(existingId) === String(userId)))

        if (hasSameMessages && hasSameFiles && hasSameContributors) return context

        changed = true
        return {
          ...context,
          linkedMessageIds,
          linkedFileIds,
          contributorIds,
          updatedAt: context.updatedAt || new Date().toISOString(),
        }
      })

      return changed ? nextItems : prev
    })
  }, [activeView, activeChannel, activeDMUser, currentUser, currentMessages])

  const toggleMessageSelection = messageId => {
    setSelectedMessageIds(prev =>
      prev.some(id => String(id) === String(messageId))
        ? prev.filter(id => String(id) !== String(messageId))
        : [...prev, messageId]
    )
  }

  const openCreateContextModal = messageIds => {
    if (!currentUser) return
    setEditingContextId(null)
    setContextDraft({
      title: "",
      summary: "",
      status: "active",
      ownerId: String(currentUser.id),
      messageIds: Array.from(new Set(messageIds)),
    })
    setMessageActionMenu(null)
  }

  const markMessageDecision = async message => {
    if (!message) return
    const updatedMessage = await patchMessage(message.id, current => ({
      ...current,
      isDecision: !current.isDecision,
    }))
    const nextState = Boolean(updatedMessage?.isDecision)
    const targetContextIds = openContextId
      ? [openContextId]
      : (updatedMessage?.contextIds || [])
    if (nextState) {
      targetContextIds.forEach(contextId => {
        const decisionId = ensureDecisionForContext(contextId, updatedMessage)
        if (!decisionId) return
        setContextItems(prev =>
          prev.map(context =>
            String(context.id) === String(contextId)
              ? {
                  ...appendContextActivity(context, {
                    id: `activity-decision-${decisionId}-${Date.now()}`,
                    type: "decision_added",
                    userId: currentUser.id,
                    decisionId,
                    timestamp: new Date().toISOString(),
                  }),
                  decisionIds: Array.from(new Set([...(context.decisionIds || []), decisionId])),
                }
              : context
          )
        )
      })
    } else {
      const removedDecisionIds = contextDecisions
        .filter(item => String(item.messageId) === String(message.id))
        .map(item => item.id)
      setContextDecisions(prev => prev.filter(item => String(item.messageId) !== String(message.id)))
      setContextItems(prev =>
        prev.map(context => ({
          ...context,
          decisionIds: (context.decisionIds || []).filter(decisionId => !removedDecisionIds.includes(decisionId)),
        }))
      )
    }
    setMessageActionMenu(null)
  }

  const openTaskFromMessage = message => {
    const source = activeView === "channel" || (activeView === "contexts" && contextsSourceView === "channel") ? "channel" : "tasks_section"
    setTaskModalDraft({
      source,
      channelId: source === "channel" ? activeChannel : null,
      channelName: source === "channel" ? activeChannelData?.name || "" : "",
      spaceName: currentSpace?.name || "",
      sourceMessageId: message.id,
      initialTaskText: message.text || "",
      initialAssignees: [],
      contextId: openContextId || (message.contextIds || [])[0] || null,
    })
    setShowTaskModal(true)
    setMessageActionMenu(null)
  }

  const currentChannelFiles = useMemo(
    () =>
      currentMessages
        .flatMap(message =>
          (message.attachments || []).map((att, index) => ({
            id: `${message.id}-${att.fileId || att.id || index}`,
            name: att.name || "Attachment",
            messageId: message.id,
            messageLabel: message.text || "Shared in channel",
            sourceLabel: att.source || "chat",
            fileId: getAttachmentCacheKey(att) || att.driveId || att.name,
            author: getUser(message.userId)?.name || "Unknown",
            timestamp: message.timestamp,
            url: att.url || att.public_url || att.webViewLink || null,
            mimeType: att.type || att.mimeType || att.mimetype || "",
            size: att.size || 0,
            canDelete: canDeleteMessage(message),
          }))
        )
        .sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0
          return timeB - timeA
        }),
    [currentMessages, usersById, currentUser, activeView, contextsSourceView, activeChannelData, currentSpace]
  )

  const currentChannelDecisionItems = useMemo(
    () =>
      currentMessages
        .filter(message => message.isDecision)
        .map(message => ({
          id: `decision-inline-${message.id}`,
          messageId: message.id,
          text: message.text || "Decision captured",
          author: getUser(message.userId)?.name || "Unknown",
          createdAt: message.timestamp,
        })),
    [currentMessages, usersById]
  )

  const openDeleteChannelFileConfirm = file => {
    if (!file?.canDelete) return
    const chatId = getActiveChatId()
    if (!chatId || !file.messageId || !file.fileId) return
    setShowDeleteConfirm({
      type: "file",
      id: file.fileId,
      chatId,
      messageId: file.messageId,
      fileName: file.name || "Attachment",
    })
  }

  const openContext = contextId => {
    if ((activeView === "channel" || activeView === "dm") && activeChannelTab === "contexts") {
      setOpenContextId(contextId)
      setMessageActionMenu(null)
      setMessageContextPicker(null)
      return
    }

    openContextsPage(contextId)
    setMessageActionMenu(null)
    setMessageContextPicker(null)
  }

  const closeContextsPage = React.useCallback(() => {
    setOpenContextId(null)
    setActiveChannelTab("messages")

    if (dedicatedPageReturn?.view === "channel" || dedicatedPageReturn?.view === "dm") {
      pushAppRoute(restoreFromDedicatedPage())
      return
    }

    if (contextsSourceView === "dm") {
      setActiveView("dm")
    } else {
      setActiveView("channel")
    }
    pushAppRoute("/")
  }, [contextsSourceView, dedicatedPageReturn, restoreFromDedicatedPage])

  const currentContext = useMemo(
    () => (openContextId ? contextItems.find(context => String(context.id) === String(openContextId)) || null : null),
    [openContextId, contextItems]
  )

  const currentContextFiles = useMemo(
    () => {
      if (!currentContext) return []

      const linkedFileIds = new Set((currentContext.linkedFileIds || []).map(fileId => String(fileId)))
      const linkedMessageIds = new Set((currentContext.linkedMessageIds || []).map(messageId => String(messageId)))

      currentMessages.forEach(message => {
        if ((message.contextIds || []).some(contextId => String(contextId) === String(currentContext.id))) {
          linkedMessageIds.add(String(message.id))
        }
      })

      const seen = new Set()
      return currentChannelFiles.filter(file => {
        const fileKeys = [file.fileId, file.id, file.url, file.name].filter(value => value !== undefined && value !== null).map(value => String(value))
        const isAttachedToContext =
          linkedMessageIds.has(String(file.messageId)) ||
          fileKeys.some(fileKey => linkedFileIds.has(fileKey))

        if (!isAttachedToContext) return false

        const dedupeKey = file.fileId || file.id || file.url || `${file.messageId}-${file.name}`
        if (seen.has(String(dedupeKey))) return false
        seen.add(String(dedupeKey))
        return true
      })
    },
    [currentContext, currentChannelFiles, currentMessages]
  )

  const currentContextDecisions = useMemo(
    () => currentContext
      ? contextDecisions.filter(item =>
          String(item.contextId) === String(currentContext.id) ||
          (currentContext.decisionIds || []).some(decisionId => String(decisionId) === String(item.id))
        )
      : [],
    [currentContext, contextDecisions]
  )

  const currentContextTasks = useMemo(
    () => currentContext
      ? contextTasks.filter(item =>
          String(item.contextId) === String(currentContext.id) ||
          (currentContext.taskIds || []).some(taskId => String(taskId) === String(item.id))
        )
      : [],
    [currentContext, contextTasks]
  )

  const currentContextMessages = useMemo(
    () => currentContext
      ? Array.from(new Set([
          ...(currentContext.linkedMessageIds || []).map(messageId => String(messageId)),
          ...currentMessages
            .filter(message =>
              (message.contextIds || []).some(contextId => String(contextId) === String(currentContext.id))
            )
            .map(message => String(message.id)),
        ]))
          .map(messageId => getMessageById(messageId))
          .filter(Boolean)
          .map(message => {
            const author = getUser(message.userId)
            return {
              ...message,
              id: message.id,
              text: message.text,
              timestamp: message.timestamp,
              author: author?.name || "Unknown",
              authorAvatar: author?.avatar_url || author?.profileImage || author?.profile_image || author?.avatarUrl || "",
              authorInitials: String(author?.name || message.userName || "Unknown").trim().slice(0, 2).toUpperCase(),
            }
          })
      : [],
    [currentContext, currentMessages, usersById]
  )

  const currentContextActivity = currentContext
    ? (currentContext.activity || []).map(item => {
        const actor = getUser(item.userId)?.name || "Someone"
        if (item.type === "created") return { ...item, label: `${actor} created this context` }
        if (item.type === "message_added") return { ...item, label: `${actor} linked a message` }
        if (item.type === "decision_added") return { ...item, label: `${actor} added a decision` }
        if (item.type === "task_added") return { ...item, label: `${actor} added a task` }
        if (item.type === "file_added") return { ...item, label: `${actor} linked a file` }
        if (item.type === "status_changed") return { ...item, label: `${actor} changed status to ${item.to}` }
        return { ...item, label: `${actor} updated context` }
      })
    : []

  const saveMessageScrollPosition = (chatId = getActiveChatId()) => {
    const container = messagesContainerRef.current
    if (!chatId || !container) return
    const threshold = (messageInputRef.current?.offsetHeight || 64) + 16
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    messageScrollPositionsRef.current[String(chatId)] = container.scrollTop
    messageScrollStateRef.current[String(chatId)] = {
      scrollTop: container.scrollTop,
      atBottom,
    }
    prevScrollHeightRef.current = container.scrollHeight
  }

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current
    if (!container) return

    const activeChat = getActiveChatId()
    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight

    if (activeChat) {
      const chatKey = String(activeChat)
      messageScrollPositionsRef.current[chatKey] = scrollTop
      const threshold = (messageInputRef.current?.offsetHeight || 64) + 16
      messageScrollStateRef.current[chatKey] = {
        scrollTop,
        atBottom: scrollHeight - scrollTop - container.clientHeight < threshold,
      }
    }
    prevScrollHeightRef.current = scrollHeight

    if (messageScrollRafRef.current) return
    messageScrollRafRef.current = requestAnimationFrame(() => {
      messageScrollRafRef.current = null
      const latestContainer = messagesContainerRef.current
      if (!latestContainer) return
      const threshold = (messageInputRef.current?.offsetHeight || 64) + 16
      const atBottom =
        latestContainer.scrollHeight - latestContainer.scrollTop - latestContainer.clientHeight < threshold
      if (isAtBottomRef.current !== atBottom) {
        setIsAtBottomFast(atBottom)
      }
    })
  }

  const handleChannelTabChange = nextTab => {
    const activeChatId = getActiveChatId()
    if ((activeView === "channel" || activeView === "dm") && activeChatId) {
      if (activeChannelTab === "messages" && nextTab !== "messages") {
        saveMessageScrollPosition(activeChatId)
      }

      if (activeChannelTab !== "messages" && nextTab === "messages") {
        pendingTabScrollRestoreRef.current = String(activeChatId)
      } else if (nextTab !== "messages") {
        pendingTabScrollRestoreRef.current = null
      }
    }

    if (nextTab !== "contexts") {
      setOpenContextId(null)
    }

    setActiveChannelTab(nextTab)
  }

  useEffect(() => {
    if (activeView !== "channel" && activeView !== "dm") return
    const activeChatId = getActiveChatId()
    if (!activeChatId) return

    const previousTab = previousChannelTabRef.current
    if (previousTab === "messages" && activeChannelTab !== "messages") {
      saveMessageScrollPosition(activeChatId)
    }

    if (previousTab !== "messages" && activeChannelTab === "messages") {
      restoreMessageScrollRef.current = true
    }

    previousChannelTabRef.current = activeChannelTab
  }, [activeChannelTab, activeView, activeChannel, activeDMUser])

  useLayoutEffect(() => {
    if (activeChannelTab !== "messages") return
    const activeChatId = getActiveChatId()
    if (!activeChatId) return
    const activeChatKey = String(activeChatId)

    const shouldRestore =
      restoreMessageScrollRef.current ||
      pendingTabScrollRestoreRef.current === activeChatKey
    if (!shouldRestore) return
    if (!Object.prototype.hasOwnProperty.call(messages, activeChatKey)) return

    const savedState = messageScrollStateRef.current[activeChatKey] || null
    const savedScrollTop =
      savedState && typeof savedState.scrollTop === "number"
        ? savedState.scrollTop
        : messageScrollPositionsRef.current[activeChatKey]
    let frame = null
    frame = requestAnimationFrame(() => {
      const container = messagesContainerRef.current
      if (container) {
        if (savedState?.atBottom) {
          container.scrollTop = container.scrollHeight
          setIsAtBottomFast(true)
        } else if (typeof savedScrollTop === "number") {
          container.scrollTop = savedScrollTop
          const threshold = (messageInputRef.current?.offsetHeight || 64) + 16
          const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
          setIsAtBottomFast(atBottom)
        } else {
          container.scrollTop = container.scrollHeight
          setIsAtBottomFast(true)
        }
        prevScrollHeightRef.current = container.scrollHeight
      }
      restoreMessageScrollRef.current = false
      pendingTabScrollRestoreRef.current = null
    })

    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [activeChannelTab, activeChannel, activeDMUser, messages])

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
    setCollapsedSpaceMenu(null)
    setChannelActionMenu(null)
    // When navigating to a channel, collapse the friends sidebar for focused view
    setFriendsSidebarCollapsed(true)
    if (isMobile) setMobileView("chat")
  } else {
    setShowAccessDeniedModal(true)
  }
}

  const starredMessageKeySet = useMemo(
    () => new Set((starredMessages || []).map(item => String(item?.messageId))),
    [starredMessages]
  )

  const selectedStarredMessage = useMemo(() => {
    const list = Array.isArray(starredMessages) ? starredMessages : []
    if (list.length === 0) return null
    return list.find(item => getStarredItemKey(item) === activeStarredMessageId) || list[0]
  }, [activeStarredMessageId, starredMessages])

  useEffect(() => {
    const list = Array.isArray(starredMessages) ? starredMessages : []
    if (list.length === 0) {
      setActiveStarredMessageId(null)
      return
    }

    setActiveStarredMessageId(currentKey =>
      currentKey && list.some(item => getStarredItemKey(item) === currentKey)
        ? currentKey
        : getStarredItemKey(list[0])
    )
  }, [starredMessages])

  const pinnedChannelIdSet = useMemo(
    () => new Set((pinnedChannels || []).map(item => String(item?.channelId))),
    [pinnedChannels]
  )

  const findSpaceAndChannel = useCallback(channelId => {
    for (const space of spaces || []) {
      const channel = (space.channels || []).find(item => String(item.id) === String(channelId))
      if (channel) return { space, channel }
    }
    return { space: null, channel: null }
  }, [spaces])

  const buildOptimisticStarredItem = useCallback(message => {
    if (!message?.id) return null
    const resolvedView = activeView === "contexts" ? contextsSourceView : activeView
    const chatId =
      resolvedView === "channel"
        ? activeChannel
        : resolvedView === "dm" && activeDMUser && currentUser
          ? getDMChatId(activeDMUser)
          : null
    const match = resolvedView === "channel" ? findSpaceAndChannel(activeChannel) : { space: null, channel: null }
    const messageUserId = message.userId || message.senderId || message.createdBy
    const senderName =
      message.userName ||
      message.senderName ||
      message.sender?.name ||
      (String(messageUserId) === String(currentUser?.id) ? currentUser?.name : null) ||
      "Unknown user"

    return {
      id: `${chatId || "message"}:${message.id}`,
      messageId: message.id,
      chatId,
      message,
      sender: {
        id: messageUserId || currentUser?.id,
        name: senderName,
      },
      spaceId: match.space?.id || null,
      spaceName: match.space?.name || (resolvedView === "dm" ? "Direct messages" : null),
      channelId: match.channel?.id || chatId,
      channelName: match.channel?.name || (resolvedView === "dm" ? "Direct message" : null),
      createdAt: new Date().toISOString(),
      optimistic: true,
    }
  }, [activeChannel, activeDMUser, activeView, contextsSourceView, currentUser, findSpaceAndChannel])

  const buildOptimisticPinnedChannel = useCallback(channelId => {
    const { space, channel } = findSpaceAndChannel(channelId)
    if (!space || !channel) return null
    return {
      id: `${space.id}:${channel.id}`,
      spaceId: space.id,
      spaceName: space.name,
      channelId: channel.id,
      channelName: channel.name,
      createdAt: new Date().toISOString(),
      optimistic: true,
    }
  }, [findSpaceAndChannel])

  const openChannelActionMenu = useCallback((event, space, channel) => {
    if (!space || !channel) return
    event?.preventDefault?.()
    event?.stopPropagation?.()
    event?.nativeEvent?.stopImmediatePropagation?.()

    const rect = event?.currentTarget?.getBoundingClientRect?.()
    const menuWidth = 176
    const maxLeft = Math.max(12, window.innerWidth - menuWidth - 12)
    const left = rect
      ? Math.min(maxLeft, Math.max(12, rect.right - menuWidth))
      : 12
    const top = rect ? Math.max(12, Math.min(window.innerHeight - 180, rect.bottom + 8)) : 72

    setChannelActionMenu(prev => {
      const sameTarget =
        prev &&
        String(prev.spaceId) === String(space.id) &&
        String(prev.channelId) === String(channel.id)

      if (sameTarget) return null

      return {
        spaceId: space.id,
        spaceName: space.name,
        channelId: channel.id,
        channelName: channel.name,
        canManageChannel: String(space.ownerId) === String(currentUser?.id),
        top,
        left,
      }
    })
  }, [currentUser?.id])

  const loadTimesavers = useCallback(async () => {
    if (!currentUser?.id) return
    setTimesaversLoading(true)
    try {
      const [starred, pinned] = await Promise.all([
        Storage.getStarredMessages(),
        Storage.getPinnedChannels(),
      ])
      setStarredMessages(Array.isArray(starred) ? starred : [])
      setPinnedChannels(Array.isArray(pinned) ? pinned : [])
    } catch (error) {
      console.error("Failed to load timesavers", error)
    } finally {
      setTimesaversLoading(false)
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return
    loadTimesavers()
  }, [currentUser?.id, isAuthenticated, loadTimesavers])

  const openStarredMessages = useCallback(() => {
    setOpenContextId(null)
    setShowMobileDrawer(false)
    setActiveView("starred")
    pushAppRoute("/starred")
    if (isMobile) setMobileView("chat")
  }, [isMobile])

  const openNotificationsPage = useCallback(() => {
    setOpenContextId(null)
    setShowMobileDrawer(false)
    setShowNotificationsModal(false)
    setActiveView("notifications")
    pushAppRoute("/notifications")
    if (isMobile) setMobileView("chat")
  }, [isMobile])

  const applyStarredRealtimeUpdate = useCallback(data => {
    const action = data?.action
    const payload = data?.payload
    if (!action || !payload) return
    if (data.kind === "starred_messages") {
      setStarredMessages(prev => {
        const list = Array.isArray(prev) ? prev : []
        if (action === "unstar") {
          return list.filter(item => String(item.messageId) !== String(payload.messageId))
        }
        if (action === "star" && payload.messageId) {
          return [payload, ...list.filter(item => String(item.messageId) !== String(payload.messageId))]
        }
        return list
      })
    } else if (data.kind === "pinned_channels") {
      setPinnedChannels(prev => {
        const list = Array.isArray(prev) ? prev : []
        if (action === "unpin") {
          return list.filter(item => String(item.channelId) !== String(payload.channelId))
        }
        if (action === "pin" && payload.channelId) {
          return [payload, ...list.filter(item => String(item.channelId) !== String(payload.channelId))]
        }
        return list
      })
    }
  }, [])

  const toggleMessageStar = useCallback(async message => {
    if (!message?.id) return
    const messageId = message.id
    const isStarred = starredMessageKeySet.has(String(messageId))
    try {
      if (isStarred) {
        setStarredMessages(prev => (prev || []).filter(item => String(item.messageId) !== String(messageId)))
        await Storage.unstarMessage(messageId)
      } else {
        const optimisticItem = buildOptimisticStarredItem(message)
        if (optimisticItem) {
          setStarredMessages(prev => [optimisticItem, ...(prev || []).filter(existing => String(existing.messageId) !== String(messageId))])
        }
        const item = await Storage.starMessage(messageId)
        if (item) {
          setStarredMessages(prev => [item, ...(prev || []).filter(existing => String(existing.messageId) !== String(item.messageId))])
        } else if (!optimisticItem) {
          await loadTimesavers()
        }
      }
    } catch (error) {
      console.error("Failed to toggle star", error)
      await loadTimesavers()
      if (error?.status === 403) setShowAccessDeniedModal(true)
    }
  }, [buildOptimisticStarredItem, loadTimesavers, starredMessageKeySet])

  const toggleChannelPin = useCallback(async (channelId) => {
    if (!channelId) return
    setChannelActionMenu(null)
    setMessageActionMenu(null)
    setMessageContextPicker(null)
    setComposerAttachMenuOpen(false)
    setComposerContextPickerOpen(false)
    const isPinned = pinnedChannelIdSet.has(String(channelId))
    try {
      if (isPinned) {
        setPinnedChannels(prev => (prev || []).filter(item => String(item.channelId) !== String(channelId)))
        await Storage.unpinChannel(channelId)
      } else {
        const optimisticItem = buildOptimisticPinnedChannel(channelId)
        if (optimisticItem) {
          setPinnedChannels(prev => [optimisticItem, ...(prev || []).filter(existing => String(existing.channelId) !== String(channelId))])
        }
        const item = await Storage.pinChannel(channelId)
        if (item) {
          setPinnedChannels(prev => [item, ...(prev || []).filter(existing => String(existing.channelId) !== String(item.channelId))])
        } else if (!optimisticItem) {
          await loadTimesavers()
        }
      }
    } catch (error) {
      console.error("Failed to toggle channel pin", error)
      await loadTimesavers()
      if (error?.status === 403) setShowAccessDeniedModal(true)
    }
  }, [buildOptimisticPinnedChannel, loadTimesavers, pinnedChannelIdSet])

  const openStarredMessage = useCallback(item => {
    if (!item) return
    const messageId = item.messageId
    const chatId = item.chatId || item.channelId

    if (item.spaceId && item.channelId) {
      handleChannelNavigation(item.spaceId, item.channelId)
    } else if (typeof chatId === "string" && chatId.startsWith("dm_")) {
      const parts = chatId.split("_")
      const otherUserId = parts.find(part => part && part !== "dm" && String(part) !== String(currentUser?.id))
      if (otherUserId) {
        setActiveDMUser(otherUserId)
        setHomeActiveDMUser(otherUserId)
        setActiveView("dm")
        setFriendsSidebarCollapsed(false)
      }
    }

    if (messageId) {
      setHighlightTerm("")
      setTargetMessageId(messageId)
      setPinnedMessageId(messageId)
    }
    if (isMobile) setMobileView("chat")
  }, [currentUser?.id, handleChannelNavigation, isMobile])

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
          const resp = await fetch(`${API_BASE}/upload/file`, { method: 'POST', credentials: "include", body: form, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
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

  const COMPOSER_EMPTY_MARKER = "\u200B"

  const escapeHtml = value =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")

  const normalizeComposerUrl = value => {
    const trimmed = String(value || "").trim()
    if (!trimmed) return ""
    if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed
    return `https://${trimmed.replace(/^\/+/, "")}`
  }

  const markdownInlineToComposerHtml = value => {
    const tokenPattern = /(\*\*[^*]+\*\*|~~[^~]+~~|<u>[\s\S]*?<\/u>|`[^`]+`|\[[^\]]+\]\([^)]+\)|_[^_]+_)/g
    const text = String(value || "")
    let html = ""
    let cursor = 0
    let match

    while ((match = tokenPattern.exec(text)) !== null) {
      html += escapeHtml(text.slice(cursor, match.index))
      const token = match[0]

      if (token.startsWith("**") && token.endsWith("**")) {
        html += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`
      } else if (token.startsWith("~~") && token.endsWith("~~")) {
        html += `<s>${escapeHtml(token.slice(2, -2))}</s>`
      } else if (token.startsWith("<u>") && token.endsWith("</u>")) {
        html += `<u>${escapeHtml(token.slice(3, -4))}</u>`
      } else if (token.startsWith("`") && token.endsWith("`")) {
        html += `<code>${escapeHtml(token.slice(1, -1))}</code>`
      } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
        const labelEnd = token.indexOf("](")
        const label = token.slice(1, labelEnd)
        const href = normalizeComposerUrl(token.slice(labelEnd + 2, -1))
        html += href
          ? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
          : escapeHtml(label)
      } else if (token.startsWith("_") && token.endsWith("_")) {
        html += `<em>${escapeHtml(token.slice(1, -1))}</em>`
      }

      cursor = match.index + token.length
    }

    html += escapeHtml(text.slice(cursor))
    return html
  }

  const markdownToComposerHtml = value => {
    const text = String(value || "")
    if (!text) return ""
    const segments = text.split(/```([\s\S]*?)```/g)

    return segments
      .map((segment, index) => {
        if (index % 2 === 1) {
          return `<pre><code>${escapeHtml(segment.replace(/^\n|\n$/g, ""))}</code></pre>`
        }

        const lines = segment.split("\n")
        let html = ""
        let openList = null

        const closeList = () => {
          if (openList) {
            html += `</${openList}>`
            openList = null
          }
        }

        lines.forEach(line => {
          const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/)
          const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/)

          if (orderedMatch || bulletMatch) {
            const listTag = orderedMatch ? "ol" : "ul"
            if (openList !== listTag) {
              closeList()
              html += `<${listTag}>`
              openList = listTag
            }
            html += `<li>${markdownInlineToComposerHtml(orderedMatch ? orderedMatch[1] : bulletMatch[1])}</li>`
            return
          }

          closeList()
          html += line ? `<div>${markdownInlineToComposerHtml(line)}</div>` : "<div><br></div>"
        })

        closeList()
        return html
      })
      .join("")
  }

  const composerNodeToMarkdown = node => {
    if (!node) return ""
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue.replaceAll(COMPOSER_EMPTY_MARKER, "")
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ""

    const tag = node.tagName.toLowerCase()
    const childMarkdown = () => Array.from(node.childNodes).map(composerNodeToMarkdown).join("")

    if (tag === "br") return "\n"
    if (tag === "strong" || tag === "b") {
      const content = childMarkdown()
      return content ? `**${content}**` : ""
    }
    if (tag === "em" || tag === "i") {
      const content = childMarkdown()
      return content ? `_${content}_` : ""
    }
    if (tag === "u") {
      const content = childMarkdown()
      return content ? `<u>${content}</u>` : ""
    }
    if (tag === "s" || tag === "strike" || tag === "del") {
      const content = childMarkdown()
      return content ? `~~${content}~~` : ""
    }
    if (tag === "a") {
      const label = childMarkdown()
      const href = normalizeComposerUrl(node.getAttribute("href"))
      return label && href ? `[${label}](${href})` : label
    }
    if (tag === "code" && node.parentElement?.tagName?.toLowerCase() !== "pre") {
      const content = childMarkdown()
      return content ? `\`${content}\`` : ""
    }
    if (tag === "pre") {
      const code = node.textContent.replaceAll(COMPOSER_EMPTY_MARKER, "").replace(/\n$/g, "")
      return code ? `\`\`\`\n${code}\n\`\`\`\n` : ""
    }
    if (tag === "ol" || tag === "ul") {
      const items = Array.from(node.children)
        .filter(child => child.tagName?.toLowerCase() === "li")
        .map(child => composerNodeToMarkdown(child).replace(/\n+$/g, ""))
        .filter(item => item.trim())
        .map((item, index) => {
          const marker = tag === "ol" ? `${index + 1}. ` : "- "
          return `${marker}${item}`
        })
      return items.length ? `${items.join("\n")}\n` : ""
    }
    if (tag === "blockquote") {
      return childMarkdown()
        .split("\n")
        .filter(Boolean)
        .map(line => `> ${line}`)
        .join("\n")
    }
    if (tag === "li") return childMarkdown()
    if (tag === "div" || tag === "p") return `${childMarkdown()}\n`

    return childMarkdown()
  }

  const getComposerMarkdown = () => {
    const editor = composerEditorRef.current
    if (!editor) return messageInput
    return Array.from(editor.childNodes)
      .map(composerNodeToMarkdown)
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\s+$/g, "")
  }

  const syncComposerInputFromEditor = () => {
    const nextValue = getComposerMarkdown()
    composerLastValueRef.current = nextValue
    setMessageInput(nextValue)
    setComposerIsEmpty(!nextValue.trim())
    window.requestAnimationFrame?.(refreshComposerFormatState)
    return nextValue
  }

  const resetComposerEditor = () => {
    const editor = composerEditorRef.current
    if (editor) editor.innerHTML = ""
    composerLastValueRef.current = ""
    setMessageInput("")
    setComposerIsEmpty(true)
    setActiveComposerFormats({})
  }

  const selectComposerRange = (node, offset = 0) => {
    const selection = window.getSelection?.()
    if (!selection) return
    const range = document.createRange()
    range.setStart(node, offset)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const ensureComposerRange = () => {
    const editor = composerEditorRef.current
    if (!editor) return null
    editor.focus()

    const selection = window.getSelection?.()
    if (selection?.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) {
      return selection.getRangeAt(0)
    }

    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
    return range
  }

  const insertComposerInlineElement = tagName => {
    const range = ensureComposerRange()
    if (!range) return

    const element = document.createElement(tagName)
    if (range.collapsed) {
      const marker = document.createTextNode(COMPOSER_EMPTY_MARKER)
      element.appendChild(marker)
      range.insertNode(element)
      selectComposerRange(marker, marker.length)
      return
    }

    element.appendChild(range.extractContents())
    range.insertNode(element)

    const selection = window.getSelection?.()
    const nextRange = document.createRange()
    nextRange.selectNodeContents(element)
    selection?.removeAllRanges()
    selection?.addRange(nextRange)
  }

  const applyComposerLink = () => {
    const range = ensureComposerRange()
    if (!range) return

    const href = normalizeComposerUrl(window.prompt("Enter link URL", "https://") || "")
    if (!href) return

    if (range.collapsed) {
      const anchor = document.createElement("a")
      anchor.href = href
      const marker = document.createTextNode(COMPOSER_EMPTY_MARKER)
      anchor.appendChild(marker)
      range.insertNode(anchor)
      selectComposerRange(marker, marker.length)
      syncComposerInputFromEditor()
      return
    }

    const selection = window.getSelection?.()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.execCommand("createLink", false, href)
    syncComposerInputFromEditor()
  }

  const applyComposerCodeBlock = () => {
    const range = ensureComposerRange()
    if (!range) return

    if (!range.collapsed) {
      const pre = document.createElement("pre")
      const code = document.createElement("code")
      code.textContent = range.toString()
      pre.appendChild(code)
      range.deleteContents()
      range.insertNode(pre)

      const selection = window.getSelection?.()
      const nextRange = document.createRange()
      nextRange.setStartAfter(pre)
      nextRange.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(nextRange)
      syncComposerInputFromEditor()
      return
    }

    document.execCommand("formatBlock", false, "pre")
    syncComposerInputFromEditor()
  }

  const runComposerCommand = (command, value = null) => {
    if (!ensureComposerRange()) return
    document.execCommand(command, false, value)
    syncComposerInputFromEditor()
  }

  const applyComposerFormat = format => {
    switch (format) {
      case "bold":
        runComposerCommand("bold")
        break
      case "italic":
        runComposerCommand("italic")
        break
      case "underline":
        runComposerCommand("underline")
        break
      case "strike":
        runComposerCommand("strikeThrough")
        break
      case "link":
        applyComposerLink()
        break
      case "ordered-list":
        runComposerCommand("insertOrderedList")
        break
      case "bullet-list":
        runComposerCommand("insertUnorderedList")
        break
      case "quote":
        runComposerCommand("formatBlock", "blockquote")
        break
      case "inline-code":
        insertComposerInlineElement("code")
        syncComposerInputFromEditor()
        break
      case "code-block":
        applyComposerCodeBlock()
        break
      default:
        break
    }
    window.requestAnimationFrame?.(refreshComposerFormatState)
  }

  useEffect(() => {
    const editor = composerEditorRef.current
    if (!editor) return

    const editorHasSyncedContent = messageInput
      ? Boolean(editor.innerHTML)
      : !editor.textContent?.replaceAll(COMPOSER_EMPTY_MARKER, "").trim()

    if (messageInput === composerLastValueRef.current && editorHasSyncedContent) return

    editor.innerHTML = markdownToComposerHtml(messageInput)
    composerLastValueRef.current = messageInput
    setComposerIsEmpty(!messageInput.trim())
  }, [messageInput, activeView, activeChannel, activeDMUser])

  const sendMessage = async () => {
    const composerText = syncComposerInputFromEditor()
    if ((!composerText.trim() && selectedFiles.length === 0) || !currentUser)
      return
    const chatId = getActiveChatId()
    if (!chatId) return

    const attachments = selectedFiles.map(file => ({ ...file }))
    const tempId = createClientId("tmp")
    const selectedContextIds = selectedComposerContext ? [selectedComposerContext.id] : []
    const newMsg = {
      id: tempId,
      userId: currentUser.id,
      text: composerText,
      timestamp: new Date().toISOString(),
      reactions: {},
      thread: [],
      contextIds: selectedContextIds,
      isDecision: false,
      taskId: null,
      attachments,
      status: "sending",
      optimistic: true
    }

    setMessages(prev => ({
      ...prev,
      [chatId]: dedupeMessagesById([...(prev[chatId] || []), newMsg])
    }))
    resetComposerEditor()
    setSelectedFiles([])
    setSelectedComposerContextId(null)
    setComposerContextPickerOpen(false)
    if (activeDraftId) {
      deleteDraftById(activeDraftId)
    }

    if (selectedContextIds.length > 0) {
      const activityTimestamp = newMsg.timestamp
      setContextItems(prev =>
        prev.map(context =>
          selectedContextIds.some(contextId => String(contextId) === String(context.id))
            ? {
                ...appendContextActivity(context, {
                  id: `activity-message-${tempId}-${Date.now()}`,
                  type: "message_added",
                  userId: currentUser.id,
                  messageId: tempId,
                  timestamp: activityTimestamp,
                }),
                linkedMessageIds: Array.from(new Set([...(context.linkedMessageIds || []), tempId])),
              }
            : context
        )
      )
    }

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
    openAttachmentPreview(att)
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
      try {
        const a = document.createElement("a")
        a.href = att.previewUrl
        a.download = att.name || "attachment"
        document.body.appendChild(a)
        a.click()
        a.remove()
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

  const createSpace = () => {
    const spaceName = newSpaceName.trim()
    if (!spaceName || !currentUser) return
    const createdAt = Date.now()
    const newSpace = {
      id: createdAt,
      name: spaceName,
      iconType: getSpaceImageIconType(spaces.length),
      members: [currentUser.id],
      inviteCode: `${spaceName.substring(0, 4).toUpperCase()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`,
      channels: [
        {
          id: createdAt + 1,
          name: "general",
          type: "public",
          members: [currentUser.id],
          roles: { [String(currentUser.id)]: 'owner' }
        },
        {
          id: createdAt + 2,
          name: "random",
          type: "public",
          members: [currentUser.id],
          roles: { [String(currentUser.id)]: 'owner' }
        }
      ],
      expanded: true,
      ownerId: currentUser.id
    }
    const userSpaceIds = Array.isArray(currentUser.spaces) ? currentUser.spaces : []
    const updatedUser = {
      ...currentUser,
      spaces: [...userSpaceIds, newSpace.id]
    }

    setSpaces(prev => {
      const arr = Array.isArray(prev) ? [...prev] : []
      return [...arr, { ...newSpace, icon: getSpaceIconElement(newSpace.iconType) }]
    })
    setCurrentUser(updatedUser)
    setShowCreateSpaceModal(false)
    setNewSpaceName("")

    void Storage.saveSpace(newSpace)
      .then(savedSpace => {
        if (!savedSpace) return
        setSpaces(prev =>
          (Array.isArray(prev) ? prev : []).map(space =>
            String(space.id) === String(newSpace.id)
              ? {
                  ...savedSpace,
                  icon: getSpaceIconElement(savedSpace.iconType),
                  expanded: space.expanded ?? savedSpace.expanded
                }
              : space
          )
        )
      })
      .catch(error => {
        console.error("Failed to create space", error)
        setSpaces(prev =>
          (Array.isArray(prev) ? prev : []).filter(space => String(space.id) !== String(newSpace.id))
        )
        setCurrentUser(prev =>
          prev
            ? {
                ...prev,
                spaces: (Array.isArray(prev.spaces) ? prev.spaces : []).filter(
                  spaceId => String(spaceId) !== String(newSpace.id)
                )
              }
            : prev
        )
      })
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
      setPinnedChannels(prev =>
        (prev || []).map(item =>
          String(item.spaceId) === String(showRenameModal.id)
            ? { ...item, spaceName: newNameInput }
            : item
        )
      )
    } else if (showRenameModal.type === "channel") {
      const targetSpaceId = showRenameModal.spaceId || activeSpace
      if (!targetSpaceId) return
      await Storage.renameChannel(targetSpaceId, showRenameModal.id, newNameInput)
      setSpaces(prev =>
        prev.map(s => {
          if (String(s.id) === String(targetSpaceId)) {
            const newChannels = s.channels.map(c =>
              String(c.id) === String(showRenameModal.id) ? { ...c, name: newNameInput } : c
            )
            return { ...s, channels: newChannels }
          }
          return s
        })
      )
      setPinnedChannels(prev =>
        (prev || []).map(item =>
          String(item.channelId) === String(showRenameModal.id)
            ? { ...item, channelName: newNameInput }
            : item
        )
      )
    }
    setShowRenameModal(null)
    setNewNameInput("")
  }

  const handleDelete = async () => {
    const deleteTarget = showDeleteConfirm
    if (!deleteTarget) return
    if (deleteTarget.type === "space") {
      const removedSpace = spaces.find(space => String(space.id) === String(deleteTarget.id))
      const wasActiveSpace = String(activeSpace) === String(deleteTarget.id)

      setShowDeleteConfirm(null)
      setSpaces(prev =>
        (Array.isArray(prev) ? prev : []).filter(space => String(space.id) !== String(deleteTarget.id))
      )
      setCurrentUser(prev =>
        prev
          ? {
              ...prev,
              spaces: (Array.isArray(prev.spaces) ? prev.spaces : []).filter(
                spaceId => String(spaceId) !== String(deleteTarget.id)
              )
            }
          : prev
      )
      if (wasActiveSpace) {
        setActiveSpace(null)
        setActiveChannel(null)
      }

      void Storage.deleteSpace(deleteTarget.id).catch(error => {
        console.error("Failed to delete space", error)
        if (removedSpace) {
          setSpaces(prev => {
            const arr = Array.isArray(prev) ? prev : []
            if (arr.some(space => String(space.id) === String(deleteTarget.id))) return arr
            return [{ ...removedSpace, icon: removedSpace.icon || getSpaceIconElement(removedSpace.iconType) }, ...arr]
          })
        }
        setCurrentUser(prev => {
          if (!prev) return prev
          const existingSpaces = Array.isArray(prev.spaces) ? prev.spaces : []
          if (existingSpaces.some(spaceId => String(spaceId) === String(deleteTarget.id))) return prev
          return { ...prev, spaces: [...existingSpaces, deleteTarget.id] }
        })
        if (wasActiveSpace) {
          setActiveSpace(deleteTarget.id)
          setActiveChannel(removedSpace?.channels?.[0]?.id || null)
        }
      })
      return
    } else if (deleteTarget.type === "channel") {
      const targetSpaceId = deleteTarget.spaceId || activeSpace
      if (!targetSpaceId) return
      const space = spaces.find(s => String(s.id) === String(targetSpaceId))
      const firstRemaining = (space?.channels || []).find(
        c => String(c.id) !== String(deleteTarget.id)
      )

      await Storage.deleteChannel(targetSpaceId, deleteTarget.id)
      setSpaces(prev =>
        prev.map(s => {
          if (String(s.id) === String(targetSpaceId)) {
            return {
              ...s,
              channels: s.channels.filter(c => String(c.id) !== String(deleteTarget.id))
            }
          }
          return s
        })
      )
      setPinnedChannels(prev =>
        (prev || []).filter(item => String(item.channelId) !== String(deleteTarget.id))
      )
      if (String(activeSpace) === String(targetSpaceId) && String(activeChannel) === String(deleteTarget.id)) {
        if (firstRemaining) setActiveChannel(firstRemaining.id)
        else setActiveChannel("")
      }
    } else if (deleteTarget.type === "message" && deleteTarget.chatId) {
      if (!deleteTarget.optimistic) {
        await Storage.deleteMessage(deleteTarget.chatId, deleteTarget.id)
      }
      setMessages(prev => ({
        ...prev,
        [deleteTarget.chatId]: (prev[deleteTarget.chatId] || []).filter(
          message => String(message.id) !== String(deleteTarget.id)
        )
      }))
      if (editingMessageId === deleteTarget.id) {
        cancelEditingMessage()
      }
      if (pinnedMessageId === deleteTarget.id) {
        setPinnedMessageId(null)
      }
      if (targetMessageId === deleteTarget.id) {
        setTargetMessageId(null)
      }
      setSelectedMessageIds(prev =>
        prev.filter(messageId => String(messageId) !== String(deleteTarget.id))
      )
    } else if (deleteTarget.type === "file" && deleteTarget.chatId && deleteTarget.messageId) {
      const attachmentMatches = attachment =>
        [attachment?.id, attachment?.fileId, attachment?.drive_file_id, attachment?.driveId, attachment?.url, attachment?.public_url, attachment?.webViewLink, attachment?.name]
          .some(value => value !== undefined && value !== null && String(value) === String(deleteTarget.id))

      const result = await Storage.deleteMessageAttachment(
        deleteTarget.chatId,
        deleteTarget.messageId,
        deleteTarget.id
      )

      setMessages(prev => ({
        ...prev,
        [deleteTarget.chatId]: (prev[deleteTarget.chatId] || []).flatMap(message => {
          if (String(message.id) !== String(deleteTarget.messageId)) return [message]
          const remaining = (message.attachments || []).filter(attachment => !attachmentMatches(attachment))
          if (result?.messageDeleted || (remaining.length === 0 && !String(message.text || "").trim())) return []
          return [{ ...message, attachments: remaining }]
        }),
      }))
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
    const target = users.find(u => String(u.id) === String(targetId))
    const requestTargetId = target?.id ?? targetId
    if (requestTargetId === undefined || requestTargetId === null || requestTargetId === "") return null
    const pendingKey = String(requestTargetId)
    if (pendingFriendRequestIdsRef.current.has(pendingKey)) return { status: "pending" }

    pendingFriendRequestIdsRef.current.add(pendingKey)
    setPendingFriendRequestIds(prev => (prev.some(id => String(id) === pendingKey) ? prev : [...prev, requestTargetId]))

    let keepPendingState = false
    try {
      const response = await Storage.sendFriendRequest(currentUser.id, currentUser.name, requestTargetId)
      keepPendingState = !["already_connected", "incoming_request", "accepted"].includes(response?.status)
      return response
    } finally {
      pendingFriendRequestIdsRef.current.delete(pendingKey)
      if (!keepPendingState) {
        setPendingFriendRequestIds(prev => prev.filter(id => String(id) !== pendingKey))
      }
    }
  }

  const handleBulkFriendInvite = async () => {
    if (selectedFriendInvitees.length === 0) return
    await Promise.all(selectedFriendInvitees.map(id => sendFriendRequest(id)))

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
    if (pendingNotificationActionIdsRef.current.has(notificationId)) return

    pendingNotificationActionIdsRef.current.add(notificationId)
    setPendingNotificationActionIds(prev => (prev.includes(notificationId) ? prev : [...prev, notificationId]))

    const previousNotifications = currentUser.notifications || []
    try {
      const notif = (currentUser.notifications || []).find(n => String(n.id) === String(notificationId))
      const normalizedType = type === "friend_request" ? "connection_invite" : (type || notif?.type)

      if (normalizedType === "info" || normalizedType?.endsWith?.("_response")) {
        await markNotificationReadLocal(notificationId)
        return
      }

      setCurrentUser(prev => {
        if (!prev) return prev
        return {
          ...prev,
          notifications: (prev.notifications || []).map(notification =>
            String(notification.id) === String(notificationId)
              ? { ...notification, status: "read", actionStatus: "accepted", readAt: new Date().toISOString() }
              : notification
          )
        }
      })

      const result = await Storage.acceptNotification(notificationId)
      await refreshRelationshipState(currentUser.id)

      if (result?.space) {
        const joinedSpace = result.space
        setSpaces(prev => {
          const existing = prev.some(space => String(space.id) === String(joinedSpace.id))
          return existing
            ? prev.map(space => String(space.id) === String(joinedSpace.id) ? { ...joinedSpace, icon: space.icon, expanded: space.expanded } : space)
            : [{ ...joinedSpace, icon: createSpaceIconElement(joinedSpace.iconType), expanded: true }, ...prev]
        })
      }

      setSuccessMessage("Notification accepted")
      setShowSuccessToast(true)
      setNotificationsError("")
    } catch (error) {
      console.error("Failed to accept notification", error)
      setCurrentUser(prev => prev ? { ...prev, notifications: previousNotifications } : prev)
      setNotificationsError(error?.message || "Could not update notification")
    } finally {
      pendingNotificationActionIdsRef.current.delete(notificationId)
      setPendingNotificationActionIds(prev => prev.filter(id => id !== notificationId))
    }
  }

  const handleRejectNotification = async (notificationId, type) => {
    void type
    if (!currentUser) return
    if (pendingNotificationActionIdsRef.current.has(notificationId)) return

    pendingNotificationActionIdsRef.current.add(notificationId)
    setPendingNotificationActionIds(prev => (prev.includes(notificationId) ? prev : [...prev, notificationId]))

    const previousNotifications = currentUser.notifications || []
    try {
      setCurrentUser(prev => {
        if (!prev) return prev
        return {
          ...prev,
          notifications: (prev.notifications || []).map(notification =>
            String(notification.id) === String(notificationId)
              ? { ...notification, status: "read", actionStatus: "declined", readAt: new Date().toISOString() }
              : notification
          )
        }
      })

      await Storage.declineNotification(notificationId)
      await refreshRelationshipState(currentUser.id)
      setSuccessMessage("Notification declined")
      setShowSuccessToast(true)
      setNotificationsError("")
    } catch (error) {
      console.error("Failed to decline notification", error)
      setCurrentUser(prev => prev ? { ...prev, notifications: previousNotifications } : prev)
      setNotificationsError(error?.message || "Could not update notification")
    } finally {
      pendingNotificationActionIdsRef.current.delete(notificationId)
      setPendingNotificationActionIds(prev => prev.filter(id => id !== notificationId))
    }
  }

  const handleWithdrawNotification = async notificationId => {
    if (!currentUser) return
    if (pendingNotificationActionIdsRef.current.has(notificationId)) return

    pendingNotificationActionIdsRef.current.add(notificationId)
    setPendingNotificationActionIds(prev => (prev.includes(notificationId) ? prev : [...prev, notificationId]))

    const previousNotifications = currentUser.notifications || []
    try {
      setCurrentUser(prev => {
        if (!prev) return prev
        return {
          ...prev,
          notifications: (prev.notifications || []).map(notification =>
            String(notification.id) === String(notificationId)
              ? { ...notification, status: "read", actionStatus: "withdrawn", readAt: new Date().toISOString() }
              : notification
          )
        }
      })

      await Storage.withdrawNotification(notificationId)
      setSuccessMessage("Invite withdrawn")
      setShowSuccessToast(true)
      setNotificationsError("")
    } catch (error) {
      console.error("Failed to withdraw notification", error)
      setCurrentUser(prev => prev ? { ...prev, notifications: previousNotifications } : prev)
      setNotificationsError(error?.message || "Could not withdraw invite")
    } finally {
      pendingNotificationActionIdsRef.current.delete(notificationId)
      setPendingNotificationActionIds(prev => prev.filter(id => id !== notificationId))
    }
  }

  const handleRemindNotification = async notificationId => {
    if (!currentUser) return
    if (pendingNotificationActionIdsRef.current.has(notificationId)) return

    pendingNotificationActionIdsRef.current.add(notificationId)
    setPendingNotificationActionIds(prev => (prev.includes(notificationId) ? prev : [...prev, notificationId]))

    try {
      await Storage.remindNotification(notificationId)
      setSuccessMessage("Reminder sent")
      setShowSuccessToast(true)
      setNotificationsError("")
    } catch (error) {
      console.error("Failed to remind notification", error)
      setNotificationsError(error?.message || "Could not send reminder")
    } finally {
      pendingNotificationActionIdsRef.current.delete(notificationId)
      setPendingNotificationActionIds(prev => prev.filter(id => id !== notificationId))
    }
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
      const updatedUser = await Storage.getCurrentUser({ forceRefresh: true }).catch(() => null)
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
      const updatedUser = await Storage.getCurrentUser({ forceRefresh: true }).catch(() => null)
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
      isDarkMode ? 'bg-[#070b14] text-white' : 'bg-[#f3f7fb] text-slate-950'
    }`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute inset-0 ${
          isDarkMode
            ? 'bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_80%_12%,_rgba(251,146,60,0.12),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.16),_transparent_32%),linear-gradient(180deg,#070b14_0%,#09111f_45%,#070b14_100%)]'
            : 'bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.22),_transparent_24%),radial-gradient(circle_at_78%_10%,_rgba(191,219,254,0.20),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(103,232,249,0.16),_transparent_28%),linear-gradient(180deg,#f3f7fb_0%,#edf4fb_48%,#e7f0f8_100%)]'
        }`} />
        <div className={`absolute -top-24 right-[8%] h-72 w-72 rounded-full blur-3xl ${
          isDarkMode ? 'bg-cyan-400/10' : 'bg-sky-300/30'
        }`} />
        <div className={`absolute bottom-0 left-[5%] h-96 w-96 rounded-full blur-3xl ${
          isDarkMode ? 'bg-cyan-500/10' : 'bg-blue-200/25'
        }`} />
        <div
          className={`absolute inset-0 opacity-[0.05] ${
            isDarkMode
              ? 'bg-[linear-gradient(rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)]'
              : 'bg-[linear-gradient(rgba(15,23,42,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.16)_1px,transparent_1px)]'
          }`}
          style={{ backgroundSize: '72px 72px' }}
        />
      </div>

      <nav className="relative z-20 px-4 py-5 sm:px-6">
        <div className={`mx-auto flex max-w-7xl items-center justify-between rounded-full border px-4 py-3 sm:px-6 ${
          isDarkMode
            ? 'border-white/10 bg-slate-950/60 backdrop-blur-xl'
            : 'border-slate-900/10 bg-white/75 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.08)]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
              isDarkMode ? 'bg-white/5 ring-1 ring-white/10' : 'bg-slate-950 ring-1 ring-slate-900/10'
            }`}>
              <SmartImage src={isDarkMode ? "/logo%20SD.png" : "/logo%20SL.png"} alt="Spaces logo" className="h-7 w-7 object-contain" loading="eager" fetchPriority="high" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight">Spaces</p>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Calm collaboration for focused teams</p>
            </div>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            {[
              ['Overview', 'showcase'],
              ['Features', 'features'],
              ['Teams', 'usecases'],
            ].map(([label, id]) => (
              <button
                key={id}
                onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'auto' })}
                className={`text-sm font-semibold transition-colors ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsDarkMode(!isDarkMode)
                localStorage.setItem('spacexyz-dark-mode', JSON.stringify(!isDarkMode))
              }}
              className={`flex h-11 w-11 items-center justify-center rounded-full border transition-none ${
                isDarkMode
                  ? 'border-white/10 bg-white/5 text-amber-300 hover:bg-white/10'
                  : 'border-slate-900/10 bg-white text-slate-600 hover:bg-[#eeedec]'
              }`}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            </button>
            <button
              onClick={() => { setShowLandingPage(false); setAuthMode('login'); }}
              className={`hidden rounded-full px-4 py-2 text-sm font-semibold sm:block ${
                isDarkMode ? 'text-slate-300 hover:bg-white/5 hover:text-white' : 'text-slate-700 hover:bg-slate-900/5'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setShowLandingPage(false); setAuthMode('signup'); }}
              className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-sky-500 px-4 py-2 text-sm font-bold text-white shadow-[0_14px_40px_rgba(59,130,246,0.34)] transition-transform hover:scale-[1.03]"
            >
              Start Free
            </button>
          </div>
        </div>
      </nav>

      <section className="relative z-10 px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-16">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] ${
              isDarkMode ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200' : 'border-cyan-600/15 bg-white/70 text-cyan-800'
            }`}>
              Built for teams that hate clutter
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.05em] sm:text-6xl lg:text-7xl xl:text-[5.4rem]">
              Team chat,
              <span className={`block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>files, tasks, and calls</span>
              <span className="block bg-gradient-to-r from-cyan-400 via-blue-500 to-orange-400 bg-clip-text text-transparent">in one sharp workspace.</span>
            </h1>

            <p className={`mt-6 max-w-2xl text-base leading-8 sm:text-lg ${
              isDarkMode ? 'text-slate-400' : 'text-slate-700'
            }`}>
              Spaces pulls conversation, docs, meetings, and ownership into a single interface so your team stops jumping between tabs and starts shipping.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => { setShowLandingPage(false); setAuthMode('signup'); }}
                className="rounded-full bg-slate-950 px-7 py-4 text-sm font-bold text-white shadow-[0_18px_50px_rgba(15,23,42,0.28)] transition-transform hover:scale-[1.02] dark:bg-white dark:text-slate-950"
              >
                Create your Space
              </button>
              <button
                onClick={() => document.getElementById('showcase')?.scrollIntoView({ behavior: 'auto' })}
                className={`rounded-full border px-7 py-4 text-sm font-bold transition-colors ${
                  isDarkMode
                    ? 'border-white/12 bg-white/5 text-white hover:bg-white/10'
                    : 'border-slate-900/10 bg-white/70 text-slate-900 hover:bg-white'
                }`}
              >
                See the interface
              </button>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ['Messages', 'Realtime chat with threads, DMs, and shared context'],
                ['Documents', 'Google apps and files connected directly inside work'],
                ['Ownership', 'Tasks and action items live where decisions happen'],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className={`rounded-[1.6rem] border p-4 ${
                    isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-900/8 bg-white/70'
                  }`}
                >
                  <p className="text-sm font-bold">{title}</p>
                  <p className={`mt-2 text-sm leading-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className={`absolute inset-6 rounded-[2rem] blur-3xl ${
              isDarkMode ? 'bg-cyan-500/15' : 'bg-blue-400/20'
            }`} />
            <div className={`relative rounded-[2rem] border p-3 shadow-[0_30px_90px_rgba(15,23,42,0.16)] ${
              isDarkMode ? 'border-white/10 bg-slate-950/70' : 'border-white/80 bg-white/80'
            }`}>
              <div className={`flex items-center justify-between rounded-[1.35rem] border px-4 py-3 ${
                isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-900/8 bg-slate-50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Live workspace</p>
              </div>
              <SmartImage src="/image 10.png" alt="Spaces workspace preview" className="mt-3 w-full rounded-[1.5rem] object-cover" loading="eager" fetchPriority="high" />
            </div>
          </div>
        </div>
      </section>

      <section id="showcase" className="relative z-10 px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.24em] ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>Product walkthrough</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Use the actual product visuals.</h2>
            </div>
          </div>

          <div className="grid gap-6">
            <div className={`overflow-hidden rounded-[2rem] border p-3 ${
              isDarkMode ? 'border-white/10 bg-slate-950/70' : 'border-white/80 bg-white/80'
            }`}>
              <SmartImage src="/image 10.png" alt="Spaces full workspace interface" className="w-full rounded-[1.5rem] object-cover" />
            </div>
            <div className={`mx-auto w-full max-w-3xl rounded-[2rem] border p-3 ${
              isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-900/8 bg-white/75'
            }`}>
              <SmartImage src="/image 11.png" alt="Spaces messaging interface" className="w-full rounded-[1.4rem] object-cover" />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <p className={`text-xs font-bold uppercase tracking-[0.24em] ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>Why it feels better</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl"></h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: MessageSquare, title: 'Context-first chat', desc: 'Channels, threads, and reactions stay attached to the work instead of floating in another app.' },
              { icon: Grid3x3, title: 'Connected tools', desc: 'Drive, Docs, Sheets, Slides, and Gmail attachments can live inside the same workspace.' },
              { icon: ClipboardList, title: 'Actionable work', desc: 'Turn messages into tasks before ownership disappears.' },
              { icon: Video, title: 'Calls on demand', desc: 'Jump into meetings from the exact place the conversation is happening.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className={`rounded-[2rem] border p-6 ${
                  isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-900/8 bg-white/75'
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  isDarkMode ? 'bg-white/8 text-cyan-300' : 'bg-slate-950 text-white'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-bold">{title}</h3>
                <p className={`mt-3 text-sm leading-7 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="usecases" className="relative z-10 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className={`rounded-[2.25rem] border p-8 ${
            isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-900/8 bg-white/75'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-[0.24em] ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>Built for</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Student teams, startups, and compact orgs that need clarity fast.</h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { title: 'College projects', desc: 'Keep every channel, file, and task attached to one shared workspace.', icon: GraduationCap },
              { title: 'Small startups', desc: 'Replace chat sprawl with a product space that actually matches your workflow.', icon: Briefcase },
              { title: 'Cross-functional teams', desc: 'Messages, docs, and decisions stop disappearing across separate tools.', icon: Users },
              { title: 'Ops-heavy groups', desc: 'Calls, checklists, and shared files sit together so handoffs stay clean.', icon: ShieldAlert },
            ].map(({ title, desc, icon: Icon }) => (
              <div
                key={title}
                className={`rounded-[2rem] border p-6 ${
                  isDarkMode ? 'border-white/10 bg-slate-950/60' : 'border-slate-900/8 bg-white/80'
                }`}
              >
                <Icon className={`h-6 w-6 ${isDarkMode ? 'text-orange-300' : 'text-orange-600'}`} />
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className={`mt-3 text-sm leading-7 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 py-14 sm:px-6 sm:py-20">
        <div className={`mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 rounded-[2.5rem] border p-8 sm:p-12 lg:flex-row lg:items-center ${
          isDarkMode
            ? 'border-white/10 bg-[linear-gradient(135deg,rgba(8,47,73,0.45),rgba(88,28,135,0.35),rgba(124,45,18,0.35))]'
            : 'border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.85),rgba(224,242,254,0.9),rgba(255,237,213,0.95))]'
        }`}>
          <div className="max-w-2xl">
            <p className={`text-xs font-bold uppercase tracking-[0.24em] ${isDarkMode ? 'text-cyan-200' : 'text-cyan-800'}`}>Ready to launch</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">If you need 5 tools and 15 more subtools to work, something is broken.</h2>
            <p className={`mt-4 text-sm leading-7 sm:text-base ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              onClick={() => { setShowLandingPage(false); setAuthMode('signup'); }}
              className="rounded-full bg-slate-950 px-7 py-4 text-sm font-bold text-white transition-transform hover:scale-[1.02] dark:bg-white dark:text-slate-950"
            >
              Get Started
            </button>
            <button
              onClick={() => { setShowLandingPage(false); setAuthMode('login'); }}
              className={`rounded-full border px-7 py-4 text-sm font-bold ${
                isDarkMode ? 'border-white/12 bg-white/5 text-white hover:bg-white/10' : 'border-slate-900/10 bg-white/80 text-slate-900 hover:bg-white'
              }`}
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      <footer className={`relative z-10 px-4 py-8 sm:px-6 sm:py-12 ${
        isDarkMode ? 'text-slate-500' : 'text-slate-600'
      }`}>
        <div className={`mx-auto flex max-w-7xl flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between ${
          isDarkMode ? 'border-white/10' : 'border-slate-900/10'
        }`}>
          <div className="flex items-center gap-3">
            <SmartImage src={isDarkMode ? "/logo%20SD.png" : "/logo%20SL.png"} alt="Spaces logo" className="h-8 w-8 rounded-xl object-contain" loading="eager" fetchPriority="high" />
            <span className="text-sm font-bold text-current">Spaces</span>
          </div>
          <p className="text-sm"></p>
          <p className="text-sm"> 2026 Spaces</p>
        </div>
      </footer>
      {/* Demo Modal */}
      {showDemoModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setShowDemoModal(false)}
        >
          {/* Backdrop */}
          <div className={`absolute inset-0 backdrop-blur-md ${
            isDarkMode ? 'bg-slate-950/80' : 'bg-slate-900/60'
          }`}></div>
          
          {/* Modal Content */}
          <div 
            className={`relative w-full max-w-4xl rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl ${
              isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowDemoModal(false)}
              className={`absolute top-4 right-4 z-10 p-2 rounded-full transition-colors ${
                isDarkMode 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              aria-label="Close demo modal"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Header */}
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                See Spacess in action
              </h3>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                A quick look at how teams collaborate on Spacess
              </p>
            </div>
            
            {/* Demo Content - Placeholder GIF/Image */}
            <div className={`aspect-video w-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              {/* Placeholder for demo - shows screenshot as fallback */}
              <div className="w-full h-full flex items-center justify-center relative">
                <SmartImage
                  src="/image 10.png"
                  alt="Spacess Demo Preview"
                  className="w-full h-full object-cover"
                />
                {/* Overlay with play icon for video placeholder */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                    isDarkMode ? 'bg-white/10' : 'bg-black/10'
                  }`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-sm ${
                      isDarkMode ? 'bg-sky-600' : 'bg-sky-500'
                    }`}>
                      <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                </div>
                {/* Coming soon overlay */}
                <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium ${
                  isDarkMode ? 'bg-slate-900/90 text-slate-300' : 'bg-white/90 text-slate-600'
                }`}>
                  🎬 Demo video coming soon
                </div>
              </div>
            </div>
            
            {/* Footer CTA */}
            <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Ready to try it yourself?
                </p>
                <button
                  onClick={() => { 
                    setShowDemoModal(false); 
                    setShowLandingPage(false); 
                    setAuthMode('signup'); 
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 hover:from-sky-500 hover:via-cyan-500 hover:to-teal-500 transition-all shadow-lg hover:shadow-cyan-500/30"
                >
                  Start Free
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const workspaceRestoreAnimations = [
    "/sunday-gif-1.gif",
    "/monday-gif-1.gif",
    "/monday-gif-%202.gif",
    "/tuesday-gif-1.gif",
    "/tuesday-gif-2.gif",
    "/wednesday-gif-1.gif",
    "/thursday-gif-1.gif",
    "/thursday-gif-2.gif",
    "/friday-gif-1.gif",
    "/saturday-gif-1.gif",
  ]
  const workspaceRestoreAnimationsByDay = {
    0: ["/sunday-gif-1.gif"],
    1: ["/monday-gif-1.gif", "/monday-gif-%202.gif"],
    2: ["/tuesday-gif-1.gif", "/tuesday-gif-2.gif"],
    3: ["/wednesday-gif-1.gif"],
    4: ["/thursday-gif-1.gif", "/thursday-gif-2.gif"],
    5: ["/friday-gif-1.gif"],
    6: ["/saturday-gif-1.gif"],
  }
  const restoreDate = new Date()
  const currentRestoreAnimations = workspaceRestoreAnimationsByDay[restoreDate.getDay()] || workspaceRestoreAnimations
  const workspaceRestoreAnimationSrc =
    currentRestoreAnimations[restoreDate.getDate() % currentRestoreAnimations.length] || "/monday-gif-1.gif"

  if (!authBootError && restoreSplashEnabled && restoreSplashVisible) {
    return (
      <div className={`relative min-h-screen overflow-hidden flex items-center justify-center font-sans px-6 ${
        isDarkMode ? "bg-[#06131d] text-white" : "bg-[#f4f7fb] text-slate-950"
      }`}>
        <div className="relative w-full max-w-md">
          <div className="flex flex-col items-center text-center">
            <div className={`mb-7 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg ${
              isDarkMode
                ? "border-white/10 bg-white/[0.08] shadow-black/20"
                : "border-slate-200 bg-white/90 shadow-slate-200/70"
            }`}>
              <img
                src={isDarkMode ? "/logo%20SD.png" : "/logo%20SL.png"}
                alt="Spacess"
                className="h-10 w-10 rounded-xl object-contain"
                draggable="false"
              />
              <div className="text-left">
                <p className={`text-lg font-black leading-tight ${isDarkMode ? "text-white" : "text-slate-950"}`}>
                  Spacess
                </p>
                <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${isDarkMode ? "text-cyan-200/80" : "text-cyan-700"}`}>
                  Workspace platform
                </p>
              </div>
            </div>

            <div className={`relative mb-7 h-56 w-72 overflow-hidden rounded-[1.75rem] border ${
              isDarkMode
                ? "border-white/10 bg-white/5"
                : "border-slate-200 bg-white"
            }`}>
              <img
                src={workspaceRestoreAnimationSrc}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-contain p-4"
                draggable="false"
                onError={(event) => {
                  event.currentTarget.src = "/monday-gif-1.gif"
                }}
              />
            </div>

            <div className="w-full">
              <div className="mb-4 flex items-center justify-center gap-3">
                <div
                  className="h-9 w-9 shrink-0 rounded-full border-[4px] border-cyan-500 border-t-transparent animate-spin"
                  aria-hidden="true"
                />
                <div className="text-left">
                  <p className={`text-base font-black ${isDarkMode ? "text-slate-50" : "text-slate-900"}`}>
                    Preparing your Spacess workspace
                  </p>
                  <p className={`text-sm mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {authInitializing
                      ? "Checking your secure session..."
                      : !appDataReady
                        ? "Loading your profile and spaces..."
                        : "Opening your workspace..."}
                  </p>
                </div>
              </div>
              <div className={`h-2 w-full overflow-hidden rounded-full ${isDarkMode ? "bg-white/10" : "bg-slate-200"}`}>
                <div className="h-full w-2/5 rounded-full bg-cyan-500 animate-[pulse_1s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (authBootError) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans px-6 ${
        isDarkMode ? "bg-[#06131d] text-white" : "bg-[#eef3fb] text-slate-900"
      }`}>
        <div className={`w-full max-w-sm rounded-2xl border p-6 text-center shadow-xl ${
          isDarkMode ? "bg-white/8 border-white/10" : "bg-white border-slate-200"
        }`}>
          <ShieldAlert className={`h-8 w-8 mx-auto mb-4 ${isDarkMode ? "text-amber-300" : "text-amber-600"}`} />
          <p className="text-sm font-bold">Session check paused</p>
          <p className={`text-xs mt-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {authBootError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 w-full px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold transition-colors"
          >
            Retry session check
          </button>
        </div>
      </div>
    )
  }

  // Show landing page for unauthenticated users who haven't clicked sign in/up
  if (!isAuthenticated && showLandingPage) {
    return (
      <ProductLandingPage
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onLogin={() => {
          setShowLandingPage(false)
          setAuthMode('login')
        }}
        onSignup={() => {
          setShowLandingPage(false)
          setAuthMode('signup')
        }}
      />
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen font-sans relative overflow-hidden ${
        isDarkMode 
          ? 'bg-[#06131d] text-white' 
          : 'bg-[#eef3fb] text-slate-900'
      }`}>
        <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between">
          <button
            onClick={() => setShowLandingPage(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-medium transition-all duration-300 ${
              isDarkMode 
                ? 'border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200' 
                : 'border border-slate-900/10 bg-white/80 hover:bg-white text-slate-700 shadow-lg shadow-slate-200/40'
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
                ? 'border border-white/10 bg-white/5 hover:bg-white/10 text-amber-300' 
                : 'border border-slate-900/10 bg-white/80 hover:bg-white text-slate-600 shadow-lg shadow-slate-200/40'
            } backdrop-blur-xl`}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-32 right-[-5rem] h-80 w-80 rounded-full blur-3xl animate-float ${
            isDarkMode ? 'bg-cyan-500/12' : 'bg-cyan-300/30'
          }`}></div>
          <div className={`absolute -bottom-40 -left-32 h-96 w-96 rounded-full blur-3xl animate-float ${
            isDarkMode ? 'bg-blue-500/14' : 'bg-blue-300/30'
          }`} style={{animationDelay: '1s'}}></div>
          <div className={`absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${
            isDarkMode ? 'bg-sky-500/10' : 'bg-sky-200/20'
          }`}></div>
        </div>

        <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl gap-12 px-6 pb-12 pt-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10">
          <div className="animate-fade-in-up">
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] ${
              isDarkMode ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200' : 'border-cyan-600/15 bg-white/70 text-cyan-800'
            }`}>
              Built for teams that hate clutter
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.05em] sm:text-6xl xl:text-[5rem]">
              Team chat,
              <span className={`block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>files, tasks, and calls</span>
              <span className="block bg-gradient-to-r from-cyan-400 via-blue-500 to-orange-400 bg-clip-text text-transparent">in one sharp workspace.</span>
            </h1>
            <p className={`mt-6 max-w-2xl text-base leading-8 sm:text-lg ${
              isDarkMode ? 'text-slate-400' : 'text-slate-700'
            }`}>
              Spaces pulls conversation, docs, meetings, and ownership into a single interface so your team stops jumping between tabs and starts shipping.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ['Messages', 'Realtime chat with shared context and decisions'],
                ['Files', 'Docs and assets connected directly to active work'],
                ['Ownership', 'Tasks and accountability live beside every thread'],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className={`rounded-[1.6rem] border p-4 ${
                    isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-900/8 bg-white/70'
                  }`}
                >
                  <p className="text-sm font-bold">{title}</p>
                  <p className={`mt-2 text-sm leading-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-in-up">
            <div className={`rounded-[2rem] overflow-hidden border p-3 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl ${
              isDarkMode ? 'border-white/10 bg-slate-950/70' : 'border-white/80 bg-white/80'
            }`}>
              <div className={`flex p-1.5 rounded-[1.6rem] mb-2 ${isDarkMode ? 'bg-white/[0.04]' : 'bg-slate-100/80'}`}>
                <button
                  onClick={() => setAuthMode("login")}
                  disabled={authPending}
                  className={`flex-1 py-3 px-6 text-center font-bold text-sm rounded-2xl transition-all duration-300 ${
                    authMode === "login"
                      ? isDarkMode 
                        ? "bg-white/10 text-white shadow-lg shadow-slate-950/40" 
                        : "bg-white text-slate-900 shadow-lg shadow-slate-200/70"
                      : isDarkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"
                  } ${authPending ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setAuthMode("signup")}
                  disabled={authPending}
                  className={`flex-1 py-3 px-6 text-center font-bold text-sm rounded-2xl transition-all duration-300 ${
                    authMode === "signup"
                      ? isDarkMode 
                        ? "bg-white/10 text-white shadow-lg shadow-slate-950/40" 
                        : "bg-white text-slate-900 shadow-lg shadow-slate-200/70"
                      : isDarkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"
                  } ${authPending ? "cursor-not-allowed opacity-70" : ""}`}
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
                      disabled={authPending}
                      onChange={e =>
                        setAuthData({ ...authData, name: e.target.value })
                      }
                      className={`w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent transition-all font-medium ${
                        isDarkMode 
                          ? 'bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:ring-cyan-500/40' 
                          : 'bg-white/90 border border-slate-200/80 text-slate-700 placeholder-slate-400 focus:ring-cyan-500/30 shadow-sm'
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
                    disabled={authPending}
                    onChange={e =>
                      setAuthData({ ...authData, email: e.target.value })
                    }
                    className={`w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent transition-all font-medium ${
                      isDarkMode 
                        ? 'bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:ring-cyan-500/40' 
                        : 'bg-white/90 border border-slate-200/80 text-slate-700 placeholder-slate-400 focus:ring-cyan-500/30 shadow-sm'
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
                    disabled={authPending}
                    onChange={e =>
                      setAuthData({ ...authData, password: e.target.value })
                    }
                    className={`w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent transition-all font-medium ${
                      isDarkMode 
                        ? 'bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:ring-cyan-500/40' 
                        : 'bg-white/90 border border-slate-200/80 text-slate-700 placeholder-slate-400 focus:ring-cyan-500/30 shadow-sm'
                    }`}
                    placeholder="........"
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
                      disabled={authPending}
                      onChange={e =>
                        setAuthData({
                          ...authData,
                          confirmPassword: e.target.value
                        })
                      }
                      className={`w-full px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent transition-all font-medium ${
                        isDarkMode 
                          ? 'bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:ring-cyan-500/40' 
                          : 'bg-white/90 border border-slate-200/80 text-slate-800 placeholder-slate-400 focus:ring-cyan-500/30'
                      }`}
                      placeholder="........"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={authPending}
                  className={`w-full py-4 font-bold rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 transform active:scale-[0.98] mt-4 text-white shadow-xl hover:scale-[1.02] ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-sky-500 hover:from-cyan-400 hover:via-blue-400 hover:to-sky-400 shadow-blue-500/20 hover:shadow-blue-500/40' 
                      : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-sky-500 hover:from-cyan-600 hover:via-blue-600 hover:to-sky-600 shadow-blue-300/40 hover:shadow-blue-400/50'
                  } ${authPending ? 'cursor-not-allowed opacity-80 hover:scale-100' : ''}`}
                >
                  {authPending && !googleAuthPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {authMode === "login" ? "Signing in..." : "Creating account..."}
                    </>
                  ) : authMode === "login" ? (
                    <>
                      <LogIn className="w-5 h-5" /> Enter Space
                    </>
                  ) : (
                    <>
                      <UserPlusIcon className="w-5 h-5" /> Join the Crew
                    </>
                  )}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className={`w-full border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200/80'}`}></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className={`px-3 font-bold ${isDarkMode ? 'bg-slate-950/80 text-slate-500' : 'bg-white/90 text-slate-400'}`}>Or continue with</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={authPending}
                  className={`w-full py-4 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 transform active:scale-[0.98] border-2 ${
                    isDarkMode 
                      ? 'bg-white/[0.03] border-white/10 text-slate-200 hover:bg-white/[0.06] hover:border-white/20 hover:shadow-md' 
                      : 'bg-white/90 border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300 hover:shadow-md shadow-sm'
                  } ${authPending ? 'cursor-not-allowed opacity-80' : ''}`}
                >
                  {googleAuthPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Opening Google...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {authMode === "signup" ? "Continue with Google" : "Sign in with Google"}
                    </>
                  )}
                </button>
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
                          ? 'text-white shadow-xl bg-white/6 backdrop-blur-lg border border-white/10 hover:scale-[1.01] shadow-blue-600/20'
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
                      }} className="px-4 py-2 rounded-2xl bg-sky-600 text-white font-bold">Send OTP</button>
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
                        }} className="px-4 py-2 rounded-2xl bg-sky-600 text-white">Verify</button>
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
                              if (j?.setupToken) setOrgPasswordSetupToken(j.setupToken)

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
                        className={`px-4 py-2 rounded-2xl bg-sky-600 text-white flex items-center gap-2 ${orgDnsChecking ? 'opacity-70 cursor-not-allowed' : ''}`}>
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
                      <button onClick={() => { setShowOrgModal(false); setOrgStage('form'); try { setActiveView('channel') } catch(e){}; try { setShowAdminDashboard(true) } catch(e){} }} className="px-4 py-2 rounded-2xl bg-sky-600 text-white">Done</button>
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
                        <button onClick={handleSetPasswordSubmit} disabled={setPasswordLoading} className={`px-4 py-2 rounded-2xl bg-sky-600 text-white ${setPasswordLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
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
  const { daysInMonth, firstDay } = getDaysInMonth(currentDate)
  const appRailNotificationCount = unreadNotifications.length
  const appRailTaskAssignmentCount = unreadAssignedTaskNotifications.length
  const calendarRailImageNumber = Math.min(47, Math.max(17, new Date().getDate() + 16))
  const calendarRailIconSrc = `/image%20${calendarRailImageNumber}.png`
  const isWorkspaceRailActive =
    activeView === "channel" ||
    activeView === "calendar" ||
    activeView === "meeting" ||
    (activeView === "contexts" && contextsSourceView !== "dm")
  const appRailItems = [
    { key: "home", label: "Home", title: "Home", icon: HomeIcon, imageSrc: "/Home.png", active: activeView === "home" && homeSection === "overview", action: openHomePage },
    { key: "work", label: "Work", title: "Spaces", icon: Briefcase, imageSrc: "/Work.png", active: isWorkspaceRailActive, action: openWorkspaceHome },
    { key: "dms", label: "DMs", title: "Direct Messages", icon: MessageSquare, active: (activeView === "home" && homeSection === "dm") || activeView === "dm", action: openDirectMessagesPage },
    { key: "starred", label: "Starred", title: "Starred messages", icon: Star, imageSrc: "/Starred.png", active: activeView === "starred", badge: starredMessages.length, action: openStarredMessages },
    { key: "notifications", label: "Activity", title: "Notifications", icon: Bell, imageSrc: "/Activity.png", active: activeView === "notifications", badge: appRailNotificationCount, action: openNotificationsPage },
    { key: "files", label: "Files", title: "Files", icon: FileText, imageSrc: "/Files.png", active: activeView === "documents" || showDocsModal, action: openDocumentsPage },
    { key: "tasks", label: "Tasks", title: "Tasks", icon: ClipboardList, imageSrc: "/Tasks.png", active: activeView === "tasks", badge: appRailTaskAssignmentCount, action: openTasksPage },
    { key: "calendar", label: "Calendar", title: "Calendar", icon: Calendar, imageSrc: calendarRailIconSrc, active: activeView === "calendar", action: openCalendarPage },
    { key: "connect", label: "Connect", title: "Connect", icon: UserPlus, active: activeView === "connect" || (activeView === "home" && homeSection === "connect"), action: openHomeConnect },
  ]
  const mobilePrimaryNavItems = [
    {
      key: "dms",
      label: "DMs",
      title: "Direct messages",
      icon: MessageSquare,
      active: (activeView === "home" && homeSection === "dm") || activeView === "dm",
      action: openDirectMessagesPage,
    },
    {
      key: "work",
      label: "Work",
      title: "Work",
      icon: Briefcase,
      imageSrc: "/Work.png",
      active: isWorkspaceRailActive || (isMobile && mobileView === "spaces"),
      action: () => {
        openWorkspaceHome()
        if (isMobile) setMobileView("spaces")
      },
    },
    {
      key: "files",
      label: "Files",
      title: "Files",
      icon: FileText,
      imageSrc: "/Files.png",
      active: activeView === "documents" || showDocsModal,
      action: openDocumentsPage,
    },
    {
      key: "tasks",
      label: "Tasks",
      title: "Tasks",
      icon: ClipboardList,
      imageSrc: "/Tasks.png",
      active: activeView === "tasks",
      badge: appRailTaskAssignmentCount,
      action: openTasksPage,
    },
    {
      key: "activity",
      label: "Activity",
      title: "Activity",
      icon: Bell,
      imageSrc: "/Activity.png",
      active: activeView === "notifications",
      badge: appRailNotificationCount,
      action: openNotificationsPage,
    },
  ]

  const openProfileEditor = () => {
    setSelectedPreset(currentUser?.avatar_preset || null)
    setAvatarPreview(currentUser?.avatar_url || null)
    setAvatarFile(null)
    setShowProfileModal(true)
    setShowUserMenu(false)
    setShowMobileDrawer(false)
  }

  const renderMobileAccountSidebar = () => {
    if (!isMobile || !showMobileAccountSidebar) return null

    const rowBase = `flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold transition ${
      isDarkMode
        ? "text-slate-200 hover:bg-white/[0.07] active:bg-white/[0.10]"
        : "text-slate-700 hover:bg-slate-100 active:bg-slate-200/70"
    }`
    const iconBase = `flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
      isDarkMode ? "bg-white/[0.07] text-slate-100" : "bg-white text-slate-700 shadow-sm"
    }`
    const settingsButton = `inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition ${
      isDarkMode ? "bg-white/[0.07] text-slate-100 hover:bg-white/[0.10]" : "bg-white text-slate-700 hover:bg-slate-50"
    }`

    return (
      <div className="fixed inset-0 z-[95] md:hidden" role="dialog" aria-modal="true" aria-label="Account sidebar">
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/45"
          aria-label="Close account sidebar"
          onClick={() => setShowMobileDrawer(false)}
        />
        <aside className={`mobile-slide-in-left absolute inset-y-0 left-0 flex w-[82vw] max-w-[320px] flex-col border-r shadow-2xl ${
          isDarkMode ? "border-white/10 bg-[#111111] text-slate-100" : "border-slate-200 bg-[#f8fafc] text-slate-900"
        }`}>
          <div className={`flex items-center gap-3 border-b px-4 pb-4 pt-[calc(18px+env(safe-area-inset-top))] ${
            isDarkMode ? "border-white/10" : "border-slate-200"
          }`}>
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${
              isDarkMode ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-white"
            }`}>
              {renderAvatar(currentUser, 44)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold">{currentUser?.name || "Profile"}</div>
              <div className={`truncate text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{currentUser?.email || "Signed in"}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowMobileDrawer(false)}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition ${
                isDarkMode ? "text-slate-400 hover:bg-white/[0.08] hover:text-white" : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              }`}
              aria-label="Close account sidebar"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-1">
              <button type="button" onClick={openCalendarPage} className={rowBase}>
                <span className={iconBase}><Calendar className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">Calendar</span>
                  <span className={`mt-0.5 block truncate text-xs font-medium ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Events and meetings</span>
                </span>
              </button>

              <button type="button" onClick={openStarredMessages} className={rowBase}>
                <span className={iconBase}><Star className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">Starred Messages</span>
                  <span className={`mt-0.5 block truncate text-xs font-medium ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{starredMessages.length} saved</span>
                </span>
              </button>

              <button type="button" onClick={openHomeNetwork} className={rowBase}>
                <span className={iconBase}><Users className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">Network</span>
                  <span className={`mt-0.5 block truncate text-xs font-medium ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Show all connections</span>
                </span>
              </button>

              <button type="button" onClick={openHomeConnect} className={rowBase}>
                <span className={iconBase}><UserPlus className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">Connect</span>
                  <span className={`mt-0.5 block truncate text-xs font-medium ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Find and invite people</span>
                </span>
              </button>
            </div>

            <section className={`mt-4 rounded-[22px] border p-3 ${
              isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-white/80"
            }`}>
              <div className={`mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[0.18em] ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}>
                <Settings className="h-4 w-4" />
                Settings
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsDarkMode(prev => !prev)} className={settingsButton}>
                  {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {isDarkMode ? "Light" : "Dark"}
                </button>
                <button type="button" onClick={openProfileEditor} className={settingsButton}>
                  <UserIcon className="h-4 w-4" />
                  Manage profile
                </button>
              </div>
            </section>
          </div>

          <div className={`border-t p-3 pb-[calc(12px+env(safe-area-inset-bottom))] ${
            isDarkMode ? "border-white/10" : "border-slate-200"
          }`}>
            <button
              type="button"
              onClick={handleLogout}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                isDarkMode ? "bg-red-500/12 text-red-300 hover:bg-red-500/18" : "bg-red-50 text-red-600 hover:bg-red-100"
              }`}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>
      </div>
    )
  }

  const renderChannelMembersView = () => {
    const currentSpaceRecord = getCurrentSpace()
    const ownerId = activeChannelData?.ownerId || currentSpaceRecord?.ownerId
    let ownerMembers = activeMembers.filter(member => {
      const role = getChannelRole(member.id)
      return role === "owner" || (ownerId && String(member.id) === String(ownerId))
    })

    if (!ownerMembers.length && ownerId) {
      const owner = getUser(ownerId)
      if (owner) ownerMembers = [owner]
    }

    const ownerIds = new Set(ownerMembers.map(member => String(member.id)))
    const regularMembers = activeMembers.filter(member => !ownerIds.has(String(member.id)))
    const canEditRoles = String(currentUser?.id || "") === String(currentSpaceRecord?.ownerId || "")
    const currentFriendIds = new Set([
      ...(Array.isArray(currentUser?.friends) ? currentUser.friends : []),
      ...(Array.isArray(friends) ? friends.map(friend => friend?.id ?? friend).filter(id => id !== undefined && id !== null) : []),
    ].map(id => String(id)))

    const isPendingNotification = notification => {
      const status = notification?.actionStatus || notification?.status
      return !["accepted", "declined", "withdrawn"].includes(status)
    }

    const getMemberConnectionState = member => {
      const memberId = String(member?.id ?? "")
      const currentUserId = String(currentUser?.id ?? "")
      if (!memberId || memberId === currentUserId) return { status: "self", notificationId: null }
      if (currentFriendIds.has(memberId)) return { status: "connected", notificationId: null }

      const incomingRequest = (currentUser?.notifications || []).find(notification =>
        ["friend_request", "connection_invite"].includes(notification?.type) &&
        String(notification?.fromId ?? notification?.senderId ?? notification?.from) === memberId &&
        isPendingNotification(notification)
      )
      if (incomingRequest) return { status: "incoming_request", notificationId: incomingRequest.id || null }

      if (pendingFriendRequestIds.some(id => String(id) === memberId)) {
        return { status: "outgoing_request", notificationId: null }
      }

      return { status: "can_connect", notificationId: null }
    }

    const formatRole = member => {
      if (ownerIds.has(String(member.id))) return "Owner"
      const role = getChannelRole(member.id)
      return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member"
    }

    const renderConnectionAction = member => {
      const relationship = getMemberConnectionState(member)
      if (relationship.status === "self" || relationship.status === "connected") return null

      const isOutgoing = relationship.status === "outgoing_request"
      const isIncoming = relationship.status === "incoming_request"
      const label = isIncoming ? "Accept" : isOutgoing ? "Pending" : "Connect"

      return (
        <button
          type="button"
          className={`workspace-channel-member-connect ${isOutgoing ? "is-pending" : ""}`}
          disabled={isOutgoing}
          onClick={() => {
            if (isIncoming && relationship.notificationId) {
              handleNotificationAction(relationship.notificationId, "friend_request")
              return
            }
            setShowAddFriendConfirm(member.id)
          }}
          title={label}
          aria-label={`${label} with ${member.name || member.email || "member"}`}
        >
          {isOutgoing ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
          <span>{label}</span>
        </button>
      )
    }

    const renderMemberRow = (member, section) => {
      const isMe = String(member.id) === String(currentUser?.id)
      const canManageMember = canEditRoles && !isMe && section !== "owners"

      return (
        <div key={`${section}-${member.id}`} className="workspace-channel-member-row">
          <div className="workspace-channel-member-name">
            <div className="workspace-channel-member-avatar">
              {renderAvatar(member, 34)}
            </div>
            <div className="min-w-0">
              <div className="workspace-channel-member-title">{member.name || member.email || "Member"}</div>
              {section === "members" && (
                <div className="workspace-channel-member-nickname">
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Set nickname</span>
                </div>
              )}
            </div>
          </div>
          <div className="workspace-channel-member-role">
            {renderConnectionAction(member)}
            {canManageMember ? (
              <select
                value={getChannelRole(member.id)}
                onChange={event => handleSetRole(member.id, event.target.value)}
                className="workspace-channel-member-role-select"
                aria-label={`Role for ${member.name || member.email || "member"}`}
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
            ) : (
              <span>{formatRole(member)}</span>
            )}
            {canManageMember && (
              <button
                type="button"
                onClick={() => handleRemoveMember(member.id)}
                className="workspace-channel-member-remove"
                title="Remove member"
                aria-label={`Remove ${member.name || member.email || "member"}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )
    }

    const renderSection = (title, people, section) => (
      <section className="workspace-channel-members-section">
        <div className="workspace-channel-members-section-title">
          <ChevronDown className="h-4 w-4" />
          <span>{title} ({people.length})</span>
        </div>
        <div className="workspace-channel-members-header">
          <span>Name</span>
          <span>Role</span>
        </div>
        <div className="workspace-channel-members-list">
          {people.length ? (
            people.map(member => renderMemberRow(member, section))
          ) : (
            <div className="workspace-channel-members-empty">No {title.toLowerCase()} in this channel yet.</div>
          )}
        </div>
      </section>
    )

    return (
      <div className={`workspace-channel-details-view ${isDarkMode ? "is-dark" : ""}`}>
        {renderSection("Owners", ownerMembers, "owners")}
        {renderSection("Members", regularMembers, "members")}
      </div>
    )
  }
  const isDirectMessagesShell = activeView === "dm"
  const shouldShowSpacesSidebar = !["tasks", "documents", "connect", "starred", "notifications"].includes(activeView)
  const shouldShowWorkspaceSearch = !isMobile && ["channel", "dm", "calendar", "documents", "starred", "notifications"].includes(activeView)
  const workspaceSearchOpen = debouncedSearchQuery.trim().length > 0 && !workspaceSearchDismissed
  const showLegacySidebarControls = false
  const showLegacySidebarSearch = false
  const showLegacyFriendsSidebar = false

  const openSpaceSearchResult = result => {
    if (!result) return

    if (result.spaceId && result.channelId) {
      handleChannelNavigation(result.spaceId, result.channelId)
      setHighlightTerm(debouncedSearchQuery)
      if (result.messageId) {
        setTargetMessageId(result.messageId)
        setPinnedMessageId(result.messageId)
      } else {
        setTargetMessageId(null)
        setPinnedMessageId(null)
      }
    } else if (result.spaceId) {
      const matchedSpace = spaces.find(space => String(space.id) === String(result.spaceId))
      const firstChannel = getAccessibleChannelsForSpace(matchedSpace)[0]
      if (firstChannel) {
        handleChannelNavigation(result.spaceId, firstChannel.id)
      } else {
        setActiveSpace(result.spaceId)
        setActiveChannel(null)
        setActiveView("channel")
      }
    }

    setWorkspaceSearchDismissed(true)
  }

  const openDmSearchResult = result => {
    if (!result?.userId) return
    const user = getUser(result.userId)

    setActiveDMUser(result.userId)
    setHomeActiveDMUser(result.userId)
    setActiveChannelTab("messages")
    setActiveView("dm")
    loadDMMessagesForUser(result.userId)
    pushAppRoute(`/dm/${encodeURIComponent(slugifyRoutePart(user?.name || result.title) || String(result.userId))}`)

    if (result.messageId) {
      setHighlightTerm(debouncedSearchQuery)
      setTargetMessageId(result.messageId)
      setPinnedMessageId(result.messageId)
    } else {
      setTargetMessageId(null)
      setPinnedMessageId(null)
    }

    if (isMobile) setMobileView("chat")
    setWorkspaceSearchDismissed(true)
  }

  const openMessageSearchResult = result => {
    if (!result) return
    if (result.resultScope === "channel" || result.channelId) {
      openSpaceSearchResult(result)
      return
    }
    openDmSearchResult(result)
  }

  const openFileSearchResult = result => {
    if (!result?.file) return
    setWorkspaceSearchDismissed(true)
    openHomeFile(result.file)
  }

  const getNotificationTitle = notification => {
    if (!notification) return "Notification"
    const metadata = notification.metadata || {}
    if (notification.type === "connection_invite") return notification.senderName || "Connection invite"
    if (notification.type === "connection_invite_response") return "Connection invite response"
    if ((notification.type === "space_invite" || notification.type === "channel_invite") && metadata.senderCopy) {
      return `Invite sent to ${metadata.recipientName || "member"}`
    }
    if (notification.type === "space_invite") return metadata.spaceName || notification.spaceName || "Space invite"
    if (notification.type === "channel_invite") return metadata.channelName ? `#${metadata.channelName}` : "Channel invite"
    if (notification.type === "space_invite_response" || notification.type === "channel_invite_response") return metadata.spaceName || "Invite response"
    if (notification.type === "task_assigned") return metadata.taskTitle || notification.message || "Task assigned"
    return "Notification"
  }

  const getNotificationPreview = notification => {
    if (!notification) return ""
    const metadata = notification.metadata || {}
    if (notification.type === "connection_invite") return `${notification.senderName} wants to connect with you`
    if ((notification.type === "space_invite" || notification.type === "channel_invite") && metadata.senderCopy) {
      return notification.message || `Pending invite for ${metadata.spaceName || "space"}`
    }
    if (notification.type === "space_invite") return notification.message || `${notification.senderName} invited you to ${metadata.spaceName || "a space"}`
    if (notification.type === "channel_invite") {
      return notification.message || `${notification.senderName} invited you to #${metadata.channelName || "channel"}`
    }
    if (notification.type === "task_assigned") {
      const source = metadata.sourceLabel || (metadata.source === "channel" ? `Assigned from #${metadata.channelName || "channel"}` : "Assigned from Tasks")
      return `${source}${metadata.dueDate ? ` | Due ${metadata.dueDate}` : ""}`
    }
    return notification.message || "Workspace update"
  }

  const getNotificationStatusLabel = notification => {
    if (!notification) return ""
    if (notification.actionStatus === "pending") return "Pending"
    if (notification.actionStatus && notification.actionStatus !== "pending") return notification.actionStatus
    return notification.status === "read" ? "Read" : "Unread"
  }

  const getNotificationSpaceContext = notification => {
    const metadata = notification?.metadata || {}
    const space = spaces.find(item => String(item.id) === String(notification?.spaceId))
    const channel = (space?.channels || []).find(item => String(item.id) === String(notification?.channelId))
    return {
      space,
      channel,
      spaceName: metadata.spaceName || notification?.spaceName || space?.name || "",
      channelName: metadata.channelName || notification?.channelName || channel?.name || "",
    }
  }

  const canManageNotificationContext = notification => {
    if (!notification || !currentUser?.id) return false
    const { space, channel } = getNotificationSpaceContext(notification)
    if (!space) return false
    if (String(space.ownerId || space.createdBy) === String(currentUser.id)) return true
    const role = (channel?.roles || {})[String(currentUser.id)]
    return role === "owner" || role === "admin"
  }

  const openTaskFromNotification = async notification => {
    if (!notification) return
    const taskId = notification.taskId || notification.metadata?.taskId
    if (!taskId) return
    await markNotificationReadLocal(notification.id)
    setFocusedTaskId(String(taskId))
    setActiveView("tasks")
    pushAppRoute("/tasks")
    if (isMobile) setMobileView("chat")
  }

  const renderNotificationDetail = notification => {
    if (!notification) {
      return (
        <div className="workspace-notification-detail-empty">
          <Bell className="h-10 w-10" />
          <h3>No notification selected</h3>
          <p>Select a notification to see the details and available actions.</p>
        </div>
      )
    }

    const metadata = notification.metadata || {}
    const sender = notification.sender || getUser(notification.senderId)
    const isPending = notification.actionStatus === "pending"
    const isSenderCopy = Boolean(metadata.senderCopy || notification.senderCopy)
    const isInviteType = ["space_invite", "channel_invite"].includes(notification.type)
    const isActionable = !isSenderCopy && isPending && ["connection_invite", "space_invite", "channel_invite"].includes(notification.type)
    const isWorking = pendingNotificationActionIds.includes(notification.id)
    const { space, channel, spaceName, channelName } = getNotificationSpaceContext(notification)
    const canSeeManagement = canManageNotificationContext(notification)
    const canManageInviteActions = canSeeManagement && isSenderCopy && isInviteType && isPending
    const taskTitle = metadata.taskTitle || notification.message || "Untitled task"
    const sourceLabel =
      metadata.sourceLabel ||
      (metadata.source === "channel" ? `Assigned from #${channelName || metadata.channelName || "channel"}` : "Assigned from Tasks")

    return (
      <div className="workspace-notification-detail-inner">
        <div className="workspace-notification-detail-header">
          <div className="workspace-notification-detail-person">
            <span className="workspace-notification-detail-avatar">
              {notification.type === "task_assigned" ? (
                <ClipboardList className="h-5 w-5" />
              ) : sender ? (
                renderAvatar(sender, 44)
              ) : (
                <Bell className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <div className="workspace-notification-detail-name">{getNotificationTitle(notification)}</div>
              <div className="workspace-notification-detail-context">
                {formatDateLabel(notification.createdAt, timeTicker)}
                {notification.createdAt ? ` at ${formatTime(notification.createdAt)}` : ""}
              </div>
            </div>
          </div>
          <span className={`workspace-notification-status-pill is-${String(getNotificationStatusLabel(notification)).toLowerCase()}`}>
            {getNotificationStatusLabel(notification)}
          </span>
        </div>

        <div className="workspace-notification-card">
          {notification.type === "connection_invite" ? (
            <>
              <div className="workspace-notification-profile">
                <span>{sender ? renderAvatar(sender, 56) : <UserIcon className="h-6 w-6" />}</span>
                <div>
                  <h3>{notification.senderName}</h3>
                  <p>{notification.senderName} wants to connect with you</p>
                </div>
              </div>
            </>
          ) : notification.type === "space_invite" || notification.type === "channel_invite" ? (
            <>
              <div className="workspace-notification-kv">
                <span>Space</span>
                <strong>{spaceName || "Space"}</strong>
              </div>
              {notification.type === "channel_invite" && (
                <div className="workspace-notification-kv">
                  <span>Channel</span>
                  <strong>#{channelName || "channel"}</strong>
                </div>
              )}
              <div className="workspace-notification-kv">
                <span>{isSenderCopy ? "Invitee" : "Invited by"}</span>
                <strong>{isSenderCopy ? metadata.recipientName || "Member" : notification.senderName}</strong>
              </div>
              <p className="workspace-notification-detail-message">{getNotificationPreview(notification)}</p>
            </>
          ) : notification.type === "task_assigned" ? (
            <>
              <div className="workspace-notification-kv">
                <span>Task</span>
                <strong>{taskTitle}</strong>
              </div>
              <div className="workspace-notification-kv">
                <span>Assigned by</span>
                <strong>{metadata.senderName || notification.senderName}</strong>
              </div>
              <div className="workspace-notification-kv">
                <span>Source</span>
                <strong>{sourceLabel}</strong>
              </div>
              {metadata.dueDate && (
                <div className="workspace-notification-kv">
                  <span>Due</span>
                  <strong>{metadata.dueDate}</strong>
                </div>
              )}
            </>
          ) : (
            <p className="workspace-notification-detail-message">{notification.message || getNotificationPreview(notification)}</p>
          )}

          {isActionable && (
            <div className="workspace-notification-actions">
              <button
                type="button"
                className="workspace-notification-primary-action"
                disabled={isWorking}
                onClick={() => handleNotificationAction(notification.id, notification.type)}
              >
                <CheckCircle className="h-4 w-4" />
                Accept
              </button>
              <button
                type="button"
                className="workspace-notification-secondary-action"
                disabled={isWorking}
                onClick={() => handleRejectNotification(notification.id, notification.type)}
              >
                <XCircle className="h-4 w-4" />
                Decline
              </button>
            </div>
          )}

          {notification.type === "task_assigned" && (
            <div className="workspace-notification-actions">
              <button type="button" className="workspace-notification-primary-action" onClick={() => openTaskFromNotification(notification)}>
                <ExternalLink className="h-4 w-4" />
                Open task
              </button>
            </div>
          )}
        </div>

        {canSeeManagement && (space || channel) && (
          <div className="workspace-notification-management">
            <h3>Management details</h3>
            <div className="workspace-notification-management-grid">
              <div>
                <span>Members</span>
                <strong>{channel ? (channel.members || []).length : (space?.members || []).length}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{notification.actionStatus || notification.status}</strong>
              </div>
              <div>
                <span>Pending members</span>
                <strong>{isInviteType && isPending ? 1 : 0}</strong>
              </div>
              <div>
                <span>Invites</span>
                <strong>{isInviteType ? 1 : 0}</strong>
              </div>
              <div>
                <span>Requests</span>
                <strong>0</strong>
              </div>
            </div>
            {canManageInviteActions && (
              <div className="workspace-notification-actions">
                <button
                  type="button"
                  className="workspace-notification-secondary-action"
                  disabled={isWorking}
                  onClick={() => handleRemindNotification(notification.id)}
                >
                  <Bell className="h-4 w-4" />
                  Remind
                </button>
                <button
                  type="button"
                  className="workspace-notification-secondary-action is-danger"
                  disabled={isWorking}
                  onClick={() => handleWithdrawNotification(notification.id)}
                >
                  <XCircle className="h-4 w-4" />
                  Withdraw
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderNotificationsPage = () => (
    <div className={`workspace-notifications-frame workspace-starred-frame workspace-dedicated-frame ${isDarkMode ? "is-dark" : ""}`}>
      <aside className="workspace-starred-sidebar workspace-notifications-sidebar">
        <div className="workspace-starred-sidebar-header">
          <div className="workspace-starred-title-row">
            <span className="workspace-starred-icon workspace-notifications-icon">
              <Bell className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2>Notifications</h2>
              <p>{unreadNotifications.length ? `${unreadNotifications.length} unread` : "You're all caught up"}</p>
            </div>
          </div>
        </div>

        {notificationsError && normalizedNotifications.length > 0 && (
          <div className="workspace-notification-inline-error">
            <ShieldAlert className="h-4 w-4" />
            <span>{notificationsError}</span>
          </div>
        )}

        <div className="workspace-starred-list workspace-notifications-list">
          {notificationsLoading && normalizedNotifications.length === 0 ? (
            <div className="workspace-starred-empty">
              <Loader2 className="h-7 w-7 animate-spin" />
              <span>Loading notifications</span>
            </div>
          ) : notificationsError && normalizedNotifications.length === 0 ? (
            <div className="workspace-starred-empty">
              <ShieldAlert className="h-7 w-7" />
              <span>{notificationsError}</span>
            </div>
          ) : normalizedNotifications.length === 0 ? (
            <div className="workspace-starred-empty">
              <Bell className="h-7 w-7" />
              <span>No notifications yet</span>
            </div>
          ) : (
            normalizedNotifications.map(notification => {
              const isSelected = selectedNotification?.id === notification.id
              const unread = notification.status !== "read"
              const statusLabel = getNotificationStatusLabel(notification)
              return (
                <button
                  key={`notification-${notification.id}`}
                  type="button"
                  onClick={() => setActiveNotificationId(notification.id)}
                  className={`workspace-notification-list-item ${isSelected ? "is-active" : ""} ${unread ? "is-unread" : ""}`}
                >
                  <span className="workspace-starred-list-avatar workspace-notification-list-avatar">
                    {notification.type === "task_assigned" ? (
                      <ClipboardList className="h-4 w-4" />
                    ) : notification.sender ? (
                      renderAvatar(notification.sender, 30)
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </span>
                  <span className="workspace-starred-list-copy">
                    <span className="workspace-starred-list-meta">
                      <span>{getNotificationTitle(notification)}</span>
                      <span>{formatRelativeTime(notification.createdAt, timeTicker)}</span>
                    </span>
                    <span className="workspace-starred-list-preview">{getNotificationPreview(notification)}</span>
                    <span className="workspace-notification-list-footer">
                      <span>{statusLabel}</span>
                      {unread && <span className="workspace-notification-unread-dot" />}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </aside>

      <main className="workspace-starred-detail workspace-notification-detail">
        <div className="workspace-starred-detail-panel workspace-notification-detail-panel">
          {renderNotificationDetail(selectedNotification)}
        </div>
      </main>
    </div>
  )

  const renderWorkspaceSearchPage = () => {
    const query = debouncedSearchQuery.trim()
    const tabs = [
      { key: "messages", label: "Messages", count: workspaceSearchCounts.messages },
      { key: "files", label: "Files", count: workspaceSearchCounts.files },
      { key: "spaces", label: "Spaces", count: workspaceSearchCounts.spaces },
    ]
    const totalResults = workspaceSearchCounts.messages + workspaceSearchCounts.files + workspaceSearchCounts.spaces
    const activeResults =
      workspaceSearchTab === "files"
        ? filteredFileSearchResults
        : workspaceSearchTab === "spaces"
          ? spaceSearchResults
          : filteredMessageSearchResults

    return (
      <div className={`workspace-search-page ${isDarkMode ? "is-dark" : ""}`}>
        <div className="workspace-search-page-tabs" role="tablist" aria-label="Search result types">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={workspaceSearchTab === tab.key}
              className={`workspace-search-tab ${workspaceSearchTab === tab.key ? "is-active" : ""}`}
              onClick={() => setWorkspaceSearchTab(tab.key)}
            >
              <span>{tab.label}</span>
              <span className="workspace-search-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        {(workspaceSearchTab === "messages" || workspaceSearchTab === "files") && (
          <div className="workspace-search-filterbar">
            {workspaceSearchTab === "messages" && (
              <label className="workspace-search-filter-control">
                <span>From</span>
                <select value={workspaceSearchFromFilter} onChange={event => setWorkspaceSearchFromFilter(event.target.value)}>
                  <option value="all">Anyone</option>
                  <option value="you">You</option>
                  <option value="others">Others</option>
                </select>
                <ChevronDown className="h-3.5 w-3.5" />
              </label>
            )}
            <label className="workspace-search-filter-control">
              <span>Date</span>
              <select value={workspaceSearchDateFilter} onChange={event => setWorkspaceSearchDateFilter(event.target.value)}>
                <option value="all">Any time</option>
                <option value="today">Today</option>
                <option value="week">Past week</option>
                <option value="month">Past month</option>
              </select>
              <ChevronDown className="h-3.5 w-3.5" />
            </label>
          </div>
        )}

        <div className="workspace-search-page-scroll">
          {totalResults === 0 ? (
            <div className="workspace-search-empty-state">
              <Search className="h-6 w-6" />
              <span>No results found</span>
            </div>
          ) : activeResults.length === 0 ? (
            <div className="workspace-search-empty-state">
              <Search className="h-6 w-6" />
              <span>No {workspaceSearchTab} match "{query}"</span>
            </div>
          ) : workspaceSearchTab === "messages" ? (
            <div className="workspace-search-results-column">
              {activeResults.map(result => (
                <button
                  key={result.id}
                  type="button"
                  className="workspace-search-message-card"
                  onClick={() => openMessageSearchResult(result)}
                >
                  <div className="workspace-search-result-context">
                    {result.resultScope === "channel" ? <Hash className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                    <span>{result.contextPath}</span>
                  </div>
                  <div className="workspace-search-message-content">
                    <span className="workspace-search-avatar">
                      {renderAvatar(result.avatarUser || currentUser, 34)}
                    </span>
                    <span className="workspace-search-message-copy">
                      <span className="workspace-search-message-meta">
                        <span className="workspace-search-message-author">{result.title}</span>
                        {result.timestamp && <span>{formatTime(result.timestamp)}</span>}
                      </span>
                      <span className="workspace-search-message-snippet">
                        {renderWithHighlight(result.subtitle, query)}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : workspaceSearchTab === "files" ? (
            <div className="workspace-search-results-column">
              {activeResults.map(result => (
                <button
                  key={result.id}
                  type="button"
                  className="workspace-search-file-card"
                  onClick={() => openFileSearchResult(result)}
                >
                  <span className="workspace-search-file-icon">
                    {result.icon ? (
                      <SmartImage src={result.icon} alt="" className="h-6 w-6 object-contain" fallback={<span>{result.emoji}</span>} />
                    ) : (
                      <FileIcon className="h-5 w-5" />
                    )}
                  </span>
                  <span className="workspace-search-file-copy">
                    <span className="workspace-search-file-title">{renderWithHighlight(result.title, query)}</span>
                    <span className="workspace-search-file-subtitle">{renderWithHighlight(result.subtitle, query)}</span>
                  </span>
                  <span className="workspace-search-source-pill">{result.sourceLabel}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="workspace-search-results-column">
              {activeResults.map(result => (
                <button
                  key={result.id}
                  type="button"
                  className="workspace-search-space-card"
                  onClick={() => openSpaceSearchResult(result)}
                >
                  <span className="workspace-search-space-icon">
                    {result.type === "space" ? (
                      <SpaceImageIcon space={result.space} index={result.spaceIndex || 0} className="h-7 w-7" />
                    ) : (
                      <Hash className="h-5 w-5" />
                    )}
                  </span>
                  <span className="workspace-search-space-copy">
                    <span className="workspace-search-space-title">{renderWithHighlight(result.title, query)}</span>
                    <span className="workspace-search-space-subtitle">{renderWithHighlight(result.subtitle, query)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderWorkspaceCommunityChannel = (space, channel, options = {}) => {
    const normalizedSpaceId = space?.id ?? options.pinnedItem?.spaceId
    const normalizedChannelId = channel?.id ?? options.pinnedItem?.channelId
    if (normalizedSpaceId === undefined || normalizedSpaceId === null || normalizedChannelId === undefined || normalizedChannelId === null) {
      return null
    }

    const channelName = channel?.name || options.pinnedItem?.channelName || "channel"
    const spaceName = space?.name || options.pinnedItem?.spaceName || "Space"
    const isPinnedChannel = pinnedChannelIdSet.has(String(normalizedChannelId))
    const isActiveChannel =
      activeView === "channel" &&
      String(activeChannel) === String(normalizedChannelId)
    const isMenuOpen =
      channelActionMenu &&
      String(channelActionMenu.spaceId) === String(normalizedSpaceId) &&
      String(channelActionMenu.channelId) === String(normalizedChannelId)
    const hasUnread =
      unreadChannels.some(id => String(id) === String(normalizedChannelId)) &&
      String(activeChannel) !== String(normalizedChannelId)
    const channelForActions = { ...(channel || {}), id: normalizedChannelId, name: channelName }
    const spaceForActions = { ...(space || {}), id: normalizedSpaceId, name: spaceName }

    return (
      <div
        key={options.key || `${normalizedSpaceId}-${normalizedChannelId}`}
        role="button"
        tabIndex={0}
        onClick={() => handleChannelNavigation(normalizedSpaceId, normalizedChannelId)}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            handleChannelNavigation(normalizedSpaceId, normalizedChannelId)
          }
        }}
        className={`workspace-community-channel ${options.pinned ? "is-pinned" : ""} ${isActiveChannel ? "is-active" : ""} ${isMenuOpen ? "is-menu-open" : ""}`}
        title={options.pinned ? `${spaceName} / ${channelName}` : channelName}
      >
        <Hash
          className={`workspace-community-channel-icon ${options.pinned ? "workspace-community-pinned-channel-icon" : ""}`}
          strokeWidth={1.9}
        />
        <span className="workspace-community-channel-copy">
          <span className="workspace-community-channel-name">{channelName}</span>
          {options.pinned && (
            <span className="workspace-community-channel-context">{spaceName}</span>
          )}
        </span>
        {hasUnread && <span className="workspace-community-unread-dot" />}
        {isPinnedChannel && !options.pinned && (
          <Pin className="workspace-community-channel-pin" strokeWidth={1.9} />
        )}
        <button
          type="button"
          className="workspace-community-channel-menu-button"
          onClick={event => openChannelActionMenu(event, spaceForActions, channelForActions)}
          title="Channel options"
          aria-label={`Options for ${channelName}`}
          aria-haspopup="menu"
          aria-expanded={Boolean(isMenuOpen)}
        >
          <MoreVertical className="workspace-community-channel-more" strokeWidth={1.9} />
        </button>
      </div>
    )
  }

  const renderChannelActionMenu = () => {
    if (!channelActionMenu) return null
    const isPinnedChannel = pinnedChannelIdSet.has(String(channelActionMenu.channelId))
    const canManageChannel = Boolean(channelActionMenu.canManageChannel)

    return createPortal(
      <div
        className={`workspace-channel-actions-menu ${isDarkMode ? "is-dark" : ""}`}
        style={{
          top: channelActionMenu.top,
          left: channelActionMenu.left,
        }}
        role="menu"
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          role="menuitem"
          className="workspace-channel-actions-item"
          onClick={() => toggleChannelPin(channelActionMenu.channelId)}
        >
          <Pin className={isPinnedChannel ? "fill-current" : ""} />
          <span>{isPinnedChannel ? "Unpin" : "Pin"}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="workspace-channel-actions-item"
          disabled={!canManageChannel}
          title={canManageChannel ? "Edit channel" : "Only the space owner can edit this channel"}
          onClick={() => {
            if (!canManageChannel) return
            setNewNameInput(channelActionMenu.channelName || "")
            setShowRenameModal({
              type: "channel",
              id: channelActionMenu.channelId,
              spaceId: channelActionMenu.spaceId,
              currentName: channelActionMenu.channelName || "channel"
            })
            setChannelActionMenu(null)
          }}
        >
          <Edit2 />
          <span>Edit</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="workspace-channel-actions-item is-danger"
          disabled={!canManageChannel}
          title={canManageChannel ? "Delete channel" : "Only the space owner can delete this channel"}
          onClick={() => {
            if (!canManageChannel) return
            setShowDeleteConfirm({
              type: "channel",
              id: channelActionMenu.channelId,
              spaceId: channelActionMenu.spaceId
            })
            setChannelActionMenu(null)
          }}
        >
          <Trash2 />
          <span>Delete</span>
        </button>
      </div>,
      document.body
    )
  }

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
          <div className="rounded-[2rem] p-6 w-full max-w-lg shadow-2xl bg-white/95 backdrop-blur-2xl ring-1 ring-white/50 shadow-cyan-200/30">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-sky-700 bg-clip-text text-transparent">Start Video Call</h3>
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
                className="flex-1 py-3 rounded-2xl font-bold bg-gradient-to-r from-sky-500 to-cyan-600 text-white hover:from-sky-600 hover:to-cyan-700 disabled:opacity-60 shadow-lg shadow-sky-200/50 transition-all duration-300 hover:shadow-sky-300/60 hover:scale-[1.02]"
              >
                Call Everyone
              </button>
              <button
                onClick={() => setSelectedCallMembers([])}
                className="py-3 px-4 rounded-2xl font-bold border-2 border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/50 transition-all duration-200"
              >
                Select Members
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-2xl border p-3 bg-slate-50 mt-4">
              {activeMembers.map(m => (
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
                className="px-4 py-2 rounded-2xl bg-sky-600 text-white disabled:opacity-60"
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
                  <div className="w-full h-full bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">
                    {(currentUser?.name || '?')[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area - Professional Layout with PiP */}
          <div className="absolute top-14 bottom-20 left-0 right-0 p-4">
            {/* Main Video Area */}
            <div className="w-full h-full relative">
              {/* Main/Pinned Video - Takes up most of the screen */}
              <div className="w-full h-full rounded-2xl overflow-hidden bg-[#2d3136] relative group">
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
                          <div className="absolute -inset-6 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                          <div className="absolute -inset-3 rounded-full bg-emerald-500/10 animate-pulse" />
                          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/20">
                            {renderAvatar(webrtcCallPartner, 128) || (
                              <div className="w-full h-full bg-gradient-to-br from-orange-400 to-teal-500 flex items-center justify-center text-white text-4xl font-bold">
                                {(webrtcCallPartner?.name || '?').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="mt-6 text-white/80 text-lg font-medium">{webrtcCallPartner?.name || 'Unknown'}</p>
                        <p className="mt-2 text-white/50 text-sm">Ringing...</p>
                        {/* Countdown */}
                        <div className="mt-4 w-12 h-12 rounded-full border-2 border-emerald-500/50 flex items-center justify-center">
                          <span className="text-emerald-400 text-lg font-bold">{callerCountdown}</span>
                        </div>
                      </>
                    ) : webrtcCallStatus === 'connecting' ? (
                      <>
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/20">
                          {renderAvatar(webrtcCallPartner, 128) || (
                            <div className="w-full h-full bg-gradient-to-br from-blue-400 to-sky-500 flex items-center justify-center text-white text-4xl font-bold">
                              {(webrtcCallPartner?.name || '?').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <p className="mt-6 text-white/80 text-lg font-medium">{webrtcCallPartner?.name || 'Unknown'}</p>
                        <div className="mt-4 flex gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/20">
                          {renderAvatar(webrtcCallPartner, 128) || (
                            <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white text-4xl font-bold">
                              {(webrtcCallPartner?.name || '?').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <p className="mt-6 text-white/80 text-lg font-medium">{webrtcCallPartner?.name || 'Unknown'}</p>
                        <p className="mt-2 text-white/40 text-sm">Camera off</p>
                      </>
                    )}
                  </div>
                )}
                
                {/* Name Badge for main video */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-sm font-medium">
                    {webrtcCallPartner?.name || 'Unknown'}
                  </span>
                  {pinnedParticipant?.id === webrtcCallPartner?.id && (
                    <span className="px-2 py-1 rounded-lg bg-sky-500/80 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1">
                      📌 Pinned
                    </span>
                  )}
                </div>
                
                {/* Pin button for remote participant */}
                {webrtcCallStatus === 'connected' && (
                  <button
                    onClick={() => setPinnedParticipant(pinnedParticipant?.id === webrtcCallPartner?.id ? null : webrtcCallPartner)}
                    className={`absolute top-4 right-4 p-2 rounded-lg backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 ${
                      pinnedParticipant?.id === webrtcCallPartner?.id
                        ? 'bg-sky-500/80 text-white'
                        : 'bg-black/50 text-white/70 hover:bg-black/70 hover:text-white'
                    }`}
                    title={pinnedParticipant?.id === webrtcCallPartner?.id ? 'Unpin' : 'Pin'}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                )}
                
                {/* Mic indicator for remote participant */}
                <div className="absolute top-4 left-4 p-2 rounded-lg bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <Mic className="w-4 h-4 text-white/70" />
                </div>
              </div>

              {/* Local Video - Small PiP in bottom right corner */}
              <div className="absolute bottom-4 right-4 w-48 h-36 rounded-xl overflow-hidden bg-[#2d3136] shadow-2xl border-2 border-white/10 group cursor-move hover:border-white/30 transition-all">
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
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20">
                      {renderAvatar(currentUser, 64) || (
                        <div className="w-full h-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xl font-bold">
                          {(currentUser?.name || '?').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Name Badge - You */}
                <div className="absolute bottom-2 left-2">
                  <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
                    You
                  </span>
                </div>
                
                {/* Mic indicator for self */}
                {!isWebRTCMicOn && (
                  <div className="absolute top-2 right-2 p-1 rounded-md bg-red-500/90">
                    <MicOff className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>

              {/* Pending Call Participants - Show as small tiles on left side */}
              {pendingCallParticipants.length > 0 && (
                <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                  {pendingCallParticipants.map((participant) => (
                    <div key={participant.id} className="w-32 h-24 rounded-xl overflow-hidden bg-[#2d3136] shadow-xl border border-yellow-500/30">
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#2d3136] to-[#1f2226]">
                        <div className="relative">
                          <div className="absolute -inset-2 rounded-full bg-yellow-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-yellow-500/30">
                            {renderAvatar(participant, 40) || (
                              <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold">
                                {(participant.name || '?').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 text-yellow-400/80 text-[10px]">Calling...</p>
                        <p className="text-white/60 text-xs truncate max-w-[90%]">{participant.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Connected Additional Participants - Show as small tiles */}
              {callParticipants.filter(p => p.id !== webrtcCallPartner?.id && p.id !== currentUser?.id).length > 0 && (
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  {callParticipants.filter(p => p.id !== webrtcCallPartner?.id && p.id !== currentUser?.id).map((participant) => (
                    <div 
                      key={participant.id} 
                      className={`w-32 h-24 rounded-xl overflow-hidden bg-[#2d3136] shadow-xl border cursor-pointer transition-all hover:scale-105 ${
                        pinnedParticipant?.id === participant.id ? 'border-sky-500' : 'border-white/10'
                      }`}
                      onClick={() => setPinnedParticipant(pinnedParticipant?.id === participant.id ? null : participant)}
                    >
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#2d3136] to-[#1f2226] relative group">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20">
                          {renderAvatar(participant, 48) || (
                            <div className="w-full h-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white text-base font-bold">
                              {(participant.name || '?').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <p className="mt-1 text-white/60 text-xs truncate max-w-[90%]">{participant.name}</p>
                        {/* Pin indicator */}
                        {pinnedParticipant?.id === participant.id && (
                          <div className="absolute top-1 right-1 p-1 rounded bg-sky-500/80">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          </div>
                        )}
                        {/* Pin button on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setPinnedParticipant(pinnedParticipant?.id === participant.id ? null : participant)
                          }}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="text-white text-xs font-medium">
                            {pinnedParticipant?.id === participant.id ? 'Unpin' : 'Pin'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                            <div className="w-full h-full bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center text-white text-base font-bold">
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
              setAvatarFile(null)
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
                  setAvatarFile(null)
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
                    const isActive =
                      avatarPreview === preset.url || selectedPreset === preset.id
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedPreset(preset.id)
                          setAvatarPreview(preset.url)
                          setAvatarFile(null)
                        }}
                        className={`w-16 h-16 rounded-full shadow-md overflow-hidden flex items-center justify-center transition-all ${
                          isActive ? "ring-4 ring-sky-200 scale-105" : "ring-0"
                        }`}
                        aria-label={preset.label}
                      >
                        <SmartImage
                          src={preset.url}
                          alt={preset.label}
                          className="w-full h-full object-cover"
                          loading="eager"
                        />
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
                          setAvatarFile(f)
                        }
                        reader.readAsDataURL(f)
                      }}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                    />
                  </label>
                  {avatarPreview && (
                    <div className="mt-3">
                      <SmartImage
                        src={avatarPreview}
                        alt="preview"
                        apiBase={getBackendRelativeImageApiBase(avatarPreview)}
                        className="w-32 h-32 rounded-full object-cover border"
                        loading="eager"
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
                      e?.preventDefault?.()
                      if (isSavingProfile) return
                      setIsSavingProfile(true)
                      try {
                        const stored = currentUser
                        const uid = getUserIdValue(stored)
                        if (!uid) throw new Error("No user id")

                        // Only send avatar-related fields to avoid overwriting other data
                        const avatarVersion = Date.now()
                        const savedAvatarUrl = avatarFile
                          ? await uploadAvatarFile(avatarFile)
                          : avatarPreview
                        const updates = {
                          avatar_url: savedAvatarUrl || null,
                          avatar_preset: selectedPreset || null,
                          avatar_version: avatarVersion,
                          avatar_updated_at: avatarVersion
                        }

                        // Optimistically update UI immediately for fast feedback
                        const optimisticMerged = { ...stored, ...updates }
                        saveAuth(optimisticMerged, getToken())
                        setCurrentUser(optimisticMerged)
                        syncUserCollections(optimisticMerged)
                        setAvatarFile(null)
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
                          avatar_version: updates.avatar_version,
                          avatar_updated_at: updates.avatar_updated_at,
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
                    className="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold shadow disabled:opacity-60"
                  >
                    {isSavingProfile ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarPreview(null)
                      setSelectedPreset(null)
                      setAvatarFile(null)
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

      {contextDraft && (
        <CreateContextModal
          isDarkMode={isDarkMode}
          owners={activeMembers}
          value={contextDraft}
          isEditing={Boolean(editingContextId)}
          onChange={setContextDraft}
          onClose={() => {
            setContextDraft(null)
            setEditingContextId(null)
          }}
          onSubmit={createOrUpdateContextFromDraft}
        />
      )}

      {showTaskModal && (
        <TaskModal
          visible={showTaskModal}
          onClose={() => {
            setShowTaskModal(false)
            setTaskModalDraft(null)
          }}
          members={taskAssignableMembers}
          currentUser={currentUser}
          spaceId={activeSpace}
          source={taskCreationSource}
          channelId={taskCreationSource === "channel" ? activeChannel : null}
          channelName={taskCreationSource === "channel" ? activeChannelData?.name || "" : ""}
          spaceName={currentSpace?.name || ""}
          initialTaskText={taskModalDraft?.initialTaskText || ""}
          initialAssignees={taskModalDraft?.initialAssignees || []}
          sourceMessageId={taskModalDraft?.sourceMessageId || null}
          listId={taskModalDraft?.listId || "my-tasks"}
          listName={taskModalDraft?.listName || "My Tasks"}
          listOptions={taskModalDraft?.listOptions || [{ id: "my-tasks", title: "My Tasks" }]}
          onTaskCreated={(payload) => {
            // optimistic UI: add a task message to current chat and add to tasks list
            try {
              const chatId = getActiveChatId()
              const newMsg = {
                id: `tmp-task-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                userId: currentUser?.id,
                text: payload.message,
                timestamp: payload.timestamp || new Date().toISOString(),
                type: 'task',
                assigned_to: payload.assigned_to,
                assignee_statuses: payload.assignee_statuses,
                list_id: payload.list_id,
                listName: payload.listName,
                source: payload.source,
                channel_id: payload.channel_id || payload.channelId,
                channelName: payload.channelName,
                spaceId: payload.spaceId || payload.space_id,
                spaceName: payload.spaceName,
                contextIds: taskModalDraft?.contextId ? [taskModalDraft.contextId] : [],
                isDecision: false,
                taskId: payload.id,
                attachments: [],
                status: 'sent',
                optimistic: false
              }
              if (payload.source === "channel" && chatId) {
                setMessages(prev => ({
                  ...prev,
                  [chatId]: [...(prev[chatId] || []), newMsg]
                }))
              }
              setTasksList(prev => [payload, ...(prev || [])])
              if (payload.sourceMessageId) {
                patchMessage(payload.sourceMessageId, message => ({
                  ...message,
                  taskId: payload.id,
                  taskStatus: payload.status || "pending",
                  assigned_to: payload.assigned_to || [],
                  assignee_statuses: payload.assignee_statuses || {},
                  list_id: payload.list_id,
                  listName: payload.listName,
                }))
              }
              if (taskModalDraft?.contextId) {
                const taskId = ensureTaskForContext(taskModalDraft.contextId, payload)
                setContextItems(prev =>
                  prev.map(context =>
                    String(context.id) === String(taskModalDraft.contextId)
                      ? {
                          ...appendContextActivity(context, {
                            id: `activity-task-${payload.id}-${Date.now()}`,
                            type: "task_added",
                            userId: currentUser.id,
                            taskId: taskId || payload.id,
                            timestamp: payload.timestamp || new Date().toISOString(),
                          }),
                          taskIds: Array.from(new Set([...(context.taskIds || []), taskId || payload.id])),
                        }
                      : context
                  )
                )
              }
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
                    }} className="px-4 py-2 rounded-2xl bg-sky-600 text-white font-bold">Send OTP</button>
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
                      }} className="px-4 py-2 rounded-2xl bg-sky-600 text-white">Verify</button>
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
                            if (j?.setupToken) setOrgPasswordSetupToken(j.setupToken)

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
                      className={`px-4 py-2 rounded-2xl bg-sky-600 text-white flex items-center gap-2 ${orgDnsChecking ? 'opacity-70 cursor-not-allowed' : ''}`}>
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
                    <button onClick={() => { setShowOrgModal(false); setOrgStage('form') }} className="px-4 py-2 rounded-2xl bg-sky-600 text-white">Done</button>
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

      {!isMobile && (
        <aside className={`workspace-app-rail hidden h-full w-[68px] shrink-0 flex-col items-center border-r px-2 py-3 md:flex ${
          isDarkMode
            ? "border-white/10 bg-[#0b1118]/95 text-slate-300"
            : "border-slate-200/80 bg-white/90 text-slate-500 shadow-[12px_0_34px_rgba(15,23,42,0.04)]"
        }`}>
          <button
            type="button"
            onClick={openHomePage}
            className={`workspace-app-rail-logo flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
              isDarkMode
                ? "border-white/10 bg-white/[0.06] hover:bg-white/[0.09]"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
            title="Spacess home"
            aria-label="Spacess home"
          >
            <SmartImage
              src={isDarkMode ? "/logo%20SL.png" : "/logo%20SD.png"}
              alt="Spacess"
              className="h-6 w-6 object-contain"
              loading="eager"
              fetchPriority="high"
            />
          </button>

          <nav className="mt-5 flex w-full flex-1 flex-col items-center gap-1.5" aria-label="Primary app navigation">
            {appRailItems.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.action}
                  title={item.title}
                  aria-label={item.title}
                  aria-current={item.active ? "page" : undefined}
                  className={`workspace-app-rail-button relative flex h-[58px] w-[58px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold transition-all ${item.active ? "is-active" : ""} ${
                    item.active
                      ? isDarkMode
                        ? "bg-sky-400/14 text-sky-200 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.22)]"
                        : "bg-sky-50 text-sky-700 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.55)]"
                      : isDarkMode
                        ? "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.active && (
                    <span className={`workspace-app-rail-active-marker absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full ${isDarkMode ? "bg-sky-300" : "bg-sky-600"}`} />
                  )}
                  {item.imageSrc ? (
                    <SmartImage
                      src={item.imageSrc}
                      alt={item.label}
                      className="workspace-app-rail-image"
                      fallback={Icon ? <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={1.9} /> : null}
                    />
                  ) : Icon ? (
                    <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={1.9} />
                  ) : null}
                  <span className="workspace-app-rail-label">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="workspace-app-rail-account relative mt-3">
            <button
              type="button"
              onClick={() => setShowUserMenu(prev => !prev)}
              className={`workspace-app-rail-profile flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border transition ${
                isDarkMode
                  ? "border-white/10 bg-white/[0.06] hover:bg-white/[0.09]"
                  : "border-slate-200 bg-slate-50 hover:bg-white"
              }`}
              title="Profile"
              aria-label="Profile"
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
            >
              {renderAvatar(currentUser, 36)}
            </button>

            {showUserMenu && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[54] cursor-default border-0 bg-transparent p-0"
                  aria-label="Close profile menu"
                  onClick={() => setShowUserMenu(false)}
                />
                <div
                  className={`workspace-rail-profile-menu ${isDarkMode ? "is-dark" : ""}`}
                  role="menu"
                  aria-label="Profile menu"
                >
                  <div className="workspace-rail-profile-menu-header">
                    <span className="workspace-rail-profile-menu-avatar">
                      {renderAvatar(currentUser, 44)}
                    </span>
                    <span className="workspace-rail-profile-menu-copy">
                      <span className="workspace-rail-profile-menu-name">{currentUser?.name || "Profile"}</span>
                      <span className="workspace-rail-profile-menu-email">{currentUser?.email || "Signed in"}</span>
                      <span className="workspace-rail-profile-menu-status">Available</span>
                    </span>
                  </div>

                  <div className="workspace-rail-profile-menu-actions">
                    <button type="button" role="menuitem" onClick={openProfileEditor}>
                      <UserPlus className="h-4 w-4" />
                      <span>Edit Profile</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openNotificationsPage()
                        setShowUserMenu(false)
                      }}
                    >
                      <Bell className="h-4 w-4" />
                      <span>Notifications</span>
                      {unreadNotifications.length ? (
                        <span className="workspace-rail-profile-menu-badge">
                          {unreadNotifications.length > 9 ? "9+" : unreadNotifications.length}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="is-danger"
                      onClick={() => {
                        setShowUserMenu(false)
                        handleLogout()
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      )}

      {renderChannelActionMenu()}
      {renderMobileAccountSidebar()}

      <div className="workspace-shell flex min-w-0 flex-1">
      {activeView === "home" ? (
        <HomeHub
          currentUser={currentUser}
          friends={homeFriends}
          drafts={drafts}
          tasks={tasksList || []}
          files={homeFiles}
          pendingRequests={pendingFriendRequests}
          section={homeSection}
          activeDMUser={homeActiveDMUser}
          dmMessages={homeDMMessages}
          dmInput={homeDMInput}
          dmSending={homeDMSending}
          renderAvatar={renderAvatar}
          onSectionChange={handleHomeSectionChange}
          onOpenWorkspace={openWorkspaceHome}
          onOpenDirectMessages={openWorkspaceFriendsHome}
          onOpenDM={openHomeDM}
          onOpenAddConnection={openHomeConnect}
          onOpenTask={openTaskDetailView}
          onOpenDraft={openDraft}
          onDeleteDraft={deleteDraftById}
          onSendDM={sendHomeDM}
          onSaveDraft={saveHomeDraft}
          onAcceptRequest={notificationId => handleNotificationAction(notificationId, "friend_request")}
          onRejectRequest={notificationId => handleRejectNotification(notificationId, "friend_request")}
          onOpenFile={openHomeFile}
          onOpenDocumentsHub={openDocumentsPage}
          onConnectMail={handleConnectGoogleDocs}
          onRefreshMail={refreshHomeMail}
          onOpenNotifications={openNotificationsPage}
          onOpenProfile={() => {
            setAvatarPreview(currentUser?.avatar_url || null)
            setAvatarFile(null)
            setShowProfileModal(true)
          }}
          onOpenAdminDashboard={openAdminDashboard}
          canOpenAdminDashboard={canOpenAdminDashboard}
          onConnectUser={sendFriendRequest}
          connectPreferredPane={connectPreferredPane}
          setConnectPreferredPane={setConnectPreferredPane}
          setDmInput={setHomeDMInput}
          isDarkMode={isDarkMode}
          isMobile={isMobile}
          apiBase={API_BASE}
          gmailAttachments={dedupedGmailAttachments}
          googleAccessToken={googleAccessToken}
          resolveProtectedFileUrl={fetchProtectedUrlAndCreateObjectURL}
          onThemeChange={setIsDarkMode}
        />
      ) : activeView === "contexts" ? (
        currentContext ? (
          <LivingContextPanel
            isDarkMode={isDarkMode}
            context={currentContext}
            ownerName={getContextOwnerName(currentContext.ownerId)}
            contributorNames={(currentContext.contributorIds || []).map(getContextOwnerName)}
            linkedMessages={currentContextMessages}
            files={currentContextFiles}
            decisions={currentContextDecisions}
            tasks={currentContextTasks.map(task => ({
              ...task,
              assigneeLabel: (task.assigneeIds || []).map(getContextOwnerName).join(", ") || "Unassigned",
            }))}
            activity={currentContextActivity}
            canEdit={isContextManager(currentContext)}
            canAddSelectedMessage={selectedMessageIds.length > 0}
            onAddSelectedMessage={async () => {
              for (const messageId of selectedMessageIds) {
                await addMessageToContext(currentContext.id, messageId)
              }
            }}
            onMarkDecision={contextsSourceView === "channel" ? (() => {
              const selected = getMessageById(selectedMessageIds[0])
              if (selected) markMessageDecision(selected)
            }) : undefined}
            onCreateTask={() => {
              const selected = getMessageById(selectedMessageIds[0])
              if (selected) openTaskFromMessage(selected)
            }}
            onEdit={() => {
              setEditingContextId(currentContext.id)
              setContextDraft({
                title: currentContext.title,
                summary: currentContext.summary,
                status: currentContext.status,
                ownerId: String(currentContext.ownerId),
                messageIds: currentContext.linkedMessageIds || [],
              })
            }}
            onClose={() => {
              setOpenContextId(null)
              pushAppRoute("/contexts")
            }}
            formatTime={formatContextTime}
          />
        ) : (
          <ContextsHub
            isDarkMode={isDarkMode}
            contexts={currentChannelContexts}
            renderOwner={getContextOwnerName}
            formatUpdatedTime={formatContextTime}
            onBack={closeContextsPage}
            onOpenContext={openContext}
            sourceLabel={
              contextsSourceView === "dm"
                ? `Direct message with ${getUser(activeDMUser)?.name || "contact"}`
                : currentSpace?.name && activeChannelData?.name
                  ? `${currentSpace.name} / #${activeChannelData.name}`
                  : activeChannelData?.name
                    ? `#${activeChannelData.name}`
                    : ""
            }
          />
        )
      ) : (
        <>
      {shouldShowSpacesSidebar && (
        <>
      {/* Mobile Sidebar Overlay */}
      {isMobile && mobileView === "spaces" && (
        <div 
          className="mobile-sidebar-overlay"
          onClick={() => setMobileView("chat")}
        />
      )}

      {/* Left Sidebar - SPACES */}
      <div
        className={`${
          sidebarCollapsed ? "w-[76px]" : "w-[300px]"
        } ${isMobile ? (mobileView === "spaces" ? "flex fixed inset-0 left-0 w-screen max-w-none mobile-slide-in-left z-[70]" : "hidden") : "flex"} flex-col transition-all ease-[cubic-bezier(0.32,0.72,0,1)] duration-300 z-40 flex-shrink-0 liquid-glass-sidebar`}
      >
        {/* Mobile Swipe Indicator */}
        {isMobile && mobileView === "spaces" && (
          <div className="swipe-indicator mt-2" />
        )}
        {/* ... (Sidebar Content) ... */}
        <div className={`workspace-sidebar-topbar px-4 py-3 ${isMobile ? 'pt-4 pb-4' : ''} flex items-center justify-between h-[60px] border-b ${isDarkMode ? 'border-[var(--border-light)]' : 'border-slate-100/60'}`}>
          <div className="flex gap-2 ml-auto">
            {showLegacySidebarControls && isMobile && (
              <button
                onClick={() => setShowCreateSpaceModal(true)}
                className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#2C2C2C] text-slate-400 hover:text-sky-400' : 'hover:bg-slate-100 text-slate-400 hover:text-sky-600'}`}
                title="Create Space"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            {isMobile && (
              <button
                onClick={() => setMobileView("chat")}
                className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-sky-400' : 'hover:bg-slate-100 text-slate-400 hover:text-sky-600'}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {showLegacySidebarControls && !sidebarCollapsed && !isMobile && (
              <button
                onClick={() => setShowCreateSpaceModal(true)}
                className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#2C2C2C] text-slate-400 hover:text-sky-400' : 'hover:bg-slate-100 text-slate-400 hover:text-sky-600'}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            {/* Admin dashboard access - visible to company admins/owners of verified orgs */}
            {showLegacySidebarControls && !sidebarCollapsed && !isMobile && canOpenAdminDashboard && (
              <button
                onClick={openAdminDashboard}
                className="p-1.5 rounded-lg transition-colors hover:bg-slate-100 text-slate-400 hover:text-sky-600"
                title="Admin Dashboard"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {showLegacySidebarSearch && (!sidebarCollapsed || isMobile) && (
          <div className="hidden">
            <div className="relative group">
              <Search className="absolute left-3 top-2.5 w-4 h-4 transition-colors text-slate-400 group-focus-within:text-sky-500" />
              <input
                type="search"
                placeholder="Search spaces and DMs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-xl text-[13px] focus:outline-none transition-all ease-in-out duration-300 ${
                  isDarkMode
                    ? 'bg-slate-800/60 border border-slate-700/50 focus:bg-slate-800 focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/50 text-slate-200 hover:bg-slate-800/80 placeholder:text-slate-500'
                    : 'bg-slate-100/60 border border-slate-200/50 focus:bg-white focus:ring-2 focus:ring-sky-500/25 focus:border-sky-300 text-slate-700 hover:bg-slate-100/80 hover:border-slate-200 placeholder:text-slate-400 shadow-sm'
                }`}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-4">
          {(!sidebarCollapsed || isMobile) ? (
            <>
            <div className={`${isDirectMessagesShell ? "workspace-dms-sidebar" : "workspace-communities-sidebar"} animate-fade-in`}>
              {isDirectMessagesShell ? (
                <>
                  <div className="workspace-communities-title-row">
                    <h2>Direct Messages</h2>
                    <div className="workspace-communities-title-actions">
                      <button
                        type="button"
                        onClick={openHomeConnect}
                        className="workspace-communities-action-button"
                        title="New direct message"
                        aria-label="New direct message"
                      >
                        <Plus className="h-5 w-5" strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>

                  <div className="workspace-dm-list">
                    {friends.length === 0 ? (
                      <div className="workspace-dm-empty">
                        <Users className="h-5 w-5" strokeWidth={1.8} />
                        <span>No direct messages yet</span>
                      </div>
                    ) : (
                      friends.map(friend => {
                        const isActiveFriend = activeView === "dm" && String(activeDMUser) === String(friend.id)
                        return (
                          <button
                            key={friend.id}
                            type="button"
                            onClick={() => {
                              setActiveDMUser(friend.id)
                              setHomeActiveDMUser(friend.id)
                              setActiveChannelTab("messages")
                              setActiveView("dm")
                              if (isMobile) setMobileView("chat")
                              loadDMMessagesForUser(friend.id)
                              pushAppRoute(`/dm/${encodeURIComponent(slugifyRoutePart(friend.name) || String(friend.id))}`)
                            }}
                            className={`workspace-dm-row ${isActiveFriend ? "is-active" : ""}`}
                          >
                            <span className="workspace-dm-avatar">
                              {renderAvatar(friend, 36)}
                              <span className={`workspace-dm-status ${friend.status === "online" ? "is-online" : ""}`} />
                            </span>
                            <span className="workspace-dm-copy">
                              <span className="workspace-dm-name">{friend.name}</span>
                              <span className="workspace-dm-meta">{friend.status === "online" ? "Online" : "Offline"}</span>
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </>
              ) : (
                <>
              <div className="workspace-communities-title-row">
                <h2>Spaces</h2>
                <div className="workspace-communities-title-actions">
                  <button
                    type="button"
                    onClick={() => setShowCreateSpaceModal(true)}
                    className="workspace-communities-action-button"
                    title="Create space"
                    aria-label="Create space"
                  >
                    <Plus className="h-5 w-5" strokeWidth={1.8} />
                  </button>
                </div>
              </div>

              <div className="workspace-community-list">
                {pinnedChannels.length > 0 && (
                  <section className="workspace-community-pinned-section">
                    <div className="workspace-community-section-label">
                      <Pin className="h-3.5 w-3.5 fill-current" strokeWidth={1.9} />
                      <span>Pinned</span>
                    </div>
                    <div className="workspace-community-channel-list">
                      {pinnedChannels.map(item => {
                        const fallback = findSpaceAndChannel(item.channelId)
                        const pinnedSpace =
                          fallback.space ||
                          spaces.find(space => String(space.id) === String(item.spaceId)) ||
                          { id: item.spaceId, name: item.spaceName || "Space" }
                        const pinnedChannel =
                          fallback.channel ||
                          { id: item.channelId, name: item.channelName || "channel" }

                        return renderWorkspaceCommunityChannel(pinnedSpace, pinnedChannel, {
                          pinned: true,
                          pinnedItem: item,
                          key: `pinned-visible-${item.spaceId || pinnedSpace.id}-${item.channelId}`
                        })
                      })}
                    </div>
                  </section>
                )}

                {spaces.map((space, spaceIndex) => {
                  const accessibleChannels = getAccessibleChannelsForSpace(space)
                  const isSpaceActive = activeView === "channel" && String(activeSpace) === String(space.id)

                  return (
                    <section key={space.id} className="workspace-community-section">
                      {spaceIndex > 0 && <div className="workspace-community-divider" />}
                      <button
                        type="button"
                        onClick={() => toggleSpaceExpansion(space.id)}
                        className={`workspace-community-space-heading ${isSpaceActive ? "is-active" : ""}`}
                        title={space.name}
                      >
                        <span className="workspace-community-space-icon">
                          <SpaceImageIcon space={space} index={spaceIndex} className="h-7 w-7" />
                        </span>
                        <span className="workspace-community-space-name">{space.name}</span>
                        {space.expanded === false ? (
                          <ChevronRight className="workspace-community-space-chevron" strokeWidth={1.9} />
                        ) : (
                          <ChevronDown className="workspace-community-space-chevron" strokeWidth={1.9} />
                        )}
                      </button>

                      {space.expanded !== false && (
                        <div className="workspace-community-channel-list">
                          {accessibleChannels.map(channel =>
                            renderWorkspaceCommunityChannel(space, channel, {
                              key: `space-visible-${space.id}-${channel.id}`
                            })
                          )}

                          {space.ownerId === currentUser?.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSpace(space.id)
                                setShowChannelModal(true)
                              }}
                              className="workspace-community-add-channel"
                            >
                              <Plus className="h-4 w-4" strokeWidth={1.6} />
                              <span>Add channel</span>
                            </button>
                          )}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
                </>
              )}
            </div>
            <div className="hidden">
              {/* Conditional Rendering: Show Search Results or Standard Tree */}
              {debouncedSearchQuery.trim().length > 0 ? (
                <div className="space-y-3">
                  <div className="px-2 mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Search Results
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isDarkMode ? "bg-[#2C2C2C] text-slate-300" : "bg-slate-100 text-slate-500"
                    }`}>
                      {spaceSearchResults.length + dmSearchResults.length}
                    </span>
                  </div>
                  {spaceSearchResults.length + dmSearchResults.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs font-medium">
                      No results found
                    </div>
                  ) : (
                    <>
                      {spaceSearchResults.length > 0 && (
                        <div className="space-y-2">
                          <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Spaces
                          </div>
                          {spaceSearchResults.map(result => (
                            <button
                              key={result.id}
                              type="button"
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
                                  const matchedSpace = spaces.find(space => String(space.id) === String(result.spaceId))
                                  const firstChannel = getAccessibleChannelsForSpace(matchedSpace)[0]
                                  if (firstChannel) {
                                    handleChannelNavigation(result.spaceId, firstChannel.id)
                                  } else {
                                    setActiveSpace(result.spaceId)
                                    setActiveView("channel")
                                  }
                                }
                              }}
                              className={`w-full rounded-xl border p-2 text-left shadow-sm transition-all group ${
                                isDarkMode
                                  ? "border-white/[0.06] bg-white/[0.04] hover:bg-white/[0.07]"
                                  : "border-slate-100 bg-white hover:shadow-md"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`p-1.5 rounded-lg ${
                                    result.type === "message"
                                      ? "bg-sky-50 text-sky-500"
                                      : isDarkMode
                                        ? "bg-white/10 text-slate-300"
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
                                <span className={`text-xs font-bold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                                  {result.title}
                                </span>
                              </div>
                              <div className={`text-xs truncate pl-9 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                {renderWithHighlight(
                                  result.subtitle,
                                  debouncedSearchQuery
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {dmSearchResults.length > 0 && (
                        <div className="space-y-2">
                          <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Direct Messages
                          </div>
                          {dmSearchResults.map(result => (
                            <button
                              key={result.id}
                              type="button"
                              onClick={() => {
                                if (result.userId) {
                                  setActiveDMUser(result.userId)
                                  setActiveView("dm")
                                  if (isMobile) setMobileView("chat")
                                  if (result.messageId) {
                                    setTargetMessageId(result.messageId)
                                    setPinnedMessageId(result.messageId)
                                    setHighlightTerm(debouncedSearchQuery)
                                  } else {
                                    setPinnedMessageId(null)
                                  }
                                }
                              }}
                              className={`sidebar-section-row flex min-h-11 w-full items-center gap-3 px-2.5 py-2 text-left transition-colors duration-150 ease-in-out ${
                                activeView === "dm" && activeDMUser === result.userId
                                  ? isDarkMode ? "bg-[rgba(96,165,250,0.16)] text-slate-100" : "bg-[rgba(59,130,246,0.12)] text-slate-900"
                                  : isDarkMode ? "text-slate-300 hover:bg-[rgba(255,255,255,0.06)] hover:text-slate-100" : "text-slate-600 hover:bg-[rgba(15,23,42,0.06)] hover:text-slate-900"
                              }`}
                            >
                              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-base">
                                {result.icon}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2">
                                  <span className="block truncate text-[13px] font-semibold">
                                    {result.title}
                                  </span>
                                  {result.timestamp && (
                                    <span className={`shrink-0 text-[10px] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                                      {formatTime(result.timestamp)}
                                    </span>
                                  )}
                                </span>
                                <span className={`block truncate text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                  {renderWithHighlight(result.subtitle, debouncedSearchQuery)}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <button
                    onClick={() => {
                      if (!googleCalendarToken) {
                        setShowCalendarConnectModal(true)
                      } else {
                        setActiveView("calendar")
                        setActiveSpace(null)
                      }
                    }}
                    className={`w-full flex h-10 items-center gap-3 px-3 rounded-full cursor-pointer transition-colors duration-150 ease-in-out mb-3 group ${
                      activeView === "calendar"
                        ? (isDarkMode
                            ? "bg-[rgba(96,165,250,0.16)] text-slate-100"
                            : "bg-[rgba(59,130,246,0.12)] text-sky-700")
                        : (isDarkMode
                            ? "text-slate-300 hover:bg-[rgba(255,255,255,0.06)] hover:text-slate-100"
                            : "text-slate-600 hover:bg-[rgba(15,23,42,0.06)] hover:text-slate-900")
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-full transition-colors duration-150 ease-in-out ${
                        activeView === "calendar"
                          ? (isDarkMode
                              ? "text-slate-100"
                              : "text-sky-700")
                          : (isDarkMode
                              ? "text-slate-400 group-hover:text-slate-100"
                              : "text-slate-500 group-hover:text-slate-900")
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-[13px] tracking-normal">
                      Calendar
                    </span>
                  </button>

                  {pinnedChannels.length > 0 && (
                    <section className="sidebar-section-group">
                      <div className="sidebar-section-header">
                        Pinned channels
                      </div>
                      <div className="sidebar-section-list">
                        {pinnedChannels.map(item => {
                          const isActivePinned =
                            activeView === "channel" &&
                            String(activeChannel) === String(item.channelId)
                          return (
                            <button
                              key={`pinned-${item.spaceId}-${item.channelId}`}
                              onClick={() => handleChannelNavigation(item.spaceId, item.channelId)}
                              className={`sidebar-section-row flex h-8 w-full items-center gap-2.5 px-2.5 text-[13px] font-medium transition-colors duration-150 ease-in-out ${
                                isActivePinned
                                  ? (isDarkMode ? "bg-[rgba(96,165,250,0.16)] text-slate-100" : "bg-[rgba(59,130,246,0.12)] text-sky-800")
                                  : (isDarkMode ? "text-slate-400 hover:bg-[rgba(255,255,255,0.06)] hover:text-slate-100" : "text-slate-600 hover:bg-[rgba(15,23,42,0.06)] hover:text-slate-900")
                              }`}
                              title={`${item.spaceName || "Space"} / #${item.channelName || "channel"}`}
                            >
                              <Hash className={`h-3.5 w-3.5 ${isActivePinned ? (isDarkMode ? "text-slate-100" : "text-sky-700") : ""}`} />
                              <span className="min-w-0 flex-1 truncate text-left">{item.channelName || "channel"}</span>
                              {unreadChannels.some(id => String(id) === String(item.channelId)) &&
                                String(activeChannel) !== String(item.channelId) && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
                                )}
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  )}

                  <section className="sidebar-section-group">
                    <button
                      type="button"
                      onClick={() =>
                        setSidebarSectionOpen(prev => ({
                          ...prev,
                          spaces: !prev.spaces
                        }))
                      }
                      className={`sidebar-section-header w-full cursor-pointer rounded-xl transition-colors ${
                        isDarkMode ? "hover:bg-white/[0.06]" : "hover:bg-slate-100/70"
                      }`}
                      aria-expanded={sidebarSectionOpen.spaces}
                    >
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        {sidebarSectionOpen.spaces ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="truncate">Your Spaces</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-[#2C2C2C] text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                        {spaces.length}
                      </span>
                    </button>

                    {sidebarSectionOpen.spaces && (
                    <div className="sidebar-section-list">
                      {spaces.map((space, spaceIndex) => (
                        <div key={space.id} className="mb-1">
                          <div
                            className={`sidebar-section-row flex h-9 items-center gap-2 px-2 cursor-pointer transition-colors duration-150 ease-in-out group ${
                              activeView === "channel" && activeSpace === space.id
                                ? (isDarkMode
                                    ? "bg-[rgba(96,165,250,0.16)] text-slate-100"
                                    : "bg-[rgba(59,130,246,0.12)] text-slate-900")
                                : (isDarkMode
                                    ? "bg-transparent text-slate-300 hover:bg-[rgba(255,255,255,0.06)] hover:text-slate-100"
                                    : "bg-transparent text-slate-600 hover:bg-[rgba(15,23,42,0.06)] hover:text-slate-900")
                            }`}
                            onClick={() => {
                              toggleSpaceExpansion(space.id)
                            }}
                          >
                        <span className="flex h-7 w-7 items-center justify-center rounded-none bg-transparent transition-colors">
                          <SpaceImageIcon space={space} index={spaceIndex} className="h-5 w-5" />
                        </span>
                        <span
                          className={`font-semibold text-[13px] truncate flex-1 transition-colors ${
                            activeView === "channel" && activeSpace === space.id
                              ? (isDarkMode ? "text-slate-100" : "text-slate-900")
                              : (isDarkMode ? "text-slate-300 group-hover:text-slate-100" : "text-slate-600 group-hover:text-slate-900")
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
                        </div>
                      </div>

                      {space.expanded && (
                        <div className={`ml-5 pl-3 border-l mt-1 space-y-0.5 ${isDarkMode ? "border-white/[0.06]" : "border-slate-200/60"}`}>
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
                              {(() => {
                                const isPinnedChannel = pinnedChannelIdSet.has(String(channel.id))
                                return (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  handleChannelNavigation(space.id, channel.id)
                                }
                                onKeyDown={event => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    handleChannelNavigation(space.id, channel.id)
                                  }
                                }}
                                className={`sidebar-section-row flex h-8 items-center gap-2.5 w-full px-2.5 text-[13px] font-medium transition-colors duration-150 ease-in-out ${
                                  activeView === "channel" &&
                                  activeChannel === channel.id
                                    ? (isDarkMode
                                        ? "bg-[rgba(96,165,250,0.16)] text-slate-100"
                                        : "bg-[rgba(59,130,246,0.12)] text-sky-800")
                                    : (isDarkMode
                                        ? "text-slate-400 hover:text-slate-100 hover:bg-[rgba(255,255,255,0.06)]"
                                        : "text-slate-500 hover:text-slate-900 hover:bg-[rgba(15,23,42,0.06)]")
                                }`} 
                              >
                                <Hash
                                  className={`w-3.5 h-3.5 transition-colors ${
                                    activeChannel === channel.id
                                      ? (isDarkMode ? "text-slate-100" : "text-sky-700")
                                      : (isDarkMode ? "text-slate-400 group-hover/channel:text-slate-100" : "text-slate-300 group-hover/channel:text-slate-700")
                                  }`} 
                                />
                                <span className="truncate flex-1 text-left">
                                  {channel.name}
                                </span>

                                {/* Unread Indicator */}
                                {unreadChannels.some(id => String(id) === String(channel.id)) &&
                                  String(activeChannel) !== String(channel.id) && (
                                    <div className="w-1.5 h-1.5 rounded-full mr-1 bg-[#2C2C2C]"></div>
                                  )}

                                <span
                                  role="button"
                                  tabIndex={0}
                                  className={`${isPinnedChannel ? "flex" : "hidden group-hover/channel:flex"} h-6 w-6 items-center justify-center rounded-full transition-colors ${
                                    isPinnedChannel
                                      ? (isDarkMode ? "text-sky-300 hover:bg-white/10" : "text-sky-600 hover:bg-slate-200/70")
                                      : (isDarkMode ? "text-slate-500 hover:bg-white/10 hover:text-slate-200" : "text-slate-300 hover:bg-slate-200/70 hover:text-slate-600")
                                  }`}
                                  title={isPinnedChannel ? "Unpin channel" : "Pin channel"}
                                  aria-label={isPinnedChannel ? "Unpin channel" : "Pin channel"}
                                  onClick={event => {
                                    event.stopPropagation()
                                    toggleChannelPin(channel.id)
                                  }}
                                  onKeyDown={event => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      toggleChannelPin(channel.id)
                                    }
                                  }}
                                >
                                  <Pin className={`h-3.5 w-3.5 ${isPinnedChannel ? "fill-current" : ""}`} />
                                </span>

                                {space.ownerId === currentUser?.id && (
                                  <div className="hidden group-hover/channel:flex items-center gap-1">
                                    <span
                                      className="p-1 text-blue-500 hover:text-blue-600 cursor-pointer"
                                      onClick={e => {
                                        e.stopPropagation()
                                        setNewNameInput(channel.name)
                                        setShowRenameModal({
                                          type: "channel",
                                          id: channel.id,
                                          spaceId: space.id,
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
                                          id: channel.id,
                                          spaceId: space.id
                                        })
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </span>
                                  </div>
                                )}
                              </div>
                                )
                              })()}
                            </div>
                          ))}
                          {space.ownerId === currentUser?.id && (
                            <button
                              onClick={() => {
                                setActiveSpace(space.id)
                                setShowChannelModal(true)
                              }}
                              className={`sidebar-section-row flex h-8 items-center gap-2.5 w-full px-2.5 text-[13px] transition-colors duration-150 ease-in-out group mt-1 ${
                                isDarkMode
                                  ? "text-slate-400 hover:text-slate-100 hover:bg-[rgba(255,255,255,0.06)]"
                                  : "text-slate-400 hover:text-slate-900 hover:bg-[rgba(15,23,42,0.06)]"
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add channel</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                    </div>
                  )}
                  </section>

                  <section className={`rounded-[20px] border p-3.5 ${
                    isDarkMode ? "border-white/10 bg-[#111111]" : "border-[#eef2f6] bg-[#fbfdff]"
                  }`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSidebarSectionOpen(prev => ({
                            ...prev,
                            dms: !prev.dms
                          }))
                        }
                        className={`inline-flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-lg text-left text-sm font-semibold transition-colors ${
                          isDarkMode ? "text-slate-200 hover:bg-white/[0.06]" : "text-[#374151] hover:bg-[#f4f7fb]"
                        }`}
                        aria-expanded={sidebarSectionOpen.dms}
                      >
                        {sidebarSectionOpen.dms ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        )}
                        <span className="truncate">Direct Messages</span>
                      </button>
                      <button
                        type="button"
                        onClick={openHomeConnect}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                          isDarkMode
                            ? "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                            : "text-[#6b7280] hover:bg-[#f4f7fb] hover:text-[#111827]"
                        }`}
                        title="Start a new direct message"
                        aria-label="Start a new direct message"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {sidebarSectionOpen.dms && (
                    <div className="flex min-h-[220px] flex-col gap-2 overflow-y-auto pr-1">
                      {friends.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center px-3 py-6 text-center">
                          <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                            isDarkMode ? "bg-slate-800 text-slate-500" : "bg-slate-100/80 text-slate-400"
                          }`}>
                            <Users className="h-6 w-6" />
                          </div>
                          <p className={`mb-3 text-sm font-medium ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
                            No friends yet.
                          </p>
                          <button
                            type="button"
                            onClick={openHomeConnect}
                            className={`text-xs font-bold hover:underline ${isDarkMode ? "text-sky-400" : "text-sky-600"}`}
                          >
                            Find people
                          </button>
                        </div>
                      ) : (
                        friends.map(friend => (
                          <button
                            key={friend.id}
                            type="button"
                            onClick={() => {
                              setActiveDMUser(friend.id)
                              setActiveView("dm")
                              if (isMobile) setMobileView("chat")
                            }}
                            className={`flex min-w-0 items-center gap-3 rounded-[16px] px-3 py-2 text-left transition-colors duration-150 ease-in-out ${
                              activeView === "dm" && activeDMUser === friend.id
                                ? isDarkMode ? "bg-white/[0.07]" : "bg-[#f4f7fb]"
                                : isDarkMode ? "hover:bg-white/[0.04]" : "hover:bg-white"
                            }`}
                          >
                            <span className="relative shrink-0">
                              <span className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-base ${
                                isDarkMode ? "bg-white/[0.05]" : "bg-[#f3f6fa]"
                              }`}>
                                {renderAvatar(friend, 36)}
                              </span>
                              <span
                                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 ${
                                  friend.status === "online"
                                    ? "bg-emerald-400"
                                    : "bg-slate-300"
                                } ${isDarkMode ? "border-[#0f1724]" : "border-white"}`}
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-sm font-medium ${
                                isDarkMode ? "text-slate-100" : "text-[#111827]"
                              }`}>
                                {friend.name}
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  </section>
                </div>
              )}
            </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 mt-1 animate-fade-in">
              <button
                onClick={() => {
                  if (!googleCalendarToken) {
                    setShowCalendarConnectModal(true)
                  } else {
                    setActiveView("calendar")
                    setActiveSpace(null)
                  }
                }}
                className={`p-2.5 rounded-[14px] transition-colors duration-150 ease-in-out ${
                  activeView === "calendar"
                    ? (isDarkMode ? "bg-[rgba(96,165,250,0.16)] text-slate-100" : "bg-[rgba(59,130,246,0.12)] text-sky-700")
                    : (isDarkMode ? "bg-transparent text-slate-400 hover:bg-[rgba(255,255,255,0.06)] hover:text-slate-100" : "text-slate-500 hover:bg-[rgba(15,23,42,0.06)] hover:text-slate-900")
                }`}
                title="Calendar"
              >
                <Calendar className="w-4 h-4" />
              </button>
              <div className="w-7 h-px my-1 bg-slate-200"></div>
              {spaces.map((s, spaceIndex) => {
                const accessibleChannels = getAccessibleChannelsForSpace(s)
                const isMenuOpen = collapsedSpaceMenu?.spaceId === s.id
                return (
                  <button
                    key={s.id}
                    className={`w-9 h-9 flex items-center justify-center rounded-[14px] transition-colors duration-150 ease-in-out relative ${
                      activeSpace === s.id || isMenuOpen
                        ? (isDarkMode ? 'bg-[rgba(96,165,250,0.16)]' : 'bg-[rgba(59,130,246,0.12)]')
                        : (isDarkMode ? 'hover:bg-[rgba(255,255,255,0.06)]' : 'hover:bg-[rgba(15,23,42,0.06)]')
                    }`}
                    title={s.name}
                    onClick={event => {
                      if (isMobile) {
                        setActiveSpace(s.id)
                        setActiveView("channel")
                        if (accessibleChannels[0]) setActiveChannel(accessibleChannels[0].id)
                        setMobileView("chat")
                        return
                      }
                      openCollapsedSpaceMenu(s, event)
                    }}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-none bg-transparent text-[13px] font-bold uppercase">
                      <SpaceImageIcon space={s} index={spaceIndex} className="h-5 w-5" />
                    </span>
                  </button>
                )
              })}
              <button
                onClick={() => setShowCreateSpaceModal(true)}
                className="p-2.5 rounded-xl border border-dashed transition-all border-slate-200 text-slate-400 hover:border-sky-400 hover:text-sky-500"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* ... (Main Content, Headers, etc.) ... */}

      {/* Main Content Area */}
      <div className={`workspace-main-shell flex-1 flex flex-col min-w-0 min-h-0 relative ${activeView === "tasks" ? "workspace-main-shell--tasks" : ""} ${isMobile && mobileView !== "chat" ? "hidden" : ""}`}>
        {shouldShowWorkspaceSearch && (
          <div className="workspace-global-search-row">
            <div className="workspace-global-search-wrap">
              <Search className="workspace-global-search-icon" strokeWidth={1.8} />
              <input
                type="search"
                value={searchQuery}
                onChange={event => {
                  setWorkspaceSearchDismissed(false)
                  setSearchQuery(event.target.value)
                }}
                onFocus={() => {
                  if (searchQuery.trim()) setWorkspaceSearchDismissed(false)
                }}
                placeholder="Search"
                className="workspace-global-search-input"
                aria-label="Search workspace"
              />
              {searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  className="workspace-global-search-clear"
                  onClick={() => {
                    setSearchQuery("")
                    setWorkspaceSearchDismissed(false)
                    setPinnedMessageId(null)
                    setTargetMessageId(null)
                    setHighlightTerm("")
                    setFileSearchResults([])
                  }}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
        {shouldShowWorkspaceSearch && workspaceSearchOpen && renderWorkspaceSearchPage()}
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
          <div className={`flex-1 flex flex-col overflow-hidden ${isDarkMode ? 'bg-[var(--bg-tertiary)]' : 'bg-gradient-to-br from-slate-50/80 via-white/40 to-sky-50/30'}`}>
            {/* ... (Calendar UI) ... */}
            <div className={`h-[90px] flex items-center justify-between px-8 border-b ${isDarkMode ? 'bg-[var(--bg-secondary)]/90 border-[var(--border-light)]' : 'bg-white/80 border-slate-200/50'} backdrop-blur-xl`}>
              <h2 className={`text-3xl font-bold flex items-center gap-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-cyan-600 to-sky-600 shadow-lg shadow-cyan-500/30' : 'bg-gradient-to-br from-sky-500 to-cyan-500 shadow-lg shadow-sky-200/50'}`}>
                  <Calendar className="w-7 h-7 text-white" />
                </div>
                Calendar
              </h2>
              <div className="flex items-center gap-4">
                <div className={`flex rounded-2xl p-1.5 border ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-slate-200/60 shadow-sm'}`}>
                  <button
                    onClick={() => changeMonth(-1)}
                    className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-cyan-400' : 'hover:bg-slate-100 text-slate-600'}`}
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
                    className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-cyan-400' : 'hover:bg-slate-100 text-slate-600'}`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    setSelectedDate(new Date())
                    setShowEventModal(true)
                  }}
                  className={`px-6 py-3 rounded-2xl font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex items-center gap-2 text-white ${isDarkMode ? 'bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 shadow-cyan-500/30 hover:shadow-cyan-500/50' : 'bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 shadow-cyan-300/40 hover:shadow-cyan-400/50'}`}
                >
                  <Plus className="w-5 h-5" /> New Event
                </button>
                {!googleCalendarToken ? (
                  <button
                    onClick={() => handleConnectGoogleCalendar()}
                    className={`px-4 py-2.5 rounded-2xl font-bold text-sm border transition-all flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-cyan-600/50 hover:text-cyan-300' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-sky-200 hover:text-sky-600 shadow-sm'}`}
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
                            ? "bg-cyan-900/30 border-cyan-600/40 shadow-lg shadow-cyan-500/10"
                            : "bg-gradient-to-br from-sky-50 to-cyan-50 border-sky-200 shadow-md shadow-sky-100/50"
                          : isDarkMode 
                            ? "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-cyan-600/30 hover:shadow-lg hover:shadow-cyan-500/10"
                            : "bg-white/80 border-slate-200/60 hover:bg-white hover:shadow-lg hover:border-sky-200 hover:shadow-sky-100/30"
                      }`}
                    >
                      <span
                        className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                          isToday
                            ? isDarkMode 
                              ? "bg-gradient-to-br from-cyan-600 to-sky-600 text-white shadow-md shadow-cyan-500/30"
                              : "bg-gradient-to-br from-sky-600 to-cyan-600 text-white shadow-md shadow-sky-300/50"
                            : isDarkMode 
                              ? "text-slate-300 group-hover:bg-slate-700 group-hover:text-cyan-400"
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
                                ? "bg-cyan-900/50 text-cyan-300 hover:bg-cyan-800/50 border border-cyan-700/30"
                                : "bg-gradient-to-r from-sky-100 to-cyan-100 text-sky-700 hover:from-sky-200 hover:to-cyan-200"
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
        ) : activeView === "starred" ? (
          <div className={`workspace-starred-frame workspace-dedicated-frame ${isDarkMode ? "is-dark" : ""}`}>
            <aside className="workspace-starred-sidebar">
              <div className="workspace-starred-sidebar-header">
                <div className="workspace-starred-title-row">
                  <span className="workspace-starred-icon">
                    <Star className="h-5 w-5 fill-current" />
                  </span>
                  <div className="min-w-0">
                    <h2>Starred messages</h2>
                    <p>{starredMessages.length ? `${starredMessages.length} saved message${starredMessages.length === 1 ? "" : "s"}` : "No starred messages yet"}</p>
                  </div>
                </div>
              </div>

              <div className="workspace-starred-list">
                {starredMessages.length === 0 ? (
                  <div className="workspace-starred-empty">
                    <Star className="h-7 w-7" />
                    <span>No starred messages yet</span>
                  </div>
                ) : (
                  starredMessages.map(item => {
                    const message = item.message || {}
                    const attachments = Array.isArray(message.attachments) ? message.attachments : []
                    const messageText = String(message.text || message.message || "").replace(/\s+/g, " ").trim()
                    const preview = messageText || (attachments.length ? `${attachments.length} attachment${attachments.length === 1 ? "" : "s"}` : "Attachment")
                    const dateLabel = formatDateLabel(message.timestamp || item.createdAt, timeTicker)
                    const senderId = item.sender?.id || message.userId || message.senderId || message.createdBy
                    const senderName = item.sender?.name || message.userName || message.senderName || getUser(senderId)?.name || "Unknown user"
                    const channelLabel = item.channelName && item.channelName !== "Direct message" ? `#${item.channelName}` : item.channelName
                    const contextLabel = [item.spaceName, channelLabel].filter(Boolean).join(" / ") || "Direct message"
                    const itemKey = getStarredItemKey(item)
                    const isSelected = selectedStarredMessage && getStarredItemKey(selectedStarredMessage) === itemKey

                    return (
                      <button
                        key={`starred-${itemKey}`}
                        type="button"
                        onClick={() => setActiveStarredMessageId(itemKey)}
                        className={`workspace-starred-list-item ${isSelected ? "is-active" : ""}`}
                      >
                        <span className="workspace-starred-list-avatar">
                          <Star className="h-4 w-4 fill-current" />
                        </span>
                        <span className="workspace-starred-list-copy">
                          <span className="workspace-starred-list-meta">
                            <span>{senderName}</span>
                            <span>{dateLabel}</span>
                          </span>
                          <span className="workspace-starred-list-preview">{preview}</span>
                          <span className="workspace-starred-list-context">{contextLabel}</span>
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </aside>

            <main className="workspace-starred-detail">
              <div className="workspace-starred-detail-panel">
                {selectedStarredMessage ? (() => {
                  const item = selectedStarredMessage
                  const message = item.message || {}
                  const attachments = Array.isArray(message.attachments) ? message.attachments : []
                  const messageText = String(message.text || message.message || "").trim()
                  const timestamp = message.timestamp || item.createdAt
                  const dateLabel = `${formatDateLabel(timestamp, timeTicker)}${timestamp ? ` at ${formatTime(timestamp)}` : ""}`
                  const channelLabel = item.channelName && item.channelName !== "Direct message" ? `#${item.channelName}` : item.channelName
                  const starredSpaceIndex = spaces.findIndex(space => String(space.id) === String(item.spaceId))
                  const starredSpace = starredSpaceIndex >= 0
                    ? spaces[starredSpaceIndex]
                    : item.spaceId
                      ? { id: item.spaceId, name: item.spaceName || "Space", iconType: item.iconType }
                      : null
                  const locationTitle = item.spaceName || "Direct message"
                  const locationSubtitle = channelLabel || (item.channelName || "Saved message")

                  return (
                    <div className="workspace-starred-detail-inner">
                      <div className="workspace-starred-detail-header">
                        <button
                          type="button"
                          onClick={() => openStarredMessage(item)}
                          className="workspace-starred-detail-location"
                          title="Open this message in its original channel"
                        >
                          <span className="workspace-starred-detail-space-icon">
                            {starredSpace ? (
                              <SpaceImageIcon
                                space={starredSpace}
                                index={starredSpaceIndex >= 0 ? starredSpaceIndex : 0}
                                className="h-7 w-7"
                              />
                            ) : (
                              <UserIcon className="h-5 w-5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="workspace-starred-detail-name">{locationTitle}</div>
                            <div className="workspace-starred-detail-context">{locationSubtitle}</div>
                          </div>
                        </button>
                        <div className="workspace-starred-detail-actions">
                          <button type="button" onClick={() => openStarredMessage(item)} className="workspace-starred-action-button">
                            <ExternalLink className="h-4 w-4" />
                            Open original
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleMessageStar({ id: item.messageId })}
                            className="workspace-starred-action-button is-danger"
                          >
                            <X className="h-4 w-4" />
                            Unstar
                          </button>
                        </div>
                      </div>

                      <div className="workspace-starred-message-card">
                        <div className="workspace-starred-message-topline">
                          <span className="workspace-starred-message-badge">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            Starred
                          </span>
                          <span>{dateLabel}</span>
                        </div>

                        {messageText ? (
                          <p className="workspace-starred-message-text">{messageText}</p>
                        ) : (
                          <div className="workspace-starred-message-empty">This starred item does not include saved message text.</div>
                        )}

                        {attachments.length > 0 && (
                          <div className="workspace-starred-attachments">
                            <div className="workspace-starred-attachments-title">Attachments</div>
                            <div className="workspace-starred-attachment-list">
                              {attachments.map((attachment, index) => {
                                const attachmentName = attachment.name || attachment.filename || `Attachment ${index + 1}`
                                const attachmentMeta = [
                                  attachment.mimeType || attachment.type,
                                  attachment.size ? formatDocsSize(attachment.size) : "",
                                ].filter(Boolean).join(" | ")

                                return (
                                  <button
                                    key={`${item.messageId}-attachment-${attachment.id || attachmentName || index}`}
                                    type="button"
                                    onClick={() => openAttachment(attachment)}
                                    className="workspace-starred-attachment"
                                  >
                                    <FileIcon className="h-4 w-4" />
                                    <span className="min-w-0 flex-1">
                                      <span className="workspace-starred-attachment-name">{attachmentName}</span>
                                      {attachmentMeta && <span className="workspace-starred-attachment-meta">{attachmentMeta}</span>}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })() : (
                  <div className="workspace-starred-detail-empty">
                    <Star className="h-10 w-10" />
                    <h3>No starred message selected</h3>
                    <p>Star a message from any conversation and it will appear here.</p>
                  </div>
                )}
              </div>
            </main>
          </div>
        ) : activeView === "notifications" ? (
          renderNotificationsPage()
        ) : activeView === "contexts" ? (
          currentContext ? (
            <LivingContextPanel
              isDarkMode={isDarkMode}
              context={currentContext}
              ownerName={getContextOwnerName(currentContext.ownerId)}
              contributorNames={(currentContext.contributorIds || []).map(getContextOwnerName)}
              linkedMessages={currentContextMessages}
              files={currentContextFiles}
              decisions={currentContextDecisions}
              tasks={currentContextTasks.map(task => ({
                ...task,
                assigneeLabel: (task.assigneeIds || []).map(getContextOwnerName).join(", ") || "Unassigned",
              }))}
              activity={currentContextActivity}
              canEdit={isContextManager(currentContext)}
              canAddSelectedMessage={selectedMessageIds.length > 0}
              onAddSelectedMessage={async () => {
                for (const messageId of selectedMessageIds) {
                  await addMessageToContext(currentContext.id, messageId)
                }
              }}
              onMarkDecision={contextsSourceView === "channel" ? (() => {
                const selected = getMessageById(selectedMessageIds[0])
                if (selected) markMessageDecision(selected)
              }) : undefined}
              onCreateTask={() => {
                const selected = getMessageById(selectedMessageIds[0])
                if (selected) openTaskFromMessage(selected)
              }}
              onEdit={() => {
                setEditingContextId(currentContext.id)
                setContextDraft({
                  title: currentContext.title,
                  summary: currentContext.summary,
                  status: currentContext.status,
                  ownerId: String(currentContext.ownerId),
                  messageIds: currentContext.linkedMessageIds || [],
                })
              }}
              onClose={() => {
                setOpenContextId(null)
                pushAppRoute("/contexts")
              }}
              formatTime={formatContextTime}
            />
          ) : (
            <ContextsHub
              isDarkMode={isDarkMode}
              contexts={currentChannelContexts}
              renderOwner={getContextOwnerName}
              formatUpdatedTime={formatContextTime}
              onBack={closeContextsPage}
              onOpenContext={openContext}
              sourceLabel={
                contextsSourceView === "dm"
                  ? `Direct message with ${getUser(activeDMUser)?.name || "contact"}`
                  : currentSpace?.name && activeChannelData?.name
                    ? `${currentSpace.name} / #${activeChannelData.name}`
                    : activeChannelData?.name
                      ? `#${activeChannelData.name}`
                      : ""
              }
            />
          )
        ) : activeView === "tasks" ? (
          <div className={`workspace-dedicated-frame ${isDarkMode ? "is-dark" : ""}`}>
            <TasksHub
              isDarkMode={isDarkMode}
              tasks={tasksList}
              messages={messages}
              currentUser={currentUser}
              members={taskAssignableMembers}
              channels={allWorkspaceChannels}
              completingTaskId={completingTaskId}
              assignedNewCount={unreadAssignedTaskNotifications.length}
              focusTaskId={focusedTaskId}
              onAssignedScopeOpen={markAssignedTaskNotificationsRead}
              onCreateTask={(list, listOptions) => {
                setTaskModalDraft({
                  source: "tasks_section",
                  listId: list?.id || "my-tasks",
                  listName: list?.title || "My Tasks",
                  listOptions: Array.isArray(listOptions) && listOptions.length > 0
                    ? listOptions
                    : [{ id: list?.id || "my-tasks", title: list?.title || "My Tasks" }],
                })
                setShowTaskModal(true)
              }}
              onBackHome={() => {
                pushAppRoute(restoreFromDedicatedPage())
              }}
              onMarkTaskComplete={handleMarkTaskComplete}
              onDeleteCompletedTasks={handleDeleteCompletedTasks}
            />
          </div>
        ) : activeView === "documents" ? (
          <div className={`workspace-documents-frame ${isDarkMode ? "is-dark" : ""}`}>
            <DocumentsHub
              embedded
              isDarkMode={isDarkMode}
              googleAccessToken={googleAccessToken}
              loadingDocs={loadingDocs}
              docsError={docsError}
              selectedAppFilter={selectedAppFilter}
              docsOverview={docsOverview}
              docsCollectionSummary={docsCollectionSummary}
              googleDocs={googleDocs}
              sortedGoogleDocs={sortedGoogleDocs}
              sharedChatDocs={sharedChatDocs}
              gmailAttachments={dedupedGmailAttachments}
              formatDocsDate={formatDocsDate}
              formatDocsSize={formatDocsSize}
              onBackHome={closeDocumentsPage}
              onConnectGoogle={handleConnectGoogleDocs}
              onReconnectGoogle={handleDocumentsReconnect}
              onRefresh={handleDocumentsRefresh}
              onOpenConnections={() => setShowConnectAppsModal(true)}
              onSelectFilter={handleDocumentsFilterSelect}
              onOpenAttachment={openAttachment}
              onAddDocument={handleHubAddDocument}
            />
          </div>
        ) : activeView === "connect" ? (
          <div className={`workspace-dedicated-frame ${isDarkMode ? "is-dark" : ""}`}>
            <div className={`h-full min-h-0 w-full overflow-y-auto ${
              isDarkMode ? "bg-[#0d1117] text-slate-100" : "bg-[#f6f8fb] text-slate-900"
            }`}>
              <div className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col px-4 py-4 sm:px-6">
                <ConnectHub
                  currentUser={currentUser}
                  friends={homeFriends}
                  pendingRequests={pendingFriendRequests}
                  renderAvatar={renderAvatar}
                  onOpenDM={openHomeDM}
                  onAcceptRequest={notificationId => handleNotificationAction(notificationId, "friend_request")}
                  onRejectRequest={notificationId => handleRejectNotification(notificationId, "friend_request")}
                  onConnectUser={sendFriendRequest}
                  preferredPane={connectPreferredPane}
                  onPaneChange={setConnectPreferredPane}
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>
          </div>
        ) : (
          /* VIEW: CHANNEL / DM */
          <>
            {/* Header - Desktop with Liquid Glass */}
            <div className={`workspace-topbar h-[80px] sticky top-0 z-30 ${isMobile ? 'hidden' : 'flex'} items-center justify-between gap-3 px-5 mx-0 w-full mt-0`}>
              {/* Liquid Glass Channel Info Container */}
              <div
                onClick={() => {
                  if (activeView === "channel") {
                    setShowMemberDetails(false)
                    setActiveChannelTab("members")
                  } else {
                    setShowMemberDetails(prev => !prev)
                  }
                }}
                className={`liquid-glass-header workspace-channel-summary flex items-center gap-2.5 cursor-pointer group px-2.5 py-1.5 transition-all ease-in-out duration-300 hover:scale-[1.01]`}
              >
                {activeView === "dm" ? (
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-[18px] flex items-center justify-center text-xl shadow-lg border-2 ${isDarkMode ? 'bg-gradient-to-br from-cyan-900/50 to-sky-900/50 border-cyan-700/50' : 'bg-gradient-to-br from-sky-100 to-cyan-100 border-white'} text-slate-700 overflow-hidden`}>
                        {renderAvatar(getUser(activeDMUser), 40)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] ${isDarkMode ? 'border-[var(--bg-secondary)]' : 'border-white'} shadow-md ${
                          getUser(activeDMUser)?.status === "online"
                            ? "bg-emerald-500"
                            : "bg-slate-400"
                        }`}
                      ></span>
                    </div>
                    <div>
                      <h2 className={`font-bold text-[1.25rem] leading-tight tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {getActiveViewName()}
                      </h2>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 mt-0.5 ${getUser(activeDMUser)?.status === "online" ? "text-emerald-600" : isDarkMode ? 'text-slate-500' : "text-slate-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getUser(activeDMUser)?.status === "online" ? "bg-emerald-500 animate-pulse shadow-sm shadow-emerald-300" : "bg-slate-400"}`}></span>{" "}
                        {getUser(activeDMUser)?.status === "online" ? "Online" : "Offline"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center transition-all ${isDarkMode ? 'bg-white/[0.06] text-slate-300 border border-white/10 group-hover:bg-white/[0.09] group-hover:text-slate-200' : 'bg-slate-50 text-slate-600 border border-slate-100 shadow-sm group-hover:bg-sky-50 group-hover:text-sky-600'}`}>
                      <Hash className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className={`font-bold text-[14px] leading-tight tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'} flex items-center gap-1.5`}>
                        <span className="truncate max-w-[24vw] block" title={getActiveViewName().replace('#','')}>
                          {getActiveViewName().replace("#", "")}
                        </span>
                      </h2>
                      <div className={`flex items-center gap-2 text-[11px] font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className={`flex items-center gap-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          <Users className="w-3.5 h-3.5" /> {activeMembers.length}{" "}
                          members
                        </span>
                        <span className={`flex items-center gap-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Active now
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="workspace-topbar-tabs flex-1 min-w-0">
                {activeView === "channel" && (
                  <ChannelTabs
                    activeTab={activeChannelTab}
                    isDarkMode={isDarkMode}
                    onChange={handleChannelTabChange}
                    tabs={CHANNEL_TABS}
                    selectedCount={selectedMessageIds.length}
                    onCreateFromSelection={() => openCreateContextModal(selectedMessageIds)}
                  />
                )}
                {activeView === "dm" && (
                  <ChannelTabs
                    activeTab={activeChannelTab}
                    isDarkMode={isDarkMode}
                    onChange={handleChannelTabChange}
                    tabs={FRIEND_CHAT_TABS}
                    selectedCount={selectedMessageIds.length}
                    onCreateFromSelection={() => openCreateContextModal(selectedMessageIds)}
                  />
                )}
              </div>

              {/* Action Buttons with Liquid Glass */}
              <div className="workspace-navbar-actions flex items-center gap-1.5">
                {/* Google Apps Grid Icon */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowGoogleAppsMenu(!showGoogleAppsMenu)}
                    className={getChannelIconButtonClass(isDarkMode, { active: showGoogleAppsMenu })}
                    title="Apps"
                    aria-label="Apps"
                    aria-haspopup="menu"
                    aria-expanded={showGoogleAppsMenu}
                  >
                    <LayoutGrid className="h-[19px] w-[19px]" strokeWidth={1.9} />
                  </button>

                  {showGoogleAppsMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowGoogleAppsMenu(false)}
                      ></div>
                      <div className={`absolute right-0 top-full mt-3 w-96 rounded-3xl shadow-2xl p-8 animate-fade-in origin-top-right z-50 ${isDarkMode ? 'bg-[#2C2C2C] ring-1 ring-cyan-500/30 border border-slate-700' : 'bg-white/95 ring-1 ring-slate-200 border border-slate-100'} backdrop-blur-xl`}>
                        <h3 className={`text-xl font-bold mb-6 flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-gradient-to-br from-cyan-600 to-sky-600' : 'bg-gradient-to-br from-sky-500 to-cyan-600'}`}>
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
                                <SmartImage
                                  src={app.icon}
                                  alt={app.name}
                                  className="w-8 h-8 object-contain"
                                  fallback={<span className="text-2xl">{app.name.charAt(0)}</span>}
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
                      type="button"
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
                      className={getChannelIconButtonClass(isDarkMode, { active: showWebRTCCall })}
                      title="Video call"
                      aria-label="Video call"
                      aria-pressed={showWebRTCCall}
                    >
                      <Video className="h-[19px] w-[19px]" strokeWidth={1.9} />
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
                      type="button"
                      title="Invite people"
                      aria-label="Invite people"
                      onClick={() => {
                        if (!canInvite) return
                        setInviteSearchQuery("")
                        setSelectedInviteUsers([])
                        setShowAddToSpaceModal(true)
                      }}
                      disabled={!canInvite}
                      className={getChannelIconButtonClass(isDarkMode, { disabled: !canInvite, hiddenOnMobile: true })}
                    >
                      <UserPlus className="h-[19px] w-[19px]" strokeWidth={1.9} />
                    </button>
                  )
                })()}

                <div className={`h-8 w-px mx-1.5 bg-gradient-to-b ${isDarkMode ? 'from-transparent via-slate-600 to-transparent' : 'from-transparent via-slate-200 to-transparent'}`}></div>

                {/* Theme Toggle Button */}
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`liquid-glass-nav-item theme-toggle-nav-button p-2.5 transition-all group ${
                    isDarkMode ? 'text-yellow-400' : 'text-slate-600'
                  }`}
                  title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  <div className="transition-transform group-hover:scale-110">
                    {isDarkMode ? (
                      <Sun className="w-[18px] h-[18px]" />
                    ) : (
                      <Moon className="w-[18px] h-[18px]" />
                    )}
                  </div>
                </button>

              </div>
            </div>

            {/* Header - Mobile */}
            {isMobile && (
              <div className={`workspace-mobile-header h-[64px] fixed top-0 left-0 right-0 z-[60] flex items-center justify-between gap-2 px-3 border-b backdrop-blur-xl shadow-sm safe-area-top ${
                isDarkMode 
                  ? 'bg-slate-900/95 border-slate-700/60 shadow-slate-950/30' 
                  : 'bg-white/95 border-slate-200/60 shadow-slate-100/50'
              }`}>
                <button
                  type="button"
                  onClick={event => {
                    event.preventDefault()
                    event.stopPropagation()
                    setShowMobileDrawer("account")
                  }}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border transition ${
                    isDarkMode
                      ? "border-white/10 bg-white/[0.06] active:bg-white/[0.10]"
                      : "border-slate-200 bg-white active:bg-slate-100"
                  }`}
                  title="Open account sidebar"
                  aria-label="Open account sidebar"
                >
                  {renderAvatar(currentUser, 34)}
                </button>

                {/* Left: Profile & Context */}
                <div 
                  onClick={() => {
                    if (activeView === "channel") {
                      setShowMemberDetails(false)
                      setActiveChannelTab("members")
                    } else {
                      setShowMemberDetails(prev => !prev)
                    }
                  }}
                  className="workspace-mobile-title flex-1 min-w-0 flex items-center gap-3 cursor-pointer touch-active"
                >
                  {activeView === "dm" ? (
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-base shadow-md border-2 overflow-hidden ${
                          isDarkMode 
                            ? 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600' 
                            : 'bg-gradient-to-br from-sky-100 to-cyan-100 border-white'
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
                    <div className="flex min-w-0 w-full items-center gap-2.5">
                      <div className={`workspace-mobile-channel-icon w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${
                        isDarkMode 
                          ? 'bg-gradient-to-br from-slate-700 to-slate-800 text-slate-300 border border-slate-600' 
                          : 'bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 border border-slate-200/50'
                      }`}>
                        <Hash className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className={`workspace-mobile-channel-name font-bold text-[15px] leading-tight flex min-w-0 items-center gap-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          <span className="truncate">{getActiveViewName().replace("#", "")}</span>
                        </h2>
                        <p className={`text-[11px] font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Users className="w-3 h-3" /> {activeMembers.length} members
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Action Icons & Menu */}
                <div className="workspace-mobile-actions flex items-center gap-1 flex-shrink-0 relative z-10">
                  {/* Video Call Icon */}
                  {VIDEO_ENABLED && (
                    <div className="relative">
                      <button
                        type="button"
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
                        className={getMobileIconButtonClass(isDarkMode, { active: showWebRTCCall })}
                        title="Video call"
                        aria-label="Video call"
                        aria-pressed={showWebRTCCall}
                      >
                        <Video className="h-5 w-5" strokeWidth={1.9} />
                      </button>
                      {/* In Call Indicator */}
                      {showWebRTCCall && (
                        <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 shadow-sm ${isDarkMode ? 'border-slate-900' : 'border-white'}`}></span>
                      )}
                    </div>
                  )}

                  {/* Add people (Channel only) */}
                  {activeView === "channel" && (() => {
                    const role = getChannelRole(currentUser?.id)
                    const canInvite = role === 'owner' || role === 'admin'
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canInvite) return
                          setInviteSearchQuery("")
                          setSelectedInviteUsers([])
                          setShowAddToSpaceModal(true)
                        }}
                        disabled={!canInvite}
                        className={getMobileIconButtonClass(isDarkMode, { disabled: !canInvite })}
                        title="Invite people"
                        aria-label="Invite people"
                      >
                        <UserPlus className="h-5 w-5" strokeWidth={1.9} />
                      </button>
                    )
                  })()}

                  {/* Mobile Menu Button with Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMobileDrawer(prev => prev === "quick" ? false : "quick"); }}
                      className={`workspace-mobile-action p-2.5 rounded-xl transition-all touch-active ${
                        isDarkMode 
                          ? 'bg-slate-800 text-slate-400 active:bg-slate-700' 
                          : 'bg-slate-50 text-slate-500 active:bg-sky-50'
                      }`}
                      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                      title="Menu"
                      aria-label="Menu"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                    
                    {/* Quick Menu Dropdown */}
                    {showMobileDrawer === "quick" && (
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
                              setAvatarFile(null)
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
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-sky-400' : 'bg-slate-100 text-slate-500'}`}>
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
                              openNotificationsPage()
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
                              {unreadNotifications.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                  {unreadNotifications.length}
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
            <div className={`flex-1 flex min-h-0 overflow-hidden liquid-glass-chat-area workspace-chat-panel relative ${isMobile ? 'mt-[64px]' : ''}`}>
              <div className={`flex-1 flex flex-col min-w-0 ${activeView === 'dm' ? (isDarkMode ? 'dm-chat-background-dark' : 'dm-chat-background') : (isDarkMode ? 'channel-chat-background-dark' : 'channel-chat-background')}`}>
                {isMobile && activeView === "channel" && (
                  <ChannelTabs
                    activeTab={activeChannelTab}
                    isDarkMode={isDarkMode}
                    onChange={handleChannelTabChange}
                    tabs={CHANNEL_TABS}
                    selectedCount={selectedMessageIds.length}
                    onCreateFromSelection={() => openCreateContextModal(selectedMessageIds)}
                  />
                )}
                {isMobile && activeView === "dm" && (
                  <ChannelTabs
                    activeTab={activeChannelTab}
                    isDarkMode={isDarkMode}
                    onChange={handleChannelTabChange}
                    tabs={FRIEND_CHAT_TABS}
                    selectedCount={selectedMessageIds.length}
                    onCreateFromSelection={() => openCreateContextModal(selectedMessageIds)}
                  />
                )}
                {/* Updated Container with Custom Pattern Background */}

                {(activeView === "channel" || activeView === "dm") && activeChannelTab !== "messages" && (
                  <div className={`flex-1 ${activeChannelTab === "contexts" && currentContext ? "min-h-0 overflow-hidden" : "overflow-y-auto py-2 pb-6"}`}>
                    {activeChannelTab === "contexts" && (
                      currentContext ? (
                        <LivingContextPanel
                          isDarkMode={isDarkMode}
                          context={currentContext}
                          ownerName={getContextOwnerName(currentContext.ownerId)}
                          contributorNames={(currentContext.contributorIds || []).map(getContextOwnerName)}
                          linkedMessages={currentContextMessages}
                          files={currentContextFiles}
                          decisions={currentContextDecisions}
                          tasks={currentContextTasks.map(task => ({
                            ...task,
                            assigneeLabel: (task.assigneeIds || []).map(getContextOwnerName).join(", ") || "Unassigned",
                          }))}
                          activity={currentContextActivity}
                          canEdit={isContextManager(currentContext)}
                          canAddSelectedMessage={selectedMessageIds.length > 0}
                          onAddSelectedMessage={async () => {
                            for (const messageId of selectedMessageIds) {
                              await addMessageToContext(currentContext.id, messageId)
                            }
                          }}
                          onMarkDecision={activeView === "channel" ? (() => {
                            const selected = getMessageById(selectedMessageIds[0])
                            if (selected) markMessageDecision(selected)
                          }) : undefined}
                          onCreateTask={() => {
                            const selected = getMessageById(selectedMessageIds[0])
                            if (selected) openTaskFromMessage(selected)
                          }}
                          onEdit={() => {
                            setEditingContextId(currentContext.id)
                            setContextDraft({
                              title: currentContext.title,
                              summary: currentContext.summary,
                              status: currentContext.status,
                              ownerId: String(currentContext.ownerId),
                              messageIds: currentContext.linkedMessageIds || [],
                            })
                          }}
                          onClose={() => setOpenContextId(null)}
                          formatTime={formatContextTime}
                        />
                      ) : (
                        <ContextsTabView
                          contexts={currentChannelContexts}
                          isDarkMode={isDarkMode}
                          onOpen={openContext}
                          renderOwner={getContextOwnerName}
                          formatUpdatedTime={formatContextTime}
                        />
                      )
                    )}
                    {activeChannelTab === "files" && (
                      <ChannelFilesGallery
                        files={currentChannelFiles}
                        isDarkMode={isDarkMode}
                        onAttachFile={addChannelFileAsAttachment}
                        onOpenFile={openAttachment}
                        onDeleteFile={openDeleteChannelFileConfirm}
                      />
                    )}
                    {activeView === "channel" && activeChannelTab === "decisions" && (
                      <DecisionList
                        decisions={currentChannelDecisionItems}
                        isDarkMode={isDarkMode}
                        onOpenMessage={messageId => {
                          setActiveChannelTab("messages")
                          setTargetMessageId(messageId)
                          setPinnedMessageId(messageId)
                        }}
                        formatTime={formatContextTime}
                      />
                    )}
                    {activeView === "channel" && activeChannelTab === "members" && renderChannelMembersView()}
                  </div>
                )}
                <div className={`${(activeView === "channel" || activeView === "dm") && activeChannelTab !== "messages" ? "hidden" : "flex flex-col flex-1 min-h-0"}`}>
                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className={`workspace-message-scroll flex-1 overflow-y-auto scrollbar-thin relative ${
                    isChannelFeed
                      ? "px-0 py-3 sm:py-4 space-y-0"
                      : "p-4 sm:p-8 space-y-8"
                  }`}
                >
                  {/* ... (Existing Message Rendering) ... */}
                      {currentMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <div className={`p-10 rounded-[2.5rem] text-center max-w-sm backdrop-blur-sm ${isDarkMode ? 'bg-[#191919] border border-[#4d4d4d] shadow-lg shadow-cyan-500/5' : 'border bg-white/70 border-slate-200/50 shadow-xl shadow-sky-100/30'}`}>
                        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-[2rem] mb-6 relative shadow-lg transform rotate-3 hover:rotate-6 transition-transform ${isDarkMode ? 'bg-cyan-900/50 text-cyan-400' : 'bg-gradient-to-br from-sky-100 to-cyan-100 text-sky-600'}`}>
                          <MessageCircle className="w-12 h-12" />
                          <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-4 animate-bounce bg-yellow-400 ${isDarkMode ? 'border-slate-800' : 'border-white'}`}></div>
                        </div>
                        <h3 className={`text-2xl font-extrabold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
                          Say Hello!
                        </h3>
                        <p className={`text-sm leading-relaxed mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          This is the start of something epic in{" "}
                          <span className={`font-bold ${isDarkMode ? 'text-cyan-400' : 'text-sky-600'}`}>
                            {getActiveViewName()}
                          </span>
                          . Send a message to break the ice.
                        </p>
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-cyan-900/30 border-cyan-600/30 text-cyan-300' : 'bg-sky-50/80 border-sky-100/60 text-sky-600'}`}>
                          <Lock className="w-3 h-3" /> End-to-End Encrypted
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {pinnedMessageId && (
                        <div className={`sticky top-0 z-20 mb-4 flex items-center justify-between gap-4 rounded-xl px-4 py-3 border shadow-sm ${isDarkMode ? 'bg-slate-800/90 border-cyan-600/30' : 'bg-white/90 border-slate-100'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : ''}`}>Pinned Search Result</div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Reviewing highlighted message</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
                                setPinnedMessageId(null)
                                setHighlightTerm("")
                              }}
                              className="px-3 py-1 rounded-full text-sm bg-sky-50 text-sky-600 font-semibold"
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

                      {currentMessages.map((msg, idx) => {
                        const user = getUser(msg.userId)
                        const isMe = String(msg.userId) === String(currentUser?.id)
                        const prevMsg =
                          idx > 0 ? currentMessages[idx - 1] : null
                        // Date separator logic
                        const msgDayLabel = formatDateLabel(msg.timestamp, timeTicker)
                        const prevDayLabel = prevMsg ? formatDateLabel(prevMsg.timestamp, timeTicker) : null
                        const showDateSeparator = idx === 0 || msgDayLabel !== prevDayLabel
                        const isSequence =
                          prevMsg && prevMsg.userId === msg.userId && !showDateSeparator
                        const showNewDivider = isChannelFeed && Boolean(msg.isNew || msg.unread || msg.isUnread || msg.showNewDivider)
                        const messageStatus = msg.status || "sent"
                        const messageContexts = getMessageContexts(msg)
                        const isMessageSelected = selectedMessageIds.some(id => String(id) === String(msg.id))
                        const statusLabel = (() => {
                          if (!isMe) return null
                          if (messageStatus === "failed") {
                            return (
                              <button
                                onClick={() => retryFailedMessage(getActiveChatId(), msg)}
                                className={`flex items-center gap-1 text-[9px] underline underline-offset-2 ${
                                  isChannelFeed
                                    ? isDarkMode ? "text-rose-300" : "text-rose-600"
                                    : "text-rose-200"
                                }`}
                              >
                                <XCircle className="w-3 h-3" />
                                Retry send
                              </button>
                            )
                          }
                          if (messageStatus === "sending" || messageStatus === "retrying") {
                            return (
                              <span className={`flex items-center gap-1 text-[9px] ${
                                isChannelFeed ? isDarkMode ? "text-slate-400" : "text-slate-500" : "text-sky-100"
                              }`}>
                                <span className={`w-3 h-3 rounded-full border border-t-transparent animate-spin ${
                                  isChannelFeed ? isDarkMode ? "border-slate-500" : "border-slate-300" : "border-white/40"
                                }`}></span>
                                {messageStatus === "retrying" ? "Retrying" : "Sending"}
                              </span>
                            )
                          }
                          return (
                            <span className={`flex items-center gap-1 text-[9px] ${
                              isChannelFeed ? isDarkMode ? "text-slate-500" : "text-slate-400" : "text-sky-100"
                            }`}>
                              Sent
                              <Check className="w-3 h-3" />
                            </span>
                          )
                        })()

                        const canEditMessage =
                          isMe &&
                          Boolean(msg.text) &&
                          msg.type !== "meet-invite" &&
                          msg.type !== "task"
                        const isEditingThisMessage = editingMessageId === msg.id
                        const isActionMenuOpen = messageActionMenu?.messageId === msg.id
                        const isContextPickerOpen = messageContextPicker?.messageId === msg.id
                        const isMessageStarred = starredMessageKeySet.has(String(msg.id))
                        const isAttachmentOnlyMessage =
                          Array.isArray(msg.attachments) &&
                          msg.attachments.length > 0 &&
                          !msg.text &&
                          msg.type !== "meet-invite" &&
                          msg.type !== "task"
                        const messageActionAnchor =
                          messageActionButtonRefs.current[String(msg.id)] || null

                        return (
                          <React.Fragment key={`${msg.id || "message"}-${idx}`}>
                            {showDateSeparator && (
                              <div className={`workspace-date-separator w-full flex items-center justify-center ${isChannelFeed ? "my-3 px-5" : "mb-4"}`}>
                                {isChannelFeed && (
                                  <div className={`h-px flex-1 ${isDarkMode ? "bg-white/10" : "bg-slate-200/80"}`} />
                                )}
                                <span className={`border ${
                                  isChannelFeed
                                    ? isDarkMode
                                      ? "mx-3 rounded-full border-white/10 bg-[#16191f] px-3 py-0.5 text-xs font-semibold text-slate-400"
                                      : "mx-3 rounded-full border-slate-200 bg-white px-3 py-0.5 text-xs font-semibold text-slate-600"
                                    : isDarkMode 
                                      ? 'text-[11px] font-bold px-3 py-1 rounded-full bg-slate-800/90 border-slate-700 text-slate-400' 
                                      : 'text-[11px] font-bold px-3 py-1 rounded-full bg-white/90 border-slate-100 text-slate-500'
                                }`}>
                                  {msgDayLabel}
                                </span>
                                {isChannelFeed && (
                                  <div className={`h-px flex-1 ${isDarkMode ? "bg-white/10" : "bg-slate-200/80"}`} />
                                )}
                              </div>
                            )}
                            {showNewDivider && (
                              <div className="my-2 flex w-full items-center px-5">
                                <div className="h-px flex-1 bg-rose-500/70" />
                                <span className="ml-2 text-xs font-semibold text-rose-500">New</span>
                              </div>
                            )}
                            <div
                              id={`msg-${msg.id}`}
                              data-timestamp={msg.timestamp || ''}
                              className={`workspace-message-row ${isChannelFeed ? "workspace-channel-message-row" : "workspace-bubble-message-row"} relative flex ${
                                isChannelFeed
                                  ? `gap-3 px-5 py-1.5 transition-colors ${isDarkMode ? "hover:bg-white/[0.04]" : "hover:bg-slate-100/80"} ${isSequence ? "mt-0" : "mt-1"}`
                                  : `gap-4 ${isMe ? "flex-row-reverse" : ""} ${isSequence ? "mt-1" : "mt-6"}`
                              } ${
                                isActionMenuOpen || isContextPickerOpen || isEditingThisMessage ? "z-40" : "z-0"
                              } group`}
                            >
                            {/* Avatar only for first in sequence */}
                            <div className={`flex-shrink-0 flex flex-col items-center ${isChannelFeed ? "w-9" : "w-10"}`}>
                              {!isSequence ? (
                                <div
                                  className={`flex items-center justify-center overflow-hidden ${
                                    isChannelFeed
                                      ? `h-9 w-9 rounded-lg text-base ${isDarkMode ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"}`
                                      : `w-10 h-10 rounded-full text-lg shadow-lg border-2 ring-2 ${
                                          isMe
                                            ? isDarkMode 
                                              ? "bg-gradient-to-br from-sky-500/30 to-cyan-500/30 border-sky-500/50 ring-slate-800/50" 
                                              : "bg-gradient-to-br from-sky-100 to-cyan-100 border-white ring-white/50"
                                            : isDarkMode 
                                              ? "bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600 ring-slate-800/50 text-sm" 
                                              : "bg-gradient-to-br from-white to-slate-50 border-white ring-white/50 text-sm"
                                        } ${isMe ? isDarkMode ? "text-sky-300" : "text-sky-600" : ""}`
                                  }`}
                                >
                                  {renderAvatar(user, 36)}
                                </div>
                              ) : (
                                <div className={isChannelFeed ? "w-9" : "w-10"} />
                              )}
                            </div>

                            <div
                              className={`flex flex-col ${
                                isChannelFeed
                                  ? "min-w-0 flex-1 items-start"
                                  : `max-w-[70%] ${isMe ? "items-end" : "items-start"}`
                              }`}
                            >
                              {/* Name only for first in sequence */}
                              {!isSequence && (isChannelFeed || !isMe) && (
                                <div className={`${isChannelFeed ? "mb-0.5" : "ml-1 mb-1.5"} flex items-baseline gap-2`}>
                                  <span className={`font-bold ${
                                    isChannelFeed
                                      ? isDarkMode ? "text-sm text-slate-100" : "text-sm text-slate-900"
                                      : isDarkMode ? 'text-xs text-slate-400' : 'text-xs text-slate-500'
                                  }`}>
                                    {user?.name || "Unknown user"}
                                  </span>
                                  <span className={`${isChannelFeed ? "text-xs" : "text-[10px]"} font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {msg.timestamp
                                      ? formatTime(msg.timestamp)
                                      : "now"}
                                  </span>
                                  {msg.editedAt && (
                                    <span className={`text-[10px] font-medium italic ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                      edited
                                    </span>
                                  )}
                                </div>
                              )}

                              <div
                              onTouchStart={() => {
                                longPressTimerRef.current = setTimeout(() => setShowEmojiPickerFor(msg.id), 600)
                              }}
                              onTouchEnd={() => {
                                clearTimeout(longPressTimerRef.current)
                              }}
                              className={`relative overflow-visible break-words ${
                                  isChannelFeed
                                    ? `w-full pr-9 text-sm leading-6 transition-colors duration-75 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`
                                    : `text-[15px] leading-relaxed transition-all duration-150 ${
                                        isAttachmentOnlyMessage
                                          ? "bg-transparent shadow-none border-0 rounded-none px-0 py-0"
                                          : isMe
                                            ? "liquid-glass-message-own text-white rounded-2xl rounded-tr-sm px-5 py-3.5" 
                                            : isDarkMode 
                                              ? "liquid-glass-message text-slate-100 rounded-2xl rounded-tl-sm px-5 py-3.5" 
                                              : "liquid-glass-message text-slate-800 rounded-2xl rounded-tl-sm px-5 py-3.5"
                                      }`
                                } ${pinnedMessageId === msg.id ? isDarkMode ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900 animate-pulse-soft' : 'ring-2 ring-sky-400 ring-offset-2 animate-pulse-soft' : ''}`}
                              >
                                <div
                                  className={`absolute z-20 ${
                                    isChannelFeed
                                      ? "right-0 -top-1"
                                      : `${isMe ? '-left-10' : '-right-10'} -top-2`
                                  }`}
                                  onClick={e => e.stopPropagation()}
                                >
                                  {isMessageStarred && (
                                    <span
                                      className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full ${
                                        isDarkMode ? "bg-amber-400/15 text-amber-300" : "bg-amber-50 text-amber-500"
                                      }`}
                                      title="Starred"
                                    >
                                      <Star className="h-3.5 w-3.5 fill-current" />
                                    </span>
                                  )}
                                  <MessageActionButton
                                    buttonRef={node => {
                                      if (node) {
                                        messageActionButtonRefs.current[String(msg.id)] = node
                                      } else {
                                        delete messageActionButtonRefs.current[String(msg.id)]
                                      }
                                    }}
                                    isActive={isActionMenuOpen || isContextPickerOpen}
                                    isDarkMode={isDarkMode}
                                    onClick={event => {
                                      event.stopPropagation()
                                      setMessageContextPicker(null)
                                      setComposerAttachMenuOpen(false)
                                      setComposerContextPickerOpen(false)
                                      setMessageActionMenu(prev =>
                                        prev?.messageId === msg.id ? null : { messageId: msg.id }
                                      )
                                    }}
                                  />
                                  {isActionMenuOpen && (
                                    <div className={`absolute top-11 ${isMe ? 'left-0' : 'right-0'} z-30`}>
                                      <MessageActionsMenu
                                        anchorEl={messageActionAnchor}
                                        boundaryEl={messagesContainerRef.current}
                                        preferredAlign={isChannelFeed ? "left" : "right"}
                                        isDarkMode={isDarkMode}
                                        isSelected={isMessageSelected}
                                        isStarred={isMessageStarred}
                                        emojis={EMOJIS}
                                        onClose={() => setMessageActionMenu(null)}
                                        onReact={emoji => {
                                          toggleReaction(getActiveChatId(), msg.id, emoji)
                                          setMessageActionMenu(null)
                                        }}
                                        onEdit={canEditMessage ? () => startEditingMessage(msg) : undefined}
                                        onDelete={canDeleteMessage(msg) ? () => {
                                          const chatId = getActiveChatId()
                                          if (!chatId) return
                                          setShowDeleteConfirm({
                                            type: "message",
                                            id: msg.id,
                                            chatId,
                                            optimistic: Boolean(msg.optimistic),
                                          })
                                          setMessageActionMenu(null)
                                        } : undefined}
                                        onToggleSelection={() => {
                                          toggleMessageSelection(msg.id)
                                          setMessageActionMenu(null)
                                        }}
                                        onCreateContext={() => {
                                          openCreateContextModal([msg.id])
                                          setMessageActionMenu(null)
                                        }}
                                        onAddToContext={() => {
                                          setMessageActionMenu(null)
                                          setMessageContextPicker({ messageId: msg.id })
                                        }}
                                        onToggleStar={() => {
                                          toggleMessageStar(msg)
                                          setMessageActionMenu(null)
                                        }}
                                        onMarkDecision={activeView === "channel" ? (() => {
                                          markMessageDecision(msg)
                                          setMessageActionMenu(null)
                                        }) : undefined}
                                        onCreateTask={() => {
                                          openTaskFromMessage(msg)
                                          setMessageActionMenu(null)
                                        }}
                                      />
                                    </div>
                                  )}
                                  {isContextPickerOpen && (
                                    <div className={`absolute top-11 z-40 ${isMe ? 'left-[calc(100%+0.5rem)] max-sm:left-0' : 'right-[calc(100%+0.5rem)] max-sm:right-0'} max-sm:top-[calc(100%+0.5rem)]`}>
                                      <AddToContextPopover
                                        anchorEl={messageActionAnchor}
                                        boundaryEl={messagesContainerRef.current}
                                        isDarkMode={isDarkMode}
                                        contexts={currentChannelContexts}
                                        onClose={() => setMessageContextPicker(null)}
                                        onSelect={contextId => {
                                          addMessageToContext(contextId, msg.id)
                                          setMessageContextPicker(null)
                                          setMessageActionMenu(null)
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                                {/* Meet Invite Message */}
                                {msg.type === 'meet-invite' && msg.meetLink && (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                                        <Video className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                      </div>
                                      <span className="font-bold">Video Call Started</span>
                                    </div>
                                    <p className={`text-sm ${isChannelFeed ? (isDarkMode ? 'text-slate-300' : 'text-slate-600') : isMe ? 'text-white/90' : isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
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
                                      <div className={`font-bold ${isChannelFeed ? (isDarkMode ? 'text-slate-200' : 'text-slate-800') : isMe ? 'text-white' : isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{msg.text || (msg.task && msg.task.message)}</div>
                                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{msg.timestamp}</div>
                                    </div>
                                  </div>
                                )}
                                
                                {isEditingThisMessage ? (
                                  <div className="space-y-3">
                                    <textarea
                                      value={editingMessageText}
                                      onChange={e => setEditingMessageText(e.target.value)}
                                      rows={3}
                                      className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none ${
                                        isDarkMode
                                          ? "bg-slate-900/60 border-slate-600 text-white placeholder:text-slate-500"
                                          : "bg-white/90 border-slate-200 text-slate-800 placeholder:text-slate-400"
                                      }`}
                                      placeholder="Edit your message"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={cancelEditingMessage}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                                          isDarkMode
                                            ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => saveEditedMessage(getActiveChatId(), msg)}
                                        disabled={isSavingEditedMessage || !editingMessageText.trim()}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                                          isSavingEditedMessage || !editingMessageText.trim()
                                            ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                            : isDarkMode
                                              ? "bg-sky-500 text-white hover:bg-sky-400"
                                              : "bg-sky-600 text-white hover:bg-sky-500"
                                        }`}
                                      >
                                        {isSavingEditedMessage ? "Saving..." : "Save"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  msg.text && msg.type !== 'meet-invite' && (
                                    <div>
                                      {renderWithHighlight(
                                        msg.text,
                                        highlightTerm
                                      )}
                                    </div>
                                  )
                                )}

                                <div className={`flex flex-wrap gap-2 ${msg.text ? 'mt-2' : ''}`}>
                                  {msg.editedAt && (
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                      !isChannelFeed && isMe
                                        ? "bg-white/15 text-white/85"
                                        : isDarkMode
                                          ? "bg-slate-700/70 text-slate-300"
                                          : "bg-slate-100 text-slate-500"
                                    }`}>
                                      Edited
                                    </span>
                                  )}
                                  {msg.isDecision && (
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                      isDarkMode ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'
                                    }`}>
                                      <CheckCircle className="w-3 h-3" />
                                      Decision
                                    </span>
                                  )}
                                  <ContextBadge
                                    contexts={messageContexts}
                                    isDarkMode={isDarkMode}
                                    onOpen={() => openContext(messageContexts[0]?.id)}
                                  />
                                </div>

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
                                        style={{ cursor: "pointer" }}
                                        className={`workspace-attachment-card relative rounded-xl overflow-hidden transition-transform hover:scale-[1.02] ${
                                          att.source === 'gmail'
                                            ? "bg-red-50 border border-red-100"
                                            : ((att.url && String(att.url).includes('drive.google.com')) || att.drive_file_id)
                                              ? "bg-blue-50 border border-blue-100"
                                              : "bg-black/5"
                                        }`}
                                      >
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
                                                <FileText className="w-3 h-3 text-slate-400" />
                                              </div>
                                            </div>
                                          </div>
                                        ) : (((att.url && String(att.url).includes('drive.google.com')) || att.drive_file_id)) ? (
                                          <div className="p-3 flex items-center gap-3 rounded-xl min-w-[200px]">
                                            <div className="p-2 rounded-lg bg-white shadow-sm text-blue-600">
                                              <SmartImage
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
                                          if (mime && mime.startsWith && mime.startsWith('image/') && srcUrl && !isMissingAttachment(att)) {
                                            return (
                                              <SmartImage
                                                src={srcUrl}
                                                alt={att.name}
                                                className="max-w-[240px] max-h-[240px] object-cover"
                                                onResolveError={async () => {
                                                  try {
                                                    const blobUrl = await fetchProtectedUrlAndCreateObjectURL(att)
                                                    if (blobUrl) {
                                                      updateMessageMeta(getActiveChatId(), msg.id, m => ({
                                                        ...m,
                                                        attachments: (m.attachments || []).map(a => (String(a.id) === String(att.id) ? { ...a, previewUrl: blobUrl } : a))
                                                      }))
                                                      return blobUrl
                                                    }
                                                  } catch (err) {}
                                                  const cacheKey = getAttachmentCacheKey(att)
                                                  if (cacheKey) missingAttachmentIdsRef.current.add(String(cacheKey))
                                                  return ""
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
                                                  loading="lazy"
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
                                {isMe && !isChannelFeed && (
                                  <div className="text-[9px] text-right mt-1 font-bold flex justify-end items-center gap-2 text-sky-100 flex-wrap">
                                    <span>
                                      {msg.timestamp
                                        ? formatTime(msg.timestamp)
                                        : "now"}
                                    </span>
                                    {statusLabel}
                                  </div>
                                )}
                                {isMe && isChannelFeed && messageStatus !== "sent" && (
                                  <div className="mt-1 flex items-center gap-2">
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

                  {!isAtBottom && currentMessages.length > 0 && (
                    <button
                      onClick={() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
                        setIsAtBottomFast(true)
                        setPinnedMessageId(null)
                        setHighlightTerm("")
                      }}
                      style={{ bottom: `${(messageInputRef.current?.offsetHeight || 48) + 12}px`, right: '1.5rem' }}
                      className={`absolute z-30 p-3 rounded-full shadow-lg border transition-transform transition-opacity animate-fade-in hover:-translate-y-1 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-cyan-400' : 'bg-white border-slate-100 hover:bg-sky-50 text-sky-600 shadow-slate-200/50'}`}
                      aria-label="Scroll to latest messages"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Message Input */}
                <div ref={messageInputRef} className={`workspace-composer-wrap ${isMobile ? "px-3 pt-1 pb-16" : "p-6 pt-2"}`}>
                  {/* ... (Input UI) ... */}
                  <div
                    className={`workspace-composer ${isMobile ? "rounded-xl" : "rounded-md"} relative overflow-visible p-0 transition-all duration-300 ${
                      isDarkMode
                        ? 'border border-slate-700/70 bg-[#191b1f]'
                        : 'border border-[#d8dce3] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.08)]'
                    }`}
                  >
                    {/* Attachments Preview */}
                    {selectedFiles.length > 0 && (
                      <div className={`flex gap-3 p-3 mb-2 overflow-x-auto border-b ${isDarkMode ? 'border-slate-700/80' : 'border-slate-100/80'}`}>
                        {selectedFiles.map(file => (
                          <div
                            key={file.id}
                            className={`relative group border rounded-2xl p-2 flex items-center gap-3 flex-shrink-0 pr-8 transition-all duration-200 ${isDarkMode ? 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600 hover:border-cyan-500/50 hover:shadow-md hover:shadow-cyan-500/20' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200/80 hover:border-sky-200 hover:shadow-md'}`}
                          >
                            {file.source === "drive" || file.source === "gmail" ? (
                              <SmartImage
                                src={file.iconLink || GoogleService.getAppIcon(GoogleService.getAppTypeFromMime(file.type)).iconUrl || "/google%20drive.png"}
                                className="w-6 h-6"
                                alt={file.source === "gmail" ? "Gmail" : "Drive"}
                              />
                            ) : file.type && file.type.startsWith("image/") && (file.previewUrl || file.url) ? (
                              <SmartImage
                                src={file.url || file.previewUrl}
                                className="w-10 h-10 rounded-xl object-cover"
                                alt=""
                              />
                            ) : (
                              <FileIcon className={`w-6 h-6 ${isDarkMode ? 'text-cyan-400' : 'text-sky-500'}`} />
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

                    {selectedComposerContext && (
                      <div className={`flex items-center gap-2 px-3 pt-3 pb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-[0.24em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          Context
                        </span>
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${isDarkMode ? 'bg-sky-500/15 text-sky-200 border border-sky-500/20' : 'bg-sky-50 text-sky-700 border border-sky-100'}`}>
                          <span>{selectedComposerContext.title}</span>
                          <button
                            onClick={() => setSelectedComposerContextId(null)}
                            className={`${isDarkMode ? 'text-sky-200/70 hover:text-sky-100' : 'text-sky-500 hover:text-sky-700'}`}
                            title="Remove context"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {showComposerFormatting && (
                      <div className={`flex min-h-9 items-center gap-0.5 rounded-t-[inherit] border-b px-2 ${
                        isDarkMode
                          ? 'border-[#3a3a3a] bg-[#292929]'
                          : 'border-[#edf0f3] bg-[#f7f7f8]'
                      }`}>
                        {COMPOSER_FORMAT_ACTIONS.filter(action => action.key !== "underline" && action.key !== "quote").map(action => {
                          const FormatIcon = action.icon
                          const isActiveFormat = Boolean(activeComposerFormats[action.key])
                          const showDivider = action.dividerBefore || action.key === "inline-code"
                          return (
                            <React.Fragment key={action.key}>
                              {showDivider && (
                                <span className={`mx-1 h-5 w-px ${isDarkMode ? 'bg-slate-700' : 'bg-[#e2e5e9]'}`} />
                              )}
                              <button
                                type="button"
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => applyComposerFormat(action.key)}
                                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                                  isActiveFormat
                                    ? isDarkMode
                                      ? 'bg-white/10 text-slate-100'
                                      : 'bg-white text-slate-800 shadow-sm'
                                    : isDarkMode
                                      ? 'text-slate-400 hover:bg-white/10 hover:text-slate-100'
                                      : 'text-[#a4a9af] hover:bg-white hover:text-slate-700'
                                }`}
                                title={action.label}
                                aria-label={action.label}
                                aria-pressed={isActiveFormat}
                              >
                                <FormatIcon className="h-4 w-4" />
                              </button>
                            </React.Fragment>
                          )
                        })}
                      </div>
                    )}

                    <div className="relative px-3 pb-2 pt-2">
                      <div className="relative min-h-[38px]">
                        {composerIsEmpty && (
                          <span
                            className={`pointer-events-none absolute left-0 right-1 top-1 truncate text-base font-normal ${
                              isDarkMode ? 'text-slate-500' : 'text-[#8e949b]'
                            }`}
                          >
                            Message
                          </span>
                        )}
                        <div
                          ref={composerEditorRef}
                          contentEditable
                          suppressContentEditableWarning
                          role="textbox"
                          aria-label={`Message ${getActiveViewName()}`}
                          aria-multiline="true"
                          onInput={syncComposerInputFromEditor}
                          onBlur={syncComposerInputFromEditor}
                          onFocus={refreshComposerFormatState}
                          onKeyUp={refreshComposerFormatState}
                          onMouseUp={refreshComposerFormatState}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              sendMessage()
                            }
                          }}
                          className={`w-full max-h-32 overflow-y-auto whitespace-pre-wrap break-words border-none bg-transparent py-1 pr-2 text-base font-normal leading-6 outline-none focus:outline-none focus:ring-0 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:px-3 [&_pre]:py-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 ${
                            isDarkMode
                              ? 'text-white [&_a]:text-sky-300 [&_blockquote]:border-slate-600 [&_code]:bg-white/10 [&_code]:text-sky-100 [&_pre]:bg-black/25'
                              : 'text-slate-800 [&_a]:text-sky-700 [&_blockquote]:border-slate-300 [&_code]:bg-slate-100 [&_code]:text-slate-800 [&_pre]:bg-slate-100'
                          }`}
                          style={{ minHeight: "30px" }}
                        />
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-3">
                        <div className="relative flex min-w-0 items-center gap-1.5">
                          <button
                            type="button"
                            ref={composerAttachButtonRef}
                            onClick={e => {
                              e.stopPropagation()
                              setComposerAttachMenuOpen(prev => !prev)
                              setComposerContextPickerOpen(false)
                              setMessageActionMenu(null)
                              setMessageContextPicker(null)
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                              isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-slate-100' : 'bg-[#f1f2f4] text-[#a5abb2] hover:bg-[#e7eaee] hover:text-slate-600'
                            }`}
                            title="Attach"
                            aria-label="Attach"
                          >
                            <Plus className="h-4 w-4" />
                          </button>

                          {composerAttachMenuOpen && (
                            <div
                              className={`absolute left-0 bottom-[calc(100%+0.5rem)] z-30 min-w-[220px] rounded-2xl border p-2 shadow-2xl ${
                                isDarkMode ? 'border-slate-700 bg-slate-900/95' : 'border-slate-200 bg-white/95'
                              }`}
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  fileInputRef.current?.click()
                                  setComposerAttachMenuOpen(false)
                                }}
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                  isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <Paperclip className={`w-4 h-4 ${isDarkMode ? 'text-cyan-400' : 'text-sky-600'}`} />
                                Attach from computer
                              </button>
                              <button
                                onClick={() => {
                                  setShowTaskModal(true)
                                  setComposerAttachMenuOpen(false)
                                }}
                                className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                  isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <ClipboardList className={`w-4 h-4 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
                                Create task
                              </button>
                              {(activeView === "channel" || activeView === "dm") && (
                                <button
                                  onClick={() => {
                                    setComposerAttachMenuOpen(false)
                                    setComposerContextPickerOpen(true)
                                    setMessageActionMenu(null)
                                    setMessageContextPicker(null)
                                  }}
                                  className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                    isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <Zap className={`w-4 h-4 ${isDarkMode ? 'text-sky-300' : 'text-sky-600'}`} />
                                  Add to context
                                </button>
                              )}
                            </div>
                          )}

                          {(activeView === "channel" || activeView === "dm") && composerContextPickerOpen && (
                            <div
                              className="absolute left-0 bottom-[calc(100%+0.5rem)] z-30"
                              onClick={e => e.stopPropagation()}
                            >
                              <AddToContextPopover
                                anchorEl={composerAttachButtonRef.current}
                                boundaryEl={messageInputRef.current || messagesContainerRef.current}
                                isDarkMode={isDarkMode}
                                contexts={currentChannelContexts}
                                onClose={() => setComposerContextPickerOpen(false)}
                                onSelect={contextId => {
                                  setSelectedComposerContextId(contextId)
                                  setComposerContextPickerOpen(false)
                                }}
                              />
                            </div>
                          )}

                          <input
                            type="file"
                            multiple
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                          />

                          <button
                            type="button"
                            onClick={() => {
                              setShowComposerFormatting(prev => !prev)
                              setComposerAttachMenuOpen(false)
                              setComposerContextPickerOpen(false)
                            }}
                            className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-sm font-semibold underline-offset-2 transition-colors ${
                              showComposerFormatting
                                ? isDarkMode
                                  ? 'text-slate-100 underline'
                                  : 'text-slate-700 underline'
                                : isDarkMode
                                  ? 'text-slate-400 hover:bg-white/10 hover:text-slate-100'
                                  : 'text-[#7c838c] hover:bg-slate-100 hover:text-slate-700'
                            }`}
                            title={showComposerFormatting ? "Hide formatting" : "Show formatting"}
                            aria-label={showComposerFormatting ? "Hide formatting options" : "Show formatting options"}
                            aria-pressed={showComposerFormatting}
                          >
                            Aa
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowEmojiPickerFor(prev => (prev === 'input' ? null : 'input'))
                              setComposerAttachMenuOpen(false)
                              setComposerContextPickerOpen(false)
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                              isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-slate-100' : 'text-[#6d747c] hover:bg-slate-100 hover:text-slate-800'
                            }`}
                            title="Emoji"
                            aria-label="Emoji"
                          >
                            <Smile className="h-4 w-4" />
                          </button>

                          {showEmojiPickerFor === 'input' && (
                            <div className={`absolute left-16 bottom-[calc(100%+0.5rem)] z-30 flex gap-1 rounded-xl p-2 shadow-lg ${isDarkMode ? 'border border-slate-700 bg-slate-800' : 'border border-slate-200 bg-white'}`}>
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

                          <button
                            type="button"
                            onClick={() => composerEditorRef.current?.focus()}
                            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                              isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-slate-100' : 'text-[#6d747c] hover:bg-slate-100 hover:text-slate-800'
                            }`}
                            title="Mention"
                            aria-label="Mention"
                          >
                            <AtSign className="h-4 w-4" />
                          </button>

                          <span className={`mx-1 h-5 w-px ${isDarkMode ? 'bg-slate-700' : 'bg-[#dfe3e8]'}`} />

                          <button
                            type="button"
                            onClick={() => {
                              if (activeView === 'dm' && activeDMUser) {
                                const partner = getUser(activeDMUser)
                                if (partner) startWebRTCCall(partner)
                              } else if (activeView === 'channel') {
                                createMeetCall({ callEveryone: true })
                              } else {
                                setSelectedCallMembers([])
                                setShowVideoModal(true)
                              }
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                              isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-slate-100' : 'text-[#6d747c] hover:bg-slate-100 hover:text-slate-800'
                            }`}
                            title={activeView === 'dm' ? 'Start video call' : 'Start group call'}
                            aria-label={activeView === 'dm' ? 'Start video call' : 'Start group call'}
                          >
                            <Video className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => composerEditorRef.current?.focus()}
                            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                              isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-slate-100' : 'text-[#6d747c] hover:bg-slate-100 hover:text-slate-800'
                            }`}
                            title="Voice"
                            aria-label="Voice"
                          >
                            <Mic className="h-4 w-4" />
                          </button>

                          {(activeView === "channel" || activeView === "dm") && (
                            <>
                              <span className={`mx-1 h-5 w-px ${isDarkMode ? 'bg-slate-700' : 'bg-[#dfe3e8]'}`} />
                              <button
                                type="button"
                                onClick={saveWorkspaceDraft}
                                disabled={!messageInput.trim()}
                                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                                  isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-slate-100 disabled:hover:bg-transparent' : 'text-[#6d747c] hover:bg-slate-100 hover:text-slate-800 disabled:hover:bg-transparent'
                                }`}
                                title="Save draft"
                                aria-label="Save draft"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={sendMessage}
                            disabled={
                              (!messageInput.trim() && selectedFiles.length === 0) ||
                              isUploading
                            }
                            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${
                              isDarkMode
                                ? 'text-slate-300 hover:bg-white/10 disabled:hover:bg-transparent'
                                : 'text-[#aeb3b9] hover:bg-slate-100 hover:text-slate-700 disabled:hover:bg-transparent'
                            }`}
                            title="Send"
                            aria-label="Send"
                          >
                            <Send className="h-4.5 w-4.5 ml-0.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => composerEditorRef.current?.focus()}
                            className={`flex h-8 w-5 items-center justify-center rounded-md transition-colors ${
                              isDarkMode ? 'text-slate-500 hover:bg-white/10 hover:text-slate-200' : 'text-[#aeb3b9] hover:bg-slate-100 hover:text-slate-600'
                            }`}
                            title="More send options"
                            aria-label="More send options"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={`text-center mt-3 text-[10px] font-bold uppercase tracking-widest opacity-50 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                   
                  </div>
                </div>
                </div>
              </div>
              {/* Member Details Sidebar - Added Logic for Add Friend */}
              <div
                className={`absolute right-0 top-0 bottom-0 border-l transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col z-40 ${isDarkMode ? 'border-[#2b3038] bg-[#111315] shadow-2xl shadow-black/45' : 'border-slate-200/60 bg-white/95 shadow-2xl shadow-slate-300/30'} backdrop-blur-xl ${
                  showMemberDetails && activeView === "dm"
                    ? "w-96 translate-x-0 opacity-100"
                      : "w-96 translate-x-full opacity-0 pointer-events-none"
                }`}
              >
                <div className={`h-[80px] flex items-center justify-between px-6 border-b ${isDarkMode ? 'border-[#2b3038] bg-[#15181d]' : 'border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-sky-50/30'}`}>
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
                      <div className={`rounded-2xl p-5 border text-sm leading-relaxed ${isDarkMode ? 'bg-[#181c23] border-[#303641] text-slate-200' : 'bg-slate-50/80 border-slate-100/60 text-slate-600'}`}>
                        Welcome to the{" "}
                        <span className={`font-bold ${isDarkMode ? 'text-cyan-400' : 'text-sky-600'}`}>
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
                          return !!hasOutgoing || !!hasIncoming || pendingFriendRequestIds.some(id => String(id) === String(member.id))
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
                                <span className={`text-[10px] px-2 py-1 rounded-md font-bold tracking-wide ${isDarkMode ? 'bg-cyan-900/50 text-cyan-400' : 'bg-sky-50 text-sky-600'}`}>
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
                                          : isDarkMode ? "hover:bg-cyan-900/50 text-slate-400 hover:text-cyan-400" : "hover:bg-sky-100 text-slate-400 hover:text-sky-600"
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

      {collapsedSpaceMenu && !isMobile && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={collapsedSpaceMenuRef}
            className={`collapsed-space-popover ${isDarkMode ? "collapsed-space-popover-dark" : ""}`}
            style={{
              position: "fixed",
              top: collapsedSpaceMenu.top,
              left: collapsedSpaceMenu.left
            }}
          >
            <div className="collapsed-space-popover-header">
              <span className="collapsed-space-popover-title">
                {collapsedSpaceMenu.spaceName}
              </span>
              <span className="collapsed-space-popover-count">
                {collapsedSpaceMenu.channels.length}
              </span>
            </div>
            <div className="collapsed-space-popover-list">
              {collapsedSpaceMenu.channels.length > 0 ? (
                collapsedSpaceMenu.channels.map(channel => (
                  <button
                    key={channel.id}
                    className={`collapsed-space-channel-item ${
                      activeView === "channel" && activeChannel === channel.id
                        ? "collapsed-space-channel-item-active"
                        : ""
                    }`}
                    onClick={() => handleChannelNavigation(collapsedSpaceMenu.spaceId, channel.id)}
                  >
                    <Hash className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate flex-1 text-left">{channel.name}</span>
                    {unreadChannels.some(id => String(id) === String(channel.id)) && String(activeChannel) !== String(channel.id) && (
                      <span className="collapsed-space-channel-dot" />
                    )}
                  </button>
                ))
              ) : (
                <div className="collapsed-space-popover-empty">
                  No channels available
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {showLegacyFriendsSidebar && (
        <>
      {/* Right Sidebar - FRIENDS & DMs */}
      <div className={`${isMobile ? (mobileView === "friends" ? "flex fixed inset-0 right-0 w-screen max-w-none mobile-slide-in-right z-[70]" : "hidden") : "hidden lg:flex"} flex-col ${friendsSidebarCollapsed ? "w-[92px]" : "w-[272px]"} transition-all ease-[cubic-bezier(0.32,0.72,0,1)] duration-300 z-40 liquid-glass-sidebar-right`}>
        {/* Mobile Swipe Indicator */}
        {isMobile && mobileView === "friends" && (
          <div className="swipe-indicator mt-2" />
        )}
        <div className={`p-6 ${isMobile ? 'pt-4' : ''} h-[80px] border-b flex items-center justify-between ${isDarkMode ? 'border-[var(--border-light)] bg-gradient-to-r from-transparent to-cyan-900/20' : 'border-slate-100/60 bg-gradient-to-r from-transparent to-sky-50/30'}`}>
          {isMobile && (
            <button
              onClick={() => setMobileView("chat")}
              className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-cyan-400' : 'hover:bg-slate-100/80 text-slate-400 hover:text-sky-600'} mr-2`}
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {!friendsSidebarCollapsed && (
            <h3 className={`font-extrabold text-lg bg-gradient-to-r ${isDarkMode ? 'from-white to-cyan-300' : 'from-slate-700 to-sky-700'} bg-clip-text text-transparent animate-fade-in`}>Connections</h3>
          )}
          <div className="flex gap-2 ml-auto">
            {!friendsSidebarCollapsed && !isMobile && (
              <button
                onClick={openHomeConnect}
                className={`p-2.5 rounded-xl transition-all duration-200 ${isDarkMode ? 'hover:bg-gradient-to-br hover:from-cyan-900/50 hover:to-sky-900/50 text-slate-400 hover:text-cyan-400' : 'hover:bg-gradient-to-br hover:from-sky-50 hover:to-cyan-50 text-slate-400 hover:text-sky-600'} hover:shadow-md`}
              >
                <UserPlus className="w-5 h-5" />
              </button>
            )}
            {isMobile && (
              <button
                onClick={openHomeConnect}
                className={`p-2.5 rounded-xl transition-all duration-200 ${isDarkMode ? 'hover:bg-gradient-to-br hover:from-cyan-900/50 hover:to-sky-900/50 text-slate-400 hover:text-cyan-400' : 'hover:bg-gradient-to-br hover:from-sky-50 hover:to-cyan-50 text-slate-400 hover:text-sky-600'} hover:shadow-md`}
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
              <Search className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-cyan-400' : 'text-slate-400 group-focus-within:text-sky-500'}`} />
              <input
                type="text"
                placeholder="Filter connections..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none transition-all duration-300 ease-in-out ${isDarkMode ? 'bg-slate-800/70 border-slate-700 focus:bg-slate-800 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 text-white hover:bg-slate-800 hover:border-slate-600 placeholder:text-slate-500' : 'bg-white/70 border-slate-200/50 focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-300 text-slate-700 hover:bg-white hover:border-slate-300 placeholder:text-slate-400 shadow-sm'} border`}
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
                        if (isMobile) setMobileView("chat")
                        if (result.messageId) {
                          // Scroll to the message and pin it for review
                          setTargetMessageId(result.messageId)
                          setPinnedMessageId(result.messageId)
                          setHighlightTerm(debouncedSearchQuery)
                        } else {
                          // Navigating to a DM without a specific message should clear any pinned result
                          setPinnedMessageId(null)
                        }
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-[10px] cursor-pointer transition-all border ${
                      activeView === "dm" && activeDMUser === result.userId
                        ? isDarkMode ? "bg-transparent border-transparent text-slate-200" : "bg-[#eeedec] border-transparent text-slate-700 shadow-sm"
                        : isDarkMode ? "bg-transparent border-transparent hover:bg-[#2C2C2C]" : "bg-white/60 border-transparent hover:bg-[#f1f0ef] hover:shadow-sm"
                    }`}
                  >
                    <div className="relative w-10 h-10 flex items-center justify-center text-lg">
                      {result.icon}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-sm font-bold truncate ${
                            activeView === "dm" && activeDMUser === result.userId
                              ? isDarkMode ? "text-slate-200" : "text-slate-800"
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
                          debouncedSearchQuery
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
                    onClick={openHomeConnect}
                    className={`text-xs font-bold hover:underline ${isDarkMode ? 'text-cyan-400' : 'text-sky-600'}`}
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
                      if (isMobile) setMobileView("chat")
                    }}
                    className={`flex items-center gap-3 p-3 rounded-[10px] cursor-pointer transition-all duration-300 border hover-lift ${
                      activeView === "dm" && activeDMUser === friend.id
                        ? isDarkMode 
                          ? "bg-transparent border-transparent"
                          : "bg-[#eeedec] border-transparent shadow-sm"
                        : isDarkMode 
                          ? "bg-transparent border-transparent hover:bg-[#2C2C2C]"
                          : "bg-white/60 border-transparent hover:bg-[#f1f0ef] hover:border-slate-200/40 hover:shadow-md"
                    }`}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg overflow-hidden">
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
                    <div className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-700 hover:text-cyan-400 text-slate-500' : 'hover:bg-white hover:text-sky-600 text-slate-300'}`}>
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
                  onClick={openHomeConnect}
                  className={`p-3 rounded-2xl border-2 border-dashed transition-all ${isDarkMode ? 'border-slate-700 text-slate-500 hover:border-cyan-500 hover:text-cyan-400' : 'border-slate-200 text-slate-400 hover:border-sky-400 hover:text-sky-500'}`}
                  title="Add Friend"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              ) : (
                <>
                  {friends.map(friend => (
                    <button
                      key={friend.id}
                      className={`collapsed-friend-icon group relative w-11 h-11 flex items-center justify-center rounded-[10px] transition-all duration-300 overflow-visible ${
                        activeView === "dm" && activeDMUser === friend.id
                          ? isDarkMode
                            ? "bg-transparent collapsed-friend-icon-active-dark"
                            : "bg-[#eeedec] collapsed-friend-icon-active"
                          : isDarkMode
                            ? "collapsed-friend-icon-dark"
                            : "collapsed-friend-icon-light"
                      }`}
                      title={friend.name}
                      onClick={() => {
                        setActiveDMUser(friend.id)
                        setActiveView("dm")
                        if (isMobile) setMobileView("chat")
                      }}
                    >
                      <span className="collapsed-friend-avatar">
                        {renderAvatar(friend, 48)}
                      </span>
                      <span
                        className={`collapsed-friend-status absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 shadow-sm ${
                          friend.status === "online"
                            ? "bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-emerald-300/50 collapsed-friend-status-online"
                            : "bg-gradient-to-br from-slate-300 to-slate-400"
                        } ${isDarkMode ? 'border-slate-800' : 'border-white'}`}
                      ></span>
                      <span className={`collapsed-friend-tooltip ${isDarkMode ? "collapsed-friend-tooltip-dark" : ""}`}>
                        {friend.name}
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={openHomeConnect}
                    className={`p-3 rounded-2xl border-2 border-dashed transition-all ${isDarkMode ? 'border-slate-700 text-slate-500 hover:border-cyan-500 hover:text-cyan-400' : 'border-slate-200 text-slate-400 hover:border-sky-400 hover:text-sky-500'}`}
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
        </>
      )}
      </>
      )}

      {/* --- MODALS --- */}

      {/* Add Friend Confirmation Modal */}
      {showAddFriendConfirm && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-fade-in ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/30'}`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-sm text-center`}>
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-sm ${isDarkMode ? 'bg-cyan-900/50 text-cyan-400' : 'bg-sky-100/80 text-sky-600'}`}>
              <UserPlus className="w-8 h-8" />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Add Friend?
            </h3>
            <p className={`text-sm mb-8 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Do you want to send a friend request to{" "}
              <span className="font-bold">
                {getUser(showAddFriendConfirm)?.name || activeMembers.find(member => String(member.id) === String(showAddFriendConfirm))?.name || "this member"}
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
                  if (showAddFriendConfirm) sendFriendRequest(showAddFriendConfirm)
                  setShowAddFriendConfirm(null)
                }}
                disabled={pendingFriendRequestIds.some(id => String(id) === String(showAddFriendConfirm))}
                className={`flex-1 py-3 px-6 rounded-2xl font-bold text-white shadow-lg transition-all ${isDarkMode ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-500/20' : 'bg-sky-600 shadow-sky-200 hover:bg-sky-700'}`}
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
              className={`w-full py-3.5 px-6 rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${isDarkMode ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-500/20' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
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
              className={`w-full p-4 rounded-2xl mb-6 outline-none focus:ring-2 ${isDarkMode ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:ring-sky-500 border' : 'bg-slate-50 border border-slate-200 focus:ring-sky-500'}`}
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
                className={`flex-1 py-3 rounded-2xl font-bold text-white shadow-lg ${isDarkMode ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-500/20' : 'bg-sky-600 shadow-sky-200 hover:bg-sky-700'}`}
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
              {showDeleteConfirm.type === "file"
                ? `You are about to remove "${showDeleteConfirm.fileName || "this file"}" from this channel. This action cannot be undone.`
                : `You are about to delete this ${showDeleteConfirm.type}. This action cannot be undone.`}
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
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-cyan-600 to-sky-600 shadow-lg shadow-cyan-500/30' : 'bg-gradient-to-br from-sky-500 to-cyan-500 shadow-lg shadow-sky-200/50'}`}>
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
                      : isDarkMode ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-sky-600 text-white hover:bg-sky-700'
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
                      <div key={ev.id} className={`p-4 rounded-xl border mb-3 last:mb-0 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-cyan-600/30' : 'bg-white border-slate-200/60 hover:border-sky-200 hover:shadow-sm'}`}>
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
                        className={`w-full px-5 py-3.5 rounded-xl focus:outline-none focus:ring-2 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:ring-cyan-500/30 focus:border-cyan-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-sky-500/30 focus:border-sky-400'} border`}
                        placeholder="Enter event title" 
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Time</label>
                      <input 
                        type="time" 
                        value={newEvent.time} 
                        onChange={e => setNewEvent({ ...newEvent, time: e.target.value })} 
                        className={`w-full px-5 py-3.5 rounded-xl focus:outline-none focus:ring-2 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-cyan-500/30 focus:border-cyan-500' : 'bg-white border-slate-200 text-slate-800 focus:ring-sky-500/30 focus:border-sky-400'} border`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Description</label>
                      <textarea 
                        value={newEvent.description} 
                        onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} 
                        className={`w-full px-5 py-3.5 rounded-xl h-28 focus:outline-none focus:ring-2 transition-all resize-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:ring-cyan-500/30 focus:border-cyan-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-sky-500/30 focus:border-sky-400'} border`}
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
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all ${isDarkMode ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-sky-600 hover:bg-sky-700'}`}
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
      </div>

      {/* Google Apps Menu - Mobile Full Screen Modal */}
      {isMobile && showGoogleAppsMenu && (
        <div className={`fixed inset-0 z-[60] backdrop-blur-sm animate-fade-in ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/50'}`}>
          <div className={`fixed inset-x-0 bottom-0 rounded-t-3xl shadow-2xl mobile-slide-in-bottom p-6 max-h-[80vh] overflow-y-auto ${isDarkMode ? 'bg-slate-800/98 border-t border-slate-700/50' : 'bg-white'}`}>
            {/* Handle bar */}
            <div className={`w-10 h-1 rounded-full mx-auto mb-4 ${isDarkMode ? 'bg-slate-600' : 'bg-slate-300'}`}></div>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-gradient-to-br from-sky-600 to-cyan-600' : 'bg-gradient-to-br from-sky-500 to-cyan-600'}`}>
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
                    <SmartImage
                      src={app.icon}
                      alt={app.name}
                      className="w-7 h-7 object-contain"
                      fallback={<span className="text-xl">{app.name.charAt(0)}</span>}
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
            {mobilePrimaryNavItems.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.action}
                  className={`mobile-nav-item ${item.active ? "active" : ""} ${
                    item.active
                      ? isDarkMode ? "text-sky-400" : "text-sky-600"
                      : isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                  title={item.title}
                  aria-label={item.title}
                  aria-current={item.active ? "page" : undefined}
                >
                  <span className="relative flex h-6 w-6 items-center justify-center">
                    {item.imageSrc ? (
                      <SmartImage
                        src={item.imageSrc}
                        alt=""
                        className="mobile-nav-image h-5 w-5 object-contain transition-transform duration-200"
                        fallback={<Icon className="h-5 w-5 transition-transform duration-200" />}
                      />
                    ) : (
                      <Icon className="h-5 w-5 transition-transform duration-200" />
                    )}
                    {item.badge > 0 && (
                      <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </span>
                  <span className="mobile-nav-label text-[10px] font-semibold">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Create Space Modal */}
      {showCreateSpaceModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in ${
          isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/30'
        }`}>
          <div className={`liquid-glass-modal p-8 w-full max-w-sm`}>
            <h3 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
              Create a Space
            </h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Create your first Space — it takes 30 seconds.
            </p>
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={e => setNewSpaceName(e.target.value)}
                  className={`w-full px-5 py-4 rounded-2xl border focus:outline-none focus:ring-2 ${
                    isDarkMode 
                      ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:ring-sky-500' 
                      : 'bg-slate-50 border-slate-200 focus:ring-sky-500'
                  }`}
                  placeholder="Space Name"
                  autoFocus
                />
                <p className={`text-xs mt-2 ${isDarkMode ? 'text-sky-400/70' : 'text-sky-600/70'}`}>
                  💡 Tip: Create one Space per project to keep messages, files & tasks together.
                </p>
              </div>
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
                      ? 'bg-sky-600 shadow-sky-500/20 hover:bg-sky-700' 
                      : 'bg-sky-600 shadow-sky-200 hover:bg-sky-700'
                  }`}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Friend Modal */}
      {showAddFriendModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 animate-fade-in ${
          isDarkMode ? 'bg-slate-950/70' : 'bg-slate-950/35'
        }`}>
          <div className={`w-full max-w-2xl max-h-[calc(100vh-48px)] rounded-3xl overflow-hidden shadow-[0_28px_90px_rgba(15,23,42,0.28)] border flex flex-col ${
            isDarkMode
              ? 'bg-slate-950 border-slate-800'
              : 'bg-white border-slate-200'
          }`}>
            <div className={`px-5 py-4 sm:px-6 sm:py-5 border-b ${
              isDarkMode ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    isDarkMode ? 'bg-sky-500/12 text-sky-300' : 'bg-sky-50 text-sky-700'
                  }`}>
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className={`text-xl sm:text-2xl leading-tight font-bold ${
                      isDarkMode ? 'text-white' : 'text-slate-950'
                    }`}>
                      Invite friends to Spacess
                    </h3>
                    <p className={`mt-1 text-sm ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Search people, select who to invite, and send requests together.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Close invite friends modal"
                  onClick={() => setShowAddFriendModal(false)}
                  className={`p-2 rounded-xl transition-all shrink-0 ${
                    isDarkMode
                      ? 'text-slate-400 hover:bg-slate-900 hover:text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {!inviteSent ? (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}>
                      Search people
                    </label>

                    <div className={`relative rounded-2xl border transition-all focus-within:ring-4 ${
                      isDarkMode
                        ? 'border-slate-800 bg-slate-900/70 focus-within:border-sky-500 focus-within:ring-sky-500/10'
                        : 'border-slate-200 bg-slate-50 focus-within:border-sky-500 focus-within:bg-white focus-within:ring-sky-500/10'
                    }`}>
                      <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? 'text-slate-500' : 'text-slate-400'
                      }`} />
                      <input
                        type="text"
                        value={inviteSearchQuery}
                        onChange={e => {
                          setInviteSearchQuery(e.target.value)
                        }}
                        placeholder="Search by name"
                        className={`w-full h-[52px] pl-12 pr-4 bg-transparent text-base border-0 outline-none focus:outline-none focus:ring-0 ${
                          isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
                        }`}
                      />
                    </div>

                    {selectedFriendInvitees.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedFriendInvitees.map(id => {
                          const u =
                            inviteSearchResults.find(r => r.id === id) ||
                            users.find(us => us.id === id)
                          return (
                            <div
                              key={id}
                              className={`inline-flex max-w-full items-center gap-2 rounded-full pl-1.5 pr-2.5 py-1.5 text-sm font-medium border ${
                                isDarkMode
                                  ? 'bg-sky-500/10 text-sky-100 border-sky-400/20'
                                  : 'bg-sky-50 text-sky-800 border-sky-200'
                              }`}
                            >
                              <span className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-transparent">
                                {u ? renderAvatar(u, 22) : <UserIcon className="w-4 h-4" />}
                              </span>
                              <span className="truncate">{u?.name || 'Selected user'}</span>
                              <button
                                type="button"
                                aria-label={`Remove ${u?.name || 'selected user'}`}
                                onClick={() => toggleFriendSelection(id)}
                                className={`rounded-full p-1 transition-colors ${
                                  isDarkMode ? 'hover:bg-white/10' : 'hover:bg-sky-200/70'
                                }`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className={`mt-5 rounded-2xl border overflow-hidden ${
                    isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'
                  }`}>
                    <div className={`px-4 py-3 flex items-center justify-between gap-3 border-b ${
                      isDarkMode ? 'border-slate-800' : 'border-slate-100'
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'
                        }`}>
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${
                            isDarkMode ? 'text-slate-100' : 'text-slate-900'
                          }`}>
                            Suggestions
                          </p>
                          <p className={`text-xs truncate ${
                            isDarkMode ? 'text-slate-500' : 'text-slate-500'
                          }`}>
                            {selectedFriendInvitees.length > 0
                              ? `${selectedFriendInvitees.length} selected`
                              : 'Results appear as you type'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {inviteSearchResults.length > 0 ? (
                      <div className="max-h-[300px] overflow-y-auto">
                        {inviteSearchResults.map((u, index) => {
                          const isSelected = selectedFriendInvitees.includes(u.id)
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => toggleFriendSelection(u.id)}
                              className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors ${
                                index !== inviteSearchResults.length - 1
                                  ? isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-100'
                                  : ''
                              } ${
                                isSelected
                                  ? isDarkMode ? 'bg-sky-500/10' : 'bg-sky-50'
                                  : isDarkMode ? 'hover:bg-slate-900' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${
                                  isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
                                }`}>
                                  {renderAvatar(u, 36)}
                                </div>
                                <div className="min-w-0">
                                  <p className={`font-semibold truncate ${
                                    isDarkMode ? 'text-slate-100' : 'text-slate-900'
                                  }`}>
                                    {u.name}
                                  </p>
                                  <p className={`text-sm truncate ${
                                    isDarkMode ? 'text-slate-500' : 'text-slate-500'
                                  }`}>
                                    {u.email || (isSelected ? 'Selected' : 'Available to invite')}
                                  </p>
                                </div>
                              </div>
                              <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? isDarkMode
                                    ? 'border-sky-400 bg-sky-400 text-slate-950'
                                    : 'border-sky-600 bg-sky-600 text-white'
                                  : isDarkMode
                                    ? 'border-slate-600 bg-slate-900'
                                    : 'border-slate-300 bg-white'
                              }`}>
                                {isSelected && <Check className="w-4 h-4" />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="px-6 py-12 text-center">
                        <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                          isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-slate-50 text-slate-400'
                        }`}>
                          <Search className="w-5 h-5" />
                        </div>
                        <p className={`font-semibold ${
                          isDarkMode ? 'text-slate-200' : 'text-slate-800'
                        }`}>
                          {inviteSearchQuery.trim() ? 'No matching people found' : 'Start typing to find friends'}
                        </p>
                        <p className={`mt-1 text-sm ${
                          isDarkMode ? 'text-slate-500' : 'text-slate-500'
                        }`}>
                          {inviteSearchQuery.trim()
                            ? 'Try a different name or check the spelling.'
                            : 'Search by name to add people to your invite list.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`px-5 py-4 sm:px-6 border-t flex items-center justify-between gap-3 flex-wrap ${
                  isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50/70'
                }`}>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      isDarkMode ? 'text-sky-300 hover:bg-sky-500/10' : 'text-sky-700 hover:bg-sky-50'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    Copy invite link
                  </button>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setShowAddFriendModal(false)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                        isDarkMode
                          ? 'text-slate-300 hover:bg-slate-900'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkFriendInvite}
                      disabled={selectedFriendInvitees.length === 0}
                      className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:shadow-none ${
                        selectedFriendInvitees.length === 0
                          ? isDarkMode
                            ? 'bg-slate-800 text-slate-500'
                            : 'bg-slate-200 text-slate-400'
                          : isDarkMode
                            ? 'bg-sky-400 text-slate-950 hover:bg-sky-300 shadow-lg shadow-sky-500/15'
                            : 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-600/20'
                      }`}
                    >
                      {selectedFriendInvitees.length > 0 ? `Send ${selectedFriendInvitees.length}` : 'Send'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="px-6 py-16 text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
                  isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  <Check className="w-8 h-8" />
                </div>
                <h4 className={`text-2xl font-bold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  Requests sent
                </h4>
                <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                  Your friend invites have been delivered successfully.
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
          <div className={`w-full max-w-4xl rounded-[26px] overflow-hidden shadow-[0_40px_110px_rgba(15,23,42,0.28)] border ${
            isDarkMode
              ? 'bg-slate-900 border-slate-700/80'
              : 'bg-white border-slate-200/90'
          }`}>
            <div className="relative p-7 sm:p-9">
              <button
                onClick={() => setShowAddToSpaceModal(false)}
                className={`absolute right-5 top-5 p-2.5 rounded-full transition-all ${
                  isDarkMode
                    ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="pr-14">
                <h3 className={`text-[2rem] leading-tight font-bold ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  Add members to this space
                </h3>
              </div>

              {!inviteSent ? (
                <div className="mt-8">
                {friends.length === 0 ? (
                  <div className={`rounded-2xl border p-6 text-center ${
                    isDarkMode ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50/70'
                  }`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                      isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-400 border border-slate-200'
                    }`}>
                      <Users className="w-8 h-8" />
                    </div>
                    <p className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      No eligible friends yet
                    </p>
                    <p className={`text-sm font-medium mb-6 px-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      You need to be friends with people before inviting them to this channel.
                    </p>
                    <button
                      onClick={() => {
                        setShowAddToSpaceModal(false)
                        openHomeConnect()
                      }}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-lg font-semibold transition-all ${
                        isDarkMode
                          ? 'bg-slate-200 text-slate-900 hover:bg-white'
                          : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                      }`}
                    >
                      <UserPlus className="w-5 h-5" /> Find Friends
                    </button>
                  </div>
                ) : (
                  <>
                    <label className={`block text-sm font-semibold mb-2 ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}>
                      To:
                    </label>

                    <div className={`rounded-[22px] border-2 px-4 py-4 min-h-[110px] transition-all ${
                      isDarkMode
                        ? 'border-sky-500/80 bg-slate-950 shadow-[0_0_0_4px_rgba(14,165,233,0.12)]'
                        : 'border-sky-500 bg-white shadow-[0_0_0_4px_rgba(59,130,246,0.10)]'
                    }`}>
                      <div className="relative">
                        <Search className={`absolute left-0 top-1 w-5 h-5 ${
                          isDarkMode ? 'text-slate-500' : 'text-slate-400'
                        }`} />
                        <input
                          type="text"
                          value={inviteSearchQuery}
                          onChange={e => setInviteSearchQuery(e.target.value)}
                          placeholder="Search by name..."
                          className={`w-full pl-8 pr-2 bg-transparent text-2xl sm:text-[2rem] leading-tight border-0 outline-none focus:outline-none focus:ring-0 ${
                            isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-700 placeholder-slate-400'
                          }`}
                        />
                      </div>

                      {selectedInviteUsers.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedInviteUsers.map(id => {
                            const u =
                              inviteSearchResults.find(r => r.id === id) ||
                              users.find(us => us.id === id)
                            return (
                              <div
                                key={id}
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                                  isDarkMode
                                    ? 'bg-sky-500/12 text-sky-100 border border-sky-400/20'
                                    : 'bg-sky-100 text-sky-800 border border-sky-200'
                                }`}
                              >
                                <span className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-transparent">
                                  {u ? renderAvatar(u, 22) : <UserIcon className="w-4 h-4" />}
                                </span>
                                {u?.name || 'Selected user'}
                                <button
                                  type="button"
                                  onClick={() => toggleInviteSelection(id)}
                                  className={`rounded-full p-0.5 ${
                                    isDarkMode ? 'hover:bg-white/10' : 'hover:bg-sky-200/70'
                                  }`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="my-8 flex items-center gap-4">
                      <div className={`h-px flex-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      <span className={`text-sm ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        OR
                      </span>
                      <div className={`h-px flex-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                    </div>

                    <div className={`rounded-2xl border p-4 ${
                      isDarkMode ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50/60'
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center ${
                          isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'
                        }`}>
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`text-xl font-semibold ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}>
                            Invite existing friends
                          </p>
                          <p className={`mt-1 text-base ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            
                          </p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <p className={`text-sm mb-3 ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          Suggestions
                        </p>

                        <div className={`rounded-2xl border overflow-hidden ${
                          isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
                        }`}>
                          {inviteSearchResults.length > 0 ? (
                            <div className="max-h-[220px] overflow-y-auto">
                              {inviteSearchResults.map((u, index) => {
                                const isSelected = selectedInviteUsers.includes(u.id)
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => toggleInviteSelection(u.id)}
                                    className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors ${
                                      index !== inviteSearchResults.length - 1
                                        ? isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-100'
                                        : ''
                                    } ${
                                      isSelected
                                        ? isDarkMode ? 'bg-sky-500/10' : 'bg-sky-50'
                                        : isDarkMode ? 'hover:bg-slate-800/80' : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center ${
                                        isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
                                      }`}>
                                        {renderAvatar(u, 32)}
                                      </div>
                                      <div className="min-w-0">
                                        <p className={`font-medium truncate ${
                                          isDarkMode ? 'text-slate-100' : 'text-slate-800'
                                        }`}>
                                          {u.name}
                                        </p>
                                        <p className={`text-sm ${
                                          isDarkMode ? 'text-slate-400' : 'text-slate-500'
                                        }`}>
                                          {isSelected ? 'Selected' : 'Click to add'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                                      isSelected
                                        ? isDarkMode
                                          ? 'border-sky-400 bg-sky-400 text-slate-950'
                                          : 'border-sky-500 bg-sky-500 text-white'
                                        : isDarkMode
                                          ? 'border-slate-600'
                                          : 'border-slate-300'
                                    }`}>
                                      {isSelected && <CheckCircle className="w-4 h-4" />}
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="px-6 py-10 text-center">
                              <p className={`font-medium ${
                                isDarkMode ? 'text-slate-300' : 'text-slate-700'
                              }`}>
                                {inviteSearchQuery.trim() ? 'No matching friends found' : 'Start typing to find friends'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
                      <button
                        onClick={() => {
                          setShowAddToSpaceModal(false)
                          openHomeConnect()
                        }}
                        className={`inline-flex items-center gap-2 text-lg font-medium transition-colors ${
                          isDarkMode ? 'text-sky-400 hover:text-sky-300' : 'text-sky-700 hover:text-sky-800'
                        }`}
                      >
                        <UserPlus className="w-5 h-5" />
                        Find new friends
                      </button>

                      <button
                        onClick={addFriendsToChannel}
                        disabled={selectedInviteUsers.length === 0}
                        className={`min-w-[128px] rounded-2xl px-8 py-3.5 text-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDarkMode
                            ? 'bg-slate-200 text-slate-900 hover:bg-white'
                            : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                        }`}
                      >
                        Add
                      </button>
                    </div>
                  </>
                )}
                </div>
              ) : (
                <div className="py-16 text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${
                  isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  <Check className="w-10 h-10" />
                </div>
                <h4 className={`text-3xl font-bold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  Members added
                </h4>
                <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                  Members successfully added to the channel.
                </p>
              </div>
            )}
          </div>
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
                <Bell className={`w-8 h-8 ${isDarkMode ? 'text-sky-400' : 'text-sky-500'}`} /> Notifications
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
                          <UserPlus className={`w-5 h-5 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
                        ) : notif.type === "info" ? (
                          <Info className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`} />
                        ) : (
                          <Mail className={`w-5 h-5 ${isDarkMode ? 'text-teal-400' : 'text-teal-500'}`} />
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
                            <span className={`font-bold ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`}>
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
                              disabled={pendingNotificationActionIds.includes(notif.id)}
                              className={`flex-1 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-95 text-white ${
                                isDarkMode 
                                  ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-500/20' 
                                  : 'bg-sky-600 hover:bg-sky-700'
                              }`}
                            >
                              <CheckCircle className="w-4 h-4" /> Accept
                            </button>
                            <button
                              onClick={() =>
                                handleRejectNotification(notif.id, notif.type)
                              }
                              disabled={pendingNotificationActionIds.includes(notif.id)}
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
                    ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:ring-sky-500' 
                    : 'bg-slate-50 border-slate-200 focus:ring-sky-500'
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
                      ? 'bg-sky-600 shadow-sky-500/20 hover:bg-sky-700' 
                      : 'bg-sky-600 shadow-sky-200 hover:bg-sky-700'
                  }`}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview */}
      {attachmentPreview && (() => {
        const att = attachmentPreview.attachment || {}
        const previewUrl = attachmentPreview.url
        const previewKind = getAttachmentPreviewKind(att)
        const isGooglePreviewFrame = typeof previewUrl === "string" && /\/preview(?:\?|$)/.test(previewUrl) && (previewUrl.includes("drive.google.com") || previewUrl.includes("docs.google.com"))
        const title = att.name || att.filename || "Attachment"
        const sourceLabel =
          att.source === "gmail"
            ? "Gmail attachment"
            : isGoogleDriveAttachment(att)
              ? "Google Drive"
              : "Shared document"
        const detail = [
          sourceLabel,
          att.size ? `${Math.max(att.size / 1024, 0.1).toFixed(1)} KB` : "",
        ].filter(Boolean).join(" | ")

        return (
          <div
            className={`fixed inset-0 z-[70] flex items-center justify-center p-3 backdrop-blur-md animate-fade-in sm:p-6 ${
              isDarkMode ? "bg-slate-950/75" : "bg-slate-950/45"
            }`}
            onClick={() => {
              setAttachmentPreview(null)
              setAttachmentPreviewMenuOpen(false)
            }}
          >
            <section
              className={`flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border shadow-[0_30px_90px_rgba(2,6,23,0.36)] ${
                isDarkMode ? "border-white/10 bg-[#0d1218] text-slate-100" : "border-white/80 bg-white text-slate-900"
              }`}
              onClick={event => event.stopPropagation()}
            >
              <header className={`flex shrink-0 items-start justify-between gap-4 border-b px-4 py-4 sm:px-5 ${
                isDarkMode ? "border-white/10" : "border-slate-200/80"
              }`}>
                <div className="min-w-0">
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
                    Preview
                  </div>
                  <h3 className={`mt-1 truncate text-lg font-semibold sm:text-xl ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {title}
                  </h3>
                  <div className={`mt-1 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {detail}
                  </div>
                </div>

                <div className="relative flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAttachmentPreviewMenuOpen(open => !open)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                      isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    }`}
                    aria-label="Attachment actions"
                    title="Attachment actions"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  {attachmentPreviewMenuOpen && (
                    <div className={`absolute right-12 top-0 z-10 w-48 overflow-hidden rounded-[18px] border p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.2)] ${
                      isDarkMode ? "border-white/10 bg-[#17191d]" : "border-slate-200 bg-white"
                    }`}>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachmentPreviewMenuOpen(false)
                          downloadAttachment(att)
                        }}
                        className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-sm font-medium transition ${
                          isDarkMode ? "text-slate-200 hover:bg-white/[0.06]" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentPreview(null)
                      setAttachmentPreviewMenuOpen(false)
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                      isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    }`}
                    aria-label="Close preview"
                    title="Close preview"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </header>

              <div className={`min-h-[360px] flex-1 overflow-auto p-3 sm:p-5 ${isDarkMode ? "bg-[#070b10]" : "bg-slate-100/80"}`}>
                {attachmentPreview.loading ? (
                  <div className="flex h-[52vh] min-h-[320px] items-center justify-center">
                    <div className="text-center">
                      <Loader2 className={`mx-auto h-8 w-8 animate-spin ${isDarkMode ? "text-sky-300" : "text-sky-600"}`} />
                      <div className={`mt-3 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Preparing preview...</div>
                    </div>
                  </div>
                ) : isGooglePreviewFrame ? (
                  <iframe src={previewUrl} title={title} className={`h-[68vh] w-full rounded-[20px] border ${
                    isDarkMode ? "border-white/10 bg-white" : "border-slate-200 bg-white"
                  }`} />
                ) : previewKind === "image" && previewUrl ? (
                  <div className="flex min-h-[52vh] items-center justify-center">
                    <SmartImage src={previewUrl} alt={title} className="max-h-[68vh] max-w-full rounded-[20px] object-contain shadow-2xl" />
                  </div>
                ) : previewKind === "video" && previewUrl ? (
                  <div className="flex min-h-[52vh] items-center justify-center">
                    <video className="max-h-[68vh] w-full max-w-4xl rounded-[20px] bg-black" controls>
                      <source src={previewUrl} type={att.type || att.mimeType || undefined} />
                    </video>
                  </div>
                ) : previewKind === "pdf" && previewUrl ? (
                  <iframe src={previewUrl} title={title} className={`h-[68vh] w-full rounded-[20px] border ${
                    isDarkMode ? "border-white/10 bg-white" : "border-slate-200 bg-white"
                  }`} />
                ) : (
                  <div className="flex h-[52vh] min-h-[320px] items-center justify-center px-4 text-center">
                    <div className="max-w-sm">
                      <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] ${
                        isDarkMode ? "bg-white/[0.06] text-slate-200" : "bg-white text-slate-600 shadow-sm"
                      }`}>
                        <FileIcon className="h-10 w-10" />
                      </div>
                      <h4 className={`mt-5 text-xl font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{title}</h4>
                      <p className={`mt-2 text-sm leading-6 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                        {attachmentPreview.error || "This file type does not have an inline preview."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )
      })()}

      {/* Docs Modal */}
      {showDocsModal && (
        <div className={`fixed inset-0 z-50 animate-fade-in ${
          isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/50'
        }`}>
          <div className={`h-full w-full overflow-y-auto ${isDarkMode ? 'bg-slate-950/90' : 'bg-slate-100/95'}`}>
            <DocumentsHub
              isDarkMode={isDarkMode}
              googleAccessToken={googleAccessToken}
              loadingDocs={loadingDocs}
              docsError={docsError}
              selectedAppFilter={selectedAppFilter}
              docsOverview={docsOverview}
              docsCollectionSummary={docsCollectionSummary}
              googleDocs={googleDocs}
              sortedGoogleDocs={sortedGoogleDocs}
              sharedChatDocs={sharedChatDocs}
              gmailAttachments={dedupedGmailAttachments}
              formatDocsDate={formatDocsDate}
              formatDocsSize={formatDocsSize}
              onBackHome={() => setShowDocsModal(false)}
              onConnectGoogle={handleConnectGoogleDocs}
              onReconnectGoogle={handleDocumentsReconnect}
              onRefresh={handleDocumentsRefresh}
              onOpenConnections={() => setShowConnectAppsModal(true)}
              onSelectFilter={handleDocumentsFilterSelect}
              onOpenAttachment={openAttachment}
              onAddDocument={handleHubAddDocument}
            />
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
                      const imgSrc = app.id === 'docs' ? '/google%20docs.png' : app.id === 'sheets' ? '/google%20sheets.png' : app.id === 'slides' ? '/google%20slides.png' : app.id === 'gmail' ? '/gmail%20(1).png' : '/google%20drive.png'
                      return <SmartImage src={imgSrc} alt={app.name} className="w-8 h-8 rounded-md" />
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
                <Calendar className={`w-7 h-7 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`} />
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
                  ? 'bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border-cyan-500/30' 
                  : 'bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-100'
              }`}>
                <Calendar className={`w-10 h-10 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`} />
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
                    ? 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-500/20' 
                    : 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-200'
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
