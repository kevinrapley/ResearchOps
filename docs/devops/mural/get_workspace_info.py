"""
Get Workspace and Room Information for Mural Agent Configuration
Helps you find the IDs to set as defaults in your .env file
"""

import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
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

def get_workspaces():
    """Get all available workspaces."""
    try:
        response = requests.get(
            f"{MURAL_BASE_URL}/workspaces",
            headers=get_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            workspaces = data.get("value", [])
            
            print("🏢 Available Workspaces:")
            print("=" * 40)
            
            for i, workspace in enumerate(workspaces, 1):
                print(f"{i}. {workspace.get('name', 'Unknown')}")
                print(f"   ID: {workspace.get('id')}")
                print(f"   Type: {workspace.get('type', 'Unknown')}")
                print()
            
            return workspaces
        else:
            print(f"❌ Failed to get workspaces: {response.status_code}")
            print(f"Response: {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error getting workspaces: {e}")
        return []

def get_rooms_for_workspace(workspace_id, workspace_name):
    """Get rooms for a specific workspace."""
    try:
        response = requests.get(
            f"{MURAL_BASE_URL}/workspaces/{workspace_id}/rooms",
            headers=get_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            rooms = data.get("value", [])
            
            print(f"📁 Rooms in '{workspace_name}':")
            print("=" * 40)
            
            if not rooms:
                print("No rooms found in this workspace.")
                return []
            
            for i, room in enumerate(rooms, 1):
                print(f"{i}. {room.get('name', 'Unknown')}")
                print(f"   ID: {room.get('id')}")
                print(f"   Type: {room.get('type', 'Unknown')}")
                
                # Get mural count for this room
                mural_count = get_mural_count_for_room(room.get('id'))
                print(f"   Murals: {mural_count}")
                print()
            
            return rooms
        else:
            print(f"❌ Failed to get rooms: {response.status_code}")
            print(f"Response: {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error getting rooms: {e}")
        return []

def get_mural_count_for_room(room_id):
    """Get the number of murals in a room."""
    try:
        response = requests.get(
            f"{MURAL_BASE_URL}/rooms/{room_id}/murals",
            headers=get_headers(),
            params={"limit": 1}  # Just get count, not full list
        )
        
        if response.status_code == 200:
            data = response.json()
            return len(data.get("value", []))
        else:
            return "Unknown"
            
    except Exception:
        return "Unknown"

def update_env_file(workspace_id, room_id):
    """Update the .env file with chosen workspace and room IDs."""
    try:
        env_file_path = ".env"
        
        # Read existing .env content
        env_lines = []
        if os.path.exists(env_file_path):
            with open(env_file_path, 'r') as f:
                env_lines = f.readlines()
        
        # Update or add the IDs
        workspace_updated = False
        room_updated = False
        
        for i, line in enumerate(env_lines):
            if line.startswith("MURAL_DEFAULT_WORKSPACE_ID="):
                env_lines[i] = f"MURAL_DEFAULT_WORKSPACE_ID={workspace_id}\n"
                workspace_updated = True
            elif line.startswith("MURAL_DEFAULT_ROOM_ID="):
                env_lines[i] = f"MURAL_DEFAULT_ROOM_ID={room_id}\n"
                room_updated = True
        
        if not workspace_updated:
            env_lines.append(f"MURAL_DEFAULT_WORKSPACE_ID={workspace_id}\n")
        
        if not room_updated:
            env_lines.append(f"MURAL_DEFAULT_ROOM_ID={room_id}\n")
        
        # Write back to .env file
        with open(env_file_path, 'w') as f:
            f.writelines(env_lines)
        
        print("✅ Updated .env file with default workspace and room IDs!")
        
    except Exception as e:
        print(f"❌ Error updating .env file: {e}")

def main():
    """Main function to help configure workspace and room defaults."""
    print("🎨 Mural Workspace & Room Configuration Helper")
    print("=" * 50)
    
    if not MURAL_ACCESS_TOKEN:
        print("❌ No access token found. Please run oauth_setup.py first.")
        return
    
    print("This tool will help you find workspace and room IDs for your .env file.")
    print("Setting defaults makes it easier to create murals without specifying locations each time.\n")
    
    # Get workspaces
    workspaces = get_workspaces()
    
    if not workspaces:
        print("❌ No workspaces found. Please check your access token and permissions.")
        return
    
    # Let user choose workspace
    print("📝 Choose a workspace to set as default:")
    try:
        choice = int(input("Enter workspace number: ").strip()) - 1
        
        if 0 <= choice < len(workspaces):
            chosen_workspace = workspaces[choice]
            workspace_id = chosen_workspace['id']
            workspace_name = chosen_workspace['name']
            
            print(f"\n✅ Selected workspace: {workspace_name}")
            
            # Get rooms in this workspace
            rooms = get_rooms_for_workspace(workspace_id, workspace_name)
            
            if rooms:
                print("📝 Choose a room to set as default:")
                room_choice = int(input("Enter room number: ").strip()) - 1
                
                if 0 <= room_choice < len(rooms):
                    chosen_room = rooms[room_choice]
                    room_id = chosen_room['id']
                    room_name = chosen_room['name']
                    
                    print(f"✅ Selected room: {room_name}")
                    
                    # Update .env file
                    print(f"\n🔧 Updating .env file with:")
                    print(f"   MURAL_DEFAULT_WORKSPACE_ID={workspace_id}")
                    print(f"   MURAL_DEFAULT_ROOM_ID={room_id}")
                    
                    update_env_file(workspace_id, room_id)
                    
                    print("\n🎉 Configuration complete!")
                    print("\nNext steps:")
                    print("1. Run: python agent.py")
                    print("2. Try: 'Create a new mural for testing'")
                    print("3. The mural will be created in your default room automatically!")
                    
                else:
                    print("❌ Invalid room selection")
            else:
                print("ℹ️  No rooms found in this workspace.")
                print("You can still use the agent, but you'll need to specify room IDs manually.")
        else:
            print("❌ Invalid workspace selection")
            
    except ValueError:
        print("❌ Please enter a valid number")
    except KeyboardInterrupt:
        print("\n👋 Configuration cancelled")

if __name__ == "__main__":
    main()