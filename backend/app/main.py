from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.routes import health, molecules, libraries, structures, docking, ws
from app.core.middleware import RequestTimingMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestTimingMiddleware)

# Routers
app.include_router(health.router)
app.include_router(molecules.router, prefix="/api/v1")
app.include_router(libraries.router, prefix="/api/v1")
app.include_router(structures.router, prefix="/api/v1")
app.include_router(docking.router, prefix="/api/v1")
app.include_router(ws.router)
