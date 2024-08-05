package routes

import (
	"database/sql"
	"net/http"
	"path/filepath"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/daos"
	"github.com/pocketbase/pocketbase/forms"
	pocketbaseModel "github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/config"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/util"
)

type OperationCount struct {
	CreateCount int64 `json:"create_count"`
	SkipCount   int64 `json:"skip_count"`
	ForceCheck  bool  `json:"force_check"`
}

func TrackCreateAppItems(c echo.Context) error {
	logger.Debug.Println("Started track create")
	token := c.Request().Header.Get(echo.HeaderAuthorization)
	logger.Debug.Println("token =", token)
	userId, err := util.GetUserId(token)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"message": "Failed to fetch id, token misconfigured"})
	}

	data := &models.TrackDeviceAPI{}

	if err := c.Bind(data); err != nil || data.Name == "" {
		logger.Error.Println("Error in parsing =", err)
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
		logger.Debug.Println("returning id:", record.Id)
		return c.JSON(http.StatusOK, map[string]interface{}{"id": record.Id})
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
			logger.Error.Println("Error saving file", err)
			return err
		}

		logger.Debug.Println("Track device ID: ", trackDevice.Id)
		return c.JSON(http.StatusOK, map[string]interface{}{"id": trackDevice.Id})
	}

}

func TrackAppItems(c echo.Context) error {
	app := config.GetApp()
	token := c.Request().Header.Get(echo.HeaderAuthorization)
	logger.Debug.Println("token =", token)
	userId, err := util.GetUserId(token)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"message": "Failed to fetch id, token misconfigured"})
	}
	data := &models.TrackUploadAPI{}

	if err := c.Bind(data); err != nil || data.Source == "" {
		logger.Error.Println("Error in parsing =", err)
		return apis.NewBadRequestError("Failed to read request data", err)
	}
	//fileContent, err := c.FormFile("file")
	//if err != nil {
	//	return err
	//}
	collection, err := app.Dao().FindCollectionByNameOrId("track_upload")
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

func SyncTrackUpload(trackUpload *models.TrackUpload, forceCheck bool) {
	trackUpload.Status = "IN-PROGRESS"
	trackUpload.MarkAsNotNew()
	app := config.GetApp()
	if err := app.Dao().Save(trackUpload); err != nil {
		logger.Error.Println("Failed updating record")
		return
	}
	defer func() {
		if err := app.Dao().Save(trackUpload); err != nil {
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
			trackItems := &models.TrackItems{User: trackUpload.User, Source: trackUpload.Source}
			err = rows.Scan(&trackItems.TrackId, &trackItems.App, &trackItems.TaskName, &trackItems.Title, &trackItems.BeginDate, &trackItems.EndDate)

			if err != nil {
				logger.Error.Println(err)
			}

			if queryCheckRequired {
				record, err := app.Dao().FindFirstRecordByFilter(
					"track_items", "user = {:user} && task_name = {:task_name} && source = {:source} && begin_date = {:begin_date} && end_date = {:end_date}",
					dbx.Params{"user": trackUpload.User,
						"task_name":  trackItems.TaskName,
						"source":     trackItems.Source,
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
