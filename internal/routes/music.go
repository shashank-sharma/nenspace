package routes

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/services/music"
	"github.com/shashank-sharma/backend/internal/store"
	"github.com/shashank-sharma/backend/internal/util"
)

func RegisterMusicRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], prefix string, musicService *music.MusicService) {
	streamer := music.NewAudioStreamer(musicService.GetStoragePath())

	musicRouter := apiRouter.Group(prefix)

	// Custom routes for complex operations
	musicRouter.POST("/tracks/upload", uploadTrack(musicService))
	musicRouter.DELETE("/tracks/{id}", deleteTrack(musicService))
	musicRouter.GET("/stream/{id}", streamTrack(streamer))

	// Aggregations and stats
	musicRouter.GET("/albums", listAlbums(musicService))
	musicRouter.GET("/artists", listArtists(musicService))
	musicRouter.GET("/genres", listGenres(musicService))
	musicRouter.GET("/stats", getListeningStats(musicService))

	// History and scanning
	musicRouter.POST("/history", recordPlay(musicService))
	musicRouter.POST("/scan", startScan(musicService))
	musicRouter.GET("/scan/status", getScanStatus(musicService))
}

func uploadTrack(musicService *music.MusicService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		file, header, err := e.Request.FormFile("file")
		if err != nil {
			return util.RespondError(e, util.NewBadRequestError("file is required"))
		}
		defer file.Close()

		record, err := musicService.ProcessUpload(userId, header.Filename, file, header.Size)
		if err != nil {
			return util.RespondError(e, util.NewInternalError(err.Error()))
		}

		return e.JSON(http.StatusCreated, record)
	}
}

func deleteTrack(musicService *music.MusicService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		trackId := e.Request.PathValue("id")
		if trackId == "" {
			return util.RespondError(e, util.NewBadRequestError("track ID is required"))
		}

		if err := musicService.DeleteTrack(trackId, userId); err != nil {
			return util.RespondError(e, util.NewInternalError(err.Error()))
		}

		return e.JSON(http.StatusOK, map[string]string{"message": "track deleted"})
	}
}

func streamTrack(streamer *music.AudioStreamer) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		trackId := e.Request.PathValue("id")
		if trackId == "" {
			return util.RespondError(e, util.NewBadRequestError("track ID is required"))
		}

		record, err := store.GetDao().FindRecordById("music_tracks", trackId)
		if err != nil {
			return util.RespondError(e, util.NewNotFoundError("track not found"))
		}

		if record.GetString("user") != userId {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		filePath := record.GetString("file_path")
		if err := streamer.StreamFile(e.Response, e.Request, filePath); err != nil {
			return util.RespondError(e, util.NewInternalError("failed to stream track"))
		}

		return nil
	}
}

func listAlbums(musicService *music.MusicService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		albums, err := musicService.GetAlbums(userId)
		if err != nil {
			return util.RespondError(e, util.NewInternalError("failed to fetch albums"))
		}

		return e.JSON(http.StatusOK, albums)
	}
}

func listArtists(musicService *music.MusicService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		artists, err := musicService.GetArtists(userId)
		if err != nil {
			return util.RespondError(e, util.NewInternalError("failed to fetch artists"))
		}

		return e.JSON(http.StatusOK, artists)
	}
}

func listGenres(musicService *music.MusicService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		genres, err := musicService.GetGenres(userId)
		if err != nil {
			return util.RespondError(e, util.NewInternalError("failed to fetch genres"))
		}

		return e.JSON(http.StatusOK, genres)
	}
}

func recordPlay(musicService *music.MusicService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		var input struct {
			TrackID        string  `json:"track_id"`
			DurationPlayed float64 `json:"duration_played"`
			Completed      bool    `json:"completed"`
		}

		if err := e.BindBody(&input); err != nil {
			return util.RespondError(e, util.NewBadRequestError("invalid request body"))
		}

		if input.TrackID == "" {
			return util.RespondError(e, util.NewBadRequestError("track_id is required"))
		}

		if err := musicService.RecordPlay(userId, input.TrackID, input.DurationPlayed, input.Completed); err != nil {
			return util.RespondError(e, util.NewInternalError(err.Error()))
		}

		return e.JSON(http.StatusOK, map[string]string{"message": "play recorded"})
	}
}

func getListeningStats(musicService *music.MusicService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		stats, err := musicService.GetListeningStats(userId)
		if err != nil {
			return util.RespondError(e, util.NewInternalError("failed to fetch stats"))
		}

		return e.JSON(http.StatusOK, stats)
	}
}

func startScan(musicService *music.MusicService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		if err := musicService.StartScan(userId); err != nil {
			return util.RespondError(e, util.NewInternalError(err.Error()))
		}

		return e.JSON(http.StatusOK, map[string]string{"message": "scan started"})
	}
}

func getScanStatus(musicService *music.MusicService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		_, ok := util.GetUserIDFromRequest(e)
		if !ok {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		progress := musicService.GetScanProgress()
		return e.JSON(http.StatusOK, progress)
	}
}
