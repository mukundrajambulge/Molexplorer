# Molexplorer Architecture

## System Architecture

```text
+-------------------+       +-------------------+       +-------------------+
|                   |       |                   |       |                   |
|   React/Vite      |       |   FastAPI         |       |   PostgreSQL      |
|   Frontend        +------>+   Backend         +------>+   Database        |
|   (Port 3000)     |       |   (Port 8000)     |       |   (Port 5432)     |
|                   |       |                   |       |                   |
+-------------------+       +--------+----------+       +-------------------+
                                     |
                                     |
                                     v
                            +--------+----------+       +-------------------+
                            |                   |       |                   |
                            |   Celery Worker   +------>+   Redis           |
                            |   Background      |       |   Message Broker  |
                            |                   |       |   (Port 6379)     |
                            +-------------------+       +-------------------+
```

## How to run locally (Dev Mode)

1. **Frontend**:
   ```bash
   npm install
   npm run dev
   ```
2. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```
3. **Database**: Use SQLite or a local PostgreSQL instance.

## How to run with Docker Compose

To start the entire stack:
```bash
docker-compose up -d --build
```
This will start:
- Web (port 3000)
- API (port 8000)
- Celery Worker
- PostgreSQL
- Redis

## How to deploy to Railway

1. Install the Railway CLI.
2. Login: `railway login`
3. Link the project: `railway link`
4. Deploy: `railway up`

(Note: Railway will detect `railway.toml` for configuration. You'll need to provision Redis and Postgres databases in the Railway project dashboard.)

## Environment Variables Reference

See `.env.example` for the required environment variables.
