package routes

import (
	"net/http"
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


func RegisterTrackRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string) {
	trackRouter := apiRouter.Group(path)
	trackRouter.POST("/create", TrackCreateAppItems)
	trackRouter.POST("/", TrackDeviceStatus)
	trackRouter.GET("/getapp", GetCurrentApp)
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

	record, err := query.FindByFilter[*models.TrackDevice](map[string]interface{}{
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
		logger.LogError("Failed updating the tracking device records")
	}

	return e.JSON(http.StatusOK, op)
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
