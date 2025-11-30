#!/usr/bin/env python3
"""
Password Migration Script
Encrypts all plaintext passwords in the devices database
"""

import sys
import os
import sqlite3

# Add backend modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from modules.device_encryption import encrypt_password, is_encrypted, get_encryption_status

def migrate_passwords(db_path='backend/data/devices.db', dry_run=False):
    """
    Migrate all plaintext passwords to encrypted format
    
    Args:
        db_path: Path to devices database
        dry_run: If True, only show what would be done without making changes
    """
    print("=" * 80)
    print("PASSWORD MIGRATION SCRIPT")
    print("=" * 80)
    
    # Check encryption status
    enc_status = get_encryption_status()
    print(f"\n📋 Encryption Status:")
    print(f"  - Enabled: {enc_status['enabled']}")
    print(f"  - Key file: {enc_status['key_file_path']}")
    print(f"  - Algorithm: {enc_status['cipher_algorithm']}")
    print(f"  - Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (will modify database)'}")
    
    if not os.path.exists(db_path):
        print(f"\n❌ Error: Database not found at {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all devices with passwords
        cursor.execute("SELECT id, deviceName, password FROM devices WHERE password IS NOT NULL AND password != ''")
        devices = cursor.fetchall()
        
        if not devices:
            print("\n✅ No devices with passwords found in database")
            conn.close()
            return True
        
        print(f"\n📊 Found {len(devices)} devices with passwords")
        
        # Count encrypted vs plaintext
        encrypted_count = 0
        plaintext_count = 0
        migrated_devices = []
        
        for device_id, device_name, password in devices:
            if is_encrypted(password):
                encrypted_count += 1
                print(f"  ✅ {device_name} (ID: {device_id}): Already encrypted")
            else:
                plaintext_count += 1
                print(f"  🔄 {device_name} (ID: {device_id}): Needs encryption")
                migrated_devices.append((device_id, device_name, password))
        
        print(f"\n📈 Summary:")
        print(f"  - Already encrypted: {encrypted_count}")
        print(f"  - Needs migration: {plaintext_count}")
        
        if plaintext_count == 0:
            print("\n✅ All passwords are already encrypted!")
            conn.close()
            return True
        
        # Migrate plaintext passwords
        if dry_run:
            print(f"\n🔍 DRY RUN: Would encrypt {plaintext_count} passwords")
            print("   Run without --dry-run flag to perform actual migration")
        else:
            print(f"\n🔄 Encrypting {plaintext_count} passwords...")
            
            for device_id, device_name, plaintext_password in migrated_devices:
                try:
                    encrypted_password = encrypt_password(plaintext_password)
                    cursor.execute(
                        "UPDATE devices SET password = ? WHERE id = ?",
                        (encrypted_password, device_id)
                    )
                    print(f"  ✅ {device_name}: Encrypted successfully")
                except Exception as e:
                    print(f"  ❌ {device_name}: Failed to encrypt - {e}")
                    conn.rollback()
                    conn.close()
                    return False
            
            conn.commit()
            print(f"\n✅ Successfully encrypted {plaintext_count} passwords!")
            print(f"\n⚠️  IMPORTANT: Backup the encryption key file:")
            print(f"   {enc_status['key_file_path']}")
            print(f"   Without this file, passwords cannot be decrypted!")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate device passwords to encrypted format")
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--db-path', default='backend/data/devices.db', help='Path to devices database')
    
    args = parser.parse_args()
    
    success = migrate_passwords(db_path=args.db_path, dry_run=args.dry_run)
    
    if success:
        print("\n🎉 Migration completed successfully!")
        sys.exit(0)
    else:
        print("\n💥 Migration failed!")
        sys.exit(1)
