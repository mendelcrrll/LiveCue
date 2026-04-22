from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Presentation(Base):
    __tablename__ = "presentations"
    __table_args__ = (
        UniqueConstraint(
            "google_presentation_id",
            name="uq_presentations_google_presentation_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_presentation_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    locale: Mapped[str | None] = mapped_column(String(64))
    revision_id: Mapped[str | None] = mapped_column(String(255))
    page_width: Mapped[float | None] = mapped_column(Numeric(12, 2))
    page_height: Mapped[float | None] = mapped_column(Numeric(12, 2))
    page_unit: Mapped[str | None] = mapped_column(String(32))
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    slides: Mapped[list[PresentationSlide]] = relationship(
        back_populates="presentation",
        cascade="all, delete-orphan",
        order_by="PresentationSlide.slide_index",
    )


class PresentationSlide(Base):
    __tablename__ = "slides"
    __table_args__ = (
        UniqueConstraint(
            "presentation_id",
            "google_object_id",
            name="uq_slides_presentation_object_id",
        ),
        UniqueConstraint(
            "presentation_id",
            "slide_index",
            name="uq_slides_presentation_slide_index",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    presentation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("presentations.id", ondelete="CASCADE"),
        nullable=False,
    )
    google_object_id: Mapped[str] = mapped_column(String(255), nullable=False)
    slide_index: Mapped[int] = mapped_column(Integer, nullable=False)
    page_type: Mapped[str | None] = mapped_column(String(64))
    time_per_slide_seconds: Mapped[int | None] = mapped_column(Integer)
    raw_page: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    presentation: Mapped[Presentation] = relationship(back_populates="slides")
    priority_items: Mapped[list[SlidePriorityItem]] = relationship(
        back_populates="slide",
        cascade="all, delete-orphan",
        order_by="SlidePriorityItem.priority_rank",
    )
    pain_points: Mapped[list[SlidePainPoint]] = relationship(
        back_populates="slide",
        cascade="all, delete-orphan",
        order_by="SlidePainPoint.created_at",
    )


class SlidePriorityItem(Base):
    __tablename__ = "slide_priority_items"
    __table_args__ = (
        UniqueConstraint(
            "slide_id",
            "priority_rank",
            name="uq_slide_priority_items_slide_rank",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slide_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("slides.id", ondelete="CASCADE"),
        nullable=False,
    )
    priority_rank: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    extra_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    slide: Mapped[PresentationSlide] = relationship(back_populates="priority_items")


class SlidePainPoint(Base):
    __tablename__ = "slide_pain_points"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slide_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("slides.id", ondelete="CASCADE"),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str | None] = mapped_column(String(64))
    details: Mapped[str | None] = mapped_column(Text)
    extra_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    slide: Mapped[PresentationSlide] = relationship(back_populates="pain_points")


class WorkflowNode(Base):
    __tablename__ = "workflow_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflow_nodes.id", ondelete="CASCADE"),
    )
    presentation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("presentations.id", ondelete="SET NULL"),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    node_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_kind: Mapped[str] = mapped_column(String(64), nullable=False, default="manual")
    google_presentation_id: Mapped[str | None] = mapped_column(String(255))
    system_key: Mapped[str | None] = mapped_column(String(64), unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    parent: Mapped[WorkflowNode | None] = relationship(
        remote_side="WorkflowNode.id",
        back_populates="children",
    )
    children: Mapped[list[WorkflowNode]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="WorkflowNode.sort_order",
    )
    presentation: Mapped[Presentation | None] = relationship()
