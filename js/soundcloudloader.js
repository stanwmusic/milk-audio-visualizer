define(function () {

    var client_id = "32e4c49c70a9e7e041bf913de7ec38ae"; // to get an ID go to http://developers.soundcloud.com/

    /**
     * Makes a request to the Soundcloud API and returns the JSON data.
     */
    var SoundcloudLoader = Class({
        constructor: function (player, uiUpdater) {
            this.sound = {};
            this.playlist = null;
            this.tracks = null;
            this.trackIndex = 0;
            this.streamUrl = "";
            this.errorMessage = "";
            this.player = player;
            this.uiUpdater = uiUpdater;

            player.crossOrigin = true;
        },

        /**
         * Loads the JSON stream data object from the URL of the track (as given in the location bar of the browser when browsing Soundcloud),
         * and on success it calls the callback passed to it (for example, used to then send the stream_url to the audiosource object).
         * @param url
         * @param callback
         */
        loadStream: function (url, successCallback, errorCallback) {
            var self = this;
            SC.initialize({
                client_id: client_id
            });
            SC.get('/resolve', {
                url: url
            }, function (sound) {
                if (sound) {
                    if (sound.errors) {
                        self.errorMessage = "";
                        for (var i = 0; i < sound.errors.length; i++) {
                            self.errorMessage += sound.errors[i].error_message + '<br>';
                        }
                        self.errorMessage += 'Make sure the URL has the correct format: https://soundcloud.com/user/title-of-the-track';
                        errorCallback();
                    } else {
                        if (sound.kind == "playlist") {
                            // sound is a playlist
                            self.playlist = sound;
                            self.tracks = self.playlist.tracks;
                            self.trackIndex = 0;
                            self.sound = self.tracks[0];
                        } else if (Array.isArray(sound)){
                            // sound is a Likes list
                            self.playlist = null;
                            self.tracks = sound;
                            self.trackIndex = 0;
                            self.sound = self.tracks[0];
                        } else {
                            // sound is a single track
                            self.playlist = null;
                            self.tracks = null;
                            self.trackIndex = 0;
                            self.sound = sound;
                        }
                        self.streamUrl = function () {
                            return self.sound.stream_url + '?client_id=' + client_id;
                        };
                        successCallback();
                    }
                }
            });
        },

        directStream: function (direction) {
            if (direction == 'toggle') {
                if (this.player.paused) {
                    this.player.play();
                } else {
                    this.player.pause();
                }
            } else if (this.tracks) {
                if (direction == 'coasting') {
                    this.streamPlaylistIndex++;
                } else if (direction == 'forward') {
                    if (this.trackIndex >= this.tracks.length - 1) this.trackIndex = 0;
                    else this.trackIndex++;
                } else {
                    if (this.trackIndex <= 0) this.trackIndex = this.tracks.length - 1;
                    else this.trackIndex--;
                }
                if (this.trackIndex >= 0 && this.trackIndex <= this.tracks.length - 1) {
                    this.sound = this.tracks[this.trackIndex];
                    this.player.setAttribute('src', this.streamUrl());
                    this.uiUpdater.update(this);
                    this.player.play();
                }
            }
        }
    });

    return SoundcloudLoader;
});