import React, { useEffect, useState } from 'react'
import * as TasksService from '../services/tasks'

export default function TaskModal({
  visible,
  onClose,
  members = [],
  currentUser,
  spaceId,
  initialTaskText = "",
  initialAssignees = [],
  sourceMessageId = null,
  source = "tasks_section",
  channelId = null,
  channelName = "",
  spaceName = "",
  listId = "my-tasks",
  listName = "My Tasks",
  listOptions = [],
  onTaskCreated,
}) {
  const [selected, setSelected] = useState([])
  const [selectedListId, setSelectedListId] = useState(listId || "my-tasks")
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const initialAssigneesKey = Array.isArray(initialAssignees) ? initialAssignees.map(String).join("\u0001") : ""
  const currentUserId = String(currentUser?.id || currentUser?._id || currentUser?.userId || "")
  const safeListOptions = listOptions.length > 0
    ? listOptions
    : [{ id: listId || "my-tasks", title: listName || "My Tasks" }]
  const selectedList = safeListOptions.find(list => String(list.id) === String(selectedListId)) || safeListOptions[0]

  useEffect(() => {
    if (!visible) return
    setText(initialTaskText || "")
    setSelected(initialAssigneesKey ? initialAssigneesKey.split("\u0001") : currentUserId ? [currentUserId] : [])
    setSelectedListId(listId || "my-tasks")
  }, [currentUserId, initialAssigneesKey, initialTaskText, listId, visible])

  if (!visible) return null

  const toggle = id => {
    const key = String(id)
    setSelected(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])
  }

  const submit = async () => {
    if (!text.trim()) return
    const createdBy = currentUser?.id || currentUser?._id || currentUser?.userId
    const assignedTo = selected.length > 0 ? selected : createdBy ? [String(createdBy)] : []
    const assigneeStatuses = Object.fromEntries(
      assignedTo.map(id => [String(id), { status: 'pending', completedAt: null }])
    )
    const payload = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_by: createdBy,
      assigned_to: assignedTo,
      assignee_statuses: assigneeStatuses,
      message: text,
      space_id: spaceId,
      status: 'pending',
      timestamp: new Date().toISOString(),
      sourceMessageId,
      source,
      channelId: source === "channel" ? channelId : null,
      channel_id: source === "channel" ? channelId : null,
      channelName: source === "channel" ? channelName : "",
      spaceName,
      list_id: selectedList?.id || listId || "my-tasks",
      listName: selectedList?.title || listName || "My Tasks",
    }
    setLoading(true)
    // Optimistic callback
    if (onTaskCreated) onTaskCreated(payload)
    try {
      await TasksService.createTask(payload)
    } catch (e) {
      console.error('create task failed', e)
    } finally {
      setLoading(false)
      setText("")
      setSelected([])
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-6 w-full max-w-md shadow-lg">
        <h3 className="text-lg font-bold mb-3">Create Task</h3>
        <div className="mb-3">
          <label className="block text-xs font-bold mb-1">List</label>
          <select
            className="w-full p-2 border rounded bg-white dark:bg-slate-900"
            value={selectedListId}
            onChange={event => setSelectedListId(event.target.value)}
          >
            {safeListOptions.map(list => (
              <option key={list.id} value={list.id}>{list.title}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-bold mb-1">Assign to</label>
          <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2">
            {members.map(m => (
              <label key={m.id} className="flex items-center gap-2">
                <input type="checkbox" checked={selected.includes(String(m.id))} onChange={() => toggle(m.id)} />
                <span className="ml-1">{m.name || m.email || m.id}</span>
              </label>
            ))}
            {members.length === 0 && <div className="text-sm text-slate-500">No members</div>}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-bold mb-1">Task</label>
          <input className="w-full p-2 border rounded" value={text} onChange={e => setText(e.target.value)} placeholder="Describe the task" />
        </div>

        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 rounded border" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={submit} disabled={loading || !text.trim()}>Create</button>
        </div>
      </div>
    </div>
  )
}
