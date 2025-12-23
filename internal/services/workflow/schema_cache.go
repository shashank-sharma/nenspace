package workflow

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

// SchemaCacheEntry represents a cached schema with metadata
type SchemaCacheEntry struct {
	Schema      *types.DataSchema
	ConfigHash  string
	InputHashes []string // Hashes of input node configs
	Timestamp   time.Time
}

// SchemaCache provides thread-safe schema caching with invalidation
type SchemaCache struct {
	cache      map[string]*SchemaCacheEntry
	mutex      sync.RWMutex
	ttl        time.Duration
	maxEntries int
}

// NewSchemaCache creates a new schema cache
func NewSchemaCache(ttl time.Duration, maxEntries int) *SchemaCache {
	return &SchemaCache{
		cache:      make(map[string]*SchemaCacheEntry),
		ttl:        ttl,
		maxEntries: maxEntries,
	}
}

// Get retrieves a cached schema if it exists and is still valid
func (sc *SchemaCache) Get(nodeID string, configHash string, inputHashes []string) (*types.DataSchema, bool) {
	sc.mutex.RLock()
	defer sc.mutex.RUnlock()

	entry, exists := sc.cache[nodeID]
	if !exists {
		return nil, false
	}

	// Check if cache entry is expired
	if time.Since(entry.Timestamp) > sc.ttl {
		return nil, false
	}

	// Check if config has changed
	if entry.ConfigHash != configHash {
		return nil, false
	}

	// Check if any input has changed
	if len(entry.InputHashes) != len(inputHashes) {
		return nil, false
	}

	for i, hash := range inputHashes {
		if i >= len(entry.InputHashes) || entry.InputHashes[i] != hash {
			return nil, false
		}
	}

	return entry.Schema, true
}

// Set stores a schema in the cache
func (sc *SchemaCache) Set(nodeID string, schema *types.DataSchema, configHash string, inputHashes []string) {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()

	// Evict oldest entries if cache is full
	if len(sc.cache) >= sc.maxEntries {
		sc.evictOldest()
	}

	// Copy input hashes to avoid external modification
	inputHashesCopy := make([]string, len(inputHashes))
	copy(inputHashesCopy, inputHashes)

	sc.cache[nodeID] = &SchemaCacheEntry{
		Schema:      schema,
		ConfigHash:  configHash,
		InputHashes: inputHashesCopy,
		Timestamp:   time.Now(),
	}
}

// Invalidate removes a specific node's cache entry
func (sc *SchemaCache) Invalidate(nodeID string) {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	delete(sc.cache, nodeID)
}

// InvalidateWorkflow removes all cache entries for nodes in a workflow
func (sc *SchemaCache) InvalidateWorkflow(workflowID string) {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	// For now, we invalidate all entries
	// In the future, we could track workflow->node mapping
	sc.cache = make(map[string]*SchemaCacheEntry)
}

// Clear removes all cache entries
func (sc *SchemaCache) Clear() {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	sc.cache = make(map[string]*SchemaCacheEntry)
}

// evictOldest removes the oldest cache entry
func (sc *SchemaCache) evictOldest() {
	var oldestKey string
	var oldestTime time.Time
	first := true

	for key, entry := range sc.cache {
		if first || entry.Timestamp.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.Timestamp
			first = false
		}
	}

	if oldestKey != "" {
		delete(sc.cache, oldestKey)
	}
}

// computeConfigHash creates a hash from node config
func computeConfigHash(config map[string]interface{}) string {
	// Simple hash implementation using SHA256
	configJSON, err := json.Marshal(config)
	if err != nil {
		return ""
	}
	
	hash := sha256.Sum256(configJSON)
	return hex.EncodeToString(hash[:])
}

