package vectorsearch

import (
	"os"
	"sort"
)

// GetEnv retrieves an environment variable or returns a default value
func GetEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// SortVectorSearchResults sorts vector search results by score in descending order
func SortVectorSearchResults(results []VectorSearchResult) {
	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})
} 