import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  CheckCircle,
  ChevronRight,
  Circle,
  Hash,
  Menu,
  MoreVertical,
  PencilLine,
  Plus,
  Star,
  UserCheck,
} from "lucide-react"

const cx = (...classes) => classes.filter(Boolean).join(" ")

const DEFAULT_TASK_LIST_ID = "my-tasks"
const DEFAULT_TASK_LIST = {
  id: DEFAULT_TASK_LIST_ID,
  title: "My Tasks",
  system: true,
}

const getTaskListsStorageKey = userId => `spaces_task_lists_${userId || "guest"}`
const getHiddenListsStorageKey = userId => `spaces_hidden_task_lists_${userId || "guest"}`

const sanitizeListTitle = value => {
  const title = String(value || "").trim().replace(/\s+/g, " ")
  return title || "Untitled list"
}

const slugifyListTitle = title =>
  sanitizeListTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "list"

const createListId = (title, existingIds = new Set()) => {
  const base = `list-${slugifyListTitle(title)}`
  if (!existingIds.has(base)) return base
  let index = 2
  while (existingIds.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

const normalizeStoredList = list => {
  if (!list || typeof list !== "object") return null
  const id = getEntityId(list.id || list.list_id || list.listId)
  if (!id) return null
  return {
    id,
    title: sanitizeListTitle(list.title || list.name || list.listName || "Untitled list"),
    system: id === DEFAULT_TASK_LIST_ID || Boolean(list.system),
    createdAt: list.createdAt || null,
  }
}

const readStoredLists = storageKey => {
  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(normalizeStoredList).filter(Boolean) : []
  } catch {
    return []
  }
}

const writeStoredLists = (storageKey, lists) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.isArray(lists) ? lists : []))
  } catch {
    // Local list order is a convenience; ignore storage failures.
  }
}

const readHiddenListIds = storageKey => {
  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

const writeHiddenListIds = (storageKey, ids) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.isArray(ids) ? ids : []))
  } catch {
    // Best effort only.
  }
}

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

const getTaskDueValue = task =>
  task?.dueDate || task?.due_at || task?.dueAt || task?.deadline || task?.deadlineAt || null

const formatDueLabel = task => {
  const value = getTaskDueValue(task)
  if (!value) return ""

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const sameDay = (left, right) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()

  const hasTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0
  const time = hasTime
    ? parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : ""

  if (sameDay(parsed, today)) return time ? `Today, ${time}` : "Today"
  if (sameDay(parsed, tomorrow)) return time ? `Tomorrow, ${time}` : "Tomorrow"

  const date = parsed.toLocaleDateString([], { month: "short", day: "numeric" })
  return time ? `${date}, ${time}` : date
}

const isTaskOverdue = task => {
  const value = getTaskDueValue(task)
  if (!value || task.status === "completed") return false
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) && parsed < Date.now()
}

const sortTasks = tasks =>
  [...tasks].sort((left, right) => {
    const leftRank = left.status === "completed" ? 1 : 0
    const rightRank = right.status === "completed" ? 1 : 0
    if (leftRank !== rightRank) return leftRank - rightRank

    const leftDue = new Date(getTaskDueValue(left) || 0).getTime() || 0
    const rightDue = new Date(getTaskDueValue(right) || 0).getTime() || 0
    if (leftDue && rightDue && leftDue !== rightDue) return leftDue - rightDue
    if (leftDue !== rightDue) return rightDue - leftDue

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
  const rawAssigneeStatuses = task.assignee_statuses || task.assigneeStatuses || {}
  const hiddenForIds = (Array.isArray(task.hidden_for)
    ? task.hidden_for
    : Array.isArray(task.hiddenFor)
      ? task.hiddenFor
      : []
  ).map(item => getEntityId(item)).filter(Boolean)
  const assigneeStatuses = Object.fromEntries(
    assigneeIds.map(assigneeId => {
      const existing = rawAssigneeStatuses?.[assigneeId] || rawAssigneeStatuses?.[String(assigneeId)] || {}
      const status = existing?.status === "completed" || task.status === "completed" ? "completed" : "pending"
      return [
        assigneeId,
        {
          ...existing,
          status,
          completedAt: existing?.completedAt || existing?.completed_at || (status === "completed" ? task.completedAt || task.completed_at || null : null),
        },
      ]
    })
  )
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
    channelName: task.channelName || task.channel_name || null,
    spaceId: task.spaceId || task.space_id || null,
    spaceName: task.spaceName || task.space_name || null,
    list_id: task.list_id || task.listId || null,
    listName: task.listName || task.list || null,
    sourceMessageId: task.sourceMessageId || null,
    assignee_statuses: assigneeStatuses,
    hidden_for: hiddenForIds,
    hiddenForIds,
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
      assignee_statuses: message.assignee_statuses || message.assigneeStatuses || {},
      created_by: message.userId,
      status: message.taskStatus || message.status || "pending",
      hidden_for: message.hidden_for || message.hiddenFor || [],
      channel_id: message.channel_id || message.channelId || null,
      channelName: message.channelName || message.channel_name || null,
      spaceId: message.spaceId || message.space_id || null,
      spaceName: message.spaceName || message.space_name || null,
      list_id: message.list_id || message.listId || null,
      listName: message.listName || message.list || null,
      sourceMessageId: message.id,
    },
    "message"
  )
}

const getTaskSubtasks = task => {
  const candidates = task?.subtasks || task?.children || task?.steps || []
  return Array.isArray(candidates) ? candidates : []
}

const isTaskStarred = task => Boolean(task?.starred || task?.isStarred || task?.starred_at || task?.starredAt)

const getAssigneeStatuses = task => {
  const raw = task?.assignee_statuses || task?.assigneeStatuses || task?.assigneeStatus || {}
  return raw && typeof raw === "object" ? raw : {}
}

const getAssigneeStatus = (task, userId) => {
  const key = getEntityId(userId)
  const item = getAssigneeStatuses(task)[key] || {}
  return item?.status === "completed" ? "completed" : "pending"
}

const areAllAssigneesComplete = task => {
  const assigned = Array.isArray(task?.assigneeIds) ? task.assigneeIds : []
  if (assigned.length === 0) return task?.status === "completed"
  return assigned.every(userId => getAssigneeStatus(task, userId) === "completed")
}

const getViewerTaskStatus = (task, viewerId) => {
  const currentUserId = getEntityId(viewerId)
  if (!task) return "pending"
  if (task.createdById === currentUserId && task.assigneeIds?.length > 0) {
    return areAllAssigneesComplete(task) ? "completed" : "pending"
  }
  if (task.assigneeIds?.includes(currentUserId)) return getAssigneeStatus(task, currentUserId)
  return task.status === "completed" ? "completed" : "pending"
}

const canViewerCompleteTask = (task, viewerId) => {
  const currentUserId = getEntityId(viewerId)
  if (!currentUserId || !task || getViewerTaskStatus(task, currentUserId) === "completed") return false
  if (task.assigneeIds?.length > 0) return task.assigneeIds.includes(currentUserId)
  return task.createdById === currentUserId
}

const getTaskListId = task => {
  const rawId = getEntityId(task?.list_id || task?.listId)
  if (rawId) return rawId
  return DEFAULT_TASK_LIST_ID
}

const getTaskListTitle = task => sanitizeListTitle(task?.listName || task?.list || "Untitled list")

const sortTasksForList = (tasks, mode = "my-order", viewerId = "") => {
  const base = [...tasks]
  const incompleteRank = task => (getViewerTaskStatus(task, viewerId) === "completed" ? 1 : 0)

  if (mode === "title") {
    return base.sort((left, right) => {
      const statusDiff = incompleteRank(left) - incompleteRank(right)
      if (statusDiff) return statusDiff
      return String(left.message || "").localeCompare(String(right.message || ""))
    })
  }

  if (mode === "date") {
    return base.sort((left, right) => {
      const statusDiff = incompleteRank(left) - incompleteRank(right)
      if (statusDiff) return statusDiff
      const leftTime = new Date(left.timestamp || left.createdAt || 0).getTime() || 0
      const rightTime = new Date(right.timestamp || right.createdAt || 0).getTime() || 0
      return rightTime - leftTime
    })
  }

  if (mode === "deadline") {
    return base.sort((left, right) => {
      const statusDiff = incompleteRank(left) - incompleteRank(right)
      if (statusDiff) return statusDiff
      const leftDue = new Date(getTaskDueValue(left) || 0).getTime() || Number.MAX_SAFE_INTEGER
      const rightDue = new Date(getTaskDueValue(right) || 0).getTime() || Number.MAX_SAFE_INTEGER
      if (leftDue !== rightDue) return leftDue - rightDue
      return String(left.message || "").localeCompare(String(right.message || ""))
    })
  }

  if (mode === "starred") {
    return base.sort((left, right) => {
      const statusDiff = incompleteRank(left) - incompleteRank(right)
      if (statusDiff) return statusDiff
      const leftStarred = new Date(left.starred_at || left.starredAt || 0).getTime() || (isTaskStarred(left) ? 1 : 0)
      const rightStarred = new Date(right.starred_at || right.starredAt || 0).getTime() || (isTaskStarred(right) ? 1 : 0)
      if (leftStarred !== rightStarred) return rightStarred - leftStarred
      return String(left.message || "").localeCompare(String(right.message || ""))
    })
  }

  return sortTasks(base)
}

function SidebarButton({ icon, label, count, active, indicatorCount = 0, onClick }) {
  return (
    <button type="button" onClick={onClick} className={cx("tasks-sidebar-nav-button", active && "is-active")}>
      <span className="tasks-sidebar-nav-icon">{icon}</span>
      <span className="tasks-sidebar-nav-label">{label}</span>
      {indicatorCount > 0 && <span className="tasks-sidebar-new-dot" title={`${indicatorCount} new`} />}
      {Number.isFinite(count) && <span className="tasks-sidebar-count">{count}</span>}
    </button>
  )
}

function TaskSidebar({
  activeScope,
  listGroups,
  totalCount,
  starredCount,
  assignedCount,
  assignedNewCount = 0,
  createdCount,
  onBackHome,
  onCreateTask,
  onCreateList,
  onScopeChange,
}) {
  const listOptions = listGroups.map(group => ({ id: group.id, title: group.title }))
  return (
    <aside className="tasks-workspace-sidebar">
      <div className="tasks-sidebar-header">
        {typeof onBackHome === "function" && (
          <button type="button" className="tasks-sidebar-menu-button" onClick={onBackHome} title="Back" aria-label="Back">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="tasks-sidebar-title-wrap">
          <span className="tasks-sidebar-app-icon">
            <Check className="h-5 w-5" />
          </span>
          <h1>Tasks</h1>
        </div>
      </div>

      <button type="button" className="tasks-sidebar-create" onClick={() => onCreateTask?.(DEFAULT_TASK_LIST, listOptions)}>
        <Plus className="h-5 w-5" />
        <span>Create</span>
      </button>

      <nav className="tasks-sidebar-nav" aria-label="Task views">
        <SidebarButton
          icon={<CheckCircle className="h-4 w-4" />}
          label="All tasks"
          count={totalCount}
          active={activeScope === "all"}
          onClick={() => onScopeChange("all")}
        />
        <SidebarButton
          icon={<Star className="h-4 w-4" />}
          label="Starred"
          count={starredCount}
          active={activeScope === "starred"}
          onClick={() => onScopeChange("starred")}
        />
        <SidebarButton
          icon={<UserCheck className="h-4 w-4" />}
          label="Assigned"
          count={assignedCount}
          indicatorCount={assignedNewCount}
          active={activeScope === "assigned"}
          onClick={() => onScopeChange("assigned")}
        />
        <SidebarButton
          icon={<PencilLine className="h-4 w-4" />}
          label="Created"
          count={createdCount}
          active={activeScope === "created"}
          onClick={() => onScopeChange("created")}
        />
      </nav>

      <div className="tasks-sidebar-section">
        <div className="tasks-sidebar-section-title">
          <span>Lists</span>
          <ChevronRight className="h-4 w-4 rotate-90" />
        </div>
        <div className="tasks-sidebar-list">
          {listGroups.map(group => (
            <button
              type="button"
              key={group.id}
              className={cx("tasks-sidebar-list-button", activeScope === `list:${group.id}` && "is-active")}
              onClick={() => onScopeChange(`list:${group.id}`)}
            >
              <span className="tasks-sidebar-list-icon">
                <Check className="h-4 w-4" />
              </span>
              <span className="tasks-sidebar-list-name">{group.title}</span>
              <span className="tasks-sidebar-list-count">{group.tasks.length}</span>
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="tasks-sidebar-new-list" onClick={onCreateList}>
        <Plus className="h-4 w-4" />
        <span>Create new list</span>
      </button>
    </aside>
  )
}

function TaskRow({
  task,
  channelName,
  currentUserId,
  membersById,
  isWorking,
  onComplete,
  onOpen,
}) {
  const isCompleted = getViewerTaskStatus(task, currentUserId) === "completed"
  const canComplete = canViewerCompleteTask(task, currentUserId)
  const dueLabel = formatDueLabel(task)
  const subtasks = getTaskSubtasks(task)
  const assigneeNames = (task.assigneeIds || []).map(userId => {
    const member = membersById.get(String(userId))
    return member?.name || member?.email || (String(userId) === String(currentUserId) ? "You" : String(userId))
  })
  const openTask = () => onOpen?.(task)
  const handleKeyDown = event => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    openTask()
  }

  return (
    <div
      className={cx("tasks-card-task", isCompleted && "is-completed")}
      onClick={openTask}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <button
        type="button"
        className={cx("tasks-card-task-check", isCompleted && "is-completed", isWorking && "is-working")}
        disabled={!canComplete || isWorking}
        onClick={event => {
          event.stopPropagation()
          onComplete?.(task)
        }}
        aria-label={isCompleted ? "Task completed" : canComplete ? "Mark task complete" : "Only assigned members can complete this task"}
        title={isCompleted ? "Task completed" : canComplete ? "Mark task complete" : "Only assigned members can complete this task"}
      >
        {isCompleted && <Check className="h-3.5 w-3.5" />}
      </button>

      <div className="tasks-card-task-body">
        <div className="tasks-card-task-title">{task.message}</div>
        <div className="tasks-card-task-meta">
          {dueLabel && (
            <span className={cx("tasks-card-due-pill", isTaskOverdue(task) && "is-overdue")}>
              {dueLabel}
            </span>
          )}
          {channelName && (
            <span className="tasks-card-channel-pill">
              <Hash className="h-3 w-3" />
              {channelName}
            </span>
          )}
          {assigneeNames.length > 0 && (
            <span className="tasks-card-assignee-pill">
              <UserCheck className="h-3 w-3" />
              {assigneeNames.length === 1 ? assigneeNames[0] : `${assigneeNames.length} assigned`}
            </span>
          )}
        </div>

        {subtasks.length > 0 && (
          <div className="tasks-card-subtasks">
            {subtasks.slice(0, 3).map((subtask, index) => (
              <div key={subtask.id || subtask.text || index} className="tasks-card-subtask">
                <Circle className="h-4 w-4" />
                <span>{subtask.text || subtask.message || subtask.title || "Subtask"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskEmptyState() {
  return (
    <div className="tasks-list-empty-state">
      <div className="tasks-list-empty-art" aria-hidden="true">
        <span className="tasks-list-empty-check" />
        <span className="tasks-list-empty-dot" />
        <span className="tasks-list-empty-line" />
        <span className="tasks-list-empty-paper" />
      </div>
      <div className="tasks-list-empty-title">No tasks yet</div>
      <div className="tasks-list-empty-copy">Add your to-dos and keep track of them across Google Workspace</div>
    </div>
  )
}

function TaskListMenu({
  group,
  sortMode,
  onSortChange,
  onRename,
  onDelete,
  onMoveFirst,
  onPrint,
  onDeleteCompleted,
}) {
  const sortOptions = [
    ["my-order", "My order"],
    ["date", "Date"],
    ["deadline", "Deadline"],
    ["starred", "Starred recently"],
    ["title", "Title"],
  ]
  const isDefaultList = group.id === DEFAULT_TASK_LIST_ID
  const completedCount = group.tasks.filter(task => getViewerTaskStatus(task, group.viewerId) === "completed").length

  return (
    <div className="tasks-list-menu" role="menu" aria-label={`${group.title} list actions`}>
      <div className="tasks-list-menu-label">Sort by</div>
      {sortOptions.map(([value, label]) => (
        <button
          type="button"
          key={value}
          className="tasks-list-menu-item"
          onClick={() => onSortChange(value)}
          role="menuitem"
        >
          <span className="tasks-list-menu-check">{sortMode === value && <Check className="h-4 w-4" />}</span>
          <span>{label}</span>
        </button>
      ))}

      <div className="tasks-list-menu-separator" />

      <button type="button" className="tasks-list-menu-item" onClick={onRename} role="menuitem">
        <span>Rename list</span>
      </button>
      <button
        type="button"
        className="tasks-list-menu-item"
        disabled={isDefaultList}
        onClick={onDelete}
        role="menuitem"
      >
        <span className="tasks-list-menu-item-text">
          <span>Delete list</span>
          {isDefaultList && <small>The default list can't be deleted</small>}
        </span>
      </button>
      <button type="button" className="tasks-list-menu-item" onClick={onMoveFirst} role="menuitem">
        <span>Move list to first position</span>
      </button>

      <div className="tasks-list-menu-separator" />

      <button type="button" className="tasks-list-menu-item" onClick={onPrint} role="menuitem">
        <span>Print list</span>
      </button>
      <button
        type="button"
        className="tasks-list-menu-item"
        disabled={completedCount === 0}
        onClick={onDeleteCompleted}
        role="menuitem"
      >
        <span>Delete all completed tasks</span>
      </button>
      <button type="button" className="tasks-list-menu-item" disabled role="menuitem">
        <span>Clean up old tasks</span>
      </button>
    </div>
  )
}

function TaskListCard({
  group,
  channelNames,
  currentUserId,
  membersById,
  listOptions,
  completingTaskId,
  menuOpen,
  sortMode,
  completedOpen,
  onCreateTask,
  onMarkTaskComplete,
  onOpenTask,
  onToggleMenu,
  onToggleCompleted,
  onSortChange,
  onRenameList,
  onDeleteList,
  onMoveListFirst,
  onPrintList,
  onDeleteCompleted,
}) {
  const pendingTasks = group.tasks.filter(task => getViewerTaskStatus(task, currentUserId) !== "completed")
  const completedTasks = group.tasks.filter(task => getViewerTaskStatus(task, currentUserId) === "completed")
  const canManageList = !group.virtual
  const createTargetList = group.sourceList || (group.virtual ? DEFAULT_TASK_LIST : group)

  return (
    <section className="tasks-list-card">
      <div className="tasks-list-card-header">
        <h2>{group.title}</h2>
        {canManageList && (
          <button
            type="button"
            className="tasks-list-more"
            aria-label={`${group.title} actions`}
            aria-expanded={menuOpen}
            title={`${group.title} actions`}
            onClick={onToggleMenu}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
        {canManageList && menuOpen && (
          <TaskListMenu
            group={group}
            sortMode={sortMode}
            onSortChange={onSortChange}
            onRename={onRenameList}
            onDelete={onDeleteList}
            onMoveFirst={onMoveListFirst}
            onPrint={onPrintList}
            onDeleteCompleted={onDeleteCompleted}
          />
        )}
      </div>

      <button type="button" className="tasks-list-add-task" onClick={() => onCreateTask?.(createTargetList, listOptions)}>
        <span className="tasks-list-add-icon">
          <CheckCircle className="h-4 w-4" />
        </span>
        <span>Add a task</span>
      </button>

      <div className="tasks-list-items">
        {pendingTasks.length === 0 && completedTasks.length === 0 ? (
          <TaskEmptyState />
        ) : (
          pendingTasks.map(task => {
            const taskId = String(task.id || task.timestamp || "")
            return (
              <TaskRow
                key={taskId || `${group.id}-${task.message}`}
                task={task}
                currentUserId={currentUserId}
                membersById={membersById}
                channelName={channelNames.get(String(task.channel_id))}
                isWorking={completingTaskId === taskId}
                onComplete={onMarkTaskComplete}
                onOpen={onOpenTask}
              />
            )
          })
        )}
      </div>

      {completedTasks.length > 0 && (
        <button
          type="button"
          className={cx("tasks-list-completed", completedOpen && "is-open")}
          aria-expanded={completedOpen}
          onClick={onToggleCompleted}
        >
          <ChevronRight className="h-4 w-4" />
          <span>Completed ({completedTasks.length})</span>
        </button>
      )}

      {completedOpen && completedTasks.length > 0 && (
        <div className="tasks-list-items tasks-list-completed-items">
          {completedTasks.map(task => {
            const taskId = String(task.id || task.timestamp || "")
            return (
              <TaskRow
                key={taskId || `${group.id}-completed-${task.message}`}
                task={task}
                currentUserId={currentUserId}
                membersById={membersById}
                channelName={channelNames.get(String(task.channel_id))}
                isWorking={completingTaskId === taskId}
                onComplete={onMarkTaskComplete}
                onOpen={onOpenTask}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

function TaskDetailsSidebar({ task, currentUserId, membersById, channelDetails, onClose }) {
  if (!task) return null
  const creator = membersById.get(String(task.createdById))
  const listTitle = task.listName || "My Tasks"
  const channel = channelDetails.get(String(task.channel_id))
  const resolvedSpaceName = task.spaceName || channel?.spaceName || ""
  const resolvedChannelName = task.channelName || channel?.name || ""
  const channelLabel = resolvedChannelName
    ? resolvedChannelName === "Direct message" || resolvedChannelName.startsWith("#")
      ? resolvedChannelName
      : `#${resolvedChannelName}`
    : "No linked channel"
  const createdDate = task.timestamp
    ? new Date(task.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : ""

  return (
    <aside className="tasks-detail-sidebar">
      <div className="tasks-detail-header">
        <div>
          <div className="tasks-detail-eyebrow">{listTitle}</div>
          <h2>{task.message}</h2>
        </div>
        <button type="button" className="tasks-detail-close" onClick={onClose} aria-label="Close task details">
          ×
        </button>
      </div>

      <section className="tasks-detail-section">
        <h3>Assigned</h3>
        <div className="tasks-detail-people">
          {(task.assigneeIds || []).length > 0 ? (
            task.assigneeIds.map(userId => {
              const member = membersById.get(String(userId))
              const status = getAssigneeStatus(task, userId)
              return (
                <div key={userId} className="tasks-detail-person">
                  <span className={cx("tasks-detail-status-dot", status === "completed" && "is-complete")} />
                  <span>{String(userId) === String(currentUserId) ? "You" : member?.name || member?.email || userId}</span>
                  <strong>{status === "completed" ? "Done" : "Not done"}</strong>
                </div>
              )
            })
          ) : (
            <div className="tasks-detail-muted">No assignees</div>
          )}
        </div>
      </section>

      <section className="tasks-detail-section">
        <h3>Location</h3>
        <div className="tasks-detail-location-list">
          <div className="tasks-detail-location-row">
            <span>Space</span>
            <strong>{resolvedSpaceName || "No linked space"}</strong>
          </div>
          <div className="tasks-detail-location-row">
            <span>Channel</span>
            <strong>{channelLabel}</strong>
          </div>
        </div>
      </section>

      <section className="tasks-detail-section">
        <h3>Created</h3>
        <div className="tasks-detail-person">
          <span className="tasks-detail-status-dot is-created" />
          <span>{String(task.createdById) === String(currentUserId) ? "You" : creator?.name || creator?.email || task.createdById || "Unknown"}</span>
          <strong>{createdDate}</strong>
        </div>
      </section>
    </aside>
  )
}

export default function TasksHub({
  isDarkMode = false,
  tasks = [],
  messages = {},
  currentUser,
  members = [],
  channels = [],
  completingTaskId = null,
  onBackHome,
  onCreateTask,
  onMarkTaskComplete,
  onDeleteCompletedTasks,
  assignedNewCount = 0,
  onAssignedScopeOpen,
  focusTaskId = null,
}) {
  const currentUserId = getEntityId(currentUser?.id || currentUser?._id || currentUser?.userId)
  const listStorageKey = useMemo(() => getTaskListsStorageKey(currentUserId), [currentUserId])
  const hiddenListsStorageKey = useMemo(() => getHiddenListsStorageKey(currentUserId), [currentUserId])
  const [activeScope, setActiveScope] = useState("all")
  const [storedLists, setStoredLists] = useState(() => readStoredLists(listStorageKey))
  const [hiddenListIds, setHiddenListIds] = useState(() => readHiddenListIds(hiddenListsStorageKey))
  const [hiddenCompletedTaskIds, setHiddenCompletedTaskIds] = useState([])
  const [listSorts, setListSorts] = useState({})
  const [completedOpenByList, setCompletedOpenByList] = useState({})
  const [openListMenuId, setOpenListMenuId] = useState(null)
  const boardRef = useRef(null)
  const dragStateRef = useRef(null)
  const draggedBoardRef = useRef(false)
  const [selectedTaskId, setSelectedTaskId] = useState(null)

  useEffect(() => {
    if (!focusTaskId) return
    setSelectedTaskId(String(focusTaskId))
    setActiveScope("assigned")
  }, [focusTaskId])

  const membersById = useMemo(() => {
    const lookup = new Map()
    ;(members || []).forEach(member => {
      const id = getEntityId(member?.id || member?._id || member?.userId)
      if (!id) return
      lookup.set(id, { ...(lookup.get(id) || {}), ...member, id })
    })
    if (currentUserId) lookup.set(currentUserId, { ...(lookup.get(currentUserId) || {}), ...(currentUser || {}), id: currentUserId })
    return lookup
  }, [currentUser, currentUserId, members])

  useEffect(() => {
    setStoredLists(readStoredLists(listStorageKey))
  }, [listStorageKey])

  useEffect(() => {
    setHiddenListIds(readHiddenListIds(hiddenListsStorageKey))
  }, [hiddenListsStorageKey])

  useEffect(() => {
    if (!openListMenuId || typeof document === "undefined") return undefined

    const closeMenu = event => {
      if (event.target?.closest?.(".tasks-list-menu, .tasks-list-more")) return
      setOpenListMenuId(null)
    }

    document.addEventListener("pointerdown", closeMenu)
    return () => document.removeEventListener("pointerdown", closeMenu)
  }, [openListMenuId])

  const persistStoredLists = updater => {
    setStoredLists(prev => {
      const nextValue = typeof updater === "function" ? updater(prev) : updater
      const seen = new Set()
      const next = (Array.isArray(nextValue) ? nextValue : [])
        .map(normalizeStoredList)
        .filter(list => {
          if (!list || seen.has(list.id)) return false
          seen.add(list.id)
          return true
        })
      writeStoredLists(listStorageKey, next)
      return next
    })
  }

  const persistHiddenListIds = updater => {
    setHiddenListIds(prev => {
      const nextValue = typeof updater === "function" ? updater(prev) : updater
      const next = Array.from(new Set((Array.isArray(nextValue) ? nextValue : []).map(String).filter(Boolean)))
      writeHiddenListIds(hiddenListsStorageKey, next)
      return next
    })
  }

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

  const channelDetails = useMemo(
    () => new Map((channels || []).map(channel => [String(channel?.id), {
      id: channel?.id,
      name: channel?.name || "channel",
      spaceId: channel?.spaceId || channel?.space_id || null,
      spaceName: channel?.spaceName || channel?.space_name || channel?.space?.name || "",
    }])),
    [channels]
  )
  const channelNames = useMemo(
    () => new Map(Array.from(channelDetails.entries()).map(([id, channel]) => [id, channel.name])),
    [channelDetails]
  )

  const scopedTasks = useMemo(() => {
    const mine = allTasks.filter(task =>
      task.assigneeIds.includes(currentUserId) || task.createdById === currentUserId
    )
    return currentUserId ? mine : allTasks
  }, [allTasks, currentUserId])

  const visibleScopedTasks = useMemo(() => {
    const hiddenTaskSet = new Set(hiddenCompletedTaskIds)
    return scopedTasks.filter(task => {
      const taskId = String(task.id || task.timestamp || "")
      if (currentUserId && (task.hiddenForIds || []).includes(currentUserId)) return false
      return !taskId || !hiddenTaskSet.has(taskId)
    })
  }, [currentUserId, hiddenCompletedTaskIds, scopedTasks])

  const assignedTasks = useMemo(
    () => visibleScopedTasks.filter(task => task.assigneeIds.includes(currentUserId)),
    [currentUserId, visibleScopedTasks]
  )
  const createdTasks = useMemo(
    () => visibleScopedTasks.filter(task => task.createdById === currentUserId),
    [currentUserId, visibleScopedTasks]
  )

  const taskLists = useMemo(() => {
    const hiddenSet = new Set(hiddenListIds)
    const defsById = new Map()
    const addList = list => {
      const normalized = normalizeStoredList(list)
      if (!normalized || hiddenSet.has(normalized.id)) return
      defsById.set(normalized.id, {
        ...normalized,
        system: normalized.id === DEFAULT_TASK_LIST_ID || normalized.system,
      })
    }

    if (storedLists.length > 0) {
      storedLists.forEach(addList)
    } else {
      addList(DEFAULT_TASK_LIST)
    }

    if (!defsById.has(DEFAULT_TASK_LIST_ID)) {
      addList(DEFAULT_TASK_LIST)
    }

    visibleScopedTasks.forEach(task => {
      const listId = getTaskListId(task)
      if (listId === DEFAULT_TASK_LIST_ID || hiddenSet.has(listId) || defsById.has(listId)) return
      defsById.set(listId, {
        id: listId,
        title: getTaskListTitle(task),
        system: false,
        createdAt: task.timestamp || null,
      })
    })

    return Array.from(defsById.values())
  }, [hiddenListIds, storedLists, visibleScopedTasks])

  const listGroups = useMemo(() => {
    const groupsById = new Map(taskLists.map(list => [list.id, { ...list, tasks: [] }]))
    const knownListIds = new Set(taskLists.map(list => list.id))

    visibleScopedTasks.forEach(task => {
      const listId = getTaskListId(task)
      const targetId = knownListIds.has(listId) ? listId : DEFAULT_TASK_LIST_ID
      const targetGroup = groupsById.get(targetId)
      if (targetGroup) targetGroup.tasks.push(task)
    })

    return taskLists.map(list => {
      const group = groupsById.get(list.id) || { ...list, tasks: [] }
      return {
        ...group,
        viewerId: currentUserId,
        tasks: sortTasksForList(group.tasks, listSorts[group.id] || "my-order", currentUserId),
      }
    })
  }, [currentUserId, listSorts, taskLists, visibleScopedTasks])

  const starredTasks = useMemo(() => visibleScopedTasks.filter(isTaskStarred), [visibleScopedTasks])
  const selectedTask = useMemo(
    () => visibleScopedTasks.find(task => String(task.id || task.timestamp || "") === String(selectedTaskId)) || null,
    [selectedTaskId, visibleScopedTasks]
  )
  const selectedGroup = activeScope.startsWith("list:")
    ? listGroups.find(group => `list:${group.id}` === activeScope)
    : null

  const buildScopedListGroups = (scope, fallbackTitle, predicate) => {
    const scopedGroups = listGroups
      .map(group => ({
        ...group,
        id: `${scope}:${group.id}`,
        sourceList: group,
        virtual: true,
        tasks: group.tasks.filter(predicate),
      }))
      .filter(group => group.tasks.length > 0)

    return scopedGroups.length > 0
      ? scopedGroups
      : [{ id: scope, title: fallbackTitle, tasks: [], virtual: true }]
  }

  const visibleGroups =
    activeScope === "starred"
      ? [{ id: "starred", title: "Starred", tasks: starredTasks, virtual: true }]
      : activeScope === "assigned"
        ? buildScopedListGroups("assigned", "Assigned", task => task.assigneeIds.includes(currentUserId))
        : activeScope === "created"
          ? buildScopedListGroups("created", "Created", task => task.createdById === currentUserId)
      : selectedGroup
        ? [selectedGroup]
        : listGroups
  const taskListOptions = taskLists.map(list => ({ id: list.id, title: list.title }))

  useEffect(() => {
    if (activeScope.startsWith("list:") && !selectedGroup) {
      setActiveScope("all")
    }
  }, [activeScope, selectedGroup])

  const handleCreateList = () => {
    const suggestedName = "Untitled list"
    const title = typeof window !== "undefined" ? window.prompt("List name", suggestedName) : suggestedName
    if (title === null) return

    const cleanTitle = sanitizeListTitle(title)
    const existingIds = new Set(taskLists.map(list => list.id))
    const nextList = {
      id: createListId(cleanTitle, existingIds),
      title: cleanTitle,
      system: false,
      createdAt: new Date().toISOString(),
    }

    persistStoredLists(prev => {
      const base = prev.length > 0 ? prev : [DEFAULT_TASK_LIST]
      return [...base, nextList]
    })
    persistHiddenListIds(prev => prev.filter(id => id !== nextList.id))
    setActiveScope("all")
    setOpenListMenuId(null)

    if (typeof window !== "undefined") window.requestAnimationFrame?.(() => {
      if (boardRef.current) {
        boardRef.current.scrollLeft = boardRef.current.scrollWidth
      }
    })
  }

  const ensureListInStoredOrder = group => {
    const source = storedLists.length > 0 ? storedLists : taskLists
    const hasGroup = source.some(list => list.id === group.id)
    return (hasGroup ? source : [...source, group]).map(list => ({
      id: list.id,
      title: list.title,
      system: list.id === DEFAULT_TASK_LIST_ID || Boolean(list.system),
      createdAt: list.createdAt || null,
    }))
  }

  const handleRenameList = group => {
    const title = typeof window !== "undefined" ? window.prompt("Rename list", group.title) : group.title
    if (title === null) return
    const cleanTitle = sanitizeListTitle(title)
    persistStoredLists(prev => {
      const source = prev.length > 0 ? prev : ensureListInStoredOrder(group)
      const exists = source.some(list => list.id === group.id)
      const renamed = { ...group, title: cleanTitle, system: group.id === DEFAULT_TASK_LIST_ID || group.system }
      return exists
        ? source.map(list => (list.id === group.id ? { ...list, title: cleanTitle } : list))
        : [...source, renamed]
    })
    setOpenListMenuId(null)
  }

  const handleDeleteList = group => {
    if (group.id === DEFAULT_TASK_LIST_ID) return
    const confirmed = typeof window === "undefined" || window.confirm(`Delete "${group.title}"? Tasks in it will move back to My Tasks.`)
    if (!confirmed) return
    persistStoredLists(prev => prev.filter(list => list.id !== group.id))
    persistHiddenListIds(prev => [...prev, group.id])
    if (activeScope === `list:${group.id}`) setActiveScope("all")
    setOpenListMenuId(null)
  }

  const handleMoveListFirst = group => {
    persistStoredLists(() => {
      const source = ensureListInStoredOrder(group)
      return [group, ...source.filter(list => list.id !== group.id)]
    })
    setOpenListMenuId(null)
  }

  const handleSortChange = (group, mode) => {
    setListSorts(prev => ({ ...prev, [group.id]: mode }))
    setOpenListMenuId(null)
  }

  const handlePrintList = group => {
    if (typeof window === "undefined") return
    const printWindow = window.open("", "_blank", "width=760,height=840")
    if (!printWindow) {
      window.print()
      setOpenListMenuId(null)
      return
    }

    const rows = group.tasks
      .map(task => `<li>${String(task.message || "Untitled task").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
      }[char]))}</li>`)
      .join("")

    printWindow.document.write(`
      <html>
        <head>
          <title>${group.title}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #202124; padding: 28px; }
            h1 { font-size: 22px; margin: 0 0 18px; }
            li { margin: 10px 0; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>${group.title}</h1>
          <ul>${rows || "<li>No tasks yet</li>"}</ul>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    setOpenListMenuId(null)
  }

  const handleDeleteCompleted = async group => {
    const completedTasks = group.tasks.filter(task => getViewerTaskStatus(task, currentUserId) === "completed")
    const completedIds = completedTasks
      .map(task => String(task.id || task.taskId || task._id || task.timestamp || ""))
      .filter(Boolean)
    if (completedIds.length === 0) return
    setHiddenCompletedTaskIds(prev => Array.from(new Set([...prev, ...completedIds])))
    setCompletedOpenByList(prev => ({ ...prev, [group.id]: false }))
    setOpenListMenuId(null)
    await onDeleteCompletedTasks?.(completedTasks)
  }

  const handleBoardPointerDown = event => {
    if (event.button !== 0) return
    if (event.target?.closest?.("button, input, textarea, select, a, [role='menu'], [contenteditable='true']")) return
    const board = boardRef.current
    if (!board) return

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: board.scrollLeft,
      dragging: false,
    }
    board.setPointerCapture?.(event.pointerId)
  }

  const handleBoardPointerMove = event => {
    const state = dragStateRef.current
    const board = boardRef.current
    if (!state || !board) return

    const deltaX = event.clientX - state.startX
    if (!state.dragging && Math.abs(deltaX) > 4) {
      state.dragging = true
      draggedBoardRef.current = true
      board.classList.add("is-dragging")
    }
    if (!state.dragging) return

    board.scrollLeft = state.scrollLeft - deltaX
    event.preventDefault()
  }

  const endBoardDrag = event => {
    const board = boardRef.current
    if (board && dragStateRef.current) {
      board.releasePointerCapture?.(dragStateRef.current.pointerId || event.pointerId)
      board.classList.remove("is-dragging")
    }
    dragStateRef.current = null
  }

  const handleBoardClickCapture = event => {
    if (!draggedBoardRef.current) return
    event.preventDefault()
    event.stopPropagation()
    draggedBoardRef.current = false
  }

  const handleScopeChange = scope => {
    setActiveScope(scope)
    if (scope === "assigned") onAssignedScopeOpen?.()
  }

  return (
    <div className={cx("tasks-workspace-page", isDarkMode && "is-dark")}>
      <TaskSidebar
        activeScope={activeScope}
        listGroups={listGroups}
        totalCount={scopedTasks.length}
        starredCount={starredTasks.length}
        assignedCount={assignedTasks.length}
        assignedNewCount={assignedNewCount}
        createdCount={createdTasks.length}
        onBackHome={onBackHome}
        onCreateTask={onCreateTask}
        onCreateList={handleCreateList}
        onScopeChange={handleScopeChange}
      />

      <main
        ref={boardRef}
        className="tasks-board-shell"
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={endBoardDrag}
        onPointerCancel={endBoardDrag}
        onClickCapture={handleBoardClickCapture}
      >
        <div className="tasks-board-panel">
          <div className="tasks-board-grid">
            {visibleGroups.map(group => (
              <TaskListCard
                key={group.id}
                group={group}
                channelNames={channelNames}
                currentUserId={currentUserId}
                membersById={membersById}
                listOptions={taskListOptions}
                completingTaskId={completingTaskId}
                menuOpen={openListMenuId === group.id}
                sortMode={listSorts[group.sourceList?.id || group.id] || "my-order"}
                completedOpen={Boolean(completedOpenByList[group.id])}
                onCreateTask={onCreateTask}
                onMarkTaskComplete={onMarkTaskComplete}
                onOpenTask={task => setSelectedTaskId(task.id || task.timestamp || null)}
                onToggleMenu={() => setOpenListMenuId(prev => (prev === group.id ? null : group.id))}
                onToggleCompleted={() => setCompletedOpenByList(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                onSortChange={mode => handleSortChange(group.sourceList || group, mode)}
                onRenameList={() => handleRenameList(group.sourceList || group)}
                onDeleteList={() => handleDeleteList(group.sourceList || group)}
                onMoveListFirst={() => handleMoveListFirst(group.sourceList || group)}
                onPrintList={() => handlePrintList(group)}
                onDeleteCompleted={() => handleDeleteCompleted(group)}
              />
            ))}
          </div>
        </div>
      </main>
      <TaskDetailsSidebar
        task={selectedTask}
        currentUserId={currentUserId}
        membersById={membersById}
        channelDetails={channelDetails}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  )
}
