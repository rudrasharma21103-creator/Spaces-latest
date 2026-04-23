import React, { useMemo, useState } from "react"
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle,
  ClipboardList,
  Clock,
  Hash,
  ListFilter,
  PenTool,
  Search,
  UserPlus,
  Users,
} from "lucide-react"

const cx = (...classes) => classes.filter(Boolean).join(" ")
const fastTransition = "motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out motion-reduce:transition-none"
const colorTransition = "motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out motion-reduce:transition-none"

const getEntityId = value => {
  if (value === undefined || value === null) return ""
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (typeof value === "object") {
    if (value.$oid) return String(value.$oid)
    if (value.id !== undefined && value.id !== null) return String(value.id)
    if (value.userId !== undefined && value.userId !== null) return String(value.userId)
    if (value._id !== undefined && value._id !== null) return getEntityId(value._id)
  }
  return String(value)
}

const normalizeStatus = status => (status === "completed" ? "completed" : "pending")

const formatTaskTimestamp = value => {
  if (!value) return "No timestamp"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)

  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

const isInCurrentWeek = date => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOfWeek = today.getDay()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - dayOfWeek)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  return date >= weekStart && date < weekEnd
}

const isInCurrentMonth = date => {
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

const matchesDateFilter = (timestamp, filterValue) => {
  if (filterValue === "all") return true
  if (!timestamp) return false

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return false

  const now = new Date()

  if (filterValue === "today") return isSameDay(date, now)
  if (filterValue === "week") return isInCurrentWeek(date)
  if (filterValue === "month") return isInCurrentMonth(date)
  if (filterValue === "recent") {
    const diff = now.getTime() - date.getTime()
    return diff <= 1000 * 60 * 60 * 24 * 30
  }
  return true
}

const sortTasks = tasks =>
  [...tasks].sort((left, right) => {
    const leftRank = left.status === "completed" ? 1 : 0
    const rightRank = right.status === "completed" ? 1 : 0
    if (leftRank !== rightRank) return leftRank - rightRank

    const leftTime = new Date(left.timestamp || 0).getTime() || 0
    const rightTime = new Date(right.timestamp || 0).getTime() || 0
    return rightTime - leftTime
  })

const normalizeTask = (task, source = "task") => {
  if (!task) return null

  const rawAssigned = Array.isArray(task.assigned_to)
    ? task.assigned_to
    : Array.isArray(task.assigneeIds)
      ? task.assigneeIds
      : []

  const assigneeIds = rawAssigned.map(item => getEntityId(item)).filter(Boolean)
  const createdById = getEntityId(task.created_by || task.createdBy || task.userId)
  const id =
    getEntityId(task.id || task.taskId || task._id) ||
    getEntityId(task.sourceMessageId) ||
    getEntityId(task.timestamp)

  return {
    ...task,
    id,
    message: task.message || task.text || "Untitled task",
    timestamp: task.timestamp || task.createdAt || task.updatedAt || null,
    status: normalizeStatus(task.status),
    channel_id: task.channel_id || task.channelId || null,
    sourceMessageId: task.sourceMessageId || null,
    assigneeIds,
    createdById,
    source,
  }
}

const taskFromMessage = message => {
  if (!message) return null
  if (message.type !== "task" && !message.taskId) return null

  return normalizeTask(
    {
      id: message.taskId || message.id,
      message: message.text || message.message,
      timestamp: message.timestamp,
      assigned_to: message.assigned_to || [],
      created_by: message.userId,
      status: message.taskStatus || message.status || "pending",
      channel_id: message.channel_id || message.channelId || null,
      sourceMessageId: message.id,
    },
    "message"
  )
}

function SurfaceCard({ children, className = "", isDarkMode = false }) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-2xl border",
        isDarkMode ? "border-[#2a313a] bg-[#171b21]" : "border-slate-200 bg-white",
        fastTransition,
        className
      )}
    >
      {children}
    </section>
  )
}

