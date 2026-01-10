package tools

import (
	"context"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/shashank-sharma/mcp-server-pocketbase/internal/pocketbase"
)

func RegisterRecordTools(server *mcp.Server, pb *pocketbase.Client) {
	// List Records
	type ListRecordsInput struct {
		Collection string `json:"collection" jsonschema:"Collection name"`
		Token      string `json:"auth_token,omitempty" jsonschema:"Auth token"`
		Page       int    `json:"page,omitempty" jsonschema:"Page number"`
		PerPage    int    `json:"per_page,omitempty" jsonschema:"Records per page"`
		Sort       string `json:"sort,omitempty" jsonschema:"Sort field (prefix - for desc)"`
		Filter     string `json:"filter,omitempty" jsonschema:"PocketBase filter expression"`
		Expand     string `json:"expand,omitempty" jsonschema:"Relations to expand"`
	}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "pb_list_records",
		Description: "List records from a PocketBase collection with optional filtering, sorting, and pagination",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input ListRecordsInput) (*mcp.CallToolResult, *pocketbase.ListResult, error) {
		opts := pocketbase.ListOptions{
			Page:    input.Page,
			PerPage: input.PerPage,
			Sort:    input.Sort,
			Filter:  input.Filter,
			Expand:  input.Expand,
		}
		result, err := pb.ListRecords(ctx, input.Collection, opts, pb.GetToken(input.Token))
		if err != nil {
			return nil, nil, err
		}
		return nil, result, nil
	})

	// Get Record
	type GetRecordInput struct {
		Collection string `json:"collection" jsonschema:"Collection name"`
		Id         string `json:"id" jsonschema:"Record ID"`
		Token      string `json:"auth_token,omitempty" jsonschema:"Auth token"`
		Expand     string `json:"expand,omitempty" jsonschema:"Relations to expand"`
	}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "pb_get_record",
		Description: "Get a single record from a collection by its ID",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input GetRecordInput) (*mcp.CallToolResult, map[string]any, error) {
		result, err := pb.GetRecord(ctx, input.Collection, input.Id, input.Expand, pb.GetToken(input.Token))
		if err != nil {
			return nil, nil, err
		}
		return nil, result, nil
	})

	// Create Record
	type CreateRecordInput struct {
		Collection string         `json:"collection" jsonschema:"Collection name"`
		Data       map[string]any `json:"data" jsonschema:"Record data to create"`
		Token      string         `json:"auth_token,omitempty" jsonschema:"Auth token"`
	}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "pb_create_record",
		Description: "Create a new record in a PocketBase collection",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input CreateRecordInput) (*mcp.CallToolResult, map[string]any, error) {
		result, err := pb.CreateRecord(ctx, input.Collection, input.Data, pb.GetToken(input.Token))
		if err != nil {
			return nil, nil, err
		}
		return nil, result, nil
	})

	// Update Record
	type UpdateRecordInput struct {
		Collection string         `json:"collection" jsonschema:"Collection name"`
		Id         string         `json:"id" jsonschema:"Record ID to update"`
		Data       map[string]any `json:"data" jsonschema:"Fields to update"`
		Token      string         `json:"auth_token,omitempty" jsonschema:"Auth token"`
	}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "pb_update_record",
		Description: "Update an existing record in a PocketBase collection",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input UpdateRecordInput) (*mcp.CallToolResult, map[string]any, error) {
		result, err := pb.UpdateRecord(ctx, input.Collection, input.Id, input.Data, pb.GetToken(input.Token))
		if err != nil {
			return nil, nil, err
		}
		return nil, result, nil
	})

	// Delete Record
	type DeleteRecordInput struct {
		Collection string `json:"collection" jsonschema:"Collection name"`
		Id         string `json:"id" jsonschema:"Record ID to delete"`
		Token      string `json:"auth_token,omitempty" jsonschema:"Auth token"`
	}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "pb_delete_record",
		Description: "Delete a record from a PocketBase collection",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input DeleteRecordInput) (*mcp.CallToolResult, map[string]string, error) {
		err := pb.DeleteRecord(ctx, input.Collection, input.Id, pb.GetToken(input.Token))
		if err != nil {
			return nil, nil, err
		}
		return nil, map[string]string{"status": "deleted"}, nil
	})
}
