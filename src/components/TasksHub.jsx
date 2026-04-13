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
        "rounded-xl border px-4 py-3",
        isDarkMode ? "border-[#2a313a] bg-[#14181d]" : "border-slate-200 bg-slate-50"
      )}
    >
      <div className={cx("text-xs font-medium", isDarkMode ? "text-slate-400" : "text-slate-500")}>
        {label}
      </div>
      <div className={cx("mt-1 text-xl font-semibold", toneClass)}>{value}</div>
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
          isDarkMode ? "border-[#2a313a] bg-[#14181d]" : "border-slate-200 bg-slate-50"
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
          isDarkMode ? "border-[#2a313a] bg-[#14181d]" : "border-slate-200 bg-slate-50"
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
  onComplete,
}) {
  const isCompleted = task.status === "completed"
  const isAssignedToCurrentUser = task.assigneeIds.includes(currentUserId)
  const isCreatedByCurrentUser = task.createdById === currentUserId

  return (
    <article
      className={cx(
        "rounded-xl border px-4 py-4 transition-colors",
        isCompleted
          ? isDarkMode
            ? "border-emerald-900/40 bg-emerald-950/20"
            : "border-emerald-100 bg-emerald-50/60"
          : isDarkMode
            ? "border-[#2c333c] bg-[#14181d] hover:border-[#39414c]"
            : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete?.(task)}
          disabled={isCompleted || isWorking}
          className={cx(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors",
            isCompleted
              ? "border-emerald-500 bg-emerald-500 text-white"
              : isDarkMode
                ? "border-[#343b45] bg-[#1c2128] text-slate-300 hover:border-[#4b5563] hover:text-white"
                : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700",
            isWorking ? "cursor-wait opacity-80" : ""
          )}
          title={isCompleted ? "Task completed" : "Mark task as complete"}
        >
          {isCompleted ? <Check className="h-4.5 w-4.5" /> : <CheckCircle className="h-4.5 w-4.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h3
                className={cx(
                  "text-[15px] font-semibold leading-6",
                  isCompleted ? "line-through opacity-70" : "",
                  isDarkMode ? "text-slate-100" : "text-slate-900"
                )}
              >
                {task.message}
              </h3>

              <div className="mt-2 flex flex-wrap items-center gap-2">
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
    <div className={cx("min-h-[100dvh] w-full overflow-y-auto", isDarkMode ? "bg-[#111315] text-slate-100" : "bg-slate-50 text-slate-900")}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1520px] flex-col px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
        <div className="flex flex-col gap-6">
          {typeof onBackHome === "function" && (
            <div className="flex items-center">
              <button
                onClick={onBackHome}
                className={cx(
                  "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                  isDarkMode ? "border-[#2d323a] bg-[#171b21] text-slate-200 hover:bg-[#1b2026]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>
          )}

          <SurfaceCard isDarkMode={isDarkMode}>
            <div className="px-5 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex items-start gap-4">
                    <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", isDarkMode ? "bg-[#20252c] text-slate-100" : "bg-slate-100 text-slate-700")}>
                      <ClipboardList className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h1 className={cx("text-[1.75rem] font-semibold tracking-[-0.02em]", isDarkMode ? "text-slate-100" : "text-slate-900")}>
                        Tasks
                      </h1>
                      <p className={cx("mt-1 max-w-3xl text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-500")}>
                        One unified task list with filters for ownership, status, and date so people can focus without jumping between sections.
                      </p>
                      {workspaceFallback && (
                        <div className={cx("mt-3 inline-flex rounded-md px-3 py-1.5 text-xs font-medium", isDarkMode ? "bg-[#20252c] text-slate-300" : "bg-slate-100 text-slate-600")}>
                          Showing visible workspace tasks because none are mapped directly to your profile yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[360px]">
                  <SummaryMetric label="Total" value={totalCount} isDarkMode={isDarkMode} />
                  <SummaryMetric label="Completed" value={completedCount} tone="success" isDarkMode={isDarkMode} />
                  <SummaryMetric label="Pending" value={pendingCount} tone="warning" isDarkMode={isDarkMode} />
                </div>
              </div>
            </div>
          </SurfaceCard>

          <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <SurfaceCard isDarkMode={isDarkMode}>
                <div className="px-5 py-5">
                  <h2 className={cx("text-sm font-semibold", isDarkMode ? "text-slate-100" : "text-slate-900")}>
                    Overview
                  </h2>
                  <div className="mt-4 space-y-4">
                    <InsightRow label="Assigned to me" value={assignedTasks.length} note="Tasks where you are an assignee." isDarkMode={isDarkMode} />
                    <InsightRow label="Created by me" value={createdTasks.length} note="Items you opened or delegated." isDarkMode={isDarkMode} />
                    <InsightRow label="Filtered results" value={filteredTasks.length} note="Tasks matching the current filter set." isDarkMode={isDarkMode} />
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard isDarkMode={isDarkMode}>
                <div className="px-5 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className={cx("text-sm font-semibold", isDarkMode ? "text-slate-100" : "text-slate-900")}>
                        Progress
                      </h2>
                      <p className={cx("mt-1 text-sm", isDarkMode ? "text-slate-400" : "text-slate-500")}>
                        Completion across the currently visible task source.
                      </p>
                    </div>
                    <div className={cx("text-sm font-semibold", isDarkMode ? "text-slate-100" : "text-slate-900")}>
                      {completionRate}%
                    </div>
                  </div>

                  <div className={cx("mt-4 h-2 overflow-hidden rounded-full", isDarkMode ? "bg-[#232931]" : "bg-slate-200")}>
                    <div className={cx("h-full rounded-full", isDarkMode ? "bg-slate-100" : "bg-slate-900")} style={{ width: `${completionRate}%` }} />
                  </div>

                  <div className="mt-4 space-y-4">
                    <InsightRow label="Completed" value={completedCount} note="Closed and no longer active." isDarkMode={isDarkMode} />
                    <InsightRow label="Pending" value={pendingCount} note="Still requires attention." isDarkMode={isDarkMode} />
                  </div>
                </div>
              </SurfaceCard>
            </aside>

            <main className="space-y-6">
              <SurfaceCard isDarkMode={isDarkMode}>
                <div className={cx("border-b px-5 py-4 sm:px-6", isDarkMode ? "border-[#2a313a]" : "border-slate-200")}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className={cx("text-lg font-semibold", isDarkMode ? "text-slate-100" : "text-slate-900")}>
                        All tasks
                      </h2>
                      <p className={cx("mt-1 text-sm", isDarkMode ? "text-slate-400" : "text-slate-500")}>
                        Filter the full list by who owns the task, current status, or date window.
                      </p>
                    </div>
                    <div className={cx("inline-flex w-fit rounded-md px-2.5 py-1 text-xs font-semibold", isDarkMode ? "bg-[#20252c] text-slate-200" : "bg-slate-100 text-slate-700")}>
                      {filteredTasks.length} results
                    </div>
                  </div>
                </div>

                <div className="px-5 py-5 sm:px-6">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(180px,1fr))]">
                    <SearchField value={searchQuery} onChange={setSearchQuery} isDarkMode={isDarkMode} />
                    <FilterField icon={<ListFilter className="h-4 w-4" />} label="Ownership" value={ownershipFilter} onChange={setOwnershipFilter} options={ownershipOptions} isDarkMode={isDarkMode} />
                    <FilterField icon={<CheckCircle className="h-4 w-4" />} label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} isDarkMode={isDarkMode} />
                    <FilterField icon={<CalendarDays className="h-4 w-4" />} label="Date" value={dateFilter} onChange={setDateFilter} options={dateOptions} isDarkMode={isDarkMode} />
                  </div>

                  <div className="mt-6">
                    {filteredTasks.length === 0 ? (
                      <EmptyState
                        title="No tasks match these filters"
                        description="Try clearing one of the filters or widen the date range to surface more tasks."
                        isDarkMode={isDarkMode}
                      />
                    ) : (
                      <div className="space-y-3 xl:max-h-[calc(100dvh-19rem)] xl:overflow-y-auto xl:pr-1">
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
                </div>
              </SurfaceCard>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
