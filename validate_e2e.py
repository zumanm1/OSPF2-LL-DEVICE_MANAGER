#!/usr/bin/env python3
"""E2E Validation Script for OSPF Device Manager Pipeline"""
import requests
import os
from pathlib import Path

BASE_URL = "http://localhost:9051"
DATA_DIR = Path("/Users/macbook/OSPF-LL-DEVICE_MANAGER/backend/data/current/TEXT")

def validate_step1():
    """Validate Step 1: Automation - Device Connectivity"""
    print("\n" + "="*60)
    print("STEP 1: AUTOMATION VALIDATION")
    print("="*60)

    # Check automation status
    try:
        resp = requests.get(f"{BASE_URL}/api/automation/status")
        status = resp.json()
        print(f"Automation Status: {status.get('status', 'unknown')}")
    except Exception as e:
        print(f"Error getting automation status: {e}")

    # Check device connectivity
    try:
        resp = requests.get(f"{BASE_URL}/api/devices")
        data = resp.json()
        devices = data.get('devices', [])

        reachable = [d for d in devices if d.get('status') == 'reachable']
        unreachable = [d for d in devices if d.get('status') != 'reachable']

        print(f"\nDevice Connectivity: {len(reachable)}/{len(devices)} reachable")
        print("\nReachable devices:")
        for d in reachable:
            print(f"  ✓ {d.get('hostname')} ({d.get('id')}) - {d.get('ip')}")

        if unreachable:
            print(f"\nUnreachable devices ({len(unreachable)}):")
            for d in unreachable:
                print(f"  ✗ {d.get('hostname')} ({d.get('id')}) - {d.get('ip')}")

        return len(reachable) == 10
    except Exception as e:
        print(f"Error checking devices: {e}")
        return False

def validate_step2():
    """Validate Step 2: Data Collection - File Storage"""
    print("\n" + "="*60)
    print("STEP 2: DATA COLLECTION VALIDATION")
    print("="*60)

    if not DATA_DIR.exists():
        print(f"ERROR: Data directory not found: {DATA_DIR}")
        return False

    txt_files = list(DATA_DIR.glob("*.txt"))
    print(f"Total TEXT files collected: {len(txt_files)}")

    # Count by command type
    command_types = {}
    for f in txt_files:
        parts = f.name.split('_show_')
        if len(parts) > 1:
            cmd = 'show_' + parts[1].rsplit('_2025', 1)[0]
        elif 'running-config' in f.name:
            cmd = 'running-config_router_ospf'
        else:
            cmd = 'unknown'
        command_types[cmd] = command_types.get(cmd, 0) + 1

    print("\nFiles by command type:")
    for cmd, count in sorted(command_types.items()):
        print(f"  {cmd}: {count} files")

    # Check running-config files specifically
    ospf_config_files = list(DATA_DIR.glob("*running-config_router_ospf*.txt"))
    print(f"\nOSPF Config files (running-config router ospf): {len(ospf_config_files)}")
    for f in ospf_config_files:
        device = f.name.split('_show_')[0]
        print(f"  ✓ {device}")

    # Expected: 10 devices × 14 commands = 140 files
    expected = 140
    return len(txt_files) >= expected - 10  # Allow some margin

def validate_step3():
    """Validate Step 3: Transformation - Topology Generation"""
    print("\n" + "="*60)
    print("STEP 3: TRANSFORMATION VALIDATION")
    print("="*60)

    try:
        resp = requests.get(f"{BASE_URL}/api/transform/topology/latest")
        data = resp.json()

        metadata = data.get('metadata', {})
        nodes = data.get('nodes', [])
        links = data.get('links', [])

        print(f"Nodes: {metadata.get('node_count', len(nodes))}")
        print(f"Links: {metadata.get('link_count', len(links))}")
        print(f"Unique costs: {metadata.get('unique_costs', [])}")

        # Analyze cost sources
        cost_sources = {}
        for link in links:
            src = link.get('cost_source', 'unknown')
            cost_sources[src] = cost_sources.get(src, 0) + 1

        print(f"\nCost sources:")
        for src, count in sorted(cost_sources.items()):
            print(f"  {src}: {count} links")

        # Check for asymmetric links
        print(f"\nAsymmetric links (cost_a != cost_b):")
        asymmetric = 0
        for link in links:
            if link.get('cost_a') != link.get('cost_b'):
                asymmetric += 1
                print(f"  {link.get('source')} <-> {link.get('target')}: {link.get('cost_a')} / {link.get('cost_b')}")
        print(f"Total asymmetric: {asymmetric}")

        # Physical links = directional links / 2
        physical_links = len(links) // 2
        print(f"\nPhysical links: {physical_links} (from {len(links)} directional)")

        return len(nodes) == 10 and len(links) == 36

    except Exception as e:
        print(f"Error getting topology: {e}")
        return False

def cross_reference():
    """Cross-reference data between steps"""
    print("\n" + "="*60)
    print("CROSS-REFERENCE: DATA FLOW VALIDATION")
    print("="*60)

    # Get devices
    resp = requests.get(f"{BASE_URL}/api/devices")
    devices = resp.json().get('devices', [])
    device_ids = [d.get('id') for d in devices]

    # Get topology nodes
    resp = requests.get(f"{BASE_URL}/api/transform/topology/latest")
    topo = resp.json()
    node_ids = [n.get('id').lower().replace('zwe-', '') for n in topo.get('nodes', [])]

    print(f"Devices in inventory: {device_ids}")
    print(f"Nodes in topology: {node_ids}")

    # Check all devices appear in topology
    missing = set(device_ids) - set(node_ids)
    if missing:
        print(f"WARNING: Devices missing from topology: {missing}")
    else:
        print("✓ All devices appear in topology")

    # Check file coverage
    txt_files = list(DATA_DIR.glob("*.txt"))
    devices_with_files = set()
    for f in txt_files:
        device = f.name.split('_show_')[0]
        devices_with_files.add(device.replace('zwe-', ''))

    print(f"\nDevices with collected data: {len(devices_with_files)}")
    missing_data = set(device_ids) - devices_with_files
    if missing_data:
        print(f"WARNING: Devices missing data files: {missing_data}")
    else:
        print("✓ All devices have collected data files")

def main():
    print("="*60)
    print("    E2E VALIDATION: OSPF DEVICE MANAGER PIPELINE")
    print("="*60)

    step1_ok = validate_step1()
    step2_ok = validate_step2()
    step3_ok = validate_step3()
    cross_reference()

    print("\n" + "="*60)
    print("VALIDATION SUMMARY")
    print("="*60)
    print(f"Step 1 (Automation):     {'✓ PASS' if step1_ok else '✗ FAIL'}")
    print(f"Step 2 (Data Collection): {'✓ PASS' if step2_ok else '✗ FAIL'}")
    print(f"Step 3 (Transformation):  {'✓ PASS' if step3_ok else '✗ FAIL'}")
    print("="*60)

    if step1_ok and step2_ok and step3_ok:
        print("✓ ALL STEPS VALIDATED SUCCESSFULLY")
    else:
        print("✗ SOME STEPS FAILED VALIDATION")

if __name__ == "__main__":
    main()
