from minio import Minio
from minio.error import S3Error
from app.core.config import settings
from datetime import timedelta
from typing import List, Dict
import io
import logging

logger = logging.getLogger(__name__)


class MinIOClient:
    def __init__(self):
        self._client = None
        self._initialized = False
    
    @property
    def client(self):
        if self._client is None:
            try:
                self._client = Minio(
                    settings.MINIO_ENDPOINT,
                    access_key=settings.MINIO_ACCESS_KEY,
                    secret_key=settings.MINIO_SECRET_KEY,
                    secure=settings.MINIO_SECURE
                )
                self._ensure_bucket()
                self._initialized = True
                logger.info(f"MinIO client initialized successfully. Endpoint: {settings.MINIO_ENDPOINT}")
            except Exception as e:
                logger.error(f"Failed to initialize MinIO client: {e}")
                raise
        return self._client
    
    def _ensure_bucket(self):
        try:
            if not self.client.bucket_exists(settings.MINIO_BUCKET):
                self.client.make_bucket(settings.MINIO_BUCKET)
                logger.info(f"Created MinIO bucket: {settings.MINIO_BUCKET}")
        except S3Error as e:
            logger.error(f"Error ensuring bucket: {e}")
            raise
    
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
            logger.info(f"Successfully uploaded to MinIO: {object_name}")
            return f"{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/{object_name}"
        except S3Error as e:
            logger.error(f"Error uploading bytes to MinIO: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error uploading to MinIO: {e}")
            raise
    
    def get_file(self, object_name: str) -> bytes:
        try:
            response = self.client.get_object(settings.MINIO_BUCKET, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            logger.info(f"Downloaded file from MinIO: {object_name}")
            return data
        except S3Error as e:
            logger.error(f"Error downloading file from MinIO: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error downloading file from MinIO: {e}")
            raise
    
    def get_file_url(self, object_name: str, expires_in_seconds: int = 3600) -> str:
        return object_name
    
    def list_files(self, prefix: str = "reports/", recursive: bool = True) -> List[Dict]:
        try:
            objects = self.client.list_objects(
                settings.MINIO_BUCKET,
                prefix=prefix,
                recursive=recursive
            )
            files = []
            for obj in objects:
                files.append({
                    "name": obj.object_name,
                    "size": obj.size,
                    "last_modified": obj.last_modified.isoformat() if obj.last_modified else None,
                    "etag": obj.etag
                })
            return sorted(files, key=lambda x: x["last_modified"] or "", reverse=True)
        except S3Error as e:
            logger.error(f"Error listing files from MinIO: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error listing files from MinIO: {e}")
            raise
    
    def delete_file(self, object_name: str):
        try:
            self.client.remove_object(settings.MINIO_BUCKET, object_name)
        except S3Error as e:
            print(f"Error deleting file: {e}")
            raise


minio_client = MinIOClient()

try:
    _ = minio_client.client
except Exception as e:
    logger.warning(f"MinIO client initialization failed on import: {e}. Will retry on first use.")

