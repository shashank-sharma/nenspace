package middleware

import (
	"reflect"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/util"
)

// ValidateRequest validates a request body with basic validation
// This is a simple validation helper. For full validation with tags,
// install github.com/go-playground/validator/v10 and use it.
func ValidateRequest(structPtr interface{}) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		if err := e.BindBody(structPtr); err != nil {
			logger.LogError("Failed to parse request body", "error", err)
			return util.RespondError(e, util.NewBadRequestError("Invalid request body"))
		}

		// Basic validation: check for required fields (fields tagged with "required")
		if err := validateRequiredFields(structPtr); err != nil {
			logger.LogError("Validation failed", "error", err)
			return util.RespondError(e, util.NewValidationError("request", err.Error()))
		}

		return e.Next()
	}
}

// validateRequiredFields performs basic validation on struct fields
func validateRequiredFields(v interface{}) error {
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Ptr {
		rv = rv.Elem()
	}

	if rv.Kind() != reflect.Struct {
		return nil
	}

	rt := rv.Type()
	for i := 0; i < rv.NumField(); i++ {
		field := rt.Field(i)
		fieldValue := rv.Field(i)

		// Check for "required" tag
		if tag := field.Tag.Get("json"); tag != "" {
			// Skip if field is empty and has "required" in validation tag
			if validationTag := field.Tag.Get("validate"); strings.Contains(validationTag, "required") {
				if isEmptyValue(fieldValue) {
					fieldName := field.Name
					if jsonTag := field.Tag.Get("json"); jsonTag != "" && jsonTag != "-" {
						fieldName = strings.Split(jsonTag, ",")[0]
					}
					return util.NewValidationError(fieldName, fieldName+" is required")
				}
			}
		}
	}

	return nil
}

// isEmptyValue checks if a reflect.Value is empty
func isEmptyValue(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.String:
		return v.Len() == 0
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return v.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return v.Float() == 0
	case reflect.Bool:
		return !v.Bool()
	case reflect.Ptr, reflect.Interface, reflect.Slice, reflect.Map:
		return v.IsNil()
	default:
		return false
	}
}
