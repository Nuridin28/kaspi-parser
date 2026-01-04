from minio import Minio
from minio.error import S3Error
from app.core.config import settings
import io


class MinIOClient:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
        self._ensure_bucket()
    
    def _ensure_bucket(self):
        try:
            if not self.client.bucket_exists(settings.MINIO_BUCKET):
                self.client.make_bucket(settings.MINIO_BUCKET)
        except S3Error as e:
            print(f"Error ensuring bucket: {e}")
    
    def upload_file(self, file_path: str, object_name: str) -> str:
        try:
            self.client.fput_object(
                settings.MINIO_BUCKET,
                object_name,
                file_path
            )
            return f"{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/{object_name}"
        except S3Error as e:
            print(f"Error uploading file: {e}")
            raise
    
    def upload_bytes(self, data: bytes, object_name: str, content_type: str = "application/octet-stream") -> str:
        try:
            data_stream = io.BytesIO(data)
            self.client.put_object(
                settings.MINIO_BUCKET,
                object_name,
                data_stream,
                length=len(data),
                content_type=content_type
            )
            return f"{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/{object_name}"
        except S3Error as e:
            print(f"Error uploading bytes: {e}")
            raise
    
    def get_file_url(self, object_name: str, expires_in_seconds: int = 3600) -> str:
        try:
            return self.client.presigned_get_object(
                settings.MINIO_BUCKET,
                object_name,
                expires=expires_in_seconds
            )
        except S3Error as e:
            print(f"Error generating URL: {e}")
            raise
    
    def delete_file(self, object_name: str):
        try:
            self.client.remove_object(settings.MINIO_BUCKET, object_name)
        except S3Error as e:
            print(f"Error deleting file: {e}")
            raise


minio_client = MinIOClient()

