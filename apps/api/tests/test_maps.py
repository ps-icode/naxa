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


def test_list_maps_limit(client: TestClient, sample_map_data: dict) -> None:
    """?limit caps the number of returned maps; X-Next-Cursor is set when more exist."""
    for i in range(3):
        data = {**sample_map_data, "id": f"map-{i}", "name": f"Map {i}"}
        client.post("/api/maps/", json=data)
    response = client.get("/api/maps/?limit=2")
    assert response.status_code == 200
    assert len(response.json()) == 2
    assert "x-next-cursor" in response.headers


def test_list_maps_cursor(client: TestClient, sample_map_data: dict) -> None:
    """Following X-Next-Cursor returns the next page without overlap or gap."""
    for i in range(3):
        data = {**sample_map_data, "id": f"page-{i}", "name": f"Map {i}"}
        client.post("/api/maps/", json=data)

    first = client.get("/api/maps/?limit=2")
    assert first.status_code == 200
    first_ids = {m["id"] for m in first.json()}
    cursor = first.headers.get("x-next-cursor")
    assert cursor is not None

    second = client.get(f"/api/maps/?limit=2&cursor={cursor}")
    assert second.status_code == 200
    second_ids = {m["id"] for m in second.json()}

    # No overlap, combined = all 3 maps
    assert first_ids.isdisjoint(second_ids)
    assert first_ids | second_ids == {"page-0", "page-1", "page-2"}
    # No further cursor since we got the last page
    assert "x-next-cursor" not in second.headers


def test_list_maps_invalid_cursor(client: TestClient, sample_map_data: dict) -> None:
    """An invalid cursor token is silently ignored and returns from the start."""
    client.post("/api/maps/", json=sample_map_data)
    response = client.get("/api/maps/?cursor=not-valid-base64!!!")
    assert response.status_code == 200
    assert len(response.json()) == 1
