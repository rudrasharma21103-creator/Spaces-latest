from typing import Literal

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

