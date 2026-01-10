package workflow

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sync"
	"sync/atomic"
	"time"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

type SchemaCacheEntry struct {
	Schema      *types.DataSchema
	ConfigHash  string
	InputHashes []string
	Timestamp   time.Time
}

type SchemaCacheMetrics struct {
	Hits      int64
	Misses    int64
	Evictions int64
	Sets      int64
	Size      int
}

type SchemaCache struct {
	cache      map[string]*SchemaCacheEntry
	workflow   map[string][]string
	mutex      sync.RWMutex
	ttl        time.Duration
	maxEntries int
	hits       int64
	misses     int64
	evictions  int64
	sets       int64
}

func NewSchemaCache(ttl time.Duration, maxEntries int) *SchemaCache {
	return &SchemaCache{
		cache:      make(map[string]*SchemaCacheEntry),
		workflow:   make(map[string][]string),
		ttl:        ttl,
		maxEntries: maxEntries,
	}
}

func (sc *SchemaCache) Get(nodeID string, configHash string, inputHashes []string) (*types.DataSchema, bool) {
	sc.mutex.RLock()
	defer sc.mutex.RUnlock()

	entry, exists := sc.cache[nodeID]
	if !exists {
		atomic.AddInt64(&sc.misses, 1)
		return nil, false
	}

	if time.Since(entry.Timestamp) > sc.ttl {
		atomic.AddInt64(&sc.misses, 1)
		return nil, false
	}

	if entry.ConfigHash != configHash {
		atomic.AddInt64(&sc.misses, 1)
		return nil, false
	}

	if len(entry.InputHashes) != len(inputHashes) {
		atomic.AddInt64(&sc.misses, 1)
		return nil, false
	}

	for i, hash := range inputHashes {
		if i >= len(entry.InputHashes) || entry.InputHashes[i] != hash {
			atomic.AddInt64(&sc.misses, 1)
			return nil, false
		}
	}

	atomic.AddInt64(&sc.hits, 1)
	return entry.Schema, true
}

func (sc *SchemaCache) Set(nodeID string, schema *types.DataSchema, configHash string, inputHashes []string) {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()

	if len(sc.cache) >= sc.maxEntries {
		sc.evictOldest()
		atomic.AddInt64(&sc.evictions, 1)
	}

	inputHashesCopy := make([]string, len(inputHashes))
	copy(inputHashesCopy, inputHashes)

	sc.cache[nodeID] = &SchemaCacheEntry{
		Schema:      schema,
		ConfigHash:  configHash,
		InputHashes: inputHashesCopy,
		Timestamp:   time.Now(),
	}

	atomic.AddInt64(&sc.sets, 1)
}

func (sc *SchemaCache) SetWithWorkflow(workflowID string, nodeID string, schema *types.DataSchema, configHash string, inputHashes []string) {
	sc.Set(nodeID, schema, configHash, inputHashes)
	
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	
	if _, exists := sc.workflow[workflowID]; !exists {
		sc.workflow[workflowID] = make([]string, 0)
	}
	
	found := false
	for _, nid := range sc.workflow[workflowID] {
		if nid == nodeID {
			found = true
			break
		}
	}
	
	if !found {
		sc.workflow[workflowID] = append(sc.workflow[workflowID], nodeID)
	}
}

func (sc *SchemaCache) Invalidate(nodeID string) {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	delete(sc.cache, nodeID)
}

func (sc *SchemaCache) InvalidateWorkflow(workflowID string) {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	
	if nodeIDs, exists := sc.workflow[workflowID]; exists {
		for _, nodeID := range nodeIDs {
			delete(sc.cache, nodeID)
}
		delete(sc.workflow, workflowID)
	}
}

func (sc *SchemaCache) Clear() {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	sc.cache = make(map[string]*SchemaCacheEntry)
	sc.workflow = make(map[string][]string)
	atomic.StoreInt64(&sc.hits, 0)
	atomic.StoreInt64(&sc.misses, 0)
	atomic.StoreInt64(&sc.evictions, 0)
	atomic.StoreInt64(&sc.sets, 0)
}

func (sc *SchemaCache) GetMetrics() SchemaCacheMetrics {
	sc.mutex.RLock()
	size := len(sc.cache)
	sc.mutex.RUnlock()

	return SchemaCacheMetrics{
		Hits:      atomic.LoadInt64(&sc.hits),
		Misses:    atomic.LoadInt64(&sc.misses),
		Evictions: atomic.LoadInt64(&sc.evictions),
		Sets:      atomic.LoadInt64(&sc.sets),
		Size:      size,
	}
}

func (sc *SchemaCache) GetHitRate() float64 {
	hits := atomic.LoadInt64(&sc.hits)
	misses := atomic.LoadInt64(&sc.misses)
	total := hits + misses
	
	if total == 0 {
		return 0.0
	}
	
	return float64(hits) / float64(total)
}

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

func computeConfigHash(config map[string]interface{}) string {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return ""
	}
	
	hash := sha256.Sum256(configJSON)
	return hex.EncodeToString(hash[:])
}
