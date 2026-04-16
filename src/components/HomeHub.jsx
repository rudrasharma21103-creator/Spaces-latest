import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  MessageCircle,
  Moon,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Send,
  Settings,
  Sun,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
import SmartImage from "./SmartImage"
import ConnectHub from "./ConnectHub"

const THOUGHTS = [
  { title: "Tiny progress counts", body: "A calm 20 minutes of focused work still moves the whole week forward.", accent: "from-[#ffd87c] via-[#ffb8a4] to-[#ff9ecb]" },
  { title: "Leave a clear trail", body: "Future-you will love one clear note, one well-named file, and one obvious next step.", accent: "from-[#9bd8ff] via-[#9ec5ff] to-[#b8b6ff]" },
  { title: "Start with the hard part", body: "When the hardest thing gets even slightly smaller, everything else feels lighter.", accent: "from-[#9ef0c8] via-[#9fe7e0] to-[#a7d8ff]" },
  { title: "Momentum loves clarity", body: "If the next action is obvious, your team usually moves without friction.", accent: "from-[#f8b5ff] via-[#d9c2ff] to-[#b7d8ff]" },
]

const sectionTitles = {
  overview: "Home",
  connect: "Connect",
  drafts: "Drafts",
  files: "Files",
  tasks: "Tasks",
  dm: "Direct messages",
}

const cx = (...classes) => classes.filter(Boolean).join(" ")
const IMAGE_FILE_PATTERN = /\.(avif|bmp|gif|heic|heif|jpeg|jpg|png|svg|webp)$/i

const getGreeting = name => {
  const hour = new Date().getHours()
  const label = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  return `${label}${name ? `, ${name}` : ""}`
}

const formatWhen = value => {
  if (!value) return "Just now"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Just now"
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

const getDailyThought = () => {
  const now = new Date()
  const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  try {
    const stored = JSON.parse(localStorage.getItem("spacexyz-home-thought") || "null")
    if (stored?.key === key && Number.isFinite(stored?.index)) return THOUGHTS[stored.index % THOUGHTS.length]
  } catch {}
  const index = key.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % THOUGHTS.length
  try {
    localStorage.setItem("spacexyz-home-thought", JSON.stringify({ key, index }))
  } catch {}
  return THOUGHTS[index]
}

const statusTone = (status, isDarkMode) => {
  if (status === "completed") {
    return isDarkMode
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : "border-emerald-100 bg-emerald-50 text-emerald-700"
  }
  return isDarkMode
    ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
    : "border-amber-100 bg-amber-50 text-amber-700"
}

const fileTone = (source, isDarkMode) => {
  if (source === "gmail") {
    return isDarkMode
      ? "border-rose-400/20 bg-rose-500/10 text-rose-200"
      : "border-rose-100 bg-rose-50 text-rose-700"
  }
  if (["drive", "docs", "sheets", "slides"].includes(source)) {
    return isDarkMode
      ? "border-sky-400/20 bg-sky-500/10 text-sky-200"
      : "border-sky-100 bg-sky-50 text-sky-700"
  }
  return isDarkMode
    ? "border-white/10 bg-white/[0.05] text-slate-300"
    : "border-slate-200 bg-slate-100 text-slate-600"
}

const isImageFile = file => {
  const mimeType = file?.mimeType || file?.type || ""
  const fileName = file?.name || ""
  return mimeType.startsWith("image/") || IMAGE_FILE_PATTERN.test(fileName)
}

const getFilePreviewSrc = file => {
  if (!file) return ""
  if (isImageFile(file)) {
    return file.thumbnailLink || file.previewUrl || file.url || file.public_url || (file.fileId || file.id ? `/upload/file/${file.fileId || file.id}/download` : "")
  }
  return file.thumbnailLink || file.iconLink || file.previewUrl || file.url || file.public_url || (file.fileId || file.id ? `/upload/file/${file.fileId || file.id}/download` : "")
}

const getFileMetaLabel = file => {
  if (!file) return "file"
  if (file.source === "gmail") return "Gmail attachment"
  if (file.source === "drive") return "Google Drive"
  if (file.source === "chat") return "Shared in chat"
  const mimeType = file.mimeType || file.type || ""
  if (mimeType.startsWith("image/")) return "Image"
  return file.source || "File"
}

const getProfessionalProfile = user => {
  const profile = user?.professionalProfile || {}
  return {
    companyName: profile.companyName || user?.companyName || "",
    position: profile.position || user?.position || "",
    linkedInUrl:
      profile.linkedInUrl ||
      profile.linkedinUrl ||
      user?.linkedInUrl ||
      user?.linkedinUrl ||
      "",
  }
}

const normalizeLinkedInUrl = value => {
  const trimmed = (value || "").trim()
  if (!trimmed) return ""
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(candidate)
    if (!parsed.hostname.toLowerCase().replace(/^www\./, "").endsWith("linkedin.com")) {
      return null
    }
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return null
  }
}

