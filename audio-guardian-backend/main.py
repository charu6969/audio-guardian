"""
AudioNotary — FastAPI Backend
Digital Audio Forensic Toolkit

Run with:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.analyze import router as analyze_router

app = FastAPI(
    title="AudioNotary",
    description="Multi-layer forensic audio trust analysis API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the React frontend (Vite default: 5173) and any localhost variants
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",   # ← your React frontend
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(analyze_router, prefix="/api", tags=["Forensic Analysis"])


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "AudioNotary",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "analyze": "POST /api/analyze",
            "report": "POST /api/report",
            "compare": "POST /api/compare",
            "docs": "GET /docs",
        },
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}