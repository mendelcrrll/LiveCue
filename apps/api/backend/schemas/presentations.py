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
    category: str = "custom"
    completed: bool = False
    completedAtMs: int | None = None
    evidence: str | None = None


class BuilderAccessibilityCheck(BaseModel):
    id: str
    label: str
    enabled: bool
    severity: str
    status: str = "pending"
    evidence: str | None = None
    updatedAtMs: int | None = None


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
    demoTranscript: str = ""
    thumbnailUrl: str | None = None
    buildData: BuilderSlideData


class PresentationBuilderData(BaseModel):
    deckId: str
    deckTitle: str
    slides: list[BuilderSlide]


class BuilderSlideUpdateRequest(BaseModel):
    buildData: BuilderSlideData


class BuilderSlideNotesUpdateRequest(BaseModel):
    speakerNotes: str = Field(default="", max_length=20000)


class BuilderSlideDemoTranscriptUpdateRequest(BaseModel):
    demoTranscript: str = Field(default="", max_length=40000)
    source: str = Field(default="manual", min_length=1, max_length=64)


class BuilderSchemaGenerationRequest(BaseModel):
    speakerNotes: str | None = Field(default=None, max_length=20000)
    demoTranscript: str | None = Field(default=None, max_length=40000)
    model: str | None = Field(default=None, min_length=1)


class FeedbackDecisionRequest(BaseModel):
    buildData: BuilderSlideData
    windowSize: int | None = Field(
        default=None,
        ge=1,
        le=50,
        description="Maximum number of transcript chunks to include for this slide.",
    )
    model: str | None = Field(default=None, min_length=1)
    persistGoalProgress: bool = True


class FeedbackGoalDecision(BaseModel):
    id: str
    completed: bool
    evidence: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class FeedbackAccessibilityDecision(BaseModel):
    id: str
    status: str
    evidence: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class FeedbackTimingDecision(BaseModel):
    elapsedMs: int
    goalMs: int
    status: str
    message: str = ""


class FeedbackDecision(BaseModel):
    summary: str = ""
    goalUpdates: list[FeedbackGoalDecision]
    accessibilityUpdates: list[FeedbackAccessibilityDecision]
    timing: FeedbackTimingDecision | None = None
    frontendUpdates: list[dict]
    updatedSlide: BuilderSlide


class AudienceVignette(BaseModel):
    id: str
    title: str = ""
    prompt: str
    sortOrder: int
    createdAt: str | None = None
    updatedAt: str | None = None


class AudienceVignetteCreateRequest(BaseModel):
    title: str = Field(default="", max_length=255)
    prompt: str = Field(default="", max_length=20000)


class AudienceVignetteUpdateRequest(BaseModel):
    title: str = Field(default="", max_length=255)
    prompt: str = Field(default="", max_length=20000)


class FeedbackCriterion(BaseModel):
    label: str
    score: int = Field(ge=0, le=100)
    feedback: str


class PostFeedbackTheme(BaseModel):
    id: str
    title: str
    score: int = Field(ge=0, le=100)
    summary: str
    criteria: list[FeedbackCriterion]


class PostFeedbackReport(BaseModel):
    id: str | None = None
    status: str = "empty"
    model: str | None = None
    overallScore: int | None = Field(default=None, ge=0, le=100)
    summary: str = ""
    themes: list[PostFeedbackTheme] = Field(default_factory=list)
    createdAt: str | None = None
    updatedAt: str | None = None


class PostFeedbackData(BaseModel):
    deckId: str
    deckTitle: str
    vignettes: list[AudienceVignette]
    feedback: PostFeedbackReport | None = None
    transcriptChunkCount: int = 0


class PostFeedbackGenerationRequest(BaseModel):
    model: str | None = Field(default=None, min_length=1)
