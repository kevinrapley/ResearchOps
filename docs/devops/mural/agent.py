"""
Mural Content Assistant Agent
A natural language interface for the Mural API using LangGraph
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Any, TypedDict, Annotated

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
# Removed ToolNode import - implementing custom tool execution

# Load environment variables
from dotenv import load_dotenv
import os
# Load local .env file first, then override with any parent .env files
current_dir = os.path.dirname(os.path.abspath(__file__))
local_env_path = os.path.join(current_dir, '.env')
load_dotenv(dotenv_path=local_env_path, override=True)

# Verify LangSmith configuration is loaded
if os.getenv("LANGCHAIN_TRACING_V2") == "true":
    print(f"✅ LangSmith tracing enabled for project: {os.getenv('LANGCHAIN_PROJECT', 'default')}")
else:
    print("⚠️  LangSmith tracing not enabled - set LANGCHAIN_TRACING_V2=true in .env")

# Import Mural tools
from mural_tools import get_mural_tools

# Import Perplexity tools
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'core', 'integrations', 'productivity', 'perplexity'))
from tools import get_perplexity_tools

# Agent State Definition
class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    current_action: str
    error_messages: List[str]
    mural_context: Dict[str, Any]

# Initialize LLM and Tools
def get_llm():
    """Initialize the LLM with proper configuration."""
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.1,
        streaming=True
    )

def get_all_tools():
    """Get all tools for the agent."""
    mural_tools = get_mural_tools()
    perplexity_tools = get_perplexity_tools()
    
    return mural_tools + perplexity_tools

# System Prompt
def get_system_prompt() -> str:
    """Get the system prompt for the Mural Content Assistant."""
    current_date = datetime.now().strftime("%Y-%m-%d")
    tools = get_all_tools()
    tool_count = len(tools)
    
    return f"""You are the Mural Content Assistant, a specialized AI agent that provides a natural language interface to the Mural visual collaboration platform.

## Current Date: {current_date}

## Your Capabilities ({tool_count} tools available):

### Mural Management:
- Create new murals with custom titles and settings
- Search for existing murals by keywords or content
- Get detailed information about specific murals
- List murals within workspaces

### Content Creation:
- Add sticky notes with custom text and positioning
- Create text boxes for longer content
- Add titles and headers to organize content
- View existing widgets and content in murals

### Collaboration Management:
- View current collaborators on murals
- Invite users to murals via email
- Manage user permissions and access
- List available workspaces

### Discovery:
- Search for mural templates by category
- Find murals across workspaces
- Browse available templates and examples

### Information Retrieval (When Explicitly Requested):
- Use Perplexity AI for real-time web research and information gathering
- Search for suppliers, vendors, market data, or industry insights
- Conduct market research and competitive analysis
- Find recent news and developments on specific topics
- IMPORTANT: Only use Perplexity tools when users explicitly ask for web research or mention "Perplexity"

## Guidelines:

### Data Transparency:
- ALWAYS use real data from tool responses when available
- Clearly indicate when data comes from "REAL Mural API - Direct Integration"
- If APIs fail, provide fallback data but label it as "Demo Data - API Error"
- Never fabricate data - always use what the tools provide

### User Experience:
- Provide clear, actionable responses
- Include mural URLs when creating or referencing murals
- Explain what actions were taken and their results
- When auto-placing sticky notes, mention where they were intelligently positioned (e.g., "placed in a vertical list", "organized in a grid", "positioned near existing content")
- Offer helpful next steps when appropriate

### Error Handling:
- If Mural API credentials are missing, guide users to set up authentication
- Provide graceful fallbacks when API calls fail
- Suggest alternatives when operations can't be completed
- Always maintain a helpful, professional tone

### Natural Language Processing:
- Understand context from previous messages
- Parse spatial references like "in the customer section", "near the priorities area", "below the timeline"
- Infer appropriate positioning for content creation based on existing mural content
- Use contextual placement when users reference specific areas, widgets, or sections
- Suggest reasonable defaults for mural organization
- Ask clarifying questions when requests are ambiguous

## Example Interactions:

User: "Create a retrospective mural for our sprint team"
You: I'll create a retrospective mural for your team. [calls create_mural tool]
→ "Created 'Sprint Retrospective' mural! You can access it here: [URL]. Would you like me to add the standard retrospective sections?"

User: "Add sticky notes for What Went Well, What Could Improve, and Action Items"  
You: I'll add those section headers to organize your retrospective. [calls create_title for each section]
→ "Added three section headers to your mural! Team members can now add their feedback under each category."

User: "Find murals about user research from our team"
You: Let me search for user research murals in your workspace. [calls search_murals]
→ "Found 3 user research murals: [list with titles, dates, and links]"

User: "Use Perplexity to find suppliers for sustainable packaging materials"
You: I'll search for sustainable packaging suppliers using Perplexity. [calls perplexity_search]
→ "Found several sustainable packaging suppliers: [details]. Would you like me to add this information to a mural as sticky notes?"

User: "Add sticky notes for our weekly action items"
You: I'll add sticky notes for your action items. [calls create_sticky_note with auto-placement]
→ "Added sticky notes for your action items! I've placed them in a vertical list format on the left side of the mural for easy tracking."

User: "Add a purple sticky note in the 'customer relationships' section"
You: I'll add a purple sticky note to the customer relationships area. [calls create_sticky_note with contextual placement]
→ "Added a purple sticky note in the customer relationships section! I found the existing 'customer relationships' widget and placed the new sticky note inside that area."

