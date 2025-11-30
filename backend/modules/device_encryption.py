"""
Device Password Encryption Module
Encrypts and decrypts device passwords using Fernet (symmetric encryption)
"""

import os
import logging
from cryptography.fernet import Fernet
from typing import Optional

logger = logging.getLogger(__name__)

# Encryption key location
ENCRYPTION_KEY_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.encryption_key')

def get_or_create_encryption_key() -> bytes:
    """
    Get existing encryption key or create a new one
    
    Returns:
        bytes: Encryption key
    """
    # Check if key file exists
    if os.path.exists(ENCRYPTION_KEY_FILE):
        try:
            with open(ENCRYPTION_KEY_FILE, 'rb') as f:
                key = f.read()
                # Validate key
                Fernet(key)  # This will raise if key is invalid
                logger.info("✅ Loaded existing encryption key")
                return key
        except Exception as e:
            logger.warning(f"⚠️ Failed to load encryption key: {e}. Generating new key...")
    
    # Generate new key
    key = Fernet.generate_key()
    
    # Save key to file with restricted permissions
    try:
        with open(ENCRYPTION_KEY_FILE, 'wb') as f:
            f.write(key)
        
        # Set file permissions to 600 (read/write for owner only)
        os.chmod(ENCRYPTION_KEY_FILE, 0o600)
        
        logger.info(f"✅ Generated new encryption key and saved to {ENCRYPTION_KEY_FILE}")
        logger.warning("⚠️ IMPORTANT: Backup this key file! Without it, encrypted passwords cannot be decrypted!")
        
        return key
    except Exception as e:
        logger.error(f"❌ Failed to save encryption key: {e}")
        raise

# Initialize Fernet cipher with key
_ENCRYPTION_KEY = get_or_create_encryption_key()
_CIPHER = Fernet(_ENCRYPTION_KEY)

def encrypt_password(plaintext: str) -> str:
    """
    Encrypt a plaintext password
    
    Args:
        plaintext: Password in plaintext
        
    Returns:
        str: Encrypted password (base64-encoded)
    """
    if not plaintext:
        return ""
    
    try:
        encrypted_bytes = _CIPHER.encrypt(plaintext.encode('utf-8'))
        encrypted_str = encrypted_bytes.decode('utf-8')
        logger.debug(f"🔒 Password encrypted (length: {len(plaintext)} -> {len(encrypted_str)})")
        return encrypted_str
    except Exception as e:
        logger.error(f"❌ Failed to encrypt password: {e}")
        raise

def decrypt_password(encrypted: str) -> str:
    """
    Decrypt an encrypted password
    
    Args:
        encrypted: Encrypted password (base64-encoded)
        
    Returns:
        str: Decrypted plaintext password
    """
    if not encrypted:
        return ""
    
    try:
        decrypted_bytes = _CIPHER.decrypt(encrypted.encode('utf-8'))
        plaintext = decrypted_bytes.decode('utf-8')
        logger.debug(f"🔓 Password decrypted (length: {len(encrypted)} -> {len(plaintext)})")
        return plaintext
    except Exception as e:
        logger.error(f"❌ Failed to decrypt password: {e}")
        logger.warning("⚠️ This may be a plaintext password from before encryption was enabled")
        # Return encrypted value as-is if decryption fails (backwards compatibility)
        return encrypted

def is_encrypted(password: str) -> bool:
    """
    Check if a password is already encrypted
    
    Args:
        password: Password string to check
        
    Returns:
        bool: True if encrypted, False if plaintext
    """
    if not password:
        return False
    
    try:
        # Try to decrypt - if successful, it's encrypted
        _CIPHER.decrypt(password.encode('utf-8'))
        return True
    except:
        # If decryption fails, it's plaintext
        return False

def migrate_password(password: str) -> str:
    """
    Migrate a password (encrypt if plaintext, leave if already encrypted)
    
    Args:
        password: Password that may or may not be encrypted
        
    Returns:
        str: Encrypted password
    """
    if is_encrypted(password):
        logger.debug("Password already encrypted, no migration needed")
        return password
    else:
        logger.info("🔄 Migrating plaintext password to encrypted format")
        return encrypt_password(password)

# Encryption status checker
def get_encryption_status() -> dict:
    """
    Get encryption status information
    
    Returns:
        dict: Encryption status details
    """
    return {
        'enabled': True,
        'key_file_exists': os.path.exists(ENCRYPTION_KEY_FILE),
        'key_file_path': ENCRYPTION_KEY_FILE,
        'cipher_algorithm': 'Fernet (AES-128-CBC with HMAC)',
    }

if __name__ == "__main__":
    # Test encryption/decryption
    print("Testing password encryption...")
    
    test_password = "test123"
    print(f"Original: {test_password}")
    
    encrypted = encrypt_password(test_password)
    print(f"Encrypted: {encrypted}")
    
    decrypted = decrypt_password(encrypted)
    print(f"Decrypted: {decrypted}")
    
    assert test_password == decrypted, "Encryption/Decryption test failed!"
    print("✅ Encryption test passed!")
    
    # Test is_encrypted
    assert is_encrypted(encrypted), "is_encrypted() should return True for encrypted password"
    assert not is_encrypted(test_password), "is_encrypted() should return False for plaintext"
    print("✅ is_encrypted() test passed!")
    
    # Test migration
    migrated = migrate_password(test_password)
    assert is_encrypted(migrated), "migrate_password() should return encrypted password"
    migrated_again = migrate_password(migrated)
    assert migrated == migrated_again, "migrate_password() should be idempotent"
    print("✅ migration test passed!")
    
    print("\n🎉 All encryption tests passed!")
