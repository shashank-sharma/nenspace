package util

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/shashank-sharma/backend/internal/logger"
)

func GenerateRandomId() string {
	return security.RandomStringWithAlphabet(core.DefaultIdLength, core.DefaultIdAlphabet)
}

// GetUserId extracts user ID from JWT token without signature verification.
// WARNING: This function does not verify token signatures. It should only be used
// when the token has already been validated by PocketBase's RequireAuth() middleware
// or when used in contexts where token authenticity is guaranteed by other means.
// For untrusted input, use proper JWT verification libraries.
func GetUserId(tokenString string) (string, error) {
	// Split the token into header, payload, and signature
	parts := strings.Split(tokenString, ".")
	if len(parts) < 2 {
		return "", fmt.Errorf("invalid token format: expected at least 2 parts, got %d", len(parts))
	}

	// Decode the payload (no signature verification)
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		logger.LogError("Error decoding payload:", err)
		return "", fmt.Errorf("failed to decode token payload: %w", err)
	}

	var claims map[string]interface{}
	err = json.Unmarshal(payload, &claims)
	if err != nil {
		logger.LogError("Error unmarshalling payload:", err)
		return "", fmt.Errorf("failed to unmarshal token claims: %w", err)
	}

	// Safe type assertion with error handling
	id, ok := claims["id"]
	if !ok {
		return "", fmt.Errorf("token claims missing 'id' field")
	}

	idStr, ok := id.(string)
	if !ok {
		return "", fmt.Errorf("token 'id' field is not a string, got %T", id)
	}

	if idStr == "" {
		return "", fmt.Errorf("token 'id' field is empty")
	}

	return idStr, nil
}

// AnyToString converts any type to a string representation
func AnyToString(value interface{}) string {
	if value == nil {
		return ""
	}

	// Use reflection to handle special types
	v := reflect.ValueOf(value)

	// Handle pointer types by dereferencing
	if v.Kind() == reflect.Ptr {
		if v.IsNil() {
			return ""
		}
		v = v.Elem()
		value = v.Interface()
	}

	switch val := value.(type) {
	case string:
		return val
	case bool:
		return strconv.FormatBool(val)
	case int:
		return strconv.Itoa(val)
	case int64:
		return strconv.FormatInt(val, 10)
	case int32:
		return strconv.FormatInt(int64(val), 10)
	case int16:
		return strconv.FormatInt(int64(val), 10)
	case int8:
		return strconv.FormatInt(int64(val), 10)
	case uint:
		return strconv.FormatUint(uint64(val), 10)
	case uint64:
		return strconv.FormatUint(val, 10)
	case uint32:
		return strconv.FormatUint(uint64(val), 10)
	case uint16:
		return strconv.FormatUint(uint64(val), 10)
	case uint8:
		return strconv.FormatUint(uint64(val), 10)
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(val), 'f', -1, 32)
	case time.Time:
		return val.Format(time.RFC3339)
	case []byte:
		return string(val)
	default:
		// For complex types, use fmt.Sprintf
		return fmt.Sprintf("%v", val)
	}
}