export default function HomeHub({
  currentUser,
  friends = [],
  drafts = [],
  tasks = [],
  files = [],
  pendingRequests = [],
  section,
  activeDMUser,
  dmMessages = [],
  dmInput,
  dmSending,
  renderAvatar,
  onSectionChange,
  onOpenWorkspace,
  onOpenDirectMessages,
  onOpenDM,
  onOpenAddConnection,
  onOpenTask,
  onOpenDraft,
  onDeleteDraft,
  onSendDM,
  onSaveDraft,
  onAcceptRequest,
  onRejectRequest,
  onOpenFile,
  onOpenDocumentsHub,
  onOpenNotifications,
  onOpenProfile,
  onConnectUser,
  onSaveProfessionalProfile,
  connectPreferredPane = "discover",
  setDmInput,
  isDarkMode = false,
  isMobile = false,
  apiBase,
  resolveProtectedFileUrl,
  onThemeChange = () => {},
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [homeSidebarCollapsed, setHomeSidebarCollapsed] = useState(false)
  const [isDMAtBottom, setIsDMAtBottom] = useState(true)
  const [connectionsScrollState, setConnectionsScrollState] = useState({ left: false, right: false })
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showManageProfileModal, setShowManageProfileModal] = useState(false)
  const [profileForm, setProfileForm] = useState(() => getProfessionalProfile(currentUser))
  const [profileError, setProfileError] = useState("")
  const [profileSaved, setProfileSaved] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const dmMessagesContainerRef = useRef(null)
  const connectionsScrollerRef = useRef(null)
  const settingsMenuRef = useRef(null)
  const previousDMUserRef = useRef(null)
  const justSwitchedDMRef = useRef(false)
  const thought = useMemo(() => getDailyThought(), [])
  const currentProfile = useMemo(() => getProfessionalProfile(currentUser), [currentUser])
  const activeFriend = useMemo(
    () => friends.find(friend => String(friend.id) === String(activeDMUser)) || null,
    [friends, activeDMUser]
  )
  const profileStrength = [currentProfile.companyName, currentProfile.position, currentProfile.linkedInUrl].filter(Boolean).length
  const profileStrengthLabel = profileStrength === 3 ? "Complete" : profileStrength === 2 ? "Strong" : profileStrength === 1 ? "Started" : "Needs details"

  const syncConnectionsScrollState = targetScrollLeft => {
    const container = connectionsScrollerRef.current
    if (!container) return

    const maxScrollLeft = Math.max(container.scrollWidth - container.clientWidth, 0)
    const nextScrollLeft = Math.min(Math.max(targetScrollLeft ?? container.scrollLeft, 0), maxScrollLeft)

    setConnectionsScrollState(prev => {
      const next = {
        left: nextScrollLeft > 8,
        right: nextScrollLeft < maxScrollLeft - 8,
      }

      return prev.left === next.left && prev.right === next.right ? prev : next
    })
  }

  useEffect(() => {
    setProfileForm(currentProfile)
  }, [currentProfile.companyName, currentProfile.position, currentProfile.linkedInUrl, currentUser?.id])

  useEffect(() => {
    const normalizedActiveDMUser = activeDMUser ? String(activeDMUser) : null
    if (!normalizedActiveDMUser) {
      previousDMUserRef.current = null
      return
    }

    if (previousDMUserRef.current !== normalizedActiveDMUser) {
      justSwitchedDMRef.current = true
      setIsDMAtBottom(true)
    }

    previousDMUserRef.current = normalizedActiveDMUser
  }, [activeDMUser])

  useEffect(() => {
    if (section !== "dm") return
    const container = dmMessagesContainerRef.current
    if (!container) return

    const shouldJumpToLatest = justSwitchedDMRef.current
    if (shouldJumpToLatest || isDMAtBottom) {
      container.scrollTop = container.scrollHeight
      justSwitchedDMRef.current = false
      setIsDMAtBottom(true)
    }
  }, [section, activeDMUser, dmMessages, isDMAtBottom])

  useEffect(() => {
    if (isMobile) return
    try {
      const stored = localStorage.getItem("spacexyz-home-sidebar-collapsed")
      if (stored != null) setHomeSidebarCollapsed(stored === "true")
    } catch {}
  }, [isMobile])

  useEffect(() => {
    if (isMobile) return
    try {
      localStorage.setItem("spacexyz-home-sidebar-collapsed", String(homeSidebarCollapsed))
    } catch {}
  }, [homeSidebarCollapsed, isMobile])

  useEffect(() => {
    const container = connectionsScrollerRef.current
    if (!container || isMobile) return

    let resizeObserver
    let frameId = 0
    let settleTimeout = 0

    const updateScrollState = () => {
      const maxScrollLeft = Math.max(container.scrollWidth - container.clientWidth, 0)
      const nextScrollLeft = Math.min(Math.max(container.scrollLeft, 0), maxScrollLeft)

      setConnectionsScrollState(prev => {
        const next = {
          left: nextScrollLeft > 8,
          right: nextScrollLeft < maxScrollLeft - 8,
        }

        return prev.left === next.left && prev.right === next.right ? prev : next
      })
    }

    updateScrollState()
    frameId = window.requestAnimationFrame(updateScrollState)
    settleTimeout = window.setTimeout(updateScrollState, 180)
    container.addEventListener("scroll", updateScrollState, { passive: true })
    window.addEventListener("resize", updateScrollState)

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateScrollState)
      resizeObserver.observe(container)
      Array.from(container.children).forEach(child => resizeObserver.observe(child))
    }

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      if (settleTimeout) window.clearTimeout(settleTimeout)
      resizeObserver?.disconnect()
      container.removeEventListener("scroll", updateScrollState)
      window.removeEventListener("resize", updateScrollState)
    }
  }, [friends, isMobile, searchQuery])

  useEffect(() => {
    if (!showSettingsMenu) return

    const handlePointerDown = event => {
      if (!settingsMenuRef.current?.contains(event.target)) {
        setShowSettingsMenu(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [showSettingsMenu])

  const filteredFriends = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return friends
    return friends.filter(friend => (friend.name || "").toLowerCase().includes(query))
  }, [friends, searchQuery])

  const filteredDrafts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return drafts
    return drafts.filter(draft => `${draft.text || ""} ${draft.chatName || ""} ${draft.recipientName || ""}`.toLowerCase().includes(query))
  }, [drafts, searchQuery])

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return tasks
    return tasks.filter(task => (task.message || "").toLowerCase().includes(query))
  }, [tasks, searchQuery])

  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return files
    return files.filter(file => `${file.name || ""} ${file.source || ""}`.toLowerCase().includes(query))
  }, [files, searchQuery])

  const ui = {
    page: isDarkMode ? "bg-[#0d0001] text-slate-100" : "bg-[#f6f8fc] text-slate-900",
    sidebar: isDarkMode ? "border-white/10 bg-[#0d0001]" : "border-[#e7edf4] bg-white/92",
    shellCard: isDarkMode
      ? "rounded-[24px] border border-white/10 bg-[#0f1724]/90 p-4 shadow-[0_14px_32px_rgba(2,6,23,0.36)]"
      : "rounded-[24px] border border-[#edf1f5] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
    softCard: isDarkMode
      ? "border-white/10 bg-white/[0.04] hover:border-sky-400/20 hover:bg-white/[0.06]"
      : "border-[#eef2f6] bg-[#fbfdff] hover:border-[#dce5ee]",
    textPrimary: isDarkMode ? "text-slate-50" : "text-[#111827]",
    textSecondary: isDarkMode ? "text-slate-300" : "text-[#475569]",
    textMuted: isDarkMode ? "text-slate-400" : "text-[#6b7280]",
    textSoft: isDarkMode ? "text-slate-500" : "text-[#94a3b8]",
    border: isDarkMode ? "border-white/10" : "border-[#eef2f6]",
    input: isDarkMode
      ? "border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-500 focus:border-sky-400/30 focus:shadow-[0_0_0_4px_rgba(56,189,248,0.12)]"
      : "border-[#e6edf4] bg-white text-[#111827] placeholder:text-[#9aa7b5] focus:border-[#d5dfe9] focus:shadow-[0_0_0_4px_rgba(236,242,248,0.8)]",
    iconButton: isDarkMode
      ? "border-white/10 bg-white/[0.04] text-slate-300 hover:border-sky-400/25 hover:bg-white/[0.08] hover:text-white"
      : "border-[#e6edf4] bg-white text-[#4b5563] hover:border-[#d7e1eb] hover:bg-[#f8fbff]",
    navActive: isDarkMode
      ? "bg-white/[0.07] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
      : "bg-[#f4f7fb] text-[#111827] shadow-[inset_0_0_0_1px_#eef2f6]",
    navIdle: isDarkMode ? "text-slate-300 hover:bg-white/[0.04]" : "text-[#4b5563] hover:bg-[#f8fafc]",
    secondaryButton: isDarkMode
      ? "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
      : "border-[#e5e7eb] bg-white text-[#475569] hover:bg-[#f8fafc]",
    secondaryTextButton: isDarkMode
      ? "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
      : "border-[#e5e7eb] text-[#6b7280] hover:bg-[#f8fafc]",
    primaryButton: isDarkMode
      ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-400 hover:to-cyan-400"
      : "bg-[#111827] text-white hover:bg-[#1f2937]",
    dashedCard: isDarkMode
      ? "border-white/10 bg-white/[0.03] text-slate-400"
      : "border-[#dbe4ec] bg-[#fbfdff] text-[#6b7280]",
    badge: isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-[#f3f6fa] text-[#516072]",
  }

  const navItems = [
    { key: "workspaces", label: "Workspaces", icon: BriefcaseBusiness, action: onOpenWorkspace },
    { key: "connect", label: "Connect", icon: UserPlus, action: () => onSectionChange("connect") },
    { key: "drafts", label: "Drafts", icon: FileText, action: () => onSectionChange("drafts") },
    { key: "files", label: "Files", icon: FileText, action: () => onSectionChange("files") },
    { key: "tasks", label: "Tasks", icon: ClipboardList, action: () => onSectionChange("tasks") },
  ]

  const overviewWidgetClass = isDarkMode ? "bg-[#111111]" : ""
  const overviewItemClass = isDarkMode ? "border-white/10 bg-[#111111] hover:border-sky-400/20" : ui.softCard
  const overviewEmptyClass = isDarkMode ? "border-white/10 bg-[#111111] text-slate-400" : ui.dashedCard

  const ShellCard = ({ children, className = "" }) => (
    <div className={cx(ui.shellCard, "min-w-0", className)}>{children}</div>
  )

  const renderFilePreview = (file, sizeClass = "h-12 w-12", roundedClass = "rounded-2xl") => {
    const previewSrc = getFilePreviewSrc(file)
    const imagePreview = isImageFile(file) && Boolean(previewSrc)

    if (previewSrc) {
      return (
        <SmartImage
          src={previewSrc}
          alt={file?.name || "File preview"}
          apiBase={apiBase}
          className={cx(sizeClass, roundedClass, imagePreview ? "object-cover" : "object-contain p-2")}
          onResolveError={resolveProtectedFileUrl ? () => resolveProtectedFileUrl(file) : undefined}
          fallback={
            <span className={cx("flex items-center justify-center", sizeClass, roundedClass, isDarkMode ? "bg-white/[0.04] text-white" : "bg-white text-[#111827]")}>
              <FileText className="h-5 w-5" />
            </span>
          }
        />
      )
    }

    return (
      <span className={cx("flex items-center justify-center", sizeClass, roundedClass, isDarkMode ? "bg-white/[0.04] text-white" : "bg-white text-[#111827]")}>
        <FileText className="h-5 w-5" />
      </span>
    )
  }

  const openTaskCount = filteredTasks.filter(task => task.status !== "completed").length

  const mobileHomeNavItems = [
    {
      key: "overview",
      label: "Home",
      description: "Daily overview and activity pulse",
      badge: "Live",
      icon: BriefcaseBusiness,
      action: () => onSectionChange("overview"),
    },
    {
      key: "workspaces",
      label: "Workspaces",
      description: "Jump back into your active spaces",
      badge: "Open",
      icon: BriefcaseBusiness,
      action: onOpenWorkspace,
    },
    {
      key: "connect",
      label: "Connect",
      description: friends.length ? `${friends.length} connection${friends.length === 1 ? "" : "s"} ready` : "Start building your network",
      badge: friends.length ? String(friends.length) : "Add",
      icon: UserPlus,
      action: () => onSectionChange("connect"),
    },
    {
      key: "drafts",
      label: "Drafts",
      description: filteredDrafts.length ? `${filteredDrafts.length} saved message${filteredDrafts.length === 1 ? "" : "s"}` : "No saved drafts right now",
      badge: filteredDrafts.length ? String(filteredDrafts.length) : "Clear",
      icon: FileText,
      action: () => onSectionChange("drafts"),
    },
    {
      key: "files",
      label: "Files",
      description: filteredFiles.length ? `${filteredFiles.length} recent file${filteredFiles.length === 1 ? "" : "s"} surfaced` : "Shared files appear here",
      badge: filteredFiles.length ? String(filteredFiles.length) : "Quiet",
      icon: FileText,
      action: () => onSectionChange("files"),
    },
    {
      key: "tasks",
      label: "Tasks",
      description: openTaskCount ? `${openTaskCount} open task${openTaskCount === 1 ? "" : "s"} to move forward` : "You're caught up for now",
      badge: openTaskCount ? String(openTaskCount) : "Done",
      icon: ClipboardList,
      action: () => onSectionChange("tasks"),
    },
  ]

  const renderThoughtsCard = (className = "") => (
    <div className={cx("flex flex-col rounded-[24px] p-4 shadow-[0_14px_30px_rgba(15,23,42,0.08)]", isDarkMode ? "border border-white/10 bg-[#111111] text-slate-100" : cx("bg-gradient-to-br text-[#111827]", thought.accent), className)}>
      <div className={cx("text-xs font-semibold uppercase tracking-[0.22em]", isDarkMode ? "text-slate-500" : "text-[#3f3f46]/65")}>Thoughts</div>
      <h3 className="mt-3 text-[1.8rem] font-semibold leading-tight">{thought.title}</h3>
      <p className={cx("mt-3 text-sm leading-7", isDarkMode ? "text-slate-300" : "text-[#27272a]/78")}>{thought.body}</p>
      <div className={cx("mt-6 rounded-[18px] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur-sm", isDarkMode ? "bg-white/[0.06] text-slate-400" : "bg-white/55 text-[#3f3f46]/70", className && "mt-auto")}>Refreshes once every 24 hours</div>
    </div>
  )

  const renderMobileOverviewHero = () => (
    <div className={cx("relative overflow-hidden rounded-[30px] border p-5 shadow-[0_18px_40px_rgba(15,23,42,0.10)]", isDarkMode ? "border-white/10 bg-[#111111]" : "border-[#e8eef5] bg-white")}>
      <div className={cx("pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-3xl", isDarkMode ? "bg-sky-500/20" : "bg-sky-200/70")} />
      <div className={cx("pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full blur-3xl", isDarkMode ? "bg-amber-400/10" : "bg-amber-100/90")} />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={cx("inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]", isDarkMode ? "bg-white/[0.06] text-slate-400" : "bg-[#f3f7fb] text-[#607085]")}>Home Hub</div>
            <div className={cx("mt-3 text-[1.9rem] font-semibold leading-tight tracking-[-0.04em]", ui.textPrimary)}>{getGreeting(currentUser?.name)}</div>
            <p className={cx("mt-2 max-w-[28rem] text-sm leading-6", ui.textMuted)}>Stay up to date with your team, files, and conversations.</p>
          </div>

          <button onClick={onOpenProfile} className={cx("flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-sm", isDarkMode ? "border-white/10 bg-white/[0.05]" : "border-[#e6edf4] bg-[#f8fbff]")} title="Open profile">
            {currentUser ? renderAvatar(currentUser, 40) : null}
          </button>
        </div>

        <div className="mt-4">
          <div className="relative">
            <Search className={cx("pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2", ui.textSoft)} />
            <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search here" className={cx("h-12 w-full rounded-full border pl-11 pr-4 text-sm outline-none transition", ui.input)} />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className={cx("inline-flex min-w-0 flex-1 rounded-[22px] border p-1", isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-[#e6edf4] bg-[#f8fbff]")}>
            <button onClick={() => onThemeChange(false)} className={cx("inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition", !isDarkMode ? "bg-[#111827] text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]" : ui.textSecondary)}>
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button onClick={() => onThemeChange(true)} className={cx("inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition", isDarkMode ? "bg-white text-slate-900 shadow-[0_12px_24px_rgba(15,23,42,0.18)]" : ui.textSecondary)}>
              <Moon className="h-4 w-4" />
              Dark
            </button>
          </div>

          <button onClick={onOpenNotifications} className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition", ui.iconButton)} title="Notifications">
            <Bell className="h-4.5 w-4.5" />
          </button>
          <button onClick={onOpenProfile} className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition", ui.iconButton)} title="Profile settings">
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </div>
  )

  const renderMobileHomeNav = () => (
    <div className="grid grid-cols-2 gap-3">
      {mobileHomeNavItems.map(item => {
        const Icon = item.icon
        const isActive = (item.key === "overview" && section === "overview") || (item.key !== "overview" && item.key !== "workspaces" && section === item.key)
        return (
          <button
            key={item.key}
            onClick={item.action}
            className={cx(
              "group rounded-[24px] border p-4 text-left transition",
              isActive
                ? isDarkMode
                  ? "border-white/10 bg-white text-slate-900 shadow-[0_16px_30px_rgba(15,23,42,0.20)]"
                  : "border-[#111827] bg-[#111827] text-white shadow-[0_18px_36px_rgba(15,23,42,0.18)]"
                : isDarkMode
                  ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                  : "border-[#e7edf4] bg-white shadow-[0_10px_26px_rgba(15,23,42,0.06)] hover:border-[#dbe5ef] hover:bg-[#fcfdff]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={cx("flex h-11 w-11 items-center justify-center rounded-2xl", isActive ? (isDarkMode ? "bg-slate-900 text-white" : "bg-white/12 text-white") : (isDarkMode ? "bg-white/[0.08] text-slate-100" : "bg-[#f4f7fb] text-[#334155]"))}>
                <Icon className="h-5 w-5" />
              </span>
              <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold", isActive ? (isDarkMode ? "bg-slate-900/10 text-slate-700" : "bg-white/12 text-white/85") : ui.badge)}>
                {item.badge}
              </span>
            </div>

            <div className={cx("mt-5 text-[15px] font-semibold", isActive ? (isDarkMode ? "text-slate-900" : "text-white") : ui.textPrimary)}>{item.label}</div>
            <div className={cx("mt-1 text-xs leading-5", isActive ? (isDarkMode ? "text-slate-600" : "text-white/72") : ui.textMuted)}>{item.description}</div>
            <div className={cx("mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]", isActive ? (isDarkMode ? "text-slate-500" : "text-white/70") : ui.textSoft)}>
              Open
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </button>
        )
      })}
    </div>
  )

  const renderMobileThoughtsCard = () => (
    <div className={cx("relative flex-1 overflow-hidden rounded-[30px] border p-5 shadow-[0_18px_40px_rgba(15,23,42,0.10)]", isDarkMode ? "border-white/10 bg-[#111111]" : "border-[#e8eef5] bg-white")}>
      <div className={cx("pointer-events-none absolute inset-0", isDarkMode ? "bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_35%)]" : "bg-[linear-gradient(155deg,rgba(255,244,230,0.9)_0%,rgba(236,248,255,0.92)_48%,rgba(228,245,238,0.95)_100%)]")} />
      <div className={cx("pointer-events-none absolute -right-10 bottom-[-20%] h-44 w-44 rounded-full", isDarkMode ? "bg-sky-500/10 blur-3xl" : "bg-sky-200/60 blur-2xl")} />

      <div className="relative flex min-h-[280px] flex-col">
        <div className={cx("inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]", isDarkMode ? "bg-white/[0.06] text-slate-400" : "bg-white/70 text-[#607085]")}>Thought Of The Day</div>
        <h3 className={cx("mt-5 max-w-[12ch] text-[2rem] font-semibold leading-[1.05] tracking-[-0.05em]", ui.textPrimary)}>{thought.title}</h3>
        <p className={cx("mt-4 max-w-[28ch] text-[15px] leading-7", isDarkMode ? "text-slate-300" : "text-[#334155]")}>{thought.body}</p>

        <div className={cx("mt-auto inline-flex w-fit rounded-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.22em]", isDarkMode ? "bg-white/[0.06] text-slate-400" : "bg-white/75 text-[#64748b] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)]")}>
          Refreshes Once Every 24 Hours
        </div>
      </div>
    </div>
  )

  const renderMobileSectionNav = () => (
    <div className={cx("border-b px-4 py-2.5 sm:px-5", ui.border)}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSectionChange("overview")}
          className={cx("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition", ui.secondaryButton)}
        >
          Back home
        </button>
        <span className={cx("min-w-0 truncate rounded-full px-3 py-1.5 text-sm font-medium", ui.badge)}>
          {sectionTitles[section] || "Home"}
        </span>
      </div>
    </div>
  )

  const scrollConnections = direction => {
    const container = connectionsScrollerRef.current
    if (!container) return

    const offset = Math.max(container.clientWidth * 0.72, 220)
    const maxScrollLeft = Math.max(container.scrollWidth - container.clientWidth, 0)
    const startScrollLeft = Math.min(Math.max(container.scrollLeft, 0), maxScrollLeft)
    const targetScrollLeft = Math.min(Math.max(startScrollLeft + direction * offset, 0), maxScrollLeft)

    if (Math.abs(targetScrollLeft - startScrollLeft) < 1) return

    container.scrollTo({ left: targetScrollLeft, behavior: "smooth" })
    syncConnectionsScrollState(targetScrollLeft)
  }

  const handleConnectionsButtonClick = (event, direction) => {
    event.preventDefault()
    event.stopPropagation()
    scrollConnections(direction)
  }

  const handleConnectionsButtonKeyDown = (event, direction) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    event.stopPropagation()
    scrollConnections(direction)
  }

  const openManageProfileModal = () => {
    setProfileForm(currentProfile)
    setProfileError("")
    setProfileSaved("")
    setShowSettingsMenu(false)
    setShowManageProfileModal(true)
  }

  const handleManageProfileSave = async event => {
    event.preventDefault()
    const normalizedLinkedIn = normalizeLinkedInUrl(profileForm.linkedInUrl)

    if (profileForm.linkedInUrl.trim() && !normalizedLinkedIn) {
      setProfileError("Enter a valid LinkedIn URL that points to linkedin.com.")
      setProfileSaved("")
      return
    }

    setSavingProfile(true)
    setProfileError("")
    setProfileSaved("")

    try {
      await onSaveProfessionalProfile?.({
        companyName: profileForm.companyName.trim(),
        position: profileForm.position.trim(),
        linkedInUrl: normalizedLinkedIn || "",
      })
      setProfileSaved("Profile updated successfully.")
      setShowManageProfileModal(false)
    } catch {
      setProfileError("We could not save your profile right now. Please try again.")
    } finally {
      setSavingProfile(false)
    }
  }

  const renderManageProfileModal = () => {
    if (!showManageProfileModal) return null

    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Close manage profile modal"
          className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
          onClick={() => setShowManageProfileModal(false)}
        />
        <div className={cx("relative z-[91] w-full max-w-4xl overflow-hidden rounded-[34px] border shadow-[0_28px_80px_rgba(15,23,42,0.22)]", isDarkMode ? "border-white/10 bg-[#0f1724]" : "border-[#dfe8f2] bg-white")}>
          <div className="flex items-start justify-between gap-4 p-5 sm:p-8">
            <div className="min-w-0">
              <div className={cx("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]", ui.badge, ui.border)}>
                <Building2 className="h-3.5 w-3.5" />
                Manage Profile
              </div>
              <div className={cx("mt-5 text-[2rem] font-semibold tracking-[-0.05em]", ui.textPrimary)}>Make your connect card feel complete.</div>
              <p className={cx("mt-3 max-w-2xl text-sm leading-8 sm:text-[15px]", ui.textMuted)}>
                These details appear on your connect card only when they exist. Leave anything blank if you would rather keep it private.
              </p>
            </div>

            <div className={cx("hidden rounded-[22px] border px-5 py-4 sm:block", isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-[#dbe5ef] bg-[#fbfdff]")}>
              <div className={cx("text-[11px] font-semibold uppercase tracking-[0.18em]", ui.textSoft)}>Strength</div>
              <div className={cx("mt-2 text-[1.35rem] font-semibold", ui.textPrimary)}>{profileStrengthLabel}</div>
              <div className={cx("mt-1 text-sm leading-6", ui.textMuted)}>{profileStrength}/3 details added</div>
            </div>
          </div>

          <form onSubmit={handleManageProfileSave} className="px-5 pb-5 sm:px-8 sm:pb-8">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className={cx("mb-2.5 block text-sm font-semibold", ui.textPrimary)}>Company name</span>
                <input
                  type="text"
                  value={profileForm.companyName}
                  onChange={event => setProfileForm(prev => ({ ...prev, companyName: event.target.value }))}
                  placeholder="Spacess"
                  className={cx("h-14 w-full rounded-[20px] border px-4 text-base outline-none transition", ui.input)}
                />
              </label>

              <label className="block">
                <span className={cx("mb-2.5 block text-sm font-semibold", ui.textPrimary)}>Position</span>
                <input
                  type="text"
                  value={profileForm.position}
                  onChange={event => setProfileForm(prev => ({ ...prev, position: event.target.value }))}
                  placeholder="Founder"
                  className={cx("h-14 w-full rounded-[20px] border px-4 text-base outline-none transition", ui.input)}
                />
              </label>
            </div>

            <label className="mt-5 block">
              <span className={cx("mb-2.5 block text-sm font-semibold", ui.textPrimary)}>LinkedIn profile link</span>
              <input
                type="url"
                value={profileForm.linkedInUrl}
                onChange={event => setProfileForm(prev => ({ ...prev, linkedInUrl: event.target.value }))}
                placeholder="linkedin.com/in/your-name"
                className={cx("h-14 w-full rounded-[20px] border px-4 text-base outline-none transition", ui.input)}
              />
            </label>

            {profileError ? (
              <div className={cx("mt-5 rounded-[18px] border px-4 py-3 text-sm", isDarkMode ? "border-rose-400/20 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700")}>
                {profileError}
              </div>
            ) : null}

            {profileSaved ? (
              <div className={cx("mt-5 rounded-[18px] border px-4 py-3 text-sm", isDarkMode ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
                {profileSaved}
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="submit" disabled={savingProfile} className={cx("inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60", ui.primaryButton)}>
                {savingProfile ? "Saving..." : "Save profile"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileForm(currentProfile)
                  setProfileError("")
                  setProfileSaved("")
                  setShowManageProfileModal(false)
                }}
                className={cx("rounded-full border px-6 py-3 text-sm font-semibold transition", ui.secondaryButton)}
              >
                Cancel
              </button>
            </div>
          </form>

          <button
            type="button"
            onClick={() => setShowManageProfileModal(false)}
            className={cx("absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border transition", ui.iconButton)}
            title="Close manage profile modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  const renderOverview = () => (
    <div className={cx("space-y-4", isMobile && "flex min-h-full flex-col")}>
      {isMobile ? (
        <>
          {renderMobileOverviewHero()}
          {renderMobileHomeNav()}
          {renderMobileThoughtsCard()}
        </>
      ) : (
        <>
      <ShellCard className={cx("p-4", overviewWidgetClass)}>
        <div className="relative mx-auto w-full max-w-[1074px]">
          <button
            type="button"
            onClick={event => handleConnectionsButtonClick(event, -1)}
            onKeyDown={event => handleConnectionsButtonKeyDown(event, -1)}
            className={cx(
              "pointer-events-auto absolute left-0 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-[0_12px_24px_rgba(15,23,42,0.10)] transition lg:flex",
              ui.iconButton,
              !connectionsScrollState.left && "opacity-40"
            )}
            title="Scroll left"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>

          <div
            ref={connectionsScrollerRef}
            className="mx-12 flex items-center gap-3 overflow-x-auto pb-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollBehavior: "auto" }}
          >
            <button onClick={onOpenAddConnection} className="flex min-w-[78px] shrink-0 flex-col items-center gap-2 rounded-[20px] px-1 py-1.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6d2a91] text-white shadow-[0_8px_20px_rgba(109,42,145,0.22)]">
                <Plus className="h-5 w-5" />
              </span>
              <span className={cx("text-sm font-medium", ui.textPrimary)}>Add yours</span>
            </button>
            {filteredFriends.map(friend => (
              <button key={friend.id} onClick={() => onOpenDM(friend.id)} className="flex min-w-[78px] shrink-0 flex-col items-center gap-2 rounded-[20px] px-1 py-1.5">
                <span className={cx("flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 shadow-[0_8px_20px_rgba(15,23,42,0.06)]", isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-[#f2d5ff] bg-white")}>
                  {renderAvatar(friend, 48)}
                </span>
                <span className={cx("max-w-[78px] truncate text-sm font-medium", ui.textPrimary)}>{friend.name}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={event => handleConnectionsButtonClick(event, 1)}
            onKeyDown={event => handleConnectionsButtonKeyDown(event, 1)}
            className={cx(
              "pointer-events-auto absolute right-0 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-[0_12px_24px_rgba(15,23,42,0.10)] transition lg:flex",
              ui.iconButton,
              !connectionsScrollState.right && "opacity-40"
            )}
            title="Scroll right"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        </div>
      </ShellCard>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <ShellCard className={overviewWidgetClass}>
            <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className={cx("text-xl font-semibold", ui.textPrimary)}>Tasks</h3>
                <p className={cx("mt-1 text-sm", ui.textMuted)}>Upcoming work surfaced from the current task system.</p>
              </div>
              <button onClick={() => onSectionChange("tasks")} className={cx("w-full justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:w-auto", ui.secondaryButton)}>View all</button>
            </div>
            <div className="space-y-2">
              {filteredTasks.slice(0, 4).length === 0 ? (
                <div className={cx("rounded-[18px] border border-dashed p-4 text-sm", overviewEmptyClass)}>No tasks assigned yet.</div>
              ) : (
                filteredTasks.slice(0, 4).map(task => (
                  <button key={task.id} onClick={() => onOpenTask(task)} className={cx("flex w-full items-start gap-3 rounded-[20px] border p-3 text-left transition", overviewItemClass)}>
                    <span className={cx("mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl", task.status === "completed" ? (isDarkMode ? "bg-emerald-500/12 text-emerald-300" : "bg-emerald-50 text-emerald-600") : (isDarkMode ? "bg-amber-500/12 text-amber-300" : "bg-amber-50 text-amber-600"))}>
                      {task.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block truncate text-sm font-semibold", ui.textPrimary)}>{task.message || "Untitled task"}</span>
                      <span className={cx("mt-1 block text-xs", ui.textMuted)}>{formatWhen(task.timestamp)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </ShellCard>

          <ShellCard className={overviewWidgetClass}>
            <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className={cx("text-xl font-semibold", ui.textPrimary)}>Files</h3>
                <p className={cx("mt-1 text-sm", ui.textMuted)}>Recent shared files and connected documents.</p>
              </div>
              <button onClick={() => onSectionChange("files")} className={cx("w-full justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:w-auto", ui.secondaryButton)}>View all</button>
            </div>
            <div className="space-y-2">
              {filteredFiles.slice(0, 5).length === 0 ? (
                <div className={cx("rounded-[18px] border border-dashed p-4 text-sm", overviewEmptyClass)}>No recent files yet.</div>
              ) : (
                filteredFiles.slice(0, 5).map(file => (
                  <button key={file.id} onClick={() => onOpenFile(file)} className={cx("flex w-full min-w-0 flex-col items-start gap-3 rounded-[20px] border p-3 text-left transition sm:flex-row sm:items-center", overviewItemClass)}>
                    {renderFilePreview(file, "h-10 w-10", "rounded-xl")}
                    <span className="min-w-0 flex-1">
                      <span className={cx("block truncate text-sm font-semibold", ui.textPrimary)}>{file.name || "Untitled file"}</span>
                      <span className={cx("mt-1 block truncate text-xs", ui.textMuted)}>
                        {getFileMetaLabel(file)} · {formatWhen(file.modifiedTime || file.timestamp)}
                      </span>
                    </span>
                    <span className={cx("max-w-full self-start rounded-full border px-3 py-1 text-[11px] font-semibold sm:self-auto", fileTone(file.source, isDarkMode))}>{file.source || "file"}</span>
                  </button>
                ))
              )}
            </div>
          </ShellCard>
        </div>

        <div className="space-y-4 xl:col-span-7">
          {renderThoughtsCard()}

          <ShellCard className={overviewWidgetClass}>
            <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className={cx("text-xl font-semibold", ui.textPrimary)}>Drafts</h3>
                <p className={cx("mt-1 text-sm", ui.textMuted)}>Pick up unfinished replies where you left them.</p>
              </div>
              <button onClick={() => onSectionChange("drafts")} className={cx("w-full justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:w-auto", ui.secondaryButton)}>View all</button>
            </div>
            <div className="space-y-2">
              {filteredDrafts.slice(0, 3).length === 0 ? (
                <div className={cx("rounded-[18px] border border-dashed p-4 text-sm", overviewEmptyClass)}>No drafts saved yet.</div>
              ) : (
                filteredDrafts.slice(0, 3).map(draft => (
                  <button key={draft.id} onClick={() => onOpenDraft(draft)} className={cx("w-full rounded-[20px] border p-3 text-left transition", overviewItemClass)}>
                    <div className={cx("text-xs font-semibold uppercase tracking-[0.16em]", ui.textSoft)}>{draft.chatType === "channel" ? "Workspace" : "Direct message"}</div>
                    <div className={cx("mt-2 truncate text-sm font-semibold", ui.textPrimary)}>{draft.chatName || draft.recipientName || "Draft"}</div>
                    <div className={cx("mt-2 line-clamp-2 text-sm leading-6", ui.textMuted)}>{draft.text}</div>
                  </button>
                ))
              )}
            </div>
          </ShellCard>
        </div>

      </div>
        </>
      )}
    </div>
  )

  const renderConnect = () => (
    <ConnectHub
      currentUser={currentUser}
      friends={friends}
      pendingRequests={pendingRequests}
      renderAvatar={renderAvatar}
      onOpenDM={onOpenDM}
      onAcceptRequest={onAcceptRequest}
      onRejectRequest={onRejectRequest}
      onConnectUser={onConnectUser}
      onSaveProfessionalProfile={onSaveProfessionalProfile}
      preferredPane={connectPreferredPane}
      isDarkMode={isDarkMode}
    />
  )

  const renderDrafts = () => (
    <div className="space-y-4">
      {filteredDrafts.length === 0 ? (
        <div className={cx("rounded-[24px] border border-dashed p-8 text-center text-sm", ui.dashedCard)}>No drafts saved yet.</div>
      ) : (
        filteredDrafts.map(draft => (
          <ShellCard key={draft.id}>
            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cx("rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", ui.badge)}>
                    {draft.chatType === "channel" ? "Workspace draft" : "Direct message"}
                  </span>
                  <span className={cx("text-xs", ui.textSoft)}>{formatWhen(draft.updatedAt)}</span>
                </div>
                <h3 className={cx("mt-3 text-lg font-semibold", ui.textPrimary)}>{draft.chatName || draft.recipientName || "Draft"}</h3>
                <p className={cx("mt-2 text-sm leading-6", ui.textMuted)}>{draft.text}</p>
              </div>
              <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
                <button onClick={() => onDeleteDraft(draft.id)} className={cx("rounded-full border p-2.5 transition self-start sm:self-auto", ui.secondaryTextButton)} title="Delete draft">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button onClick={() => onOpenDraft(draft)} className={cx("w-full rounded-full px-4 py-2 text-sm font-semibold transition sm:w-auto", ui.primaryButton)}>Reopen</button>
              </div>
            </div>
          </ShellCard>
        ))
      )}
    </div>
  )

  const renderFiles = () => (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "All files", value: files.length },
          { label: "Shared", value: files.filter(file => file.source === "chat").length },
          { label: "Drive", value: files.filter(file => file.source === "drive").length },
          { label: "Gmail", value: files.filter(file => file.source === "gmail").length },
        ].map(item => (
          <ShellCard key={item.label} className="p-4">
            <div className={cx("text-xs font-semibold uppercase tracking-[0.18em]", ui.textSoft)}>{item.label}</div>
            <div className={cx("mt-2.5 text-[1.8rem] font-semibold", ui.textPrimary)}>{item.value}</div>
          </ShellCard>
        ))}
      </div>

      <ShellCard>
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className={cx("text-xl font-semibold", ui.textPrimary)}>All files</h3>
            <p className={cx("mt-1 text-sm", ui.textMuted)}>Recent shared files, Drive assets, and Gmail attachments in one place.</p>
          </div>
          <button onClick={onOpenDocumentsHub} className={cx("inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition sm:w-auto", ui.secondaryButton)}>
            Open documents hub
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2.5">
          {filteredFiles.length === 0 ? (
            <div className={cx("rounded-[20px] border border-dashed p-7 text-center text-sm", ui.dashedCard)}>No files available yet.</div>
          ) : (
            filteredFiles.map(file => (
              <button key={file.id} onClick={() => onOpenFile(file)} className={cx("flex w-full min-w-0 flex-col items-start gap-3.5 rounded-[20px] border p-3.5 text-left transition sm:flex-row sm:items-center", ui.softCard)}>
                {renderFilePreview(file, "h-12 w-12", "rounded-xl")}
                <div className="min-w-0 flex-1">
                  <div className={cx("truncate text-sm font-semibold", ui.textPrimary)}>{file.name || "Untitled file"}</div>
                  <div className={cx("mt-1 text-xs", ui.textMuted)}>{getFileMetaLabel(file)}</div>
                  <div className={cx("mt-1 text-xs", ui.textMuted)}>{formatWhen(file.modifiedTime || file.timestamp)}</div>
                </div>
                <span className={cx("max-w-full self-start rounded-full border px-3 py-1 text-[11px] font-semibold sm:self-auto", fileTone(file.source, isDarkMode))}>{file.source || "file"}</span>
              </button>
            ))
          )}
        </div>
      </ShellCard>
    </div>
  )

  const renderTasks = () => {
    const completed = filteredTasks.filter(task => task.status === "completed").length
    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <ShellCard className="p-4">
            <div className={cx("text-xs font-semibold uppercase tracking-[0.18em]", ui.textSoft)}>Assigned or created</div>
            <div className={cx("mt-2.5 text-[1.8rem] font-semibold", ui.textPrimary)}>{filteredTasks.length}</div>
          </ShellCard>
          <ShellCard className="p-4">
            <div className={cx("text-xs font-semibold uppercase tracking-[0.18em]", ui.textSoft)}>Completed</div>
            <div className={cx("mt-2.5 text-[1.8rem] font-semibold", ui.textPrimary)}>{completed}</div>
          </ShellCard>
          <ShellCard className="p-4">
            <div className={cx("text-xs font-semibold uppercase tracking-[0.18em]", ui.textSoft)}>Pending</div>
            <div className={cx("mt-2.5 text-[1.8rem] font-semibold", ui.textPrimary)}>{filteredTasks.length - completed}</div>
          </ShellCard>
        </div>

        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className={cx("rounded-[24px] border border-dashed p-8 text-center text-sm", ui.dashedCard)}>No tasks available yet.</div>
          ) : (
            filteredTasks.map(task => (
              <button key={task.id} onClick={() => onOpenTask(task)} className={cx("flex w-full min-w-0 flex-col items-start gap-3.5 rounded-[24px] border p-4 text-left transition hover:-translate-y-[1px] sm:flex-row sm:items-center", ui.shellCard, isDarkMode ? "hover:border-sky-400/20" : "hover:border-[#dce5ee]")}>
                <div className={cx("flex h-11 w-11 items-center justify-center rounded-xl", isDarkMode ? "bg-white/[0.04] text-white" : "bg-[#f3f6fa] text-[#111827]")}>
                  {task.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cx("truncate text-base font-semibold", ui.textPrimary)}>{task.message || "Untitled task"}</div>
                  <div className={cx("mt-1 text-sm", ui.textMuted)}>{formatWhen(task.timestamp)}</div>
                </div>
                <span className={cx("max-w-full self-start rounded-full border px-3 py-1 text-[11px] font-semibold sm:self-auto", statusTone(task.status, isDarkMode))}>
                  {task.status === "completed" ? "Completed" : "Pending"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  const renderDM = () => (
    <div
      className={cx(
        "flex w-full min-w-0 flex-col overflow-hidden rounded-[28px] border shadow-[0_16px_36px_rgba(15,23,42,0.05)]",
        isMobile ? "min-h-[calc(100dvh-16rem)]" : "lg:flex-1 lg:min-h-0 lg:h-full",
        isDarkMode ? "border-white/10 bg-[#0c1624]" : "border-[#edf1f5] bg-white"
      )}
    >
      <div className={cx("flex min-w-0 items-start gap-3.5 border-b px-4 py-3.5 sm:items-center sm:px-5", ui.border)}>
        <div className="relative">
          <div className={cx("h-11 w-11 overflow-hidden rounded-full", isDarkMode ? "bg-white/[0.05]" : "bg-[#f3f6fa]")}>{activeFriend ? renderAvatar(activeFriend, 44) : null}</div>
          <span className={cx("absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2", isDarkMode ? "border-[#0c1624]" : "border-white", activeFriend?.status === "online" ? "bg-emerald-400" : "bg-slate-300")} />
        </div>
        <div className="min-w-0">
          <div className={cx("truncate text-[17px] font-semibold", ui.textPrimary)}>{activeFriend?.name || "Select a conversation"}</div>
          <div className={cx("mt-1 text-sm", ui.textMuted)}>{activeFriend?.status === "online" ? "Online now" : "Messages stay synced with your workspace chats"}</div>
        </div>
      </div>

      <div
        ref={dmMessagesContainerRef}
        onScroll={() => {
          const container = dmMessagesContainerRef.current
          if (!container) return
          const threshold = 24
          const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
          setIsDMAtBottom(atBottom)
        }}
        className={cx("flex-1 space-y-2.5 overflow-y-auto px-4 py-3.5 sm:space-y-3 sm:px-5 sm:py-4", isDarkMode ? "bg-[#08111d]" : "bg-[#fbfdff]")}
      >
        {dmMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className={cx("max-w-sm rounded-[24px] border border-dashed px-6 py-7 text-center sm:px-8 sm:py-8", ui.dashedCard)}>
              <MessageCircle className={cx("mx-auto h-10 w-10", ui.textSoft)} />
              <div className={cx("mt-4 text-lg font-semibold", ui.textPrimary)}>Start the conversation</div>
              <p className={cx("mt-2 text-sm leading-6", ui.textMuted)}>Messages you send here stay in the same direct message thread as the workspace chat.</p>
            </div>
          </div>
        ) : (
          dmMessages.map(message => {
            const isMe = String(message.userId) === String(currentUser?.id)
            return (
              <div key={message.id} className={cx("flex", isMe ? "justify-end" : "justify-start")}>
                <div
                  className={cx(
                    "max-w-[88%] rounded-[18px] border px-2.5 py-2 sm:max-w-[70%]",
                    isMe
                      ? isDarkMode
                        ? "border-[#1d4ed8] bg-[#1e3a8a] text-[#eff6ff]"
                        : "border-[#bfdbfe] bg-[#c2e7ff] text-[#0f172a]"
                      : isDarkMode
                        ? "border-[#1e293b] bg-[#0f172a] text-[#e2e8f0]"
                        : "border-[#d6deea] bg-[#f2f2f2] text-[#0f172a]"
                  )}
                >
                  {message.text && <div className="text-[13px] leading-[1.35rem]">{message.text}</div>}
                  {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {message.attachments.map(attachment => {
                        const previewSrc = getFilePreviewSrc(attachment)
                        const isImageAttachment = isImageFile(attachment) && Boolean(previewSrc)

                        if (isImageAttachment) {
                          return (
                            <button
                              key={`${message.id}-${attachment.id || attachment.name}`}
                              onClick={() => onOpenFile(attachment)}
                              className={cx(
                                "overflow-hidden rounded-[20px] border text-left",
                                isMe
                                  ? isDarkMode
                                    ? "border-[#60a5fa]/30 bg-white/10"
                                    : "border-[#93c5fd] bg-white/50"
                                  : isDarkMode
                                    ? "border-white/10 bg-white/[0.05]"
                                    : "border-[#cbd5e1] bg-white"
                              )}
                            >
                              <SmartImage
                                src={previewSrc}
                                alt={attachment.name || "Image attachment"}
                                apiBase={apiBase}
                                className="h-32 w-32 object-cover sm:h-40 sm:w-40"
                                onResolveError={resolveProtectedFileUrl ? () => resolveProtectedFileUrl(attachment) : undefined}
                                fallback={
                                  <span className={cx("flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40", isDarkMode ? "bg-white/[0.04] text-white" : "bg-white text-[#111827]")}>
                                    <FileText className="h-5 w-5" />
                                  </span>
                                }
                              />
                              <span className={cx("block truncate px-3 py-2 text-xs font-semibold", isMe ? (isDarkMode ? "text-[#eff6ff]" : "text-[#0f172a]") : isDarkMode ? "text-slate-200" : "text-[#475569]")}>
                                {attachment.name || "Image"}
                              </span>
                            </button>
                          )
                        }

                        return (
                          <button
                            key={`${message.id}-${attachment.id || attachment.name}`}
                            onClick={() => onOpenFile(attachment)}
                            className={cx(
                              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                              isMe
                                ? isDarkMode
                                  ? "border-[#60a5fa]/30 bg-white/10 text-[#eff6ff]"
                                  : "border-[#93c5fd] bg-white/50 text-[#0f172a]"
                                : isDarkMode
                                  ? "border-white/10 bg-white/[0.05] text-slate-200"
                                  : "border-[#cbd5e1] bg-white text-[#475569]"
                            )}
                          >
                            <span className={cx("flex h-6 w-6 items-center justify-center rounded-full", isDarkMode ? "bg-white/10" : "bg-slate-100")}>
                              <FileText className="h-3.5 w-3.5" />
                            </span>
                            <span className="max-w-[180px] truncate">{attachment.name || "Attachment"}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div
                    className={cx(
                      "mt-2 text-[11px]",
                      isMe
                        ? isDarkMode
                          ? "text-sky-100"
                          : "text-slate-600"
                        : ui.textSoft
                    )}
                  >
                    {formatWhen(message.timestamp)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className={cx("border-t px-4 py-3.5 sm:px-5 sm:py-4", ui.border)}>
        <div className={cx("rounded-[24px] border p-2.5", isDarkMode ? "border-white/10 bg-white/[0.03]" : "border-[#e8eef5] bg-[#fbfdff]")}>
          <textarea
            rows={2}
            value={dmInput}
            onChange={event => setDmInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                onSendDM()
              }
            }}
            placeholder={`Message ${activeFriend?.name || "your contact"}`}
            className={cx("w-full resize-none border-none bg-transparent px-1 py-1 text-sm leading-6 outline-none", isDarkMode ? "text-slate-100 placeholder:text-slate-500" : "text-[#111827] placeholder:text-[#9aa7b5]")}
          />
          <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className={cx("text-xs", ui.textSoft)}>Press Enter to send, or save it as a draft.</div>
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <button onClick={onSaveDraft} disabled={!dmInput.trim()} className={cx("w-full rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto", ui.secondaryTextButton)}>Save draft</button>
              <button onClick={onSendDM} disabled={!dmInput.trim() || dmSending} className={cx("inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto", ui.primaryButton)}>
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderBody = () => {
    if (section === "connect") return renderConnect()
    if (section === "drafts") return renderDrafts()
    if (section === "files") return renderFiles()
    if (section === "tasks") return renderTasks()
    if (section === "dm") return renderDM()
    return renderOverview()
  }

  const showSidebar = !isMobile

  return (
    <div className={cx("min-h-[100dvh] w-full overflow-x-hidden transition-colors", ui.page)}>
      <div className="flex min-h-[100dvh] flex-col lg:h-[100dvh] lg:flex-row lg:overflow-hidden">
        {showSidebar && (
        <div className={cx("relative transition-[width] duration-300 lg:flex-shrink-0", homeSidebarCollapsed ? "lg:w-[92px] lg:min-w-[92px]" : "lg:w-[272px] lg:min-w-[272px]")}>
          <aside className={cx("w-full border-b lg:flex lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-r", ui.sidebar, ui.border)}>
            <div className={cx("border-b px-4 py-3.5 sm:px-5 lg:px-5 lg:py-4", ui.border)}>
              <div className={cx("flex items-center", homeSidebarCollapsed ? "justify-center" : "gap-3")}>
                <button onClick={() => onSectionChange("overview")} className={cx("flex items-center gap-3 text-left", homeSidebarCollapsed && "justify-center")}>
                  <div
                    className={cx(
                      "flex h-10 w-10 items-center justify-center rounded-2xl",
                      isDarkMode
                        ? "bg-white/[0.08] shadow-[0_10px_20px_rgba(17,24,39,0.14)]"
                        : "border border-[#e7edf4] bg-white/92 shadow-[0_10px_24px_rgba(148,163,184,0.14)]"
                    )}
                  >
                    <SmartImage
                      src={isDarkMode ? "/logo%20SL.png" : "/logo%20SD.png"}
                      alt="Spacess logo"
                      className={cx("object-contain", isDarkMode ? "h-6 w-6" : "h-7 w-7")}
                      loading="eager"
                      fetchPriority="high"
                    />
                  </div>
                  {!homeSidebarCollapsed && (
                    <div>
                      <div className={cx("text-[17px] font-semibold", ui.textPrimary)}>Spacess</div>
                      <div className={cx("text-sm", ui.textMuted)}>Home</div>
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-3 px-4 py-3.5 sm:px-5 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:px-4 lg:py-4">
              <div className="space-y-2.5">
                <div className={cx("grid gap-2", homeSidebarCollapsed ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-1")}>
                  {navItems.map(item => {
                    const Icon = item.icon
                    const isActive = item.key !== "workspaces" && section === item.key
                    return (
                      <button
                        key={item.key}
                        onClick={item.action}
                        title={homeSidebarCollapsed ? item.label : undefined}
                        className={cx(
                          "flex min-w-0 items-center rounded-[16px] text-sm font-medium transition",
                          homeSidebarCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-2.5",
                          isActive ? ui.navActive : ui.navIdle
                        )}
                      >
                        <Icon className="h-4.5 w-4.5 shrink-0" />
                        {!homeSidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {!homeSidebarCollapsed && (
              <div className={cx("rounded-[20px] border p-3.5 lg:mt-auto lg:flex lg:min-h-0 lg:flex-1 lg:flex-col", isDarkMode ? "border-white/10 bg-[#111111]" : "border-[#eef2f6] bg-[#fbfdff]")}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className={cx("text-sm font-semibold", isDarkMode ? "text-slate-200" : "text-[#374151]")}>Direct Messages</div>
                  <button onClick={onOpenAddConnection} className={cx("rounded-full p-1.5 transition", isDarkMode ? "text-slate-400 hover:bg-white/[0.06] hover:text-white" : "text-[#6b7280] hover:bg-[#f4f7fb] hover:text-[#111827]")} title="Start a new direct message">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className={cx(isMobile ? "grid grid-cols-1 gap-2" : "flex gap-2 overflow-x-auto pb-1 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:pr-1")}>
                  {friends.map(friend => (
                    <button
                      key={friend.id}
                      onClick={() => onOpenDM(friend.id)}
                      className={cx(
                        "flex min-w-0 items-center gap-3 rounded-[16px] px-3 py-2 text-left transition",
                        !isMobile && "min-w-[208px] lg:min-w-0",
                        section === "dm" && String(activeDMUser) === String(friend.id)
                          ? (isDarkMode ? "bg-white/[0.07]" : "bg-[#f4f7fb]")
                          : isDarkMode
                            ? "hover:bg-white/[0.04]"
                            : "hover:bg-white"
                      )}
                    >
                      <div className="relative">
                        <div className={cx("h-9 w-9 overflow-hidden rounded-full", isDarkMode ? "bg-white/[0.05]" : "bg-[#f3f6fa]")}>{renderAvatar(friend, 36)}</div>
                        <span className={cx("absolute bottom-0 right-0 h-3 w-3 rounded-full border-2", isDarkMode ? "border-[#0f1724]" : "border-white", friend.status === "online" ? "bg-emerald-400" : "bg-slate-300")} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cx("truncate text-sm font-medium", ui.textPrimary)}>{friend.name}</div>
                        {isMobile && <div className={cx("mt-0.5 truncate text-xs", ui.textMuted)}>{friend.status === "online" ? "Online now" : "Open chat"}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>
          </aside>

          <button
            type="button"
            onClick={() => setHomeSidebarCollapsed(prev => !prev)}
            className={cx("absolute left-full top-5 z-20 ml-3 hidden h-10 w-10 items-center justify-center rounded-full border shadow-[0_14px_28px_rgba(15,23,42,0.10)] transition lg:flex", ui.iconButton)}
            title={homeSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {homeSidebarCollapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
          </button>
        </div>
        )}

        <main className={cx("flex min-w-0 flex-1 flex-col", isDarkMode ? "bg-[#0d0001]" : "bg-[#f6f8fc]", showSidebar && "lg:pl-16")}>
          <div className="flex min-h-0 flex-1 flex-col">
            {isMobile && section !== "overview" && section !== "dm" && renderMobileSectionNav()}
            {isMobile && section === "dm" && (
              <div className={cx("border-b px-4 py-2.5 sm:px-5", ui.border)}>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => onSectionChange("overview")}
                    className={cx("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition", ui.secondaryButton)}
                  >
                    Back home
                  </button>
                  {friends.map(friend => (
                    <button
                      key={friend.id}
                      onClick={() => onOpenDM(friend.id)}
                      className={cx(
                        "inline-flex max-w-[75vw] shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition sm:max-w-none",
                        String(activeDMUser) === String(friend.id) ? ui.navActive : ui.secondaryButton
                      )}
                    >
                      <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full">
                        {renderAvatar(friend, 28)}
                      </span>
                      <span className="min-w-0 truncate">{friend.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!(isMobile && section === "overview") && (
              <div className={cx("border-b px-4 py-3.5 sm:px-5 lg:px-6 lg:py-4", ui.border)}>
                <div className={cx("flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between", section === "dm" && "mx-auto w-full max-w-[1400px]")}>
                  <div className="min-w-0">
                    <div className={cx("text-[24px] font-semibold tracking-[-0.03em] sm:text-[28px]", ui.textPrimary)}>
                      {section === "overview" ? getGreeting(currentUser?.name) : sectionTitles[section] || "Home"}
                    </div>
                    <div className={cx("mt-1 text-sm sm:text-base", ui.textMuted)}>
                      {section === "overview"
                        ? "Stay up to date with your team, files, and conversations."
                        : section === "dm"
                          ? "Reply without leaving your Home dashboard."
                          : "Everything here stays connected to the existing workspace experience."}
                    </div>
                  </div>

                  <div
                    className={cx(
                      "flex w-full flex-col gap-3",
                      section === "dm"
                        ? "lg:max-w-[520px] xl:w-full xl:max-w-[520px]"
                        : section === "connect"
                          ? "xl:w-auto"
                          : "lg:max-w-[680px] xl:w-auto xl:min-w-[540px]"
                    )}
                  >
                    <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-end">
                      {section !== "connect" && (
                        <div className={cx("relative w-full", section === "dm" ? "md:max-w-[260px]" : "md:max-w-[300px]")}>
                          <Search className={cx("pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2", ui.textSoft)} />
                          <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search here" className={cx("h-10 w-full rounded-full border pl-11 pr-4 text-sm outline-none transition", ui.input)} />
                        </div>
                      )}

                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end md:flex-nowrap">
                        <div className={cx("inline-flex w-full justify-center rounded-full border p-1 sm:w-auto", isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-[#e6edf4] bg-white")}>
                          <button onClick={() => onThemeChange(false)} className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition", !isDarkMode ? "bg-[#111827] text-white" : ui.textSecondary)}>
                            <Sun className="h-4 w-4" />
                            Light
                          </button>
                          <button onClick={() => onThemeChange(true)} className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition", isDarkMode ? "bg-white text-slate-900" : ui.textSecondary)}>
                            <Moon className="h-4 w-4" />
                            Dark
                          </button>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button onClick={onOpenNotifications} className={cx("flex h-10 w-10 items-center justify-center rounded-full border transition", ui.iconButton)} title="Notifications">
                            <Bell className="h-4.5 w-4.5" />
                          </button>
                          <div className="relative" ref={settingsMenuRef}>
                            <button onClick={() => setShowSettingsMenu(prev => !prev)} className={cx("flex h-10 w-10 items-center justify-center rounded-full border transition", ui.iconButton)} title="Settings">
                              <Settings className="h-4.5 w-4.5" />
                            </button>
                            {showSettingsMenu && (
                              <div className={cx("absolute right-0 top-full z-20 mt-2 min-w-[220px] rounded-[22px] border p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)]", isDarkMode ? "border-white/10 bg-[#111827]" : "border-[#dfe8f2] bg-white")}>
                                <div className={cx("px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]", ui.textSoft)}>Settings</div>
                                <button
                                  type="button"
                                  onClick={openManageProfileModal}
                                  className={cx("flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left text-sm font-medium transition", isDarkMode ? "text-slate-200 hover:bg-white/[0.06]" : "text-[#1f2937] hover:bg-[#f8fbff]")}
                                >
                                  <span className={cx("flex h-9 w-9 items-center justify-center rounded-2xl", isDarkMode ? "bg-white/[0.06] text-slate-100" : "bg-[#eef5fb] text-[#334155]")}>
                                    <Building2 className="h-4 w-4" />
                                  </span>
                                  <span>Manage profile</span>
                                </button>
                              </div>
                            )}
                          </div>
                          <button onClick={onOpenProfile} className={cx("flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border", isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-[#e6edf4] bg-white")} title="Open profile">
                            {currentUser ? renderAvatar(currentUser, 36) : null}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div
              className={cx(
                "flex-1 min-w-0 px-4 py-3.5 sm:px-5 lg:px-6",
                isMobile ? "pb-24" : "",
                section === "dm"
                  ? "flex min-h-0 lg:overflow-hidden"
                  : section === "overview"
                    ? "flex pt-4 lg:py-5 lg:overflow-y-auto"
                  : "pb-6 lg:py-5 lg:overflow-y-auto"
              )}
            >
              {renderBody()}
            </div>
          </div>
        </main>
      </div>
      {renderManageProfileModal()}
    </div>
  )
}
