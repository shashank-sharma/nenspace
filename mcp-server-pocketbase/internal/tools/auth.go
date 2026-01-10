package tools

import (
	"context"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/shashank-sharma/mcp-server-pocketbase/internal/pocketbase"
)

type AuthUserInput struct {
	Email    string `json:"email" jsonschema:"User email address"`
	Password string `json:"password" jsonschema:"User password"`
}

type AuthUserOutput struct {
	Token  string         `json:"token"`
	User   map[string]any `json:"user"`
}

func RegisterAuthTools(server *mcp.Server, pb *pocketbase.Client) {
	mcp.AddTool(server, &mcp.Tool{
		Name:        "pb_auth_user",
		Description: "Authenticate with email and password to get an auth token",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input AuthUserInput) (*mcp.CallToolResult, AuthUserOutput, error) {
		resp, err := pb.AuthWithPassword(ctx, input.Email, input.Password)
		if err != nil {
			return nil, AuthUserOutput{}, err
		}
		return nil, AuthUserOutput{
			Token: resp.Token,
			User:  resp.Record,
		}, nil
	})

	type GetCurrentUserInput struct {
		Token string `json:"auth_token" jsonschema:"Auth token from pb_auth_user"`
	}

	type GetCurrentUserOutput struct {
		User map[string]any `json:"user"`
	}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "pb_get_current_user",
		Description: "Get details of the currently authenticated user",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input GetCurrentUserInput) (*mcp.CallToolResult, GetCurrentUserOutput, error) {
		user, err := pb.GetCurrentUser(ctx, input.Token)
		if err != nil {
			return nil, GetCurrentUserOutput{}, err
		}
		return nil, GetCurrentUserOutput{User: user}, nil
	})

	type RefreshTokenInput struct {
		Token string `json:"auth_token" jsonschema:"Existing auth token to refresh"`
	}

	type RefreshTokenOutput struct {
		Token string         `json:"token"`
		User  map[string]any `json:"user"`
	}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "pb_refresh_token",
		Description: "Refresh an expiring auth token",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input RefreshTokenInput) (*mcp.CallToolResult, RefreshTokenOutput, error) {
		resp, err := pb.RefreshToken(ctx, input.Token)
		if err != nil {
			return nil, RefreshTokenOutput{}, err
		}
		return nil, RefreshTokenOutput{
			Token: resp.Token,
			User:  resp.Record,
		}, nil
	})
}

