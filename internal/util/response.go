package util

import (
	"github.com/pocketbase/pocketbase/core"
)

// RespondError sends a standardized error response using APIError
func RespondError(e *core.RequestEvent, apiErr *APIError) error {
	return e.JSON(apiErr.Status, map[string]interface{}{
		"error":   apiErr.Message,
		"code":    apiErr.Code,
		"message": apiErr.Message,
	})
}

// RespondSuccess sends a standardized success response
func RespondSuccess(e *core.RequestEvent, status int, data interface{}) error {
	response := map[string]interface{}{
		"success": true,
		"data":    data,
	}
	return e.JSON(status, response)
}

// RespondWithError sends an error response with optional error details
func RespondWithError(e *core.RequestEvent, apiErr *APIError, err error) error {
	response := map[string]interface{}{
		"error":   apiErr.Message,
		"code":    apiErr.Code,
		"message": apiErr.Message,
	}

	if err != nil {
		response["details"] = err.Error()
	}

	return e.JSON(apiErr.Status, response)
}
