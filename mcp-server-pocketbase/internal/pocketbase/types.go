package pocketbase

type AuthResponse struct {
	Token  string         `json:"token"`
	Record map[string]any `json:"record"`
}

type ListResult struct {
	Page       int              `json:"page"`
	PerPage    int              `json:"perPage"`
	TotalItems int              `json:"totalItems"`
	TotalPages int              `json:"totalPages"`
	Items      []map[string]any `json:"items"`
}

type Collection struct {
	Id     string   `json:"id"`
	Name   string   `json:"name"`
	Type   string   `json:"type"`
	Schema []Schema `json:"schema"`
}

type Schema struct {
	Id       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Required bool   `json:"required"`
	Options  any    `json:"options"`
}

type ErrorResponse struct {
	Code    int            `json:"code"`
	Message string         `json:"message"`
	Data    map[string]any `json:"data"`
}
