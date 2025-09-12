package routes

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/util"
)

type AWEvent struct {
	Id        int64       `json:"id"`
	Timestamp time.Time   `json:"timestamp"`
	Duration  float64     `json:"duration"`
	Data      AWEventData `json:"data"`
}

type AWEventData struct {
	Title string `json:"title"`
	App   string `json:"app"`
}

type EventListAPI struct {
	DeviceId string    `json:"device_id"`
	TaskName string    `json:"task_name"`
	Events   []AWEvent `json:"events"`
}

type OperationCount struct {
	CreateCount int64 `json:"create_count"`
	FailedCount int64 `json:"failed_count"`
	SkipCount   int64 `json:"skip_count"`
	ForceCheck  bool  `json:"force_check"`
}

type TrackUploadAPI struct {
	Source     string           `json:"source" form:"source"`
	ForceCheck bool             `json:"force_check" form:"force_check"`
	File       *filesystem.File `json:"file" form:"file"`
}

type PublicDeviceData struct {
	Name       string         `json:"name"`
	Os         string         `json:"os"`
	IsOnline   bool           `json:"is_online"`
	IsPublic   bool           `json:"is_public"`
	LastOnline types.DateTime `json:"last_online"`
	LastSync   types.DateTime `json:"last_sync"`
	AppCurrent string         `json:"current_app"`
	AppEndTime types.DateTime `json:"app_endtime"`
}

type PublicTrackDeviceAPI struct {
	TotalDevices int                `json:"total_devices"`
	Devices      []PublicDeviceData `json:"devices"`
}

type TrackFocusAPI struct {
	User      string                  `db:"user" json:"user"`
	Device    string                  `db:"device" json:"device"`
	Tags      types.JSONArray[string] `db:"tags" json:"tags"`
	Metadata  string                  `db:"metadata" json:"metadata"`
	BeginDate types.DateTime          `db:"begin_date" json:"begin_date"`
	EndDate   types.DateTime          `db:"end_date" json:"end_date"`
}

type topAppsCacheEntry struct {
	ExpiresAt time.Time
	Payload   map[string]any
}

var topAppsSessionsCache sync.Map

// Prevent duplicate computations per cache key
type topAppsInflight struct {
	done chan struct{}
}

var topAppsFlightsMu sync.Mutex
var topAppsFlights = map[string]*topAppsInflight{}

func RegisterTrackRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string) {
	trackRouter := apiRouter.Group(path)
	trackRouter.POST("/create", TrackCreateAppItems)
	trackRouter.POST("/", TrackDeviceStatus)
	trackRouter.GET("/getapp", GetCurrentApp)
	trackRouter.GET("/topapps/sessions", GetTopAppsBySessions)
	apiRouter.POST("/focus/create", TrackFocus)
	apiRouter.POST("/sync/create", TrackAppSyncItems)
	// e.Router.POST("/sync/track-items", routes.TrackAppItems)
}

func TrackFocus(e *core.RequestEvent) error {
	token := e.Request.Header.Get("AuthSyncToken")
	if token == "" {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Dev Token missing"})
	}
	userId, err := query.ValidateDevToken(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Failed to fetch id, token misconfigured"})
	}
	data := TrackFocusAPI{}
	if err := e.BindBody(&data); err != nil {
		logger.LogError("Error in parsing =", err)
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Failed binding data"})
	}

	_, err = query.FindByFilter[*models.TrackFocus](map[string]interface{}{
		"user":       userId,
		"device":     data.Device,
		"tags":       data.Tags,
		"metadata":   data.Metadata,
		"begin_date": data.BeginDate,
		"end_date":   data.EndDate,
	})

	if err == nil {
		logger.LogError("Found record, need to skip")
	}

	trackFocus := &models.TrackFocus{
		User:      userId,
		Device:    data.Device,
		Tags:      data.Tags,
		Metadata:  data.Metadata,
		BeginDate: data.BeginDate,
		EndDate:   data.EndDate,
	}

	err = query.UpsertRecord[*models.TrackFocus](trackFocus, map[string]interface{}{
		"user":       userId,
		"device":     data.Device,
		"tags":       data.Tags,
		"metadata":   data.Metadata,
		"begin_date": data.BeginDate,
	})
	if err != nil {
		logger.LogError("Failed updating record", err)
	}
	return e.JSON(http.StatusOK, map[string]interface{}{"message": "Created successfully"})
}


