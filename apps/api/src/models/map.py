import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class GridMapBase(SQLModel):
    name: str
    config: dict[str, Any] = Field(sa_column=Column(JSON))
    cells: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    edges: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    layers: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))


class GridMap(GridMapBase, table=True):
    __tablename__ = "grid_maps"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GridMapCreate(GridMapBase):
    id: str | None = None  # client may provide its own UUID


class GridMapUpdate(SQLModel):
    name: str | None = None
    config: dict[str, Any] | None = None
    cells: list[dict[str, Any]] | None = None
    edges: list[dict[str, Any]] | None = None
    layers: list[dict[str, Any]] | None = None


class GridMapRead(GridMapBase):
    id: str
    created_at: datetime
    updated_at: datetime
