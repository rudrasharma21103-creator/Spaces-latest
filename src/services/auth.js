const TOKEN_KEY = "spaces_token"
const USER_KEY = "spaces_user"

const readStoredToken = () => {
  try {
    return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
  } catch {
    return null
  }
}

const readStoredUser = () => {
  try {
    if (typeof window === "undefined") return null
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

let sessionToken = readStoredToken()
let sessionUser = readStoredUser()

export const saveAuth = (user, token) => {
  sessionToken = token || null
  sessionUser = user || null
  try {
    if (sessionToken) localStorage.setItem(TOKEN_KEY, sessionToken)
    else localStorage.removeItem(TOKEN_KEY)

    if (sessionUser) localStorage.setItem(USER_KEY, JSON.stringify(sessionUser))
    else localStorage.removeItem(USER_KEY)
  } catch {
    // Storage can be unavailable in private modes or blocked browser contexts.
  }
}

export const getToken = () => {
  if (!sessionToken) sessionToken = readStoredToken()
  return sessionToken
}

export const getStoredUser = () => {
  if (!sessionUser) sessionUser = readStoredUser()
  return sessionUser
}

export const logout = () => {
  sessionToken = null
  sessionUser = null
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // Ignore storage cleanup failures; in-memory auth has already been cleared.
  }
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("spacexyz-auth-cleared"))
    }
  } catch {
    // Ignore event dispatch failures outside a browser-like environment.
  }
}
