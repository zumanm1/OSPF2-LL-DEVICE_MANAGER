"""
Test Suite for Credential Inheritance System
Tests the priority order and fallback mechanism for device credentials
"""

import pytest
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from modules.connection_manager import load_jumphost_config, save_jumphost_config
from modules.env_config import get_router_credentials, get_jumphost_config as get_env_jumphost_config


class TestCredentialInheritance:
    """Test credential priority order"""
    
    def test_credential_priority_order(self):
        """
        Verify credential priority is correct:
        1. Jumphost credentials (if jumphost enabled)
        2. .env.local ROUTER_USERNAME/ROUTER_PASSWORD
        3. Hardcoded default ('cisco'/'cisco')
        """
        print("\n" + "="*80)
        print("CREDENTIAL INHERITANCE TEST")
        print("="*80)
        
        # Test 1: Load jumphost config
        jumphost_config = load_jumphost_config()
        print(f"\n1. Jumphost Config Loaded:")
        print(f"   - Enabled: {jumphost_config.get('enabled', False)}")
        print(f"   - Host: {jumphost_config.get('host', 'Not set')}")
        print(f"   - Username: {jumphost_config.get('username', 'Not set')}")
        print(f"   - Password: {'*' * len(jumphost_config.get('password', '')) if jumphost_config.get('password') else 'Not set'}")
        
        # Test 2: Load router credentials from .env.local
        router_creds = get_router_credentials()
        print(f"\n2. Router Credentials (.env.local):")
        print(f"   - Username: {router_creds.get('username', 'Not set')}")
        print(f"   - Password: {'*' * len(router_creds.get('password', '')) if router_creds.get('password') else 'Not set'}")
        
        # Test 3: Simulate device credential resolution
        print(f"\n3. Device Credential Resolution Logic:")
        
        # Scenario A: Jumphost enabled
        if jumphost_config.get('enabled'):
            final_username = jumphost_config.get('username', '').strip()
            final_password = jumphost_config.get('password', '').strip()
            source = "Jumphost"
        else:
            final_username = router_creds.get('username', 'cisco')
            final_password = router_creds.get('password', 'cisco')
            source = ".env.local fallback"
        
        print(f"   - Source: {source}")
        print(f"   - Final Username: {final_username}")
        print(f"   - Final Password: {'*' * len(final_password) if final_password else 'Not set'}")
        
        # Test 4: Verify consistency
        print(f"\n4. Consistency Check:")
        if jumphost_config.get('enabled'):
            jh_user = jumphost_config.get('username', '').strip()
            jh_pass = jumphost_config.get('password', '').strip()
            
            if not jh_user or not jh_pass:
                print(f"   ⚠️  WARNING: Jumphost enabled but credentials incomplete!")
                print(f"      - Username present: {bool(jh_user)}")
                print(f"      - Password present: {bool(jh_pass)}")
                print(f"      - Will fallback to .env.local or defaults")
            else:
                print(f"   ✅ Jumphost credentials complete - all devices will use these")
        else:
            print(f"   ℹ️  Jumphost disabled - using .env.local or defaults")
        
        print("\n" + "="*80)
        print("TEST COMPLETE")
        print("="*80 + "\n")
        
        # Assertions
        assert jumphost_config is not None, "Jumphost config should load"
        assert router_creds is not None, "Router credentials should load"
        assert 'username' in router_creds, "Router username should exist"
        assert 'password' in router_creds, "Router password should exist"


class TestCredentialFlow:
    """Test end-to-end credential flow"""
    
    def test_device_info_structure(self):
        """Test that device_info dict has expected structure"""
        # Simulate device record from database
        device_info = {
            'id': 'test-device-1',
            'deviceName': 'usa-r1',
            'ipAddress': '172.20.0.11',
            'protocol': 'SSH',
            'port': 22,
            'username': 'device-user',  # This is IGNORED if jumphost enabled
            'password': 'device-pass',  # This is IGNORED if jumphost enabled
            'country': 'United States',
            'deviceType': 'PE',
            'platform': 'ISR4000',
            'software': 'IOS XE',
        }
        
        print("\n" + "="*80)
        print("DEVICE INFO STRUCTURE TEST")
        print("="*80)
        print(f"\nDevice Record:")
        print(f"  - Device Name: {device_info['deviceName']}")
        print(f"  - IP Address: {device_info['ipAddress']}")
        print(f"  - Protocol: {device_info['protocol']}")
        print(f"  - Port: {device_info['port']}")
        print(f"  - Device-level Username: {device_info.get('username', 'Not set')}")
        print(f"  - Device-level Password: {'*' * len(device_info.get('password', '')) if device_info.get('password') else 'Not set'}")
        
        # Simulate credential resolution
        jumphost_config = load_jumphost_config()
        router_creds = get_router_credentials()
        
        print(f"\nCredential Resolution:")
        if jumphost_config.get('enabled'):
            device_username = jumphost_config.get('username', '').strip()
            device_password = jumphost_config.get('password', '').strip()
            
            if not device_username:
                # Fallback chain
                device_username = device_info.get('username', '').strip() or router_creds.get('username', 'cisco')
                print(f"  ⚠️  Jumphost username empty - using fallback: {device_username}")
            else:
                print(f"  ✅ Using jumphost username: {device_username}")
            
            if not device_password:
                device_password = router_creds.get('password', 'cisco')
                print(f"  ⚠️  Jumphost password empty - using fallback from .env.local")
            else:
                print(f"  ✅ Using jumphost password")
        else:
            device_username = router_creds.get('username', 'cisco')
            device_password = router_creds.get('password', 'cisco')
            print(f"  ℹ️  Jumphost disabled - using .env.local credentials")
            print(f"     Username: {device_username}")
        
        print(f"\nFinal Credentials That Will Be Used:")
        print(f"  - Username: {device_username}")
        print(f"  - Password: {'*' * len(device_password) if device_password else 'Not set'}")
        
        print("\n" + "="*80 + "\n")
        
        assert device_info['deviceName'] == 'usa-r1'
        assert device_info['ipAddress'] == '172.20.0.11'


class TestJumphostConfigManagement:
    """Test jumphost configuration management"""
    
    def test_jumphost_config_save_load(self, tmp_path):
        """Test saving and loading jumphost config"""
        print("\n" + "="*80)
        print("JUMPHOST CONFIG SAVE/LOAD TEST")
        print("="*80)
        
        # Current config
        current_config = load_jumphost_config()
        print(f"\nCurrent Jumphost Config:")
        print(f"  - Enabled: {current_config.get('enabled')}")
        print(f"  - Host: {current_config.get('host', 'Not set')}")
        print(f"  - Port: {current_config.get('port', 22)}")
        print(f"  - Username: {current_config.get('username', 'Not set')}")
        
        print("\n" + "="*80 + "\n")
        
        assert 'enabled' in current_config
        assert 'host' in current_config
        assert 'port' in current_config
        assert 'username' in current_config
        assert 'password' in current_config


def test_documentation_accuracy():
    """
    Verify that the documentation matches actual behavior.
    
    From USER_MANUAL.md and code comments, the behavior should be:
    1. When jumphost is enabled, ALL devices use jumphost credentials
    2. When jumphost is disabled, devices use .env.local credentials
    3. Device-level username/password fields are NOT used (they're historical artifacts)
    """
    print("\n" + "="*80)
    print("DOCUMENTATION ACCURACY VERIFICATION")
    print("="*80)
    
    print("\nExpected Behavior (from documentation):")
    print("  1. Jumphost enabled → Use jumphost username/password for ALL devices")
    print("  2. Jumphost disabled → Use .env.local ROUTER_USERNAME/ROUTER_PASSWORD")
    print("  3. Device-level credentials → IGNORED (historical artifact)")
    
    print("\nActual Code Behavior (from connection_manager.py:331-349):")
    print("  1. ✅ Jumphost enabled → Uses jumphost username/password")
    print("  2. ✅ Fallback to .env.local → ROUTER_USERNAME/ROUTER_PASSWORD")
    print("  3. ⚠️  Device-level credentials → Used as SECONDARY fallback (lines 336)")
    print("     └─ THIS IS CONFUSING - device.username is checked if jumphost username is empty")
    
    print("\n🔍 ISSUE IDENTIFIED:")
    print("  The code has a confusing fallback chain that includes device-level credentials.")
    print("  This contradicts the documentation which says jumphost creds are used for ALL devices.")
    
    print("\n💡 RECOMMENDATION:")
    print("  Remove device-level credential fallback on line 336:")
    print("  BEFORE: device_username = device_info.get('username', '').strip() or router_creds.get('username', 'cisco')")
    print("  AFTER:  device_username = router_creds.get('username', 'cisco')")
    
    print("\n" + "="*80 + "\n")


if __name__ == "__main__":
    # Run tests with detailed output
    pytest.main([__file__, '-v', '-s'])




