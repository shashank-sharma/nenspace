package tools

import (
	"context"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/shashank-sharma/mcp-server-pocketbase/internal/pocketbase"
)

type ListCollectionsInput struct {
	Token string `json:"auth_token,omitempty" jsonschema:"Admin or user auth token"`
}

type ListCollectionsOutput struct {
	Collections []pocketbase.Collection `json:"collections"`
}

func RegisterSchemaTools(server *mcp.Server, pb *pocketbase.Client) {
	mcp.AddTool(server, &mcp.Tool{
		Name:        "pb_list_collections",
		Description: "List all collections with their schemas to discover available fields and types",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input ListCollectionsInput) (*mcp.CallToolResult, ListCollectionsOutput, error) {
		collections, err := pb.ListCollections(ctx, pb.GetToken(input.Token))
		if err != nil {
			return nil, ListCollectionsOutput{}, err
		}
		return nil, ListCollectionsOutput{Collections: collections}, nil
	})
}
