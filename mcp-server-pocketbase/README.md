# PocketBase MCP Server

An MCP (Model Context Protocol) server for PocketBase, written in Go. This server allows MCP clients (like Claude Desktop) to interact with your PocketBase instance using an LLM.

## Features

- **Auth**: Authenticate users and manage tokens.
- **Schema Discovery**: List all collections and their fields.
- **CRUD**: Full Create, Read, Update, and Delete operations for any collection.
- **Files**: Generate public URLs for record files.
- **Token Refresh**: Automatically handles token validity.

## Installation

### Prerequisites
- Go 1.24+
- A running PocketBase instance

### Build
```bash
cd mcp-server-pocketbase
go build -o mcp-server ./cmd/server
```

## Configuration

The server can be configured via environment variables or a `.env` file:

- `POCKETBASE_URL`: The URL of your PocketBase instance (default: `http://localhost:8090`).
- `LOG_LEVEL`: Logging level (`debug`, `info`, `warn`, `error`).
- `HTTP_TIMEOUT`: Timeout for PocketBase API calls (default: `30s`).

## Usage with Claude Desktop

Add the following to your `config.json` (usually located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "pocketbase": {
      "command": "/path/to/mcp-server-pocketbase/mcp-server",
      "env": {
        "POCKETBASE_URL": "http://your-pocketbase-url:8090"
      }
    }
  }
}
```

## Available Tools

- `pb_auth_user`: Auth with email/password.
- `pb_get_current_user`: Get current user info.
- `pb_refresh_token`: Refresh auth token.
- `pb_list_collections`: Discover schemas.
- `pb_list_records`: Query records with filters and pagination.
- `pb_get_record`: Get single record.
- `pb_create_record`: Create record.
- `pb_update_record`: Update record.
- `pb_delete_record`: Delete record.
- `pb_get_file_url`: Get file URL.

## Development

All logs are directed to `os.Stderr` to ensure they don't interfere with the JSON-RPC communication on `os.Stdin` and `os.Stdout`.

