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
  // Ensure friends array exists for backward compatibility
  if (!user.friends) user.friends = []

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

// --- Friend & DM Logic ---

export const getFriends = friendIds => {
  if (!friendIds || friendIds.length === 0) return []
  const users = getUsers()
  return users.filter(u => friendIds.includes(u.id))
}

export const sendFriendRequest = (fromId, fromName, toUserId) => {
  const users = getUsers()
  const targetUserIndex = users.findIndex(u => u.id === toUserId)

  if (targetUserIndex !== -1) {
    const targetUser = users[targetUserIndex]

    // Check if already friends or request pending
    const isFriend = targetUser.friends?.includes(fromId)
    const hasPending = targetUser.notifications.some(
      n =>
        n.type === "friend_request" &&
        n.fromId === fromId &&
        n.status === "pending"
    )

    if (!isFriend && !hasPending) {
      const notification = {
        id: `fr-${Date.now()}-${Math.random()}`,
        type: "friend_request",
        from: fromName,
        fromId: fromId,
        status: "pending",
        timestamp: Date.now()
      }
      targetUser.notifications.push(notification)
      users[targetUserIndex] = targetUser
      localStorage.setItem(USERS_KEY, JSON.stringify(users))
    }
  }
}

export const acceptFriendRequest = (userId, notificationId) => {
  const users = getUsers()
  const userIndex = users.findIndex(u => u.id === userId)

  if (userIndex === -1) return null

  const user = users[userIndex]
  const notifIndex = user.notifications.findIndex(n => n.id === notificationId)

  if (notifIndex === -1) return null

  const notif = user.notifications[notifIndex]

  // Verify it's a friend request
  if (notif.type === "friend_request" && notif.fromId) {
    // 1. Add friend ID to current user
    if (!user.friends) user.friends = []
    if (!user.friends.includes(notif.fromId)) {
      user.friends.push(notif.fromId)
    }

    // 2. Remove notification
    user.notifications.splice(notifIndex, 1)
    users[userIndex] = user

    // 3. Add current user ID to the Sender's friend list (Bi-directional)
    const senderIndex = users.findIndex(u => u.id === notif.fromId)
    if (senderIndex !== -1) {
      const sender = users[senderIndex]
      if (!sender.friends) sender.friends = []
      if (!sender.friends.includes(userId)) {
        sender.friends.push(userId)
      }
      users[senderIndex] = sender
    }

    localStorage.setItem(USERS_KEY, JSON.stringify(users))
    return user
  }

  return null
}

// --- Space Logic (Direct Add for Friends) ---

export const addMemberToSpace = (userIdToDetail, spaceId) => {
  const users = getUsers()
  const allSpaces = getSpaces()

  const spaceIndex = allSpaces.findIndex(s => s.id === spaceId)
  const userIndex = users.findIndex(u => u.id === userIdToDetail)

  if (spaceIndex !== -1 && userIndex !== -1) {
    const space = allSpaces[spaceIndex]
    const user = users[userIndex]

    // Add user to space
    if (!space.members.includes(userIdToDetail)) {
      space.members.push(userIdToDetail)
      // Default to adding to the first channel (usually #general)
      if (space.channels.length > 0) {
        space.channels[0].members.push(userIdToDetail)
      }
      localStorage.setItem(SPACES_KEY, JSON.stringify(allSpaces))
    }

    // Add space to user
    if (!user.spaces.includes(spaceId)) {
      user.spaces.push(spaceId)
      localStorage.setItem(USERS_KEY, JSON.stringify(users))
    }
  }
}

export const acceptInvite = (userId, notificationId) => {
  const users = getUsers()
  const allSpaces = getSpaces()
  const userIndex = users.findIndex(u => u.id === userId)

  if (userIndex === -1) return null

  const user = users[userIndex]
  const notifIndex = user.notifications.findIndex(n => n.id === notificationId)

  if (notifIndex === -1) return null

  const notif = user.notifications[notifIndex]

  if (notif.type === "invite" && notif.spaceId) {
    const spaceIndex = allSpaces.findIndex(s => s.id === notif.spaceId)

    if (spaceIndex !== -1) {
      const space = allSpaces[spaceIndex]

      // Add user to space
      if (!space.members.includes(userId)) {
        space.members.push(userId)
        if (space.channels.length > 0) {
          if (!space.channels[0].members.includes(userId)) {
            space.channels[0].members.push(userId)
          }
        }
        allSpaces[spaceIndex] = space
        localStorage.setItem(SPACES_KEY, JSON.stringify(allSpaces))
      }

      // Add space to user
      if (!user.spaces.includes(notif.spaceId)) {
        user.spaces.push(notif.spaceId)
      }

      // Remove notification
      user.notifications.splice(notifIndex, 1)
      users[userIndex] = user
      localStorage.setItem(USERS_KEY, JSON.stringify(users))

      return space
    }
  }

  return null
}
