"""
Mural OAuth Setup Helper
Handles the OAuth flow to get your access token for local development
"""

import os
import urllib.parse
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

CLIENT_ID = os.environ.get("MURAL_CLIENT_ID")
CLIENT_SECRET = os.environ.get("MURAL_CLIENT_SECRET")
REDIRECT_URI = "http://localhost:8080/callback"

# Mural OAuth URLs
AUTHORIZE_URL = "https://app.mural.co/api/public/v1/authorization/oauth2"
TOKEN_URL = "https://app.mural.co/api/public/v1/authorization/oauth2/token"

class OAuthHandler(BaseHTTPRequestHandler):
    """Handle the OAuth callback from Mural."""
    
    def do_GET(self):
        """Handle GET request from OAuth callback."""
        if self.path.startswith("/callback"):
            # Parse the authorization code from the callback
            query_params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            
            if "code" in query_params:
                auth_code = query_params["code"][0]
                print(f"✅ Received authorization code: {auth_code[:10]}...")
                
                # Exchange code for access token
                token_response = self.exchange_code_for_token(auth_code)
                
                if token_response:
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    
                    success_html = f"""
                    <html>
                    <head><title>Mural OAuth Success</title></head>
                    <body>
                        <h1>🎉 OAuth Setup Complete!</h1>
                        <p>Your Mural API access token has been configured.</p>
                        <p><strong>Access Token:</strong> {token_response['access_token'][:20]}...</p>
                        <p>You can close this window and return to your terminal.</p>
                        <hr>
                        <p>Next steps:</p>
                        <ol>
                            <li>The token has been saved to your .env file</li>
                            <li>Run <code>python agent.py</code> to test your agent</li>
                            <li>Try <code>python demo_test.py</code> for a full demo</li>
                        </ol>
                    </body>
                    </html>
                    """
                    self.wfile.write(success_html.encode())
                    
                    # Save token to .env file
                    self.save_token_to_env(token_response['access_token'])
                    
                else:
                    self.send_error_response("Failed to exchange code for token")
            
            elif "error" in query_params:
                error = query_params["error"][0]
                error_description = query_params.get("error_description", ["No description"])[0]
                print(f"❌ OAuth error: {error} - {error_description}")
                self.send_error_response(f"OAuth Error: {error} - {error_description}")
            
            else:
                self.send_error_response("No authorization code received")
    
    def exchange_code_for_token(self, auth_code):
        """Exchange authorization code for access token."""
        try:
            token_data = {
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "code": auth_code,
                "redirect_uri": REDIRECT_URI
            }
            
            response = requests.post(TOKEN_URL, data=token_data)
            
            if response.status_code == 200:
                token_info = response.json()
                print("✅ Successfully exchanged code for access token!")
                return token_info
            else:
                print(f"❌ Token exchange failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error during token exchange: {e}")
            return None
    
    def save_token_to_env(self, access_token):
        """Save the access token to the .env file."""
        try:
            env_file_path = ".env"
            
            # Read existing .env content
            env_lines = []
            if os.path.exists(env_file_path):
                with open(env_file_path, 'r') as f:
                    env_lines = f.readlines()
            
            # Update or add the access token
            token_updated = False
            for i, line in enumerate(env_lines):
                if line.startswith("MURAL_ACCESS_TOKEN="):
                    env_lines[i] = f"MURAL_ACCESS_TOKEN={access_token}\n"
                    token_updated = True
                    break
            
            if not token_updated:
                env_lines.append(f"MURAL_ACCESS_TOKEN={access_token}\n")
            
            # Write back to .env file
            with open(env_file_path, 'w') as f:
                f.writelines(env_lines)
            
            print(f"✅ Access token saved to {env_file_path}")
            
        except Exception as e:
            print(f"❌ Error saving token to .env: {e}")
    
    def send_error_response(self, error_message):
        """Send error response to browser."""
        self.send_response(400)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        
        error_html = f"""
        <html>
        <head><title>Mural OAuth Error</title></head>
        <body>
            <h1>❌ OAuth Setup Failed</h1>
            <p><strong>Error:</strong> {error_message}</p>
            <p>Please check your configuration and try again.</p>
            <hr>
            <p>Troubleshooting:</p>
            <ul>
                <li>Verify your MURAL_CLIENT_ID and MURAL_CLIENT_SECRET in .env</li>
                <li>Check that your redirect URI is set to: {REDIRECT_URI}</li>
                <li>Make sure your Mural app has the correct scopes: murals:read, murals:write, users:read</li>
            </ul>
        </body>
        </html>
        """
        self.wfile.write(error_html.encode())
    
    def log_message(self, format, *args):
        """Suppress default HTTP server logging."""
        pass

def start_oauth_flow():
    """Start the OAuth flow to get Mural API access."""
    print("🎨 Mural API OAuth Setup")
    print("=" * 30)
    
    # Check for required environment variables
    if not CLIENT_ID or not CLIENT_SECRET:
        print("❌ Missing required environment variables!")
        print("\nPlease ensure your .env file contains:")
        print("MURAL_CLIENT_ID=your_client_id_here")
        print("MURAL_CLIENT_SECRET=your_client_secret_here")
        print("\nGet these from your Mural developer account at https://developers.mural.co")
        return
    
    print(f"✅ Client ID: {CLIENT_ID[:10]}...")
    print(f"✅ Client Secret: {CLIENT_SECRET[:10]}...")
    print(f"✅ Redirect URI: {REDIRECT_URI}")
    
    # Build authorization URL with ALL available scopes
    scopes = [
        "rooms:read", "users:read", "workspaces:read", "murals:read", 
        "identity:read", "templates:read", "rooms:write", "workspaces:write", 
        "murals:write", "templates:write"
    ]
    
    auth_params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": " ".join(scopes)
    }
    
    auth_url = f"{AUTHORIZE_URL}?" + urllib.parse.urlencode(auth_params)
    
    print(f"\n🌐 Opening browser for Mural authorization...")
    print(f"If the browser doesn't open automatically, visit:")
    print(f"{auth_url}")
    
    # Start local server to handle callback
    print(f"\n🚀 Starting local server on {REDIRECT_URI}...")
    
    try:
        server = HTTPServer(('localhost', 8080), OAuthHandler)
        
        # Open browser
        webbrowser.open(auth_url)
        
        print("⏳ Waiting for authorization callback...")
        print("(Complete the authorization in your browser)")
        
        # Handle one request (the callback)
        server.handle_request()
        
        print("\n🎉 OAuth setup completed!")
        print("\nNext steps:")
        print("1. Your access token has been saved to .env")
        print("2. Run: python agent.py")
        print("3. Test with: python demo_test.py")
        
    except KeyboardInterrupt:
        print("\n❌ Setup cancelled by user")
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
    finally:
        print("\n👋 OAuth setup finished")

if __name__ == "__main__":
    start_oauth_flow()