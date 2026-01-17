package routes

import (
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/cron"
	"github.com/shashank-sharma/backend/internal/util"
)

func RegisterCronRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, cronService *cron.CronService) {
	cronRouter := apiRouter.Group(path)

	cronRouter.POST("/{id}/test", testCron(cronService))
	cronRouter.POST("/{id}/clone", cloneCron(cronService))
	cronRouter.GET("/{id}/stats", getCronStats(cronService))
	cronRouter.GET("/{id}/metrics", getCronMetrics(cronService))
}

func testCron(cronService *cron.CronService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		cronId := e.Request.PathValue("id")
		if cronId == "" {
			return util.RespondError(e, util.NewBadRequestError("cron ID is required"))
		}

		if err := cronService.TestCron(cronId, userId); err != nil {
			if apiErr, ok := err.(*util.APIError); ok {
				return util.RespondError(e, apiErr)
			}
			return util.RespondError(e, util.NewInternalError(err.Error()))
		}

		return e.JSON(http.StatusOK, map[string]string{"message": "cron test execution triggered"})
	}
}

func cloneCron(cronService *cron.CronService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		cronId := e.Request.PathValue("id")
		if cronId == "" {
			return util.RespondError(e, util.NewBadRequestError("cron ID is required"))
		}

		var data struct {
			Name string `json:"name"`
		}
		if err := e.BindBody(&data); err != nil {
			return util.RespondError(e, util.NewBadRequestError("invalid request body"))
		}

		if data.Name == "" {
			return util.RespondError(e, util.NewBadRequestError("name is required"))
		}

		clonedCron, err := cronService.CloneCron(cronId, userId, data.Name)
		if err != nil {
			if apiErr, ok := err.(*util.APIError); ok {
				return util.RespondError(e, apiErr)
			}
			return util.RespondError(e, util.NewInternalError(err.Error()))
		}

		return e.JSON(http.StatusCreated, clonedCron)
	}
}

func getCronStats(cronService *cron.CronService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		cronId := e.Request.PathValue("id")
		if cronId == "" {
			return util.RespondError(e, util.NewBadRequestError("cron ID is required"))
		}

		_, err := cronService.GetCron(cronId, userId)
		if err != nil {
			if apiErr, ok := err.(*util.APIError); ok {
				return util.RespondError(e, apiErr)
			}
			return util.RespondError(e, util.NewInternalError(err.Error()))
		}

		days := util.GetQueryInt(e, "days", 30)
		if days > 90 {
			days = 90
		}

		startDate := time.Now().AddDate(0, 0, -days)
		filterMap := map[string]interface{}{
			"cron": cronId,
			"user": userId,
			"created": map[string]interface{}{
				"gte": startDate,
			},
		}

		executions, err := query.FindAllByFilter[*models.CronExecution](filterMap)
		if err != nil {
			return util.RespondError(e, util.NewInternalError(err.Error()))
		}

		var totalRuns int
		var successRuns int
		var failureRuns int
		var totalDuration int64
		var lastRun *types.DateTime

		for _, exec := range executions {
			totalRuns++
			if exec.Status == "success" {
				successRuns++
			} else if exec.Status == "failure" {
				failureRuns++
			}
			totalDuration += exec.DurationMs

			if exec.CompletedAt.IsZero() == false {
				if lastRun == nil || exec.CompletedAt.After(*lastRun) {
					lastRun = &exec.CompletedAt
				}
			}
		}

		var successRate float64
		var avgDuration float64
		if totalRuns > 0 {
			successRate = float64(successRuns) / float64(totalRuns) * 100
			avgDuration = float64(totalDuration) / float64(totalRuns)
		}

		var lastRunStr *string
		if lastRun != nil {
			lastRunTime := lastRun.Time().Format(time.RFC3339)
			lastRunStr = &lastRunTime
		}

		stats := map[string]interface{}{
			"total_runs":      totalRuns,
			"success_runs":    successRuns,
			"failure_runs":    failureRuns,
			"success_rate":    successRate,
			"avg_duration_ms": avgDuration,
			"last_run":        lastRunStr,
		}

		return e.JSON(http.StatusOK, stats)
	}
}

func getCronMetrics(cronService *cron.CronService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		cronId := e.Request.PathValue("id")
		if cronId == "" {
			return util.RespondError(e, util.NewBadRequestError("cron ID is required"))
		}

		_, err := cronService.GetCron(cronId, userId)
		if err != nil {
			if apiErr, ok := err.(*util.APIError); ok {
				return util.RespondError(e, apiErr)
			}
			return util.RespondError(e, util.NewInternalError(err.Error()))
		}

		days := util.GetQueryInt(e, "days", 30)
		if days > 90 {
			days = 90
		}

		startDate := time.Now().AddDate(0, 0, -days)
		filterMap := map[string]interface{}{
			"cron": cronId,
			"user": userId,
			"created": map[string]interface{}{
				"gte": startDate,
			},
		}

		executions, err := query.FindAllByFilter[*models.CronExecution](filterMap)
		if err != nil {
			return util.RespondError(e, util.NewInternalError(err.Error()))
		}

		type DataPoint struct {
			Date           string  `json:"date"`
			SuccessCount   int     `json:"success_count"`
			FailureCount   int     `json:"failure_count"`
			AvgDuration    float64 `json:"avg_duration_ms"`
			ExecutionCount int     `json:"execution_count"`
		}

		type MetricsData struct {
			SuccessRate     []DataPoint    `json:"success_rate"`
			ExecutionCount  []DataPoint    `json:"execution_count"`
			DurationTrend   []DataPoint    `json:"duration_trend"`
			ErrorFrequency  []DataPoint    `json:"error_frequency"`
			StatusBreakdown map[string]int `json:"status_breakdown"`
		}

		dateMap := make(map[string]*DataPoint)

		for _, exec := range executions {
			dateStr := exec.Created.Time().Format("2006-01-02")
			dp, exists := dateMap[dateStr]
			if !exists {
				dp = &DataPoint{
					Date: dateStr,
				}
				dateMap[dateStr] = dp
			}

			dp.ExecutionCount++
			if exec.Status == "success" {
				dp.SuccessCount++
			} else if exec.Status == "failure" {
				dp.FailureCount++
			}

			dp.AvgDuration += float64(exec.DurationMs)
		}

		for _, dp := range dateMap {
			if dp.ExecutionCount > 0 {
				dp.AvgDuration = dp.AvgDuration / float64(dp.ExecutionCount)
			}
		}

		var successRateData []DataPoint
		var executionCountData []DataPoint
		var durationTrendData []DataPoint
		var errorFrequencyData []DataPoint
		statusBreakdown := make(map[string]int)

		for _, exec := range executions {
			statusBreakdown[exec.Status]++
		}

		for _, dp := range dateMap {
			successRateData = append(successRateData, *dp)
			executionCountData = append(executionCountData, *dp)
			durationTrendData = append(durationTrendData, *dp)
			if dp.FailureCount > 0 {
				errorFrequencyData = append(errorFrequencyData, *dp)
			}
		}

		metrics := MetricsData{
			SuccessRate:     successRateData,
			ExecutionCount:  executionCountData,
			DurationTrend:   durationTrendData,
			ErrorFrequency:  errorFrequencyData,
			StatusBreakdown: statusBreakdown,
		}

		return e.JSON(http.StatusOK, metrics)
	}
}
