import { getToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

const makeHeaders = () => {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

export const setChannelRole = async ({ space_id, channel_id, user_id, role }) => {
  const url = `${API_BASE}/spaces/channel/role`
  const res = await fetch(url, {
    method: 'POST',
    headers: makeHeaders(),
    credentials: 'include',
    body: JSON.stringify({ space_id, channel_id, user_id, role })
  })
  if (!res.ok) throw new Error('Failed to set channel role')
  return await res.json()
}

export const modifyChannelMember = async ({ action, space_id, channel_id, user_id }) => {
  const url = `${API_BASE}/spaces/channel/member`
  const res = await fetch(url, {
    method: 'POST',
    headers: makeHeaders(),
    credentials: 'include',
    body: JSON.stringify({ action, space_id, channel_id, user_id })
  })
  if (!res.ok) throw new Error('Failed to modify channel member')
  return await res.json()
}

export default { setChannelRole, modifyChannelMember }
