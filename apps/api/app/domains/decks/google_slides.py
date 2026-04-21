from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GoogleSlidesBaseModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class GoogleSlidesDimension(GoogleSlidesBaseModel):
    magnitude: float | None = None
    unit: str | None = None


class GoogleSlidesSize(GoogleSlidesBaseModel):
    width: GoogleSlidesDimension | None = None
    height: GoogleSlidesDimension | None = None


class GoogleSlidesPage(GoogleSlidesBaseModel):
    objectId: str
    pageType: str | None = None


class SlidePriorityItemInput(BaseModel):
    priority_rank: int
    title: str
    notes: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)

    @field_validator("priority_rank")
    @classmethod
    def validate_priority_rank(cls, value: int) -> int:
        if value < 1:
            raise ValueError("priority_rank must be greater than 0")
        return value


class SlidePainPointInput(BaseModel):
    label: str
    severity: str | None = None
    details: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)


class SlideEnrichmentInput(BaseModel):
    slide_object_id: str
    time_per_slide_seconds: int | None = None
    priority_queue: list[SlidePriorityItemInput] = Field(default_factory=list)
    pain_points: list[SlidePainPointInput] = Field(default_factory=list)

    @field_validator("time_per_slide_seconds")
    @classmethod
    def validate_time_per_slide_seconds(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("time_per_slide_seconds cannot be negative")
        return value


class GoogleSlidesPresentationInput(GoogleSlidesBaseModel):
    presentationId: str
    pageSize: GoogleSlidesSize | None = None
    slides: list[GoogleSlidesPage] = Field(default_factory=list)
    title: str
    masters: list[GoogleSlidesPage] = Field(default_factory=list)
    layouts: list[GoogleSlidesPage] = Field(default_factory=list)
    locale: str | None = None
    revisionId: str | None = None
    notesMaster: GoogleSlidesPage | None = None
