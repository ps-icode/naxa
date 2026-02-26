import os
import pytest

# Must be set before any src imports so the module-level DATABASE_URL reads SQLite
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402
from sqlmodel import SQLModel, Session, create_engine  # noqa: E402

import src.db.session as _db  # noqa: E402
from src.main import app  # noqa: E402
from src.db.session import get_session  # noqa: E402

# Replace the module-level engine with a StaticPool in-memory SQLite engine.
# StaticPool is required so all connections share the same in-memory database;
# without it, each connection gets a fresh (empty) database.
_db.engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@pytest.fixture(name="session")
def session_fixture():
    SQLModel.metadata.create_all(_db.engine)
    with Session(_db.engine) as session:
        yield session
    SQLModel.metadata.drop_all(_db.engine)


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_map_data() -> dict:
    return {
        "id": "test-map-1",
        "name": "Test Map",
        "config": {"rows": 3, "cols": 3, "cellShape": "square", "cellSizeMeters": 1.0},
        "cells": [],
        "edges": [],
        "layers": [],
    }
