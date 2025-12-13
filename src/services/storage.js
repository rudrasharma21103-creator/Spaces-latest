const USERS_KEY = "app_users"
const SPACES_KEY = "app_spaces"
const MESSAGES_KEY = "app_messages"

// --- User Management ---

export const getUsers = () => {
  const data = localStorage.getItem(USERS_KEY)
  return data ? JSON.parse(data) : []
}

export const saveUser = user => {
  const users = getUsers()
  const index = users.findIndex(u => u.id === user.id)
  if (index !== -1) {
    users[index] = user
  } else {
    users.push(user)
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export const findUserByEmail = email => {
  const users = getUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase())
}

export const searchUsersByName = query => {
  if (!query) return []
  const users = getUsers()
  return users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()))
}

// --- Space Management ---

export const getSpaces = () => {
  const data = localStorage.getItem(SPACES_KEY)
  return data ? JSON.parse(data) : []
}

export const saveSpace = space => {
  const spaces = getSpaces()
  const index = spaces.findIndex(s => s.id === space.id)
  if (index !== -1) {
    spaces[index] = space
  } else {
    spaces.push(space)
  }
  localStorage.setItem(SPACES_KEY, JSON.stringify(spaces))
}

export const getSpacesForUser = userSpaceIds => {
  const allSpaces = getSpaces()
  return allSpaces.filter(s => userSpaceIds.includes(s.id))
}

// --- Message Management ---

export const getMessages = chatId => {
  const data = localStorage.getItem(MESSAGES_KEY)
  const allMessages = data ? JSON.parse(data) : {}
  return allMessages[chatId] || []
}

export const saveMessage = (chatId, message) => {
  const data = localStorage.getItem(MESSAGES_KEY)
  const allMessages = data ? JSON.parse(data) : {}
  if (!allMessages[chatId]) {
    allMessages[chatId] = []
  }
  allMessages[chatId].push(message)
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(allMessages))
}

// --- DM Logic ---

export const getDMUsers = dmUserIds => {
  if (!dmUserIds || dmUserIds.length === 0) return []
  const users = getUsers()
  return users.filter(u => dmUserIds.includes(u.id))
}

export const startDM = (currentUserId, targetUserId) => {
  const users = getUsers()

  // Update Current User
  const currentUserIndex = users.findIndex(u => u.id === currentUserId)
  if (currentUserIndex !== -1) {
    const user = users[currentUserIndex]
    if (!user.dms) user.dms = []
    if (!user.dms.includes(targetUserId)) {
      user.dms.push(targetUserId)
      users[currentUserIndex] = user
    }
  }

  // Update Target User (so they see the DM too)
  const targetUserIndex = users.findIndex(u => u.id === targetUserId)
  if (targetUserIndex !== -1) {
    const user = users[targetUserIndex]
    if (!user.dms) user.dms = []
    if (!user.dms.includes(currentUserId)) {
      user.dms.push(currentUserId)
      users[targetUserIndex] = user
    }
  }

  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

// --- Invitation & Notification Logic ---

export const sendInvite = (fromName, toUserIds, spaceId, spaceName) => {
  const users = getUsers()
  let updated = false

  users.forEach(user => {
    if (toUserIds.includes(user.id)) {
      // Check if already invited or member
      const alreadyMember = user.spaces.includes(spaceId)
      const alreadyInvited = user.notifications.some(
        n =>
          n.type === "invite" && n.spaceId === spaceId && n.status === "pending"
      )

      if (!alreadyMember && !alreadyInvited) {
        const notification = {
          id: `notif-${Date.now()}-${Math.random()}`,
          type: "invite",
          from: fromName,
          spaceId: spaceId,
          spaceName: spaceName,
          status: "pending",
          timestamp: Date.now()
        }
        user.notifications.push(notification)
        updated = true
      }
    }
  })

  if (updated) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  }
}

export const acceptInvite = (userId, notificationId) => {
  const users = getUsers()
  const userIndex = users.findIndex(u => u.id === userId)

  if (userIndex === -1) return null

  const user = users[userIndex]
  const notifIndex = user.notifications.findIndex(n => n.id === notificationId)

  if (notifIndex === -1) return null

  const notif = user.notifications[notifIndex]

  // 1. Add space ID to user's spaces
  if (!user.spaces.includes(notif.spaceId)) {
    user.spaces.push(notif.spaceId)
  }

  // 2. Remove notification
  user.notifications.splice(notifIndex, 1)

  // 3. Save User
  users[userIndex] = user
  localStorage.setItem(USERS_KEY, JSON.stringify(users))

  // 4. Update Space members
  const allSpaces = getSpaces()
  const spaceIndex = allSpaces.findIndex(s => s.id === notif.spaceId)
  if (spaceIndex !== -1) {
    const space = allSpaces[spaceIndex]
    if (!space.members.includes(userId)) {
      space.members.push(userId)
      localStorage.setItem(SPACES_KEY, JSON.stringify(allSpaces))
    }
    return space
  }

  return null
}

const Storage = {
  getUsers,
  saveUser,
  findUserByEmail,
  searchUsersByName,
  getSpaces,
  saveSpace,
  getSpacesForUser,
  getMessages,
  saveMessage,
  getDMUsers,
  startDM,
  sendInvite,
  acceptInvite
}

export default Storage
