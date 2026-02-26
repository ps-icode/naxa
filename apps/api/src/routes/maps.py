import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db.session import get_session
from ..models.map import GridMap, GridMapCreate, GridMapRead, GridMapUpdate

router = APIRouter()


@router.get("/", response_model=list[GridMapRead])
def list_maps(session: Session = Depends(get_session)) -> list[GridMap]:
    return list(session.exec(select(GridMap)).all())


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