func GetCurrentApp(e *core.RequestEvent) error {
	activeDevices, err := query.FindAllByFilter[*models.TrackDevice](map[string]interface{}{
		"is_active": true,
	})
	if err != nil {
		logger.LogError("Failed getting devices: ", err)
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Failed to fetch devices"})
	}

	trackDevicePayload := PublicTrackDeviceAPI{
		TotalDevices: len(activeDevices),
		Devices:      []PublicDeviceData{},
	}

	for _, activeDevice := range activeDevices {
		publicDeviceData := PublicDeviceData{
			Name:     activeDevice.Name,
			Os:       activeDevice.Os,
			IsPublic: activeDevice.IsPublic,
		}

		if activeDevice.IsPublic {
			publicDeviceData.IsOnline = activeDevice.IsOnline
			publicDeviceData.LastOnline = activeDevice.LastOnline
			publicDeviceData.LastSync = activeDevice.LastSync

			data, err := query.FindLatestByColumn[*models.TrackItems]("end_date", map[string]interface{}{
				"device": activeDevice.Id,
			})

			if err != nil {
				publicDeviceData.AppCurrent = ""
			} else {
				publicDeviceData.AppCurrent = data.App
				publicDeviceData.AppEndTime = data.EndDate
			}
		}

		trackDevicePayload.Devices = append(trackDevicePayload.Devices, publicDeviceData)
	}

	return e.JSON(http.StatusOK, trackDevicePayload)
}

func TrackCreateAppItems(e *core.RequestEvent) error {
	logger.LogDebug("Started track create")
	token := e.Request.Header.Get("Authorization")
	logger.LogDebug("token =", token)
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Failed to fetch id, token misconfigured"})
	}

	data := &models.TrackDeviceAPI{}

	if err := e.BindBody(data); err != nil || data.Name == "" {
		logger.LogError("Error in parsing =", err)
		return apis.NewBadRequestError("Failed to read request data", err)
	}

	record, _ := query.FindByFilter[*models.TrackDevice](map[string]interface{}{
		"user":     userId,
		"name":     data.Name,
		"hostname": data.HostName,
		"os":       data.Os,
		"arch":     data.Arch,
	})

	if record != nil {
		logger.LogDebug("returning id:", record.Id)
		return e.JSON(http.StatusOK, map[string]interface{}{"id": record.Id})
	} else {
		trackDevice := &models.TrackDevice{
			User:     userId,
			Name:     data.Name,
			HostName: data.HostName,
			Os:       data.Os,
			Arch:     data.Arch,
			IsActive: true,
			IsOnline: true,
		}

		trackDevice.Id = util.GenerateRandomId()

		if err := query.SaveRecord(trackDevice); err != nil {
			logger.LogError("Error saving file", err)
			return err
		}

		logger.LogDebug("Track device ID: ", trackDevice.Id)
		return e.JSON(http.StatusOK, map[string]interface{}{"id": trackDevice.Id})
	}

}

func TrackAppSyncItems(e *core.RequestEvent) error {
	token := e.Request.Header.Get("AuthSyncToken")
	if token == "" {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Dev Token missing"})
	}
	userId, err := query.ValidateDevToken(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Failed to fetch id, token misconfigured"})
	}
	data := EventListAPI{}
	if err := e.BindBody(&data); err != nil {
		logger.LogError("Error in parsing =", err)
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Failed binding data"})
	}

	op := OperationCount{}
	// TODO: Handle failure better
	for _, event := range data.Events {
		startTimestamp := event.Timestamp.Round(time.Second)
		startDate := types.DateTime{}
		endDate := types.DateTime{}
		startDate.Scan(startTimestamp)
		endDate.Scan(startTimestamp.Add(time.Second * time.Duration(event.Duration)))

		_, err := query.FindByFilter[*models.TrackItems](map[string]interface{}{
			"user":       userId,
			"device":     data.DeviceId,
			"track_id":   event.Id,
			"app":        event.Data.App,
			"task_name":  data.TaskName,
			"title":      event.Data.Title,
			"begin_date": startDate,
			"end_date":   endDate,
		})

		if err == nil {
			op.SkipCount += 1
			continue
		}

		trackData := &models.TrackItems{
			User:      userId,
			Device:    data.DeviceId,
			TrackId:   event.Id,
			App:       event.Data.App,
			TaskName:  data.TaskName,
			Title:     event.Data.Title,
			BeginDate: startDate,
			EndDate:   endDate,
		}

		err = query.UpsertRecord[*models.TrackItems](trackData, map[string]interface{}{
			"user":       userId,
			"device":     data.DeviceId,
			"track_id":   event.Id,
			"app":        event.Data.App,
			"task_name":  data.TaskName,
			"title":      event.Data.Title,
			"begin_date": startDate,
		})
		if err != nil {
			op.FailedCount += 1
			logger.LogError("Failed updating record for event:", event, err)
		} else {
			op.CreateCount += 1
		}
	}

	if err = query.UpdateRecord[*models.TrackDevice](data.DeviceId, map[string]interface{}{
		"is_online":   true,
		"is_active":   true,
		"sync_events": true,
		"last_online": types.NowDateTime(),
		"last_sync":   types.NowDateTime(),
	}); err != nil {
		logger.LogError("Failed updating the tracking device records", err)
	}

	return e.JSON(http.StatusOK, op)
}

