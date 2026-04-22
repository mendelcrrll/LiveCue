from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class WorkflowFolderCreateRequest(BaseModel):
    parent_id: UUID
    name: str = Field(min_length=1, max_length=255)


class WorkflowFileCreateRequest(BaseModel):
    parent_id: UUID
    name: str = Field(min_length=1, max_length=255)
    source_kind: Literal["manual", "google_slides_request"] = "manual"
    google_presentation_id: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_google_presentation_id(self):
        if self.source_kind == "google_slides_request" and not self.google_presentation_id:
            raise ValueError("google_presentation_id is required for google_slides_request files")
        return self


class WorkflowNodeResponse(BaseModel):
    id: str
    parent_id: str | None
    name: str
    node_type: str
    source_kind: str
    google_presentation_id: str | None = None
