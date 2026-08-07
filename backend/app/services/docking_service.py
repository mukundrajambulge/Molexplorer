import uuid

def submit_docking_job(receptor: str, ligand: str, params: dict = None) -> str:
    # TODO: Submit to Celery
    from app.tasks.docking_tasks import run_docking
    job_id = str(uuid.uuid4())
    run_docking.delay(job_id)
    return job_id

def get_job_status(job_id: str) -> dict:
    # TODO: Fetch from DB/Celery
    return {"job_id": job_id, "status": "pending"}
