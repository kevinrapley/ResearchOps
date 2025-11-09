"""
Demo and Test Script for Mural Content Assistant
Shows example usage and tests core functionality
"""

import os
import sys
from dotenv import load_dotenv

# Add the current directory to the path so we can import our modules
sys.path.append(os.path.dirname(__file__))

from agent import create_mural_agent
from mural_tools import get_mural_tools
from langchain_core.messages import HumanMessage

def test_environment_setup():
    """Test that environment variables are properly configured."""
    print("🔧 Testing Environment Setup...")
    
    load_dotenv(override=True)
    
    required_vars = [
        "OPENAI_API_KEY",
        "MURAL_ACCESS_TOKEN"
    ]
    
    optional_vars = [
        "MURAL_CLIENT_ID", 
        "MURAL_CLIENT_SECRET",
        "MURAL_DEFAULT_WORKSPACE_ID",
        "MURAL_DEFAULT_ROOM_ID"
    ]
    
    print("\n📋 Required Environment Variables:")
    all_required_set = True
    for var in required_vars:
        value = os.environ.get(var)
        if value:
            print(f"  ✅ {var}: {'*' * 8}...{value[-4:] if len(value) > 4 else '****'}")
        else:
            print(f"  ❌ {var}: Not set")
            all_required_set = False
    
    print("\n📋 Optional Environment Variables:")
    for var in optional_vars:
        value = os.environ.get(var)
        if value:
            print(f"  ✅ {var}: {'*' * 8}...{value[-4:] if len(value) > 4 else '****'}")
        else:
            print(f"  ⚠️  {var}: Not set (will use fallbacks)")
    
    if all_required_set:
        print("\n✅ Environment setup looks good!")
        return True
    else:
        print("\n❌ Missing required environment variables. Please check your .env file.")
        return False

def test_tools_import():
    """Test that all Mural tools can be imported and initialized."""
    print("\n🛠️  Testing Mural Tools Import...")
    
    try:
        tools = get_mural_tools()
        print(f"✅ Successfully imported {len(tools)} Mural tools:")
        
        for tool in tools:
            print(f"  • {tool.name}: {tool.description[:50]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to import tools: {e}")
        return False

def test_agent_creation():
    """Test that the LangGraph agent can be created successfully."""
    print("\n🤖 Testing Agent Creation...")
    
    try:
        agent = create_mural_agent()
        print("✅ Agent created successfully!")
        return agent
        
    except Exception as e:
        print(f"❌ Failed to create agent: {e}")
        return None

def test_basic_interaction(agent):
    """Test basic interaction with the agent."""
    print("\n💬 Testing Basic Interaction...")
    
    test_message = "Hello! What can you help me with regarding Mural?"
    
    try:
        result = agent.invoke({
            "messages": [HumanMessage(content=test_message)],
            "current_action": "starting",
            "error_messages": [],
            "mural_context": {}
        })
        
        last_message = result["messages"][-1]
        print(f"👤 User: {test_message}")
        print(f"🤖 Agent: {last_message.content[:200]}...")
        print("✅ Basic interaction successful!")
        return True
        
    except Exception as e:
        print(f"❌ Basic interaction failed: {e}")
        return False

def demo_conversations(agent):
    """Run demonstration conversations showing agent capabilities."""
    print("\n🎭 Running Demo Conversations...")
    
    demo_queries = [
        {
            "query": "What workspaces do I have access to?",
            "description": "Testing workspace discovery"
        },
        {
            "query": "Search for templates about retrospectives",
            "description": "Testing template search"
        },
        {
            "query": "Create a new mural called 'Team Brainstorming Session'",
            "description": "Testing mural creation"
        },
        {
            "query": "Search for murals about 'user research' in my workspace",
            "description": "Testing mural search"
        }
    ]
    
    for i, demo in enumerate(demo_queries, 1):
        print(f"\n--- Demo {i}: {demo['description']} ---")
        print(f"👤 User: {demo['query']}")
        
        try:
            result = agent.invoke({
                "messages": [HumanMessage(content=demo['query'])],
                "current_action": "starting",
                "error_messages": [],
                "mural_context": {}
            })
            
            last_message = result["messages"][-1]
            print(f"🤖 Agent: {last_message.content}")
            
            # Check if tools were called
            if len(result["messages"]) > 2:  # User message + Agent response + Tool messages
                print("🔧 Tools were executed during this interaction")
            
        except Exception as e:
            print(f"❌ Demo failed: {e}")
    
    print("\n✅ Demo conversations completed!")

def run_interactive_demo():
    """Run an interactive demo session."""
    print("\n🎮 Interactive Demo Mode")
    print("Try these example commands:")
    print("  • 'Create a retrospective mural for our team'")
    print("  • 'What workspaces do I have?'")
    print("  • 'Search for brainstorming templates'")
    print("  • 'Add a sticky note saying Hello World'")
    print("Type 'quit' to exit.\n")
    
    agent = create_mural_agent()
    conversation_state = {
        "messages": [],
        "current_action": "starting",
        "error_messages": [],
        "mural_context": {}
    }
    
    while True:
        try:
            user_input = input("👤 You: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'bye']:
                print("👋 Demo session ended!")
                break
            
            if not user_input:
                continue
            
            # Add user message
            conversation_state["messages"].append(HumanMessage(content=user_input))
            
            # Get agent response
            result = agent.invoke(conversation_state)
            conversation_state = result
            
            # Display response
            last_message = result["messages"][-1]
            print(f"🤖 Agent: {last_message.content}\n")
            
        except KeyboardInterrupt:
            print("\n👋 Demo session ended!")
            break
        except Exception as e:
            print(f"❌ Error: {e}\n")

def main():
    """Main test and demo function."""
    print("🎨 Mural Content Assistant - Demo & Test Suite")
    print("=" * 50)
    
    # Test environment setup
    if not test_environment_setup():
        print("\n💡 To fix environment issues:")
        print("1. Copy .env.example to .env")
        print("2. Fill in your Mural API credentials")
        print("3. Add your OpenAI API key")
        return
    
    # Test tools import
    if not test_tools_import():
        return
    
    # Test agent creation
    agent = test_agent_creation()
    if not agent:
        return
    
    # Test basic interaction
    if not test_basic_interaction(agent):
        return
    
    # Run demo conversations
    demo_conversations(agent)
    
    # Check if user wants interactive mode
    print("\n🎮 Would you like to try the interactive demo? (y/n)")
    choice = input().strip().lower()
    
    if choice in ['y', 'yes']:
        run_interactive_demo()
    
    print("\n🎉 Demo and testing completed!")
    print("\nNext steps:")
    print("• Run 'python agent.py' for full interactive mode")
    print("• Check the README.md for detailed usage instructions")
    print("• Configure your Mural workspace and room defaults in .env")

if __name__ == "__main__":
    main()