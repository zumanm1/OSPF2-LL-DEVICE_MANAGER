"""
File Manager for Network Automation Outputs
Handles file listing, retrieval, and management

FIXED: Now uses 'current' symlink to read from latest execution directory
instead of hardcoded OUTPUT-Data_save path.
"""

import logging
import os
from typing import List, Dict, Optional
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

# Get the backend directory (parent of modules/)
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_current_data_dirs():
    """
    Get the current data directories, preferring the 'current' symlink
    which points to the latest automation execution.

    Returns:
        tuple: (text_dir, json_dir) paths
    """
    current_link = os.path.join(BACKEND_DIR, "data", "current")

    # If 'current' symlink exists and is valid, use it
    if os.path.exists(current_link) and os.path.islink(current_link):
        target = os.path.realpath(current_link)
        if os.path.exists(target):
            text_dir = os.path.join(target, "TEXT")
            json_dir = os.path.join(target, "JSON")

            # Only use if directories exist
            if os.path.exists(text_dir) and os.path.exists(json_dir):
                logger.info(f"📁 Using 'current' symlink: {target}")
                return text_dir, json_dir

    # Fallback to legacy OUTPUT-Data_save (for backwards compatibility)
    legacy_text = os.path.join(BACKEND_DIR, "data", "OUTPUT-Data_save", "TEXT")
    legacy_json = os.path.join(BACKEND_DIR, "data", "OUTPUT-Data_save", "JSON")
    logger.info(f"📁 Using legacy data path: OUTPUT-Data_save")
    return legacy_text, legacy_json


class FileManager:
    """Manages automation output files"""

    def __init__(self, text_dir: str = None, json_dir: str = None):
        # Use provided dirs or auto-detect from 'current' symlink
        if text_dir and json_dir:
            self.text_dir = text_dir
            self.json_dir = json_dir
        else:
            self.text_dir, self.json_dir = get_current_data_dirs()

        # Ensure directories exist
        os.makedirs(self.text_dir, exist_ok=True)
        os.makedirs(self.json_dir, exist_ok=True)

        logger.info(f"FileManager initialized - Text: {self.text_dir}, JSON: {self.json_dir}")

    def list_files(self, folder_type: str = "text", device_name: Optional[str] = None) -> List[Dict]:
        """
        List files in output directory

        Args:
            folder_type: "text" or "json"
            device_name: Filter by device name (optional)

        Returns:
            List of file info dicts
        """
        try:
            directory = self.text_dir if folder_type == "text" else self.json_dir

            if not os.path.exists(directory):
                logger.warning(f"⚠️  Directory {directory} does not exist")
                return []

            files = []
            for filename in os.listdir(directory):
                filepath = os.path.join(directory, filename)

                # Skip directories
                if os.path.isdir(filepath):
                    continue

                # Filter by device if specified
                if device_name and not filename.startswith(device_name):
                    continue

                # Get file stats
                stat = os.stat(filepath)

                files.append({
                    'filename': filename,
                    'filepath': filepath,
                    'size_bytes': stat.st_size,
                    'size_kb': round(stat.st_size / 1024, 2),
                    'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    'type': folder_type
                })

            # Sort by created time (newest first)
            files.sort(key=lambda x: x['created_at'], reverse=True)

            logger.info(f"📂 Listed {len(files)} files from {folder_type} directory")
            return files

        except Exception as e:
            logger.error(f"❌ Error listing files from {folder_type}: {str(e)}")
            raise

    def get_file_content(self, filename: str, folder_type: str = "text") -> dict:
        """
        Get content of a specific file

        Args:
            filename: Name of file to read
            folder_type: "text" or "json"

        Returns:
            Dict with file content and metadata
        """
        try:
            directory = self.text_dir if folder_type == "text" else self.json_dir
            filepath = os.path.join(directory, filename)

            if not os.path.exists(filepath):
                raise FileNotFoundError(f"File not found: {filename}")

            # Read file content
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Get file stats
            stat = os.stat(filepath)

            logger.info(f"📄 Read file: {filename} ({stat.st_size} bytes)")

            return {
                'filename': filename,
                'content': content,
                'size_bytes': stat.st_size,
                'lines': len(content.splitlines()),
                'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                'type': folder_type
            }

        except FileNotFoundError as e:
            logger.error(f"❌ File not found: {filename}")
            raise
        except Exception as e:
            logger.error(f"❌ Error reading file {filename}: {str(e)}")
            raise

    def delete_file(self, filename: str, folder_type: str = "text") -> dict:
        """
        Delete a specific file

        Args:
            filename: Name of file to delete
            folder_type: "text" or "json"

        Returns:
            Dict with deletion status
        """
        try:
            directory = self.text_dir if folder_type == "text" else self.json_dir
            filepath = os.path.join(directory, filename)

            if not os.path.exists(filepath):
                raise FileNotFoundError(f"File not found: {filename}")

            os.remove(filepath)
            logger.info(f"🗑️  Deleted file: {filename}")

            return {
                'status': 'deleted',
                'filename': filename,
                'deleted_at': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"❌ Error deleting file {filename}: {str(e)}")
            raise

    def get_directory_stats(self) -> dict:
        """
        Get statistics about output directories

        Returns:
            Dict with directory statistics
        """
        try:
            text_files = self.list_files("text")
            json_files = self.list_files("json")

            total_text_size = sum(f['size_bytes'] for f in text_files)
            total_json_size = sum(f['size_bytes'] for f in json_files)

            return {
                'text_directory': {
                    'path': self.text_dir,
                    'file_count': len(text_files),
                    'total_size_bytes': total_text_size,
                    'total_size_mb': round(total_text_size / (1024 * 1024), 2)
                },
                'json_directory': {
                    'path': self.json_dir,
                    'file_count': len(json_files),
                    'total_size_bytes': total_json_size,
                    'total_size_mb': round(total_json_size / (1024 * 1024), 2)
                },
                'total_files': len(text_files) + len(json_files),
                'total_size_mb': round((total_text_size + total_json_size) / (1024 * 1024), 2)
            }

        except Exception as e:
            logger.error(f"❌ Error getting directory stats: {str(e)}")
            raise

# Global file manager instance - will auto-detect current symlink
# Note: This is initialized once. For fresh data after automation,
# the API endpoint should create a new FileManager instance.
file_manager = FileManager()


def get_file_manager():
    """
    Get a fresh FileManager instance that uses the current symlink.
    Call this to ensure you're reading from the latest execution.
    """
    return FileManager()
