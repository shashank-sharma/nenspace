package memorysystem

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
)

// EmbeddingSystem manages the generation and storage of embeddings
type EmbeddingSystem struct {
	mutex sync.Mutex
	cache map[string][]float64
	config EmbeddingConfig
	tokenCount int
	client *http.Client
}

// EmbeddingConfig holds configuration for the embedding system
type EmbeddingConfig struct {
	UseExternalAPI bool
	APIKey string
	APIEndpoint string
	CacheTTL int
	TokensPerMinute int
	Dimensions int
	UseFallback bool
}

// NewEmbeddingSystem creates a new embedding system with the given configuration
func NewEmbeddingSystem(config EmbeddingConfig) *EmbeddingSystem {
	if config.CacheTTL == 0 {
		config.CacheTTL = 86400
	}
	if config.TokensPerMinute == 0 {
		config.TokensPerMinute = 10000
	}
	if config.Dimensions == 0 {
		config.Dimensions = 1536
	}
	if config.APIEndpoint == "" {
		config.APIEndpoint = "https://api.openai.com/v1/embeddings"
	}

	if config.APIKey == "" {
		config.APIKey = os.Getenv("OPENAI_API_KEY")
		if config.APIKey != "" {
			config.UseExternalAPI = true
		}
	}

	return &EmbeddingSystem{
		cache:      make(map[string][]float64),
		config:     config,
		tokenCount: 0,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// OpenAIEmbeddingRequest represents the request structure for OpenAI embeddings API
type OpenAIEmbeddingRequest struct {
	Input string `json:"input"`
	Model string `json:"model"`
}

// OpenAIEmbeddingResponse represents the response structure from OpenAI embeddings API
type OpenAIEmbeddingResponse struct {
	Object string `json:"object"`
	Data   []struct {
		Object    string    `json:"object"`
		Embedding []float64 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Model string `json:"model"`
	Usage struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
}

// GenerateEmbedding generates a vector embedding for the given text
func (es *EmbeddingSystem) GenerateEmbedding(text string) ([]float64, error) {
	es.mutex.Lock()
	defer es.mutex.Unlock()

	normalizedText := normalizeText(text)
	
	if embedding, ok := es.cache[normalizedText]; ok {
		return embedding, nil
	}

	var embedding []float64
	var err error

	if es.config.UseExternalAPI {
		embedding, err = es.generateOpenAIEmbedding(normalizedText)
		if err != nil {
			logger.LogError("OpenAI embedding failed", err)
			if !es.config.UseFallback {
				return nil, fmt.Errorf("embedding generation failed: %w", err)
			}
			logger.LogInfo("Falling back to TF-IDF embedding")
			embedding, err = es.generateTFIDFEmbedding(normalizedText)
		}
	} else {
		embedding, err = es.generateTFIDFEmbedding(normalizedText)
	}

	if err != nil {
		return nil, fmt.Errorf("all embedding methods failed: %w", err)
	}

	es.cache[normalizedText] = embedding
	return embedding, nil
}

// generateOpenAIEmbedding generates embeddings using OpenAI's API
func (es *EmbeddingSystem) generateOpenAIEmbedding(text string) ([]float64, error) {
	if es.config.APIKey == "" {
		return nil, fmt.Errorf("OpenAI API key not provided")
	}

	requestBody := OpenAIEmbeddingRequest{
		Input: text,
		Model: "text-embedding-ada-002",
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request: %w", err)
	}

	req, err := http.NewRequest("POST", es.config.APIEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+es.config.APIKey)

	resp, err := es.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error making request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned non-200 status: %d, body: %s", resp.StatusCode, string(bodyBytes))
	}

	var embedResponse OpenAIEmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&embedResponse); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	if len(embedResponse.Data) == 0 || len(embedResponse.Data[0].Embedding) == 0 {
		return nil, fmt.Errorf("no embedding data in response")
	}

	es.tokenCount += embedResponse.Usage.TotalTokens

	return embedResponse.Data[0].Embedding, nil
}

// generateTFIDFEmbedding generates an embedding using TF-IDF
func (es *EmbeddingSystem) generateTFIDFEmbedding(text string) ([]float64, error) {
	// This is a simplified TF-IDF implementation
	// Need to use Flask API for this
	words := strings.Fields(strings.ToLower(text))
	
	termFreq := make(map[string]int)
	for _, word := range words {
		word = strings.Trim(word, ".,!?():;\"'")
		if len(word) > 1 && !isStopWord(word) {
			termFreq[word]++
		}
	}
	
	embedding := make([]float64, es.config.Dimensions)
	
	if len(termFreq) == 0 {
		return embedding, nil
	}
	
	for term, freq := range termFreq {
		hashCode := simpleHash(term) % es.config.Dimensions
		
		embedding[hashCode] += float64(freq)
	}
	
	normalizeVector(embedding)
	return embedding, nil
}

// StoreEmbedding stores an embedding in the memory model
func (es *EmbeddingSystem) StoreEmbedding(memory *models.Memory, embedding []float64) error {
	embeddingJSON, err := json.Marshal(embedding)
	if err != nil {
		return fmt.Errorf("failed to marshal embedding: %w", err)
	}
	
	var embedRaw types.JSONRaw
	if err := embedRaw.Scan(embeddingJSON); err != nil {
		return fmt.Errorf("failed to scan embedding: %w", err)
	}
	
	memory.Embedding = embedRaw
	
	return nil
}

// ClearCache clears the embedding cache
func (es *EmbeddingSystem) ClearCache() {
	es.mutex.Lock()
	defer es.mutex.Unlock()
	
	es.cache = make(map[string][]float64)
}

// normalizeText cleans and normalizes text for consistent embedding
func normalizeText(text string) string {
	text = strings.ToLower(text)
	
	text = strings.Join(strings.Fields(text), " ")
	
	text = strings.Map(func(r rune) rune {
		if strings.ContainsRune(".,!?():;\"'", r) {
			return ' '
		}
		return r
	}, text)
	
	return strings.TrimSpace(text)
}

// normalizeVector normalizes a vector to unit length
func normalizeVector(vector []float64) {
	var sum float64
	for _, v := range vector {
		sum += v * v
	}
	magnitude := math.Sqrt(sum)
	
	if magnitude > 0 {
		for i := range vector {
			vector[i] /= magnitude
		}
	}
}

// simpleHash provides a simple hash function for strings
func simpleHash(s string) int {
	h := 0
	for _, c := range s {
		h = 31*h + int(c)
	}
	if h < 0 {
		h = -h
	}
	return h
}

// isStopWord checks if a word is a common stop word
func isStopWord(word string) bool {
	stopWords := map[string]bool{
		"a": true, "an": true, "the": true, "and": true, "or": true, "but": true,
		"if": true, "then": true, "else": true, "when": true, "at": true, "from": true,
		"by": true, "for": true, "with": true, "about": true, "to": true, "of": true,
		"in": true, "on": true, "is": true, "are": true, "was": true, "were": true,
		"be": true, "been": true, "have": true, "has": true, "had": true, "do": true,
		"does": true, "did": true, "i": true, "you": true, "he": true, "she": true,
		"it": true, "we": true, "they": true, "this": true, "that": true,
		"these": true, "those": true, "my": true, "your": true, "his": true, "her": true,
	}
	return stopWords[word]
}