import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_upload_molecule():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/api/v1/molecules/upload", json={"smiles": "CCO", "name": "Ethanol"})
    assert response.status_code == 200
    assert response.json()["message"] == "Molecule uploaded successfully"
