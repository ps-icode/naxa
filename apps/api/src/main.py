import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db.session import create_db_and_tables
from .routes import maps

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Retry with backoff: Docker's internal DNS can take a moment to resolve
    # service hostnames even after the postgres healthcheck passes.
    for attempt in range(5):
        try:
            create_db_and_tables()
            break
        except Exception as exc:
            if attempt == 4:
                raise
            wait = 2 ** attempt
            logger.warning("DB connection failed (attempt %d/5): %s — retrying in %ds", attempt + 1, exc, wait)
            await asyncio.sleep(wait)
    yield


app = FastAPI(
    title="Naxa API",
    description="Grid map editor for robot navigation systems",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(maps.router, prefix="/api/maps", tags=["maps"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