func GetTopAppsBySessions(e *core.RequestEvent) error {
	// Fixed configuration: today UTC, 30-minute inactivity gap, top 15 apps
	gapMinutes := 30
	topLimit := 20

	now := time.Now().UTC()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	// dayStart := time.Date(2025, time.September, 9, 0, 0, 0, 0, time.UTC)
	dayEnd := dayStart.Add(24 * time.Hour)

	forceRefresh := false
	// cache key: day|gap|limit; 10-min expiry
	cacheKey := fmt.Sprintf("%s|gap=%d|limit=%d", dayStart.Format("2006-01-02"), gapMinutes, topLimit)
	if !forceRefresh {
		if v, ok := topAppsSessionsCache.Load(cacheKey); ok {
			entry := v.(topAppsCacheEntry)
			if time.Now().UTC().Before(entry.ExpiresAt) {
				logger.LogDebug("GetTopAppsBySessions cache hit", "key", cacheKey, "expires_at", entry.ExpiresAt.Format(time.RFC3339))
				return e.JSON(http.StatusOK, entry.Payload)
			} else {
				logger.LogDebug("GetTopAppsBySessions cache expired", "key", cacheKey)
				topAppsSessionsCache.Delete(cacheKey)
			}
		}
	} else {
		logger.LogInfo("Forcing refresh for GetTopAppsBySessions", "key", cacheKey)
		topAppsSessionsCache.Delete(cacheKey)
	}

	// Register in-flight to coalesce concurrent requests
	var flight *topAppsInflight
	isLeader := false
	if !forceRefresh {
		topAppsFlightsMu.Lock()
		if f, ok := topAppsFlights[cacheKey]; ok {
			flight = f
			topAppsFlightsMu.Unlock()
			logger.LogDebug("GetTopAppsBySessions wait in-flight", "key", cacheKey)
			<-flight.done
			// After in-flight completes, return cached result if available
			if v, ok := topAppsSessionsCache.Load(cacheKey); ok {
				entry := v.(topAppsCacheEntry)
				if time.Now().UTC().Before(entry.ExpiresAt) {
					logger.LogDebug("GetTopAppsBySessions served after in-flight", "key", cacheKey)
					return e.JSON(http.StatusOK, entry.Payload)
				}
			}
			// Fall-through to compute if not cached
			topAppsFlightsMu.Lock()
			flight = &topAppsInflight{done: make(chan struct{})}
			topAppsFlights[cacheKey] = flight
			isLeader = true
			topAppsFlightsMu.Unlock()
		} else {
			flight = &topAppsInflight{done: make(chan struct{})}
			topAppsFlights[cacheKey] = flight
			isLeader = true
			topAppsFlightsMu.Unlock()
		}
	} else {
		// For force refresh, still coordinate so others wait for the fresh computation
		topAppsFlightsMu.Lock()
		if f, ok := topAppsFlights[cacheKey]; ok {
			flight = f
			topAppsFlightsMu.Unlock()
			logger.LogInfo("Force refresh waiting on existing in-flight", "key", cacheKey)
			<-flight.done
			// Proceed to become leader to refresh result
			topAppsFlightsMu.Lock()
			flight = &topAppsInflight{done: make(chan struct{})}
			topAppsFlights[cacheKey] = flight
			isLeader = true
			topAppsFlightsMu.Unlock()
		} else {
			flight = &topAppsInflight{done: make(chan struct{})}
			topAppsFlights[cacheKey] = flight
			isLeader = true
			topAppsFlightsMu.Unlock()
		}
	}

	startDT := types.DateTime{}
	endDT := types.DateTime{}
	startDT.Scan(dayStart)
	endDT.Scan(dayEnd)

	// Get public active devices to scope results similarly to GetCurrentApp
	devices, err := query.FindAllByFilter[*models.TrackDevice](map[string]any{
		"is_public": true,
		"is_active": true,
	})
	if err != nil {
		logger.LogError("Failed to fetch devices", "error", err)
		if isLeader && flight != nil { close(flight.done); topAppsFlightsMu.Lock(); delete(topAppsFlights, cacheKey); topAppsFlightsMu.Unlock() }
		return e.JSON(http.StatusInternalServerError, map[string]any{"message": "failed to fetch devices"})
	}
	logger.LogDebug("GetTopAppsBySessions devices fetched", "count", len(devices))
	if len(devices) == 0 {
		logger.LogInfo("No public active devices for GetTopAppsBySessions", "date", dayStart.Format("2006-01-02"))
		result := map[string]any{"date": dayStart.Format("2006-01-02"), "gap_minutes": gapMinutes, "limit": topLimit, "sessions": []any{}}
		if isLeader && flight != nil {
			now2 := time.Now().UTC()
			expires := now2.Add(10 * time.Minute)
			topAppsSessionsCache.Store(cacheKey, topAppsCacheEntry{ExpiresAt: expires, Payload: result})
			close(flight.done)
			topAppsFlightsMu.Lock(); delete(topAppsFlights, cacheKey); topAppsFlightsMu.Unlock()
		}
		return e.JSON(http.StatusOK, map[string]any{"date": dayStart.Format("2006-01-02"), "gap_minutes": gapMinutes, "limit": topLimit, "sessions": []any{}})
	}

	deviceSet := map[string]struct{}{}
	for _, d := range devices {
		deviceSet[d.Id] = struct{}{}
	}

	// Fetch all items for the day per device to minimize scan size
	items := make([]*models.TrackItems, 0, 1024)
	for _, d := range devices {
		recs, err := query.FindAllByFilter[*models.TrackItems](map[string]any{
			"device": d.Id,
			"begin_date": map[string]any{"gte": startDT, "lte": endDT},
		})
		if err != nil {
			logger.LogError("Failed to fetch track items for device", "device", d.Id, "error", err)
			continue
		}
		items = append(items, recs...)
	}
	logger.LogDebug("GetTopAppsBySessions items fetched", "count", len(items))

	type event struct {
		app   string
		begin time.Time
		end   time.Time
	}

	filtered := make([]event, 0, len(items))
	for _, it := range items {
		// Ignore loginwindow app
		if strings.EqualFold(it.App, "loginwindow") {
			continue
		}
		b := it.BeginDate.Time()
		e := it.EndDate.Time()
		// keep only events that intersect with [dayStart, dayEnd)
		if e.Before(dayStart) || !b.Before(dayEnd) {
			continue
		}
		// clamp to day bounds for accurate per-day aggregation
		if b.Before(dayStart) {
			b = dayStart
		}
		if e.After(dayEnd) {
			e = dayEnd
		}
		if e.After(b) {
			filtered = append(filtered, event{app: it.App, begin: b, end: e})
		}
	}
	logger.LogDebug("GetTopAppsBySessions events filtered", "count", len(filtered))

	if len(filtered) == 0 {
		logger.LogInfo("No track events for day in GetTopAppsBySessions", "date", dayStart.Format("2006-01-02"))
		result := map[string]any{"date": dayStart.Format("2006-01-02"), "gap_minutes": gapMinutes, "limit": topLimit, "sessions": []any{}}
		if isLeader && flight != nil {
			now2 := time.Now().UTC()
			expires := now2.Add(10 * time.Minute)
			topAppsSessionsCache.Store(cacheKey, topAppsCacheEntry{ExpiresAt: expires, Payload: result})
			close(flight.done)
			topAppsFlightsMu.Lock(); delete(topAppsFlights, cacheKey); topAppsFlightsMu.Unlock()
		}
		return e.JSON(http.StatusOK, map[string]any{"date": dayStart.Format("2006-01-02"), "gap_minutes": gapMinutes, "limit": topLimit, "sessions": []any{}})
	}

	sort.Slice(filtered, func(i, j int) bool { return filtered[i].begin.Before(filtered[j].begin) })

	gap := time.Duration(gapMinutes) * time.Minute

	type session struct {
		start   time.Time
		end     time.Time
		events  []event
	}

	sessions := []session{}
	current := session{}
	var prevEnd time.Time
	for idx, ev := range filtered {
		if idx == 0 {
			current = session{start: ev.begin, end: ev.end, events: []event{ev}}
			prevEnd = ev.end
			continue
		}
		if ev.begin.Sub(prevEnd) > gap {
			// finalize previous
			sessions = append(sessions, current)
			current = session{start: ev.begin, end: ev.end, events: []event{ev}}
		} else {
			current.events = append(current.events, ev)
			if ev.end.After(current.end) {
				current.end = ev.end
			}
		}
		prevEnd = ev.end
	}
	// append last
	sessions = append(sessions, current)
	logger.LogDebug("GetTopAppsBySessions sessions built", "count", len(sessions))

	// Build response
	type appUsage struct {
		App              string  `json:"app"`
		Percentage       float64 `json:"percentage"`
	}
	type sessionResp struct {
		SessionIndex         int            `json:"session_index"`
		Apps                 []appUsage     `json:"apps"`
	}

	respSessions := make([]sessionResp, 0, len(sessions))
	for i, s := range sessions {
		// aggregate per app
		total := int64(0)
		agg := map[string]int64{}
		for _, ev := range s.events {
			// Ignore loginwindow app
			if strings.EqualFold(ev.app, "loginwindow") {
				continue
			}
			dur := int64(ev.end.Sub(ev.begin).Seconds())
			if dur <= 0 {
				continue
			}
			agg[ev.app] += dur
			total += dur
		}
		// build sorted list by duration without returning duration fields
		keys := make([]string, 0, len(agg))
		for app := range agg {
			keys = append(keys, app)
		}
		sort.Slice(keys, func(i, j int) bool { return agg[keys[i]] > agg[keys[j]] })
		if len(keys) > topLimit {
			keys = keys[:topLimit]
		}
		apps := make([]appUsage, 0, len(keys))
		for _, app := range keys {
			pct := 0.0
			if total > 0 {
				pct = (float64(agg[app]) / float64(total)) * 100.0
			}
			apps = append(apps, appUsage{App: app, Percentage: math.Round(pct*100) / 100})
		}

		respSessions = append(respSessions, sessionResp{
			SessionIndex:         i + 1,
			Apps:                 apps,
		})
	}

	result := map[string]any{
		"date":        dayStart.Format("2006-01-02"),
		"gap_minutes": gapMinutes,
		"limit":       topLimit,
		"sessions":    respSessions,
	}

	// compute expiry in 10 minutes
	now2 := time.Now().UTC()
	expires := now2.Add(10 * time.Minute)
	topAppsSessionsCache.Store(cacheKey, topAppsCacheEntry{ExpiresAt: expires, Payload: result})
	logger.LogDebug("GetTopAppsBySessions cache stored", "key", cacheKey, "expires_at", expires.Format(time.RFC3339))
	if isLeader && flight != nil { close(flight.done); topAppsFlightsMu.Lock(); delete(topAppsFlights, cacheKey); topAppsFlightsMu.Unlock() }

	return e.JSON(http.StatusOK, result)
}

