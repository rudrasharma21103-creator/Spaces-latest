const TOKEN_KEY = "spaces_token"
const USER_KEY = "spaces_user"

export const saveAuth = (user, token) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const getToken = () => localStorage.getItem(TOKEN_KEY)

export const getStoredUser = () => {
  const u = localStorage.getItem(USER_KEY)
  return u ? JSON.parse(u) : null
}

export const logout = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
