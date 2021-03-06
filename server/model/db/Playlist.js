var
  _ = require('lodash'),
  mongoose = require('mongoose-q')(),
  Q = require('q'),
  log = require('./../../util/LogUtil'),
  MongooseUtil = require('./../../util/MongooseUtil'),
  DateFields = require('./plugin/DateFields'),
  Schema = mongoose.Schema,
  PlaylistErrorEnum = require('./../enum/PlaylistErrorEnum'),
  deepPopulate = require('mongoose-deep-populate')(mongoose);


function create() {
  var upVoteSchema = new Schema({
    createdBy: {type: Schema.Types.ObjectId, ref: 'User'}   // TODO: required: true when implemented users
  });

  upVoteSchema.plugin(DateFields);

  var playlistTrackSchema = new Schema({
    track: {type: Schema.Types.ObjectId, ref: 'Track'},
    createdBy: {type: Schema.Types.ObjectId, ref: 'User'},    // TODO: required: true when implemented users
    upVotes: [upVoteSchema]
  });

  playlistTrackSchema.plugin(DateFields);

  var playlistSchema = new Schema({
    name: {type: String, required: true},
    description: {type: String},
    tracks: [playlistTrackSchema],
    createdBy: {type: Schema.Types.ObjectId, ref: 'User'}    // TODO: required: true when implemented users
  });

  playlistSchema.plugin(DateFields);
  playlistSchema.plugin(deepPopulate);


  _.extend(playlistSchema.methods, {

    /**
     * Use this save method instead of `episode.saveQ()` if you need the returned episode to be populated
     * @returns {Q.Promise}
     */
    savePopulateQ: function () {
      return this.saveQ()
        .then(function (playlist) {
          return playlist.populateQ(playlistSchema.statics.POPULATE_FIELDS)
        });
    },

    ///**
    // * TODO: Add unit test
    // * @returns {Q.Promise}
    // */
    //getPlaylistTrackById: function (trackId) {
    //
    //  // DEBUG: Say there's no track so we then must create a new one
    //  throw new Error(PlaylistErrorEnum.TRACK_NOT_IN_PLAYLIST);
    //
    //  return this.findPopulateQ({'tracks.id': trackId})
    //    .then(function (tracks) {
    //      if (!tracks || !tracks.length)
    //        throw new Error(TrackErrorEnum.NOT_FOUND);
    //
    //      return tracks[0];
    //    }.bind(this));
    //},

    /**
     * Adds track to playlist if it's not in there already
     *
     * @param track
     * @param user
     * @returns {Q.Promise}   The added or existing track
     */
    addPlaylistTrack: function (track, user) {

      var playlistTrack = this.getPlaylistTrackByIdOrTrackId(track.id);

      if (!!playlistTrack) {
        return playlistTrack;
      }

      playlistTrack = {};
      playlistTrack.trackId = track.id;
      playlistTrack.track = track;
      //playlistTrack.createdBy = null;   // TODO: Add user
      // Add upvotes in a separate step

      console.log('Playlist.addPlaylistTrack:', this.id);

      this.tracks.addToSet(playlistTrack);

      return this.savePopulateQ()
        .then(function (playlist) {
          return this.getPlaylistTrackByIdOrTrackId(track.id);
        }.bind(this));
    },

    upVoteTrack: function (trackId, user) {
      var playlistTrack = this.getPlaylistTrackByIdOrTrackId(trackId);

      if (!playlistTrack)
        throw new Error(PlaylistErrorEnum.TRACK_NOT_IN_PLAYLIST);

      playlistTrack.upVotes.addToSet({}); // TODO: Add user

      console.log('Playlist.upVoteTrack:', playlistTrack);

      this.tracks.sort(playlistTrackSortCompare);

      console.log('Playlist.upVoteTrack: tracks after sort:', this.tracks);

      return this.savePopulateQ()
        .then(function (playlist) {
          return this.getPlaylistTrackByIdOrTrackId(trackId);
        }.bind(this));
    },

    /**
     * Gets a Playlist Track by it's id or the id of it's actual track.
     *
     * @param trackId
     * @returns {*}
     */
    getPlaylistTrackByIdOrTrackId: function (trackIdOrPlaylistTrackId) {
      return _.find(this.tracks, function (playlistTrack) {
        return playlistTrack.id == trackIdOrPlaylistTrackId || playlistTrack.track.toObject()._id == trackIdOrPlaylistTrackId;
      });
    }

  });


  function playlistTrackSortCompare(a, b) {
    if (a.upVotes.length > b.upVotes.length) {
      return -1;
    } else if (a.upVotes.length < b.upVotes.length) {
      return 1;
    } else {
      if (a.upVotes[a.upVotes.length - 1].created < b.upVotes[b.upVotes.length - 1].created) {
        return -1;
      } else if (a.upVotes[a.upVotes.length - 1].created > b.upVotes[b.upVotes.length - 1].created) {
        return 1;
      } else {
        return 0;
      }
    }
  }

  _.extend(playlistSchema.statics, {

    /**
     * These fields need to be populated by a document from another database model. String of fields names, separated by spaces.
     */
    POPULATE_FIELDS: 'createdBy tracks.track tracks.createdBy tracks.upVotes tracks.track.artists tracks.track.album',

    /**
     * Checks if the format of the ID is valid
     *
     * @param id
     */
    isValidId: function (id) {
      return mongoose.Types.ObjectId.isValid(id);
    },

    /**
     * Use this find method instead of `Playlist.findById()` if you need the returned playlist to be populated
     * with external documents.
     *
     * @param id
     * @param fields
     * @param options
     * @returns {Q.Promise}     Promised resolved with a single Episode or null
     */
    findByIdPopulateQ: function (id, fields, options) {
      if (!this.isValidId(id))
        return Q.reject(new Error(PlaylistErrorEnum.INVALID_ID));

      return this.findById(id, fields, options)
        .deepPopulate(this.POPULATE_FIELDS)
        .execQ();
    },

    /**
     * Use this find method instead of `Playlist.find()` if you need the returned episode to be populated
     * with external documents.
     *
     * @param id
     * @param fields
     * @param options
     * @returns {Q.Promise}     Promised resolved with an array of Episodes or an empty array if no matches.
     */
    findPopulateQ: function (conditions, fields, options) {
      //log.debug( 'Playlist.findPopulateQ:', conditions, fields, options );

      return this.find(conditions, fields, options)
        .deepPopulate(this.POPULATE_FIELDS)
        .execQ();
    }

  });

  return playlistSchema;
}


// Export!
MongooseUtil.exportModuleModel('appInstance', 'Playlist', create, module);
