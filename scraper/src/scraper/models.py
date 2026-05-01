"""Pydantic models that mirror schema/videos.schema.json."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


NumericString = Annotated[str, StringConstraints(pattern=r"^[0-9]+$")]


class Video(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: NumericString
    url: str
    posted_at: datetime
    duration_sec: int = Field(ge=0)
    text: str
    tags: list[str]


class VideosFile(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    generated_at: datetime
    last_synced_at: datetime
    source_query: str = Field(min_length=1)
    videos: list[Video]
