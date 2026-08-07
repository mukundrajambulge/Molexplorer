from app.tasks.celery_app import celery_app

@celery_app.task(name="compute_batch_descriptors")
def compute_batch_descriptors(molecule_ids: list):
    # TODO: Compute descriptors for multiple molecules
    return {"status": "completed", "count": len(molecule_ids)}
