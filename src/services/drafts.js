import { getStoredUser, getToken } from "./auth"

let API_BASE = "http://localhost:8000"
try {
  const raw = import.meta.env.VITE_API_URL || ""
  if (raw && typeof raw === "string") {
    if (/^https?:\/\//.test(raw)) {
      API_BASE = raw
    } else if (/^:\d+/.test(raw)) {
      if (typeof window !== "undefined") {
        API_BASE = `${window.location.protocol}//${window.location.hostname}${raw}`
      } else {
        API_BASE = `http://localhost${raw}`
      }
    } else if (raw.startsWith("//")) {
      if (typeof window !== "undefined") API_BASE = `${window.location.protocol}${raw}`
      else API_BASE = `http:${raw}`
    } else if (/^[A-Za-z0-9.-]+:\d+$/.test(raw) && typeof window !== "undefined") {
      API_BASE = `${window.location.protocol}//${raw}`
    } else if (/^[A-Za-z0-9.-]+(:\d+)?$/.test(raw)) {
      API_BASE = `http://${raw}`
    }
  }
} catch {}

const getUserCacheKey = () => {
  const stored = getStoredUser()
  const uid = stored && (stored.id || stored._id || (stored._id && stored._id.$oid) || stored.userId)
  return `spaces_drafts_${uid ? String(uid) : "guest"}`
}

const sortDrafts = items =>
  [...items].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())

const readLocalDrafts = () => {
  try {
    const raw = localStorage.getItem(getUserCacheKey())
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeLocalDrafts = drafts => {
  try {
    localStorage.setItem(getUserCacheKey(), JSON.stringify(Array.isArray(drafts) ? drafts : []))
  } catch {}
}

const mergeDraftLists = (...lists) => {
  const merged = new Map()
  lists.flat().forEach(item => {
    if (!item || !item.id) return
    merged.set(String(item.id), item)
  })
  return sortDrafts(Array.from(merged.values()))
}

const buildHeaders = (includeJson = false) => {
  const token = getToken()
  const stored = getStoredUser()
  const uid = stored && (stored.id || stored._id || (stored._id && stored._id.$oid) || stored.userId)

  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(uid ? { "X-User-Id": String(uid) } : {}),
  }
}

export const getDrafts = async () => {
  const localDrafts = readLocalDrafts()

  try {
    const res = await fetch(`${API_BASE}/drafts`, {
      headers: buildHeaders(false),
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch drafts (${res.status})`)
    }

    const remoteDrafts = await res.json()
    const mergedDrafts = mergeDraftLists(Array.isArray(remoteDrafts) ? remoteDrafts : [], localDrafts)
    writeLocalDrafts(mergedDrafts)
    return mergedDrafts
  } catch (error) {
    console.warn("Draft fetch failed, using local cache", error)
    return localDrafts
  }
}

export const saveDraft = async draft => {
  const now = new Date().toISOString()
  const localDraft = {
    ...draft,
    id: draft?.id || `draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    text: (draft?.text || "").trim(),
    updatedAt: now,
    createdAt: draft?.createdAt || now,
  }
  const localDrafts = readLocalDrafts()
  const nextLocalDrafts = mergeDraftLists(localDrafts, [localDraft])
  writeLocalDrafts(nextLocalDrafts)

  try {
    const res = await fetch(`${API_BASE}/drafts`, {
      method: "POST",
      headers: buildHeaders(true),
      body: JSON.stringify(draft),
    })

    if (!res.ok) {
      throw new Error(`Failed to save draft (${res.status})`)
    }

    const savedDraft = await res.json()
    const mergedDrafts = mergeDraftLists(nextLocalDrafts, [savedDraft])
    writeLocalDrafts(mergedDrafts)
    return savedDraft
  } catch (error) {
    console.warn("Draft save failed, keeping local draft", error)
    return localDraft
  }
}

export const deleteDraft = async draftId => {
  const nextLocalDrafts = readLocalDrafts().filter(item => String(item.id) !== String(draftId))
  writeLocalDrafts(nextLocalDrafts)

  try {
    const res = await fetch(`${API_BASE}/drafts/${encodeURIComponent(draftId)}`, {
      method: "DELETE",
      headers: buildHeaders(false),
    })

    if (!res.ok) {
      throw new Error(`Failed to delete draft (${res.status})`)
    }

    return await res.json()
  } catch (error) {
    console.warn("Draft delete failed, removed local draft only", error)
    return { status: "deleted", id: String(draftId), localOnly: true }
  }
}