/*
func TrackAppItems(e *core.RequestEvent) error {
	// TODO: Fix this damn API
	app := config.GetApp()
	token := e.Request.Header.Get("Authorization")
	logger.Debug.Println("token =", token)
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Failed to fetch id, token misconfigured"})
	}
	data := TrackUploadAPI{}

	if err := e.BindBody(data); err != nil || data.Source == "" {
		logger.Error.Println("Error in parsing =", err)
		return apis.NewBadRequestError("Failed to read request data", err)
	}

	collection, err := app.FindCollectionByNameOrId("track_upload")
	if err != nil {
		return err
	}

	record := pocketbaseModel.NewRecord(collection)

	form := forms.NewRecordUpsert(app, record)

	form.LoadData(map[string]any{
		"id":     util.GenerateRandomId(),
		"user":   userId,
		"status": "CREATED",
	})

	form.LoadRequest(c.Request(), "")
	logger.Debug.Println("Checking form id =", form.Id, "record=", record.Id)
	if err := form.Submit(); err != nil {
		logger.Error.Println("Error saving file", err)
		return err
	}

	formData := form.Data()
	trackUpload := &models.TrackUpload{
		User:   userId,
		Source: formData["source"].(string),
		File:   formData["file"].(string),
		Synced: formData["synced"].(bool),
	}

	trackUpload.BaseModel.Id = form.Id

	// load the entire request

	go SyncTrackUpload(trackUpload, data.ForceCheck)
	return c.JSON(http.StatusOK, map[string]interface{}{"message": "Task scheduled", "track_upload": trackUpload})
}
*/

