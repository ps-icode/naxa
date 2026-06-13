import base64
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, or_
from sqlmodel import Session, col, select

from ..db.session import get_session
from ..models.map import GridMap, GridMapCreate, GridMapRead, GridMapUpdate

router = APIRouter()


@router.get("/", response_model=list[GridMapRead])
def list_maps(
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = Query(None),
    response: Response = ...,  # FastAPI injects the outgoing Response object
    session: Session = Depends(get_session),
) -> list[GridMap]:
    """Return up to `limit` maps ordered by updated_at DESC, id ASC.

    If `cursor` is provided (opaque base64 token from a previous X-Next-Cursor
    header), returns the next page starting after that position.  When more
    items exist beyond the returned page, sets the X-Next-Cursor response header
    so callers can fetch the following page.
    """
    stmt = select(GridMap).order_by(col(GridMap.updated_at).desc(), col(GridMap.id).asc())

    if cursor:
        try:
            raw = base64.b64decode(cursor.encode()).decode()
            dt_str, cursor_id = raw.split("|", 1)
            cursor_dt = datetime.fromisoformat(dt_str)
            stmt = stmt.where(
                or_(
                    col(GridMap.updated_at) < cursor_dt,
                    and_(col(GridMap.updated_at) == cursor_dt, col(GridMap.id) > cursor_id),
                )
            )
        except Exception:
            pass  # malformed cursor → return from the beginning

    rows = list(session.exec(stmt.limit(limit + 1)).all())
    has_more = len(rows) > limit
    items = rows[:limit]

    if has_more and items:
        last = items[-1]
        token = base64.b64encode(f"{last.updated_at.isoformat()}|{last.id}".encode()).decode()
        response.headers["X-Next-Cursor"] = token

    return items


@router.post("/", response_model=GridMapRead, status_code=201)
def create_map(payload: GridMapCreate, session: Session = Depends(get_session)) -> GridMap:
    data = payload.model_dump(exclude_none=False)
    if not data.get("id"):
        data["id"] = str(uuid.uuid4())
    grid_map = GridMap.model_validate(data)
    session.add(grid_map)
    session.commit()
    session.refresh(grid_map)
    return grid_map


@router.get("/{map_id}", response_model=GridMapRead)
def get_map(map_id: str, session: Session = Depends(get_session)) -> GridMap:
    grid_map = session.get(GridMap, map_id)
    if not grid_map:
        raise HTTPException(status_code=404, detail="Map not found")
    return grid_map


@router.patch("/{map_id}", response_model=GridMapRead)
def update_map(
    map_id: str,
    payload: GridMapUpdate,
    session: Session = Depends(get_session),
) -> GridMap:
    grid_map = session.get(GridMap, map_id)
    if not grid_map:
        raise HTTPException(status_code=404, detail="Map not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(grid_map, key, value)
    grid_map.updated_at = datetime.utcnow()
    session.add(grid_map)
    session.commit()
    session.refresh(grid_map)
    return grid_map


@router.delete("/{map_id}", status_code=204)
def delete_map(map_id: str, session: Session = Depends(get_session)) -> None:
    grid_map = session.get(GridMap, map_id)
    if not grid_map:
        raise HTTPException(status_code=404, detail="Map not found")
    session.delete(grid_map)
    session.commit()
