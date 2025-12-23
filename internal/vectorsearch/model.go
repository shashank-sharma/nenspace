package vectorsearch

import (
	"encoding/json"
	"time"
)

// VectorSearchResult represents a single search result with vector similarity
type VectorSearchResult struct {
	ID         string                 `json:"id"`
	Data       map[string]interface{} `json:"data"`
	Collection string                 `json:"collection"`
	Score      float64                `json:"score"`
	Distance   float64                `json:"distance"`
}

// VectorSearchOptions contains parameters for a vector search operation
type VectorSearchOptions struct {
	Query          string   `json:"query"`
	Collections    []string `json:"collections"`
	Page           int      `json:"page"`
	PerPage        int      `json:"perPage"`
	Fields         []string `json:"fields"`
	IncludeContent bool     `json:"includeContent"`
	Threshold      float64  `json:"threshold"`
}

// VectorSearchResponse contains the results of a vector search operation with pagination details
type VectorSearchResponse struct {
	Items      []VectorSearchResult `json:"items"`
	Page       int                  `json:"page"`
	PerPage    int                  `json:"perPage"`
	TotalItems int                  `json:"totalItems"`
	TotalPages int                  `json:"totalPages"`
}

// VectorEmbedding represents an embedding stored in the database
type VectorEmbedding struct {
	ID           string    `json:"id"`
	CollectionID string    `json:"collectionId"`
	RecordID     string    `json:"recordId"`
	Vector       []float32 `json:"vector"`
	Metadata     Metadata  `json:"metadata"`
	Created      time.Time `json:"created"`
	Updated      time.Time `json:"updated"`
}

// Metadata contains additional information about an embedding
type Metadata struct {
	Fields    []string               `json:"fields"`
	FieldData map[string]interface{} `json:"fieldData"`
}

// MarshalVector converts a vector to a string representation for storage
func MarshalVector(vector []float32) (string, error) {
	bytes, err := json.Marshal(vector)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// UnmarshalVector converts a string representation of a vector back to []float32
func UnmarshalVector(vectorStr string) ([]float32, error) {
	var vector []float32
	err := json.Unmarshal([]byte(vectorStr), &vector)
	if err != nil {
		return nil, err
	}
	return vector, nil
} 