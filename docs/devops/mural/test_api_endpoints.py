"""
Systematic test of all Mural API endpoints used by our agent
Tests each endpoint individually to identify working vs broken tools
"""

import os
import requests
import json
from dotenv import load_dotenv

# Load environment
load_dotenv(override=True)

MURAL_BASE_URL = "https://app.mural.co/api/public/v1"
MURAL_ACCESS_TOKEN = os.environ.get("MURAL_ACCESS_TOKEN")

def get_headers():
    """Get headers for Mural API requests."""
    return {
        "Authorization": f"Bearer {MURAL_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

def test_endpoint(name, method, url, payload=None, description=""):
    """Test a specific API endpoint."""
    print(f"\n🔍 Testing: {name}")
    print(f"📝 {description}")
    print(f"🌐 {method} {url}")
    
    try:
        if method == "GET":
            response = requests.get(url, headers=get_headers())
        elif method == "POST":
            response = requests.post(url, headers=get_headers(), json=payload)
        else:
            print(f"❌ Unsupported method: {method}")
            return False
        
        print(f"📊 Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS!")
            
            # Show sample data structure
            if isinstance(data, dict):
                if "value" in data:
                    value = data["value"]
                    if isinstance(value, list):
                        print(f"📋 Returns array with {len(value)} items")
                        if value:
                            print(f"📄 Sample item keys: {list(value[0].keys()) if isinstance(value[0], dict) else 'Not dict'}")
                    else:
                        print(f"📄 Returns: {type(value).__name__}")
                else:
                    print(f"📄 Response keys: {list(data.keys())}")
            
            return True
            
        elif response.status_code == 201:
            print(f"✅ CREATED!")
            return True
            
        elif response.status_code == 404:
            print(f"❌ NOT FOUND - Endpoint doesn't exist")
            return False
            
        elif response.status_code == 403:
            print(f"❌ FORBIDDEN - Missing permissions")
            return False
            
        else:
            print(f"❌ ERROR: {response.status_code}")
            if response.text:
                error_data = response.json() if response.text.startswith('{') else response.text
                print(f"📝 Details: {error_data}")
            return False
            
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False

def main():
    """Test all API endpoints systematically."""
    print("🎨 Mural API Endpoint Testing")
    print("=" * 50)
    
    if not MURAL_ACCESS_TOKEN:
        print("❌ No access token found. Please run oauth_setup.py first.")
        return
    
    print(f"🔑 Testing with token ending in: ...{MURAL_ACCESS_TOKEN[-4:]}")
    
    # Store results
    results = {}
    
    # Test 1: Get Workspaces (KNOWN TO WORK)
    results["get_workspaces"] = test_endpoint(
        "Get Workspaces",
        "GET", 
        f"{MURAL_BASE_URL}/workspaces",
        description="Get all available workspaces for the authenticated user"
    )
    
    # Get workspace ID for subsequent tests
    workspace_id = None
    if results["get_workspaces"]:
        try:
            response = requests.get(f"{MURAL_BASE_URL}/workspaces", headers=get_headers())
            data = response.json()
            workspaces = data.get("value", [])
            if workspaces:
                workspace_id = workspaces[0]["id"]
                print(f"💡 Using workspace ID: {workspace_id}")
        except:
            pass
    
    # Test 2: Get Workspace Murals
    if workspace_id:
        results["get_workspace_murals"] = test_endpoint(
            "Get Workspace Murals",
            "GET",
            f"{MURAL_BASE_URL}/workspaces/{workspace_id}/murals",
            description=f"Get all murals in workspace {workspace_id}"
        )
    
    # Test 3: Search Murals
    results["search_murals"] = test_endpoint(
        "Search Murals",
        "GET",
        f"{MURAL_BASE_URL}/search/murals?query=test",
        description="Search for murals by keywords"
    )
    
    # Test 4: Search Templates
    results["search_templates"] = test_endpoint(
        "Search Templates",
        "GET",
        f"{MURAL_BASE_URL}/search/templates",
        description="Search for mural templates"
    )
    
    # Test 5: Get Default Templates
    results["get_default_templates"] = test_endpoint(
        "Get Default Templates",
        "GET",
        f"{MURAL_BASE_URL}/templates/default",
        description="Get default templates"
    )
    
    # Test 6: Get Templates by Workspace
    if workspace_id:
        results["get_templates_by_workspace"] = test_endpoint(
            "Get Templates by Workspace",
            "GET",
            f"{MURAL_BASE_URL}/workspaces/{workspace_id}/templates",
            description=f"Get templates for workspace {workspace_id}"
        )
    
    # Test 7: Get Workspace Rooms
    if workspace_id:
        results["get_workspace_rooms"] = test_endpoint(
            "Get Workspace Rooms",
            "GET",
            f"{MURAL_BASE_URL}/workspaces/{workspace_id}/rooms",
            description=f"Get rooms in workspace {workspace_id}"
        )
    
    # Get room ID for subsequent tests
    room_id = None
    if workspace_id and results.get("get_workspace_rooms"):
        try:
            response = requests.get(f"{MURAL_BASE_URL}/workspaces/{workspace_id}/rooms", headers=get_headers())
            data = response.json()
            rooms = data.get("value", [])
            if rooms:
                room_id = rooms[0]["id"]
                print(f"💡 Using room ID: {room_id}")
        except:
            pass
    
    # Test 8: Create Mural (if we have room)
    if room_id:
        results["create_mural"] = test_endpoint(
            "Create Mural",
            "POST",
            f"{MURAL_BASE_URL}/murals",
            payload={"title": "API Test Mural", "roomId": room_id},
            description=f"Create a new mural in room {room_id}"
        )
        
        # Get mural ID for widget tests
        mural_id = None
        if results["create_mural"]:
            try:
                response = requests.post(
                    f"{MURAL_BASE_URL}/murals",
                    headers=get_headers(),
                    json={"title": "Widget Test Mural", "roomId": room_id}
                )
                if response.status_code in [200, 201]:
                    data = response.json()
                    mural_value = data.get("value", data)
                    mural_id = mural_value.get("id")
                    print(f"💡 Created test mural ID: {mural_id}")
            except:
                pass
    
    # Test 9: Widget Creation (if we have mural)
    if mural_id:
        # Test sticky note creation
        results["create_sticky_note"] = test_endpoint(
            "Create Sticky Note",
            "POST",
            f"{MURAL_BASE_URL}/murals/{mural_id}/widgets/sticky-note",
            payload={"text": "Test sticky note", "x": 100, "y": 100, "width": 150, "height": 150},
            description=f"Create sticky note in mural {mural_id}"
        )
        
        # Test text box creation  
        results["create_textbox"] = test_endpoint(
            "Create Text Box",
            "POST",
            f"{MURAL_BASE_URL}/murals/{mural_id}/widgets/textbox",
            payload={"text": "Test text box", "x": 300, "y": 100, "width": 200, "height": 100},
            description=f"Create text box in mural {mural_id}"
        )
        
        # Test title creation
        results["create_title"] = test_endpoint(
            "Create Title",
            "POST",
            f"{MURAL_BASE_URL}/murals/{mural_id}/widgets/title",
            payload={"text": "Test Title", "x": 100, "y": 50, "width": 300, "height": 60},
            description=f"Create title in mural {mural_id}"
        )
        
        # Test get widgets
        results["get_mural_widgets"] = test_endpoint(
            "Get Mural Widgets",
            "GET",
            f"{MURAL_BASE_URL}/murals/{mural_id}/widgets",
            description=f"Get all widgets in mural {mural_id}"
        )
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 API ENDPOINT TEST SUMMARY")
    print("=" * 50)
    
    working = []
    broken = []
    
    for endpoint, success in results.items():
        if success:
            working.append(endpoint)
            print(f"✅ {endpoint}")
        else:
            broken.append(endpoint)
            print(f"❌ {endpoint}")
    
    print(f"\n📊 Results: {len(working)} working, {len(broken)} broken")
    
    if working:
        print(f"\n✅ WORKING ENDPOINTS ({len(working)}):")
        for endpoint in working:
            print(f"  • {endpoint}")
    
    if broken:
        print(f"\n❌ BROKEN ENDPOINTS ({len(broken)}):")
        for endpoint in broken:
            print(f"  • {endpoint}")
        print(f"\n💡 These tools need to be fixed or removed from the agent")
    
    print(f"\n🎯 NEXT STEPS:")
    if working:
        print(f"1. Update agent to use only the {len(working)} working endpoints")
        print(f"2. Remove or fix the {len(broken)} broken tools")
        print(f"3. Test the agent with working tools only")
    else:
        print("1. Check API documentation for correct endpoint paths")
        print("2. Verify authentication scopes")

if __name__ == "__main__":
    main()