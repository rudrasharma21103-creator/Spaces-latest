from typing import Any, Literal

from pydantic import BaseModel, Field


class ProfessionalProfilePayload(BaseModel):
    companyName: str | None = Field(default=None, max_length=120)
    position: str | None = Field(default=None, max_length=120)
    linkedInUrl: str | None = Field(default=None, max_length=500)


class UserSearchResult(BaseModel):
    id: int | str
    name: str
    avatar_url: str | None = None
    avatar_preset: str | None = None
    professionalProfile: ProfessionalProfilePayload | None = None
    relationshipStatus: Literal[
        "self",
        "connected",
        "incoming_request",
        "outgoing_request",
        "can_connect",
    ] = "can_connect"
    incomingRequestNotificationId: str | None = None


class NotificationModel(BaseModel):
    id: str | None = Field(default=None, alias="_id")
    recipientId: str
    senderId: str | None = None
    type: Literal[
        "connection_invite",
        "connection_invite_response",
        "space_invite",
        "space_invite_response",
        "channel_invite",
        "channel_invite_response",
        "task_assigned",
        "info",
    ]
    status: Literal["unread", "read"] = "unread"
    actionStatus: Literal["pending", "accepted", "declined", "withdrawn"] | None = None
    spaceId: str | None = None
    channelId: str | None = None
    taskId: str | None = None
    message: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    createdAt: str | None = None
    updatedAt: str | None = None
    readAt: str | None = None
