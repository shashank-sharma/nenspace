package workflow

import (
	"sync"
	"time"
)

type WorkflowMetrics struct {
	mu                    sync.RWMutex
	executionCount        int64
	executionSuccessCount int64
	executionFailureCount int64
	executionDurations    []time.Duration
	nodeExecutions        map[string]int64
	nodeFailures          map[string]int64
	errorCounts           map[ErrorCode]int64
	activeExecutions      int64
}

func NewWorkflowMetrics() *WorkflowMetrics {
	return &WorkflowMetrics{
		executionDurations: make([]time.Duration, 0, 1000),
		nodeExecutions:     make(map[string]int64),
		nodeFailures:       make(map[string]int64),
		errorCounts:        make(map[ErrorCode]int64),
	}
}

func (m *WorkflowMetrics) RecordExecution(success bool, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.executionCount++
	if success {
		m.executionSuccessCount++
	} else {
		m.executionFailureCount++
	}

	m.executionDurations = append(m.executionDurations, duration)
	if len(m.executionDurations) > 1000 {
		m.executionDurations = m.executionDurations[1:]
	}
}

func (m *WorkflowMetrics) RecordNodeExecution(nodeType string, success bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.nodeExecutions[nodeType]++
	if !success {
		m.nodeFailures[nodeType]++
	}
}

func (m *WorkflowMetrics) RecordError(code ErrorCode) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.errorCounts[code]++
}

func (m *WorkflowMetrics) IncrementActive() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.activeExecutions++
}

func (m *WorkflowMetrics) DecrementActive() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.activeExecutions--
}

func (m *WorkflowMetrics) GetExecutionCount() int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.executionCount
}

func (m *WorkflowMetrics) GetSuccessCount() int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.executionSuccessCount
}

func (m *WorkflowMetrics) GetFailureCount() int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.executionFailureCount
}

func (m *WorkflowMetrics) GetSuccessRate() float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.executionCount == 0 {
		return 0.0
	}
	return float64(m.executionSuccessCount) / float64(m.executionCount)
}

func (m *WorkflowMetrics) GetAverageDuration() time.Duration {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.executionDurations) == 0 {
		return 0
	}

	var total time.Duration
	for _, d := range m.executionDurations {
		total += d
	}
	return total / time.Duration(len(m.executionDurations))
}

func (m *WorkflowMetrics) GetP95Duration() time.Duration {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.executionDurations) == 0 {
		return 0
	}

	sorted := make([]time.Duration, len(m.executionDurations))
	copy(sorted, m.executionDurations)

	for i := 0; i < len(sorted)-1; i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[i] > sorted[j] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	p95Index := int(float64(len(sorted)) * 0.95)
	if p95Index >= len(sorted) {
		p95Index = len(sorted) - 1
	}
	return sorted[p95Index]
}

func (m *WorkflowMetrics) GetNodeExecutionCount(nodeType string) int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.nodeExecutions[nodeType]
}

func (m *WorkflowMetrics) GetNodeFailureCount(nodeType string) int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.nodeFailures[nodeType]
}

func (m *WorkflowMetrics) GetNodeSuccessRate(nodeType string) float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()

	executions := m.nodeExecutions[nodeType]
	if executions == 0 {
		return 0.0
	}
	failures := m.nodeFailures[nodeType]
	return float64(executions-failures) / float64(executions)
}

func (m *WorkflowMetrics) GetErrorCount(code ErrorCode) int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.errorCounts[code]
}

func (m *WorkflowMetrics) GetAllErrorCounts() map[ErrorCode]int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[ErrorCode]int64)
	for code, count := range m.errorCounts {
		result[code] = count
	}
	return result
}

func (m *WorkflowMetrics) GetActiveExecutions() int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.activeExecutions
}

func (m *WorkflowMetrics) GetAllNodeExecutions() map[string]int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]int64)
	for nodeType, count := range m.nodeExecutions {
		result[nodeType] = count
	}
	return result
}

func (m *WorkflowMetrics) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.executionCount = 0
	m.executionSuccessCount = 0
	m.executionFailureCount = 0
	m.executionDurations = make([]time.Duration, 0, 1000)
	m.nodeExecutions = make(map[string]int64)
	m.nodeFailures = make(map[string]int64)
	m.errorCounts = make(map[ErrorCode]int64)
}

type MetricsSummary struct {
	TotalExecutions   int64              `json:"total_executions"`
	SuccessCount      int64              `json:"success_count"`
	FailureCount      int64              `json:"failure_count"`
	SuccessRate       float64            `json:"success_rate"`
	AverageDuration   string             `json:"average_duration"`
	P95Duration       string             `json:"p95_duration"`
	ActiveExecutions  int64              `json:"active_executions"`
	NodeExecutions    map[string]int64   `json:"node_executions"`
	ErrorCounts       map[ErrorCode]int64 `json:"error_counts"`
	CacheMetrics      SchemaCacheMetrics `json:"cache_metrics,omitempty"`
}

func (m *WorkflowMetrics) GetSummary() MetricsSummary {
	return MetricsSummary{
		TotalExecutions:  m.GetExecutionCount(),
		SuccessCount:     m.GetSuccessCount(),
		FailureCount:     m.GetFailureCount(),
		SuccessRate:      m.GetSuccessRate(),
		AverageDuration:  m.GetAverageDuration().String(),
		P95Duration:      m.GetP95Duration().String(),
		ActiveExecutions: m.GetActiveExecutions(),
		NodeExecutions:   m.GetAllNodeExecutions(),
		ErrorCounts:      m.GetAllErrorCounts(),
	}
}

func (m *WorkflowMetrics) GetSummaryWithCache(cache *SchemaCache) MetricsSummary {
	summary := m.GetSummary()
	if cache != nil {
		summary.CacheMetrics = cache.GetMetrics()
	}
	return summary
}

