package util

import (
	"fmt"
	"net/http"
)

// APIError represents a standardized API error response
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Status  int    `json:"-"`
	Err     error  `json:"-"`
}

func (e *APIError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *APIError) Unwrap() error {
	return e.Err
}

// Predefined error types
var (
	ErrBadRequest = &APIError{
		Code:    "BAD_REQUEST",
		Message: "Invalid request",
		Status:  http.StatusBadRequest,
	}

	ErrUnauthorized = &APIError{
		Code:    "UNAUTHORIZED",
		Message: "Authentication required",
		Status:  http.StatusUnauthorized,
	}

	ErrForbidden = &APIError{
		Code:    "FORBIDDEN",
		Message: "Access denied",
		Status:  http.StatusForbidden,
	}

	ErrNotFound = &APIError{
		Code:    "NOT_FOUND",
		Message: "Resource not found",
		Status:  http.StatusNotFound,
	}

	ErrInternalServer = &APIError{
		Code:    "INTERNAL_ERROR",
		Message: "An internal server error occurred",
		Status:  http.StatusInternalServerError,
	}
)

// NewAPIError creates a new API error with a custom message
func NewAPIError(code, message string, status int) *APIError {
	return &APIError{
		Code:    code,
		Message: message,
		Status:  status,
	}
}

// WrapError wraps an error with an API error
func WrapError(apiErr *APIError, err error) *APIError {
	apiErr.Err = err
	return apiErr
}

// NewBadRequestError creates a bad request error with a custom message
func NewBadRequestError(message string) *APIError {
	return &APIError{
		Code:    "BAD_REQUEST",
		Message: message,
		Status:  http.StatusBadRequest,
	}
}

// NewValidationError creates a validation error
func NewValidationError(field, reason string) *APIError {
	return &APIError{
		Code:    "VALIDATION_ERROR",
		Message: fmt.Sprintf("Validation failed for field '%s': %s", field, reason),
		Status:  http.StatusBadRequest,
	}
}
