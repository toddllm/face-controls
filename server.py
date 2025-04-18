import os
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# Serve static web files
app.mount("/static", StaticFiles(directory="web"), name="static")

@app.get("/", response_class=HTMLResponse)
async def root():
    # Redirect to index.html
    return RedirectResponse(url="/static/index.html")

@app.get("/health")
async def health():
    return {"status": "ok"}
@app.get("/favicon.ico")
async def favicon():
    # No favicon
    from fastapi.responses import Response
    return Response(status_code=204)

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run(app, host=host, port=port)