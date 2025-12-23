package vectorsearch

import (
	"context"
	"errors"
)

// Common errors
var (
	ErrProviderNotInitialized = errors.New("embedding provider not initialized")
	ErrEmbeddingGeneration    = errors.New("failed to generate embedding")
	ErrInvalidInput           = errors.New("invalid input for embedding generation")
)

// EmbeddingProvider defines the interface for services that generate embeddings
type EmbeddingProvider interface {
	// Initialize sets up the embedding provider with the required configuration
	Initialize() error
	
	// GenerateEmbedding creates a vector embedding for the given text
	GenerateEmbedding(ctx context.Context, text string) ([]float32, error)
	
	// BatchGenerateEmbeddings creates vector embeddings for multiple texts
	BatchGenerateEmbeddings(ctx context.Context, texts []string) ([][]float32, error)
	
	// Dimensions returns the dimensionality of the generated embeddings
	Dimensions() int
	
	// Name returns the provider name
	Name() string
}

// ProviderOptions contains configuration for embedding providers
type ProviderOptions struct {
	APIKey    string `json:"apiKey"`
	Model     string `json:"model"`
	Dimensions int    `json:"dimensions"`
}

// ProviderFactory is a function type that creates embedding providers
type ProviderFactory func(options ProviderOptions) (EmbeddingProvider, error)

// providerRegistry stores available embedding provider factories
var providerRegistry = make(map[string]ProviderFactory)

// RegisterProvider adds a provider factory to the registry
func RegisterProvider(name string, factory ProviderFactory) {
	providerRegistry[name] = factory
}

// GetProviderFactory retrieves a provider factory by name
func GetProviderFactory(name string) (ProviderFactory, bool) {
	factory, ok := providerRegistry[name]
	return factory, ok
} 