from pydantic import BaseModel, Field


class PresentationImportRequest(BaseModel):
    presentation_id: str = Field(min_length=1, description="Google Slides presentation ID")


class PresentationImportResponse(BaseModel):
    id: str
    google_presentation_id: str
    title: str
    slide_count: int


class BuilderPriorityItem(BaseModel):
    id: str
    text: str
    priority: int
    category: str


class BuilderAccessibilityCheck(BaseModel):
    id: str
    label: str
    enabled: bool
    severity: str


class BuilderTimingGoal(BaseModel):
    minutes: int
    seconds: int


class BuilderSlideData(BaseModel):
    priorityItems: list[BuilderPriorityItem]
    accessibilityChecks: list[BuilderAccessibilityCheck]
    timingGoal: BuilderTimingGoal


class BuilderSlide(BaseModel):
    slideId: str
    slideNumber: int
    title: str
    slideText: list[str]
    speakerNotes: str
    thumbnailUrl: str | None = None
    buildData: BuilderSlideData


class PresentationBuilderData(BaseModel):
    deckId: str
    deckTitle: str
    slides: list[BuilderSlide]
