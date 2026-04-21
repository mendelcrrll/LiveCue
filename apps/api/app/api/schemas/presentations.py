from pydantic import BaseModel, Field


class PresentationImportRequest(BaseModel):
    presentation_id: str = Field(min_length=1, description="Google Slides presentation ID")


class PresentationImportResponse(BaseModel):
    id: str
    google_presentation_id: str
    title: str
    slide_count: int
