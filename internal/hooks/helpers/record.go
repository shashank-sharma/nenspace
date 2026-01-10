package helpers

import (
	"fmt"

	"github.com/pocketbase/pocketbase/core"
)

func GetInt64FromRecord(record *core.Record, field string) int64 {
	value := record.Get(field)
	if value == nil {
		return 0
	}

	switch v := value.(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case float64:
		return int64(v)
	case string:
		var result int64
		fmt.Sscanf(v, "%d", &result)
		return result
	default:
		return 0
	}
}

func HasField(record *core.Record, field string) bool {
	return record.Get(field) != nil
}
