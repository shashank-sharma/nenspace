package tools

import (
	"context"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/shashank-sharma/mcp-server-pocketbase/internal/pocketbase"
)

type GetFileURLInput struct {
	Collection string `json:"collection" jsonschema:"Collection name"`
	RecordId   string `json:"record_id" jsonschema:"Record ID"`
	Filename   string `json:"filename" jsonschema:"Filename of the file field"`
}

type GetFileURLOutput struct {
	URL string `json:"url"`
}

func RegisterFileTools(server *mcp.Server, pb *pocketbase.Client) {
	mcp.AddTool(server, &mcp.Tool{
		Name:        "pb_get_file_url",
		Description: "Generate a public URL for a file stored in a PocketBase record",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input GetFileURLInput) (*mcp.CallToolResult, GetFileURLOutput, error) {
		url := pb.GetFileURL(input.Collection, input.RecordId, input.Filename)
		return nil, GetFileURLOutput{URL: url}, nil
	})
}

