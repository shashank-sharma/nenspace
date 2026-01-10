package credentials

import "context"

type ContextKey string

const (
	ContextKeyCredentialType ContextKey = "credential_type"
	ContextKeyCredentialID   ContextKey = "credential_id"
	ContextKeyService        ContextKey = "service"
)

type CredentialInfo struct {
	Type    string
	ID      string
	Service string
}

func WithCredentialContext(ctx context.Context, credentialType, credentialID, service string) context.Context {
	ctx = context.WithValue(ctx, ContextKeyCredentialType, credentialType)
	ctx = context.WithValue(ctx, ContextKeyCredentialID, credentialID)
	ctx = context.WithValue(ctx, ContextKeyService, service)
	return ctx
}

func GetCredentialFromContext(ctx context.Context) (*CredentialInfo, bool) {
	credType, ok1 := ctx.Value(ContextKeyCredentialType).(string)
	credID, ok2 := ctx.Value(ContextKeyCredentialID).(string)
	service, ok3 := ctx.Value(ContextKeyService).(string)

	if !ok1 || !ok2 || !ok3 {
		return nil, false
	}

	if credType == "" || credID == "" {
		return nil, false
	}

	return &CredentialInfo{
		Type:    credType,
		ID:      credID,
		Service: service,
	}, true
}
