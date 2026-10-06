"""Pydantic mirrors of the zod schemas in lib/server/schema.ts.

Field names are snake_case in Python but serialise to the same camelCase keys
the TypeScript app emits, so a response from either service is indistinguish
able to the frontend.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

CATEGORY_IDS = (
    "software",
    "manufacturing",
    "logistics",
    "design",
    "construction",
    "electronics",
)


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


# ------------------------------------------------------------------ inputs

class ParseRequirementInput(CamelModel):
    brief: str = Field(min_length=20, max_length=6000)
    defaults: dict | None = None  # {category?, location?}


class ScoreBidInput(CamelModel):
    requirement_id: str = Field(min_length=1)
    bid_id: str = Field(min_length=1)


class DraftBidInput(CamelModel):
    requirement_id: str = Field(min_length=1)
    provider_id: str | None = None
    target_price: int | None = Field(default=None, gt=0)
    delivery_days: int | None = Field(default=None, ge=1, le=3650)
    notes: str | None = Field(default=None, max_length=1200)


class Weights(CamelModel):
    budget: float = Field(ge=0, le=1)
    timeline: float = Field(ge=0, le=1)
    relevance: float = Field(ge=0, le=1)


class SummarizeInput(CamelModel):
    requirement_id: str = Field(min_length=1)
    weights: Weights | None = None
    focus: str | None = Field(default=None, max_length=240)


class CopilotHistoryItem(CamelModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class CopilotInput(CamelModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[CopilotHistoryItem] = Field(default_factory=list, max_length=12)

    @field_validator("message")
    @classmethod
    def trim_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message must not be blank")
        return value


# ------------------------------------------------------------ LLM outputs

class ParsedRequirement(CamelModel):
    title: str = Field(min_length=6, max_length=140)
    summary: str = Field(min_length=6, max_length=240)
    description: str = Field(min_length=10, max_length=6000)
    category: str
    budget_max: int = Field(gt=0)
    budget_target: int = Field(gt=0)
    deadline_in_days: int = Field(ge=1, le=730)
    closing_in_days: int = Field(ge=1, le=120)
    location: str = Field(min_length=1, max_length=120)
    tags: list[str] = Field(min_length=2, max_length=12)
    must_haves: list[str] = Field(default_factory=list, max_length=12)
    confidence: float = Field(ge=0, le=1)
    assumptions: list[str] = Field(default_factory=list, max_length=6)

    @property
    def category_valid(self) -> bool:
        return self.category in CATEGORY_IDS


class SemanticScore(CamelModel):
    score: float = Field(ge=0, le=100)
    verdict: str = Field(min_length=3, max_length=160)
    addressed: list[str] = Field(default_factory=list, max_length=8)
    gaps: list[str] = Field(default_factory=list, max_length=8)
    confidence: float = Field(ge=0, le=1)


class DraftMilestone(CamelModel):
    label: str = Field(min_length=2, max_length=120)
    days: int = Field(ge=1, le=3650)


class DraftBid(CamelModel):
    pitch: str = Field(min_length=40, max_length=4000)
    milestones: list[DraftMilestone] = Field(min_length=2, max_length=8)
    covers_tags: list[str] = Field(min_length=1, max_length=12)
    risks: list[str] = Field(default_factory=list, max_length=6)


class Tradeoff(CamelModel):
    provider_id: str = Field(min_length=1)
    strength: str = Field(max_length=200)
    risk: str = Field(max_length=200)


class ComparisonSummary(CamelModel):
    headline: str = Field(min_length=6, max_length=200)
    recommendation: str = Field(min_length=10, max_length=400)
    tradeoffs: list[Tradeoff] = Field(default_factory=list, max_length=6)
    watch_for: list[str] = Field(default_factory=list, max_length=6)
    confidence: float = Field(ge=0, le=1)