/*
func SyncTrackUpload(trackUpload *models.TrackUpload, forceCheck bool) {
	trackUpload.Status = "IN-PROGRESS"
	trackUpload.MarkAsNotNew()
	app := config.GetApp()
	if err := app.Save(trackUpload); err != nil {
		logger.Error.Println("Failed updating record")
		return
	}
	defer func() {
		if err := app.Save(trackUpload); err != nil {
			logger.Error.Println("Failed updating record")
		}
	}()

	opCount, err := insertFromFile(trackUpload, forceCheck)
	if err != nil {
		logger.Error.Println("Something went wrong while insert err:", err)
		trackUpload.Status = "FAILED"
		return
	}
	logger.Debug.Println("Operation count:", opCount)
	trackUpload.DuplicateRecord = opCount.SkipCount
	if opCount.CreateCount == opCount.SkipCount {
		trackUpload.Status = "DUPLICATE"
	} else {
		trackUpload.Status = "COMPLETED"
	}

}

func insertFromFile(trackUpload *models.TrackUpload, forceCheck bool) (*OperationCount, error) {
	operationCount := &OperationCount{CreateCount: 0, SkipCount: 0, ForceCheck: forceCheck}
	app := config.GetApp()

	collection, _ := app.Dao().FindCollectionByNameOrId("track_upload")
	db, err := sql.Open("sqlite3", filepath.Join(app.DataDir(), "storage", collection.Id, trackUpload.BaseModel.Id, trackUpload.File))

	if err != nil {
		logger.Error.Println(err)
	}

	defer db.Close()

	var taskName string
	var beginDate, endDate types.DateTime

	err = db.QueryRow("select taskName, beginDate, endDate from TrackItems ORDER BY id ASC LIMIT 1;").Scan(&taskName, &beginDate, &endDate)

	if err != nil {
		return nil, err
	}

	err = db.QueryRow("select COUNT(*) FROM TrackItems;").Scan(&trackUpload.TotalRecord)

	if err != nil {
		return nil, err
	}

	if err := app.Dao().Save(trackUpload); err != nil {
		logger.Error.Println("Failed updating record")
		return nil, err
	}

	record, err := app.Dao().FindFirstRecordByFilter(
		"track_items", "user = {:user} && task_name = {:task_name} && source = {:source} && begin_date = {:begin_date} && end_date = {:end_date}",
		dbx.Params{"user": trackUpload.User,
			"task_name":  taskName,
			"source":     trackUpload.Source,
			"begin_date": beginDate,
			"end_date":   endDate})

	if err != nil {
		logger.Error.Println("No record found =", err)
	}
	var queryToExecute string
	queryCheckRequired := false
	if record == nil || operationCount.ForceCheck {
		queryToExecute = "select id, app, taskName, title, beginDate, endDate FROM TrackItems ORDER BY id ASC;"
		logger.Debug.Println("No checks required")
	} else {
		queryToExecute = "select id, app, taskName, title, beginDate, endDate FROM TrackItems ORDER BY id DESC;"
		queryCheckRequired = true
		logger.Debug.Println("Check required")
	}
	err = app.Dao().RunInTransaction(func(txDao *daos.Dao) error {

		rows, err := db.Query(queryToExecute)
		if err != nil {
			logger.Error.Println(err)
		}

		defer rows.Close()

		for rows.Next() {
			// TODO: Alternative of source solution here
			trackItems := &models.TrackItems{User: trackUpload.User}
			err = rows.Scan(&trackItems.TrackId, &trackItems.App, &trackItems.TaskName, &trackItems.Title, &trackItems.BeginDate, &trackItems.EndDate)

			if err != nil {
				logger.Error.Println(err)
			}

			if queryCheckRequired {
				record, err := app.Dao().FindFirstRecordByFilter(
					"track_items", "user = {:user} && task_name = {:task_name} && source = {:source} && begin_date = {:begin_date} && end_date = {:end_date}",
					dbx.Params{"user": trackUpload.User,
						"task_name":  trackItems.TaskName,
						"begin_date": trackItems.BeginDate,
						"end_date":   trackItems.EndDate})

				if err != nil {
					logger.Error.Println(err)
					return err
				}

				if record != nil {
					if operationCount.ForceCheck {
						operationCount.SkipCount += 1
						continue
					} else {
						break
					}
				}
			}

			if err := txDao.Save(trackItems); err != nil {
				return err
			}
			operationCount.CreateCount += 1
		}

		return nil
	})
	if err != nil {
		logger.Error.Println(err)
		return nil, err
	}
	return operationCount, nil
}
*/