## Important Notes:
- Always use the tools provided rather than making assumptions
- Include specific details like mural IDs, URLs, and user information in responses
- Maintain context about which mural the user is working with
- Offer proactive suggestions for improving collaboration workflows

Remember: You're helping teams collaborate more effectively through visual thinking and digital workspace management. Make the Mural platform accessible through natural conversation!"""

# Agent Nodes
def agent_node(state: AgentState) -> AgentState:
    """Main agent node that processes user input and decides on actions."""
    try:
        llm = get_llm()
        tools = get_all_tools()
        llm_with_tools = llm.bind_tools(tools)
        
        system_message = HumanMessage(content=get_system_prompt())
        messages = [system_message] + state["messages"]
        
        response = llm_with_tools.invoke(messages)
        
        # Update state
        state["messages"].append(response)
        
        # Track current action based on tool calls
        if response.tool_calls:
            tool_names = [call["name"] for call in response.tool_calls]
            state["current_action"] = f"executing_tools: {', '.join(tool_names)}"
        else:
            state["current_action"] = "responding"
        
        return state
        
    except Exception as e:
        error_msg = f"Agent error: {str(e)}"
        if "error_messages" not in state:
            state["error_messages"] = []
        state["error_messages"].append(error_msg)
        
        # Add error response message
        error_response = AIMessage(content=f"I encountered an error while processing your request: {error_msg}. Please try again or rephrase your request.")
        state["messages"].append(error_response)
        
        return state

def tools_node(state: AgentState) -> AgentState:
    """Execute tools and return results."""
    try:
        tools = get_all_tools()
        tool_map = {tool.name: tool for tool in tools}
        
        last_message = state["messages"][-1]
        tool_messages = []
        
        for tool_call in last_message.tool_calls:
            tool_name = tool_call["name"]
            tool_args = tool_call["args"]
            
            if tool_name in tool_map:
                result = tool_map[tool_name].invoke(tool_args)
                tool_messages.append(ToolMessage(
                    content=str(result),
                    tool_call_id=tool_call["id"]
                ))
            else:
                error_msg = f"Tool '{tool_name}' not found"
                tool_messages.append(ToolMessage(
                    content=json.dumps({"error": True, "message": error_msg}),
                    tool_call_id=tool_call["id"]
                ))
        
        state["messages"].extend(tool_messages)
        state["current_action"] = "tools_completed"
        
        return state
        
    except Exception as e:
        error_msg = f"Tools execution error: {str(e)}"
        if "error_messages" not in state:
            state["error_messages"] = []
        state["error_messages"].append(error_msg)
        
        # Add error tool message
        error_tool_msg = ToolMessage(
            content=json.dumps({"error": True, "message": error_msg}),
            tool_call_id="error"
        )
        state["messages"].append(error_tool_msg)
        
        return state

# Routing Logic
def should_continue(state: AgentState) -> str:
    """Determine next node based on current state."""
    last_message = state["messages"][-1]
    
    # If the last message has tool calls, go to tools
    if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
        return "tools"
    
    # If we just completed tools, go back to agent
    if state.get("current_action") == "tools_completed":
        return "agent"
    
    # Otherwise, end the conversation
    return END

# Build the Graph
def create_mural_agent():
    """Create and return the Mural Content Assistant LangGraph agent."""
    
    # Initialize state
    def initialize_state():
        return AgentState(
            messages=[],
            current_action="starting",
            error_messages=[],
            mural_context={}
        )
    
    # Create the state graph
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tools_node)
    
    # Add edges
    workflow.add_edge("tools", "agent")
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "agent": "agent",
            END: END
        }
    )
    
    # Set entry point
    workflow.set_entry_point("agent")
    
    # Compile the graph
    return workflow.compile()

# Test function
def test_agent():
    """Test the Mural Content Assistant agent."""
    print("🎨 Testing Mural Content Assistant Agent...")
    
    agent = create_mural_agent()
    
    # Test queries
    test_queries = [
        "Hello! What can you help me with?",
        "Create a new mural for our team brainstorming session",
        "What workspaces do I have access to?",
        "Search for templates related to retrospectives"
    ]
    
    for query in test_queries:
        print(f"\n👤 User: {query}")
        
        try:
            result = agent.invoke({
                "messages": [HumanMessage(content=query)],
                "current_action": "starting",
                "error_messages": [],
                "mural_context": {}
            })
            
            last_message = result["messages"][-1]
            if isinstance(last_message, AIMessage):
                print(f"🤖 Assistant: {last_message.content}")
            else:
                print(f"🤖 Assistant: {last_message}")
                
        except Exception as e:
            print(f"❌ Error: {e}")
    
    print("\n✅ Agent testing completed!")

# Interactive function
def run_interactive():
    """Run the agent in interactive mode."""
    print("🎨 Welcome to the Mural Content Assistant!")
    print("I can help you create murals, add content, manage collaborators, and more.")
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
                print("👋 Goodbye! Happy collaborating!")
                break
            
            if not user_input:
                continue
            
            # Add user message to conversation
            conversation_state["messages"].append(HumanMessage(content=user_input))
            
            # Get agent response
            result = agent.invoke(conversation_state)
            
            # Update conversation state
            conversation_state = result
            
            # Display response
            last_message = result["messages"][-1]
            if isinstance(last_message, AIMessage):
                print(f"🤖 Assistant: {last_message.content}\n")
            
        except KeyboardInterrupt:
            print("\n👋 Goodbye! Happy collaborating!")
            break
        except Exception as e:
            print(f"❌ Error: {e}\n")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        test_agent()
    else:
        run_interactive()