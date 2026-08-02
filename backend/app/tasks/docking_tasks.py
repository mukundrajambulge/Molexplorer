from app.tasks.celery_app import celery_app
import time

@celery_app.task(name="run_docking")
def run_docking(job_id: str):
    # TODO: Implement actual docking (e.g. calling MolDock)
    time.sleep(5)
    return {"job_id": job_id, "status": "completed", "score": -9.2}
