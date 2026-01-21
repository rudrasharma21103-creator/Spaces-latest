import React, { useState } from 'react'
import * as TasksService from '../services/tasks'

export default function TaskModal({ visible, onClose, members = [], currentUser, spaceId, onTaskCreated }) {
  const [selected, setSelected] = useState([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)

  if (!visible) return null

  const toggle = id => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const submit = async () => {
    if (!text.trim() || selected.length === 0) return
    const payload = {
      created_by: currentUser?.id,
      assigned_to: selected,
      message: text,
      space_id: spaceId,
      status: 'pending',
      timestamp: new Date().toISOString()
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
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-lg">
        <h3 className="text-lg font-bold mb-3">Create Task</h3>
        <div className="mb-3">
          <label className="block text-xs font-bold mb-1">Assign to</label>
          <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2">
            {members.map(m => (
              <label key={m.id} className="flex items-center gap-2">
                <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
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
          <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={submit} disabled={loading || selected.length===0}>Create</button>
        </div>
      </div>
    </div>
  )
}
