from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_maps_empty(client: TestClient) -> None:
    response = client.get("/api/maps/")
    assert response.status_code == 200
    assert response.json() == []


def test_create_map_with_client_id(client: TestClient, sample_map_data: dict) -> None:
    response = client.post("/api/maps/", json=sample_map_data)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "test-map-1"
    assert data["name"] == "Test Map"


def test_create_map_auto_generates_id(client: TestClient, sample_map_data: dict) -> None:
    sample_map_data.pop("id")
    response = client.post("/api/maps/", json=sample_map_data)
    assert response.status_code == 201
    result = response.json()
    assert "id" in result
    assert result["id"] != ""


def test_get_map_found(client: TestClient, sample_map_data: dict) -> None:
    client.post("/api/maps/", json=sample_map_data)
    response = client.get("/api/maps/test-map-1")
    assert response.status_code == 200
    assert response.json()["name"] == "Test Map"


def test_get_map_not_found(client: TestClient) -> None:
    response = client.get("/api/maps/nonexistent")
    assert response.status_code == 404


def test_update_map_name(client: TestClient, sample_map_data: dict) -> None:
    client.post("/api/maps/", json=sample_map_data)
    response = client.patch("/api/maps/test-map-1", json={"name": "Renamed Map"})
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed Map"


def test_update_map_not_found(client: TestClient) -> None:
    response = client.patch("/api/maps/nonexistent", json={"name": "X"})
    assert response.status_code == 404


def test_delete_map(client: TestClient, sample_map_data: dict) -> None:
    client.post("/api/maps/", json=sample_map_data)
    response = client.delete("/api/maps/test-map-1")
    assert response.status_code == 204


def test_delete_map_not_found(client: TestClient) -> None:
    response = client.delete("/api/maps/nonexistent")
    assert response.status_code == 404


def test_list_maps_after_create(client: TestClient, sample_map_data: dict) -> None:
    client.post("/api/maps/", json=sample_map_data)
    response = client.get("/api/maps/")
    assert response.status_code == 200
    maps = response.json()
    assert len(maps) == 1
    assert maps[0]["id"] == "test-map-1"