function SummaryMetric({ label, value, tone = "neutral", isDarkMode = false }) {
  const toneClass =
    tone === "success"
      ? isDarkMode
        ? "text-emerald-300"
        : "text-emerald-700"
      : tone === "warning"
        ? isDarkMode
          ? "text-amber-300"
          : "text-amber-700"
        : isDarkMode
          ? "text-slate-100"
          : "text-slate-900"

  return (
    <div
      className={cx(
        "rounded-[18px] border px-3.5 py-3",
        isDarkMode ? "border-[#2a313a] bg-[#14181d]" : "border-slate-200 bg-slate-50/90"
      )}
    >
      <div className={cx("text-[10px] font-semibold uppercase tracking-[0.18em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
        {label}
      </div>
      <div className={cx("mt-1.5 text-[1.15rem] font-semibold tracking-[-0.03em]", toneClass)}>{value}</div>
    </div>
  )
}

function MobileMetricCard({ label, value, tone = "neutral", isDarkMode = false }) {
  const toneClass =
    tone === "success"
      ? isDarkMode
        ? "text-emerald-300"
        : "text-emerald-700"
      : tone === "warning"
        ? isDarkMode
          ? "text-amber-300"
          : "text-amber-700"
        : isDarkMode
          ? "text-white"
          : "text-slate-950"

  return (
    <div
      className={cx(
        "min-w-[120px] rounded-[22px] border px-4 py-3.5",
        isDarkMode
          ? "border-white/10 bg-white/[0.05] backdrop-blur"
          : "border-white/80 bg-white/90 shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
      )}
    >
      <div className={cx("text-[10px] font-semibold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-400" : "text-slate-500")}>
        {label}
      </div>
      <div className={cx("mt-2 text-[1.4rem] font-semibold tracking-[-0.04em]", toneClass)}>{value}</div>
    </div>
  )
}

function InsightRow({ label, value, note, isDarkMode = false }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className={cx("text-sm font-medium", isDarkMode ? "text-slate-200" : "text-slate-800")}>
          {label}
        </div>
        <div className={cx("mt-1 text-xs", isDarkMode ? "text-slate-400" : "text-slate-500")}>
          {note}
        </div>
      </div>
      <div className={cx("shrink-0 text-sm font-semibold", isDarkMode ? "text-slate-100" : "text-slate-900")}>
        {value}
      </div>
    </div>
  )
}

function FilterChipGroup({ label, value, onChange, options, isDarkMode = false }) {
  return (
    <div>
      <div className={cx("mb-2 text-[11px] font-semibold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
        {label}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map(option => {
          const isSelected = value === option.value

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cx(
                "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold",
                isSelected
                  ? isDarkMode
                    ? "border-sky-400/40 bg-sky-400/15 text-sky-100"
                    : "border-sky-200 bg-sky-600 text-white"
                  : isDarkMode
                    ? "border-white/10 bg-white/[0.05] text-slate-300"
                    : "border-slate-200 bg-white text-slate-600",
                colorTransition
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FilterField({
  icon,
  label,
  value,
  onChange,
  options,
  isDarkMode = false,
}) {
  return (
    <label className="min-w-0">
      <div className={cx("mb-1.5 text-xs font-medium", isDarkMode ? "text-slate-400" : "text-slate-500")}>
        {label}
      </div>
      <div
        className={cx(
          "flex items-center gap-2 rounded-xl border px-3",
          isDarkMode ? "border-[#2a313a] bg-[#14181d]" : "border-slate-200 bg-slate-50",
          colorTransition
        )}
      >
        <span className={cx(isDarkMode ? "text-slate-400" : "text-slate-500")}>{icon}</span>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={cx(
            "h-11 w-full bg-transparent text-sm outline-none",
            isDarkMode ? "text-slate-100" : "text-slate-900"
          )}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  )
}

function SearchField({ value, onChange, isDarkMode = false }) {
  return (
    <label className="block min-w-0">
      <div className={cx("mb-1.5 text-xs font-medium", isDarkMode ? "text-slate-400" : "text-slate-500")}>
        Search
      </div>
      <div
        className={cx(
          "flex items-center gap-2 rounded-xl border px-3",
          isDarkMode ? "border-[#2a313a] bg-[#14181d]" : "border-slate-200 bg-slate-50",
          colorTransition
        )}
      >
        <Search className={cx("h-4 w-4", isDarkMode ? "text-slate-400" : "text-slate-500")} />
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Search tasks or channels"
          className={cx(
            "h-11 w-full bg-transparent text-sm outline-none placeholder:text-slate-400",
            isDarkMode ? "text-slate-100" : "text-slate-900"
          )}
        />
      </div>
    </label>
  )
}

function EmptyState({ title, description, isDarkMode = false }) {
  return (
    <div
      className={cx(
        "flex min-h-[260px] items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center",
        isDarkMode ? "border-[#303641] bg-[#14181d]" : "border-slate-200 bg-slate-50/70"
      )}
    >
      <div className="max-w-sm">
        <div
          className={cx(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-xl",
            isDarkMode ? "bg-[#1f242b] text-slate-300" : "bg-white text-slate-500"
          )}
        >
          <ClipboardList className="h-7 w-7" />
        </div>
        <h3 className={cx("mt-4 text-lg font-semibold", isDarkMode ? "text-slate-100" : "text-slate-900")}>
          {title}
        </h3>
        <p className={cx("mt-2 text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-500")}>
          {description}
        </p>
      </div>
    </div>
  )
}

function TaskItem({
  task,
  channelName,
  currentUserId,
  isDarkMode = false,
  isWorking = false,
  isCompact = false,
  onComplete,
}) {
  const isCompleted = task.status === "completed"
  const isAssignedToCurrentUser = task.assigneeIds.includes(currentUserId)
  const isCreatedByCurrentUser = task.createdById === currentUserId

  return (
    <article
      className={cx(
        isCompact ? "rounded-[24px] border px-4 py-4" : "rounded-xl border px-4 py-4",
        isCompleted
          ? isDarkMode
            ? "border-emerald-900/40 bg-emerald-950/20"
            : "border-emerald-100 bg-emerald-50/60"
          : isDarkMode
            ? "border-[#2c333c] bg-[#14181d] hover:border-[#39414c] hover:bg-[#171c22]"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70",
        fastTransition
      )}
    >
      <div className={cx("flex items-start gap-3", isCompact ? "gap-3.5" : "gap-3")}>
        <button
          onClick={() => onComplete?.(task)}
          disabled={isCompleted || isWorking}
          className={cx(
            isCompact ? "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border" : "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            isCompleted
              ? "border-emerald-500 bg-emerald-500 text-white"
              : isDarkMode
                ? "border-[#343b45] bg-[#1c2128] text-slate-300 hover:border-[#4b5563] hover:text-white"
                : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700",
            isWorking ? "cursor-wait opacity-80" : "",
            fastTransition
          )}
          title={isCompleted ? "Task completed" : "Mark task as complete"}
        >
          {isCompleted ? <Check className="h-4.5 w-4.5" /> : <CheckCircle className="h-4.5 w-4.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className={cx("flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between", isCompact ? "gap-2.5" : "gap-3")}>
            <div className="min-w-0">
              <h3
                className={cx(
                  isCompact ? "text-[15px] font-semibold leading-6" : "text-[15px] font-semibold leading-6",
                  isCompleted ? "line-through opacity-70" : "",
                  isDarkMode ? "text-slate-100" : "text-slate-900"
                )}
              >
                {task.message}
              </h3>

              <div className={cx("mt-2 flex flex-wrap items-center gap-2", isCompact ? "mt-2.5" : "mt-2")}>
                {isAssignedToCurrentUser && (
                  <span
                    className={cx(
                      "inline-flex rounded-md px-2.5 py-1 text-[11px] font-medium",
                      isDarkMode ? "bg-[#1d2938] text-slate-200" : "bg-slate-100 text-slate-700"
                    )}
                  >
                    Assigned to you
                  </span>
                )}
                {isCreatedByCurrentUser && (
                  <span
                    className={cx(
                      "inline-flex rounded-md px-2.5 py-1 text-[11px] font-medium",
                      isDarkMode ? "bg-[#232931] text-slate-300" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    Created by you
                  </span>
                )}
                {channelName && (
                  <span
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium",
                      isDarkMode ? "bg-[#232931] text-slate-300" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    <Hash className="h-3.5 w-3.5" />
                    {channelName}
                  </span>
                )}
                {task.assigneeIds.length > 0 && (
                  <span
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium",
                      isDarkMode ? "bg-[#232931] text-slate-300" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    <Users className="h-3.5 w-3.5" />
                    {task.assigneeIds.length} assignee{task.assigneeIds.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            <span
              className={cx(
                "inline-flex w-fit rounded-md px-2.5 py-1 text-[11px] font-semibold",
                isCompleted
                  ? isDarkMode
                    ? "bg-emerald-950/40 text-emerald-300"
                    : "bg-emerald-100 text-emerald-700"
                  : isDarkMode
                    ? "bg-amber-950/40 text-amber-300"
                    : "bg-amber-100 text-amber-700"
              )}
            >
              {isWorking && !isCompleted ? "Updating" : isCompleted ? "Completed" : "Pending"}
            </span>
          </div>

          <div className={cx("mt-3 flex flex-wrap items-center gap-3 text-xs", isDarkMode ? "text-slate-400" : "text-slate-500")}>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatTaskTimestamp(task.timestamp)}
            </span>
            {task.createdById && (
              <span className="inline-flex items-center gap-1.5">
                <PenTool className="h-3.5 w-3.5" />
                Owner tracked
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function TasksHub({
  isDarkMode = false,
  tasks = [],
  messages = {},
  currentUser,
  channels = [],
  completingTaskId = null,
  onBackHome,
  onMarkTaskComplete,
}) {
  const currentUserId = getEntityId(currentUser?.id || currentUser?._id || currentUser?.userId)
  const [ownershipFilter, setOwnershipFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const allTasks = useMemo(() => {
    const directTasks = (Array.isArray(tasks) ? tasks : [])
      .map(task => normalizeTask(task, "task"))
      .filter(Boolean)

    const messageTasks = Object.values(messages || {})
      .flatMap(list => (Array.isArray(list) ? list : []))
      .map(taskFromMessage)
      .filter(Boolean)

    const merged = [...directTasks, ...messageTasks]
    const deduped = new Map()

    merged.forEach(task => {
      const key =
        task.id || `${task.message}|${task.timestamp}|${task.createdById}|${task.assigneeIds.join(",")}`
      if (!key) return
      if (!deduped.has(key) || deduped.get(key).source === "message") {
        deduped.set(key, task)
      }
    })

    return sortTasks(Array.from(deduped.values()))
  }, [messages, tasks])

  const assignedTasks = useMemo(
    () => allTasks.filter(task => task.assigneeIds.includes(currentUserId)),
    [allTasks, currentUserId]
  )

  const createdTasks = useMemo(
    () => allTasks.filter(task => task.createdById === currentUserId),
    [allTasks, currentUserId]
  )

  const scopedTasks = useMemo(
    () =>
      allTasks.filter(task =>
        task.assigneeIds.includes(currentUserId) || task.createdById === currentUserId
      ),
    [allTasks, currentUserId]
  )

  const workspaceFallback = scopedTasks.length === 0
  const baseTasks = workspaceFallback ? allTasks : scopedTasks

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return baseTasks.filter(task => {
      const matchesOwnership =
        ownershipFilter === "all"
          ? true
          : ownershipFilter === "assigned"
            ? task.assigneeIds.includes(currentUserId)
            : task.createdById === currentUserId

      const matchesStatus =
        statusFilter === "all" ? true : task.status === statusFilter

      const matchesDate = matchesDateFilter(task.timestamp, dateFilter)

      const channelName = channels.find(channel => String(channel?.id) === String(task.channel_id))?.name || ""
      const matchesQuery =
        !query ||
        `${task.message || ""} ${channelName}`.toLowerCase().includes(query)

      return matchesOwnership && matchesStatus && matchesDate && matchesQuery
    })
  }, [baseTasks, channels, currentUserId, dateFilter, ownershipFilter, searchQuery, statusFilter])

  const channelNames = useMemo(
    () => new Map((channels || []).map(channel => [String(channel?.id), channel?.name || "channel"])),
    [channels]
  )

  const totalCount = baseTasks.length
  const completedCount = baseTasks.filter(task => task.status === "completed").length
  const pendingCount = totalCount - completedCount
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const ownershipOptions = [
    { value: "all", label: workspaceFallback ? "All visible tasks" : "All my tasks" },
    { value: "assigned", label: "Assigned to me" },
    { value: "created", label: "Created by me" },
  ]

  const statusOptions = [
    { value: "all", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Completed" },
  ]

  const dateOptions = [
    { value: "all", label: "Any time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This week" },
    { value: "month", label: "This month" },
    { value: "recent", label: "Last 30 days" },
  ]

  return (
    <div className={cx("min-h-[100dvh] w-full overflow-y-auto", isDarkMode ? "bg-[#0b0f14] text-slate-100" : "bg-[#edf3f8] text-slate-900")}>
      <div className="flex min-h-[100dvh] w-full flex-col px-4 py-4 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
        <section className="md:hidden">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <div
              className={cx(
                "overflow-hidden rounded-[30px] border px-4 py-4",
                isDarkMode
                  ? "border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_52%),linear-gradient(180deg,#101720_0%,#0d131a_100%)]"
                  : "border-white/80 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_52%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {typeof onBackHome === "function" && (
                    <button
                      onClick={onBackHome}
                      className={cx(
                        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border backdrop-blur",
                        isDarkMode ? "border-white/10 bg-white/[0.06] text-slate-100" : "border-white/90 bg-white/90 text-slate-700"
                      )}
                      title="Back"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  )}

                  <div className="min-w-0">
                    <div className={cx("text-[11px] font-semibold uppercase tracking-[0.24em]", isDarkMode ? "text-slate-400" : "text-slate-500")}>
                      Mobile Queue
                    </div>
                    <h1 className={cx("mt-2 text-[1.7rem] font-semibold tracking-[-0.05em]", isDarkMode ? "text-white" : "text-slate-950")}>
                      Tasks
                    </h1>
                    <p className={cx("mt-2 max-w-md text-sm leading-6", isDarkMode ? "text-slate-300" : "text-slate-600")}>
                      See what needs attention, filter fast, and close work from one thumb-friendly view.
                    </p>
                  </div>
                </div>

                <div className={cx("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-white/[0.08] text-slate-100" : "bg-slate-900 text-white")}>
                  {filteredTasks.length} live
                </div>
              </div>

              {workspaceFallback && (
                <div className={cx("mt-4 rounded-[20px] px-3.5 py-3 text-xs leading-5", isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-slate-100/90 text-slate-600")}>
                  Showing all visible workspace tasks until profile-linked ownership is available.
                </div>
              )}
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <MobileMetricCard label="Total" value={totalCount} isDarkMode={isDarkMode} />
              <MobileMetricCard label="Done" value={completedCount} tone="success" isDarkMode={isDarkMode} />
              <MobileMetricCard label="Open" value={pendingCount} tone="warning" isDarkMode={isDarkMode} />
              <MobileMetricCard label="Rate" value={`${completionRate}%`} isDarkMode={isDarkMode} />
            </div>

            <SurfaceCard isDarkMode={isDarkMode} className={cx(isDarkMode ? "bg-[#101720]/95" : "bg-white/95")}>
              <div className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={cx("text-[11px] font-semibold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                      Refine
                    </div>
                    <h2 className={cx("mt-2 text-lg font-semibold tracking-[-0.03em]", isDarkMode ? "text-white" : "text-slate-900")}>
                      Focus your queue
                    </h2>
                  </div>
                  <div className={cx("rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-white/[0.06] text-slate-200" : "bg-slate-100 text-slate-700")}>
                    {assignedTasks.length} assigned
                  </div>
                </div>

                <div className="mt-4">
                  <SearchField value={searchQuery} onChange={setSearchQuery} isDarkMode={isDarkMode} />
                </div>

                <div className="mt-4 space-y-4">
                  <FilterChipGroup label="Ownership" value={ownershipFilter} onChange={setOwnershipFilter} options={ownershipOptions} isDarkMode={isDarkMode} />
                  <FilterChipGroup label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} isDarkMode={isDarkMode} />
                  <FilterChipGroup label="Date" value={dateFilter} onChange={setDateFilter} options={dateOptions} isDarkMode={isDarkMode} />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  <div className={cx("rounded-[18px] border px-3 py-3", isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50")}>
                    <div className={cx("text-[10px] font-semibold uppercase tracking-[0.18em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>Assigned</div>
                    <div className={cx("mt-1.5 text-lg font-semibold tracking-[-0.04em]", isDarkMode ? "text-white" : "text-slate-900")}>{assignedTasks.length}</div>
                  </div>
                  <div className={cx("rounded-[18px] border px-3 py-3", isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50")}>
                    <div className={cx("text-[10px] font-semibold uppercase tracking-[0.18em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>Created</div>
                    <div className={cx("mt-1.5 text-lg font-semibold tracking-[-0.04em]", isDarkMode ? "text-white" : "text-slate-900")}>{createdTasks.length}</div>
                  </div>
                  <div className={cx("rounded-[18px] border px-3 py-3", isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50")}>
                    <div className={cx("text-[10px] font-semibold uppercase tracking-[0.18em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>Visible</div>
                    <div className={cx("mt-1.5 text-lg font-semibold tracking-[-0.04em]", isDarkMode ? "text-white" : "text-slate-900")}>{filteredTasks.length}</div>
                  </div>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard isDarkMode={isDarkMode} className={cx("overflow-visible", isDarkMode ? "bg-[#101720]/95" : "bg-white/95")}>
              <div className={cx("border-b px-4 py-4", isDarkMode ? "border-white/10" : "border-slate-200/80")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={cx("text-[11px] font-semibold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                      Task Feed
                    </div>
                    <h2 className={cx("mt-1.5 text-[1.15rem] font-semibold tracking-[-0.03em]", isDarkMode ? "text-white" : "text-slate-900")}>
                      Swipe-friendly list
                    </h2>
                  </div>
                  <div className={cx("rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-white/[0.06] text-slate-200" : "bg-slate-100 text-slate-700")}>
                    {filteredTasks.length} visible
                  </div>
                </div>
              </div>

              <div className="px-4 py-4">
                {filteredTasks.length === 0 ? (
                  <EmptyState
                    title="No tasks match these filters"
                    description="Try broadening the ownership or date filters to bring more work back into view."
                    isDarkMode={isDarkMode}
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredTasks.map(task => {
                      const taskId = String(task.id || task.timestamp || "")
                      return (
                        <TaskItem
                          key={taskId || `${task.message}-${task.timestamp}`}
                          task={task}
                          channelName={channelNames.get(String(task.channel_id))}
                          currentUserId={currentUserId}
                          isDarkMode={isDarkMode}
                          isWorking={completingTaskId === taskId}
                          isCompact
                          onComplete={onMarkTaskComplete}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </SurfaceCard>
          </div>
        </section>

        <section
          className={cx(
            "hidden min-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-[28px] border md:flex",
            isDarkMode ? "border-white/10 bg-[#101720]" : "border-white/70 bg-white/88 shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
          )}
        >
          <div className={cx("border-b px-4 py-4 sm:px-5 lg:px-6", isDarkMode ? "border-white/10" : "border-slate-200/80")}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  {typeof onBackHome === "function" && (
                    <button
                      onClick={onBackHome}
                      className={cx(
                        "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                        isDarkMode ? "border-[#2d323a] bg-[#121821] text-slate-200 hover:bg-[#17202a]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        fastTransition
                      )}
                      title="Back"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  )}

                  <div className="min-w-0">
                    <div className={cx("text-[11px] font-semibold uppercase tracking-[0.22em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                      Workspace Tasks
                    </div>
                    <h1 className={cx("mt-1.5 text-[1.45rem] font-semibold tracking-[-0.04em] sm:text-[1.6rem]", isDarkMode ? "text-white" : "text-slate-950")}>
                      Tasks
                    </h1>
                    <p className={cx("mt-1.5 max-w-2xl text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-600")}>
                      Track assignments, delegated work, and follow-ups across the workspace in one focused queue.
                    </p>
                    {workspaceFallback && (
                      <div className={cx("mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-medium", isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-slate-100 text-slate-600")}>
                        Showing visible workspace tasks because none are mapped directly to your profile yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-4">
                <SummaryMetric label="Total" value={totalCount} isDarkMode={isDarkMode} />
                <SummaryMetric label="Completed" value={completedCount} tone="success" isDarkMode={isDarkMode} />
                <SummaryMetric label="Pending" value={pendingCount} tone="warning" isDarkMode={isDarkMode} />
                <SummaryMetric label="Completion" value={`${completionRate}%`} isDarkMode={isDarkMode} />
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 px-4 py-4 sm:px-5 sm:py-5 lg:px-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
              <SurfaceCard isDarkMode={isDarkMode} className={cx(isDarkMode ? "bg-[#111922]" : "bg-white")}>
                <div className="px-4 py-4">
                  <div className={cx("text-[11px] font-semibold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                    Controls
                  </div>
                  <h2 className={cx("mt-2 text-lg font-semibold tracking-[-0.03em]", isDarkMode ? "text-white" : "text-slate-900")}>
                    Refine the queue
                  </h2>
                  <div className="mt-4 space-y-3.5">
                    <FilterField icon={<ListFilter className="h-4 w-4" />} label="Ownership" value={ownershipFilter} onChange={setOwnershipFilter} options={ownershipOptions} isDarkMode={isDarkMode} />
                    <FilterField icon={<CheckCircle className="h-4 w-4" />} label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} isDarkMode={isDarkMode} />
                    <FilterField icon={<CalendarDays className="h-4 w-4" />} label="Date" value={dateFilter} onChange={setDateFilter} options={dateOptions} isDarkMode={isDarkMode} />
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard isDarkMode={isDarkMode} className={cx(isDarkMode ? "bg-[#111922]" : "bg-white")}>
                <div className="px-4 py-4">
                  <div className={cx("text-[11px] font-semibold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                    Overview
                  </div>
                  <div className="mt-4 space-y-4">
                    <InsightRow label="Assigned to me" value={assignedTasks.length} note="Tasks where you are an assignee." isDarkMode={isDarkMode} />
                    <InsightRow label="Created by me" value={createdTasks.length} note="Items you opened or delegated." isDarkMode={isDarkMode} />
                    <InsightRow label="Visible now" value={filteredTasks.length} note="Tasks matching the active filters." isDarkMode={isDarkMode} />
                  </div>

                  <div className="mt-5 rounded-[18px] border px-3.5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className={cx("text-sm font-semibold", isDarkMode ? "text-slate-100" : "text-slate-900")}>Completion</div>
                      <div className={cx("text-sm font-semibold", isDarkMode ? "text-slate-100" : "text-slate-900")}>{completionRate}%</div>
                    </div>
                    <div className={cx("mt-3 h-2 overflow-hidden rounded-full", isDarkMode ? "bg-[#232931]" : "bg-slate-200")}>
                      <div className={cx("h-full rounded-full", isDarkMode ? "bg-slate-100" : "bg-slate-900", fastTransition)} style={{ width: `${completionRate}%` }} />
                    </div>
                  </div>
                </div>
              </SurfaceCard>
            </aside>

            <main className="min-h-0">
              <SurfaceCard isDarkMode={isDarkMode} className={cx("flex min-h-full flex-col", isDarkMode ? "bg-[#111922]" : "bg-white")}>
                <div className={cx("border-b px-4 py-4 sm:px-5", isDarkMode ? "border-[#2a313a]" : "border-slate-200/80")}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                      <div className={cx("text-[11px] font-semibold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                        Task Feed
                      </div>
                      <h2 className={cx("mt-1.5 text-[1.2rem] font-semibold tracking-[-0.03em]", isDarkMode ? "text-white" : "text-slate-900")}>
                        Full workspace list
                      </h2>
                      <p className={cx("mt-1.5 text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-500")}>
                        Search, filter, and close out work without leaving the main queue.
                      </p>
                    </div>
                    <div className={cx("inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-white/[0.05] text-slate-200" : "bg-slate-100 text-slate-700")}>
                      {filteredTasks.length} visible
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(160px,1fr))]">
                    <SearchField value={searchQuery} onChange={setSearchQuery} isDarkMode={isDarkMode} />
                    <FilterField icon={<UserPlus className="h-4 w-4" />} label="Ownership" value={ownershipFilter} onChange={setOwnershipFilter} options={ownershipOptions} isDarkMode={isDarkMode} />
                    <FilterField icon={<CheckCircle className="h-4 w-4" />} label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} isDarkMode={isDarkMode} />
                    <FilterField icon={<CalendarDays className="h-4 w-4" />} label="Date" value={dateFilter} onChange={setDateFilter} options={dateOptions} isDarkMode={isDarkMode} />
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-5 sm:py-5">
                  {filteredTasks.length === 0 ? (
                    <EmptyState
                      title="No tasks match these filters"
                      description="Try clearing one of the filters or widen the date range to surface more work."
                      isDarkMode={isDarkMode}
                    />
                  ) : (
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {filteredTasks.map(task => {
                        const taskId = String(task.id || task.timestamp || "")
                        return (
                          <TaskItem
                            key={taskId || `${task.message}-${task.timestamp}`}
                            task={task}
                            channelName={channelNames.get(String(task.channel_id))}
                            currentUserId={currentUserId}
                            isDarkMode={isDarkMode}
                            isWorking={completingTaskId === taskId}
                            onComplete={onMarkTaskComplete}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              </SurfaceCard>
            </main>
          </div>
        </section>
      </div>
    </div>
  )
}
