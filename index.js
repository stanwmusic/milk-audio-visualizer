(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var prefixMethod = require("./prefixmethod");

prefixMethod("getUserMedia", {parent:navigator});
prefixMethod("AudioContext");


/**
 * The *AudioSource object creates an analyzer node, sets up a repeating function with setInterval
 * which samples the input and turns it into an FFT array. The object has two properties:
 * streamData - this is the Uint8Array containing the FFT data
 * volume - cumulative value of all the bins of the streaData.
 *
 * The MicrophoneAudioSource uses the getUserMedia interface to get real-time data from the user's microphone. Not used currently but included for possible future use.
 */


var MicrophoneAudioSource = function() {
    var self = this;
    this.volume = 0;
    this.streamData = new Uint8Array(128);
    var analyser;

    var sampleAudioStream = function() {
        analyser.getByteFrequencyData(self.streamData);
        // calculate an overall volume value
        var total = 0;
        for(var i in self.streamData) {
            total += self.streamData[i];
        }
        self.volume = total;
    };

    // get the input stream from the microphone
    navigator.getUserMedia ( { audio: true }, function (stream) {
        var audioCtx = new window.AudioContext();
        var mic = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        mic.connect(analyser);
        setInterval(sampleAudioStream, 20);
    }, function(){ alert("error getting microphone input."); });
};

var SoundCloudAudioSource = function(player) {
    var self = this;
    var analyser;
    var audioCtx = new window.AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    var source = audioCtx.createMediaElementSource(player);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    var sampleAudioStream = function() {
        analyser.getByteFrequencyData(self.streamData);
        // calculate an overall volume value
        var total = 0;
        for (var i = 0; i < 80; i++) { // get the volume from the first 80 bins, else it gets too loud with treble
            total += self.streamData[i];
        }
        self.volume = total;
    };
    setInterval(sampleAudioStream, 20);
    // public properties and methods
    this.volume = 0;
    this.streamData = new Uint8Array(128);
    this.playStream = function(streamUrl) {
        // get the input stream from the audio element
        player.addEventListener('ended', function(){
            self.directStream('coasting');
        });
        player.setAttribute('src', streamUrl);
        player.play();
    };
};
if (typeof module === "object"){
	module.exports = {
		SoundCloudAudioSource: SoundCloudAudioSource,
		MicrophoneAudioSource: MicrophoneAudioSource
	};
}
},{"./prefixmethod":3}],2:[function(require,module,exports){
var UiUpdater = require("./uiupdater");
var SoundCloudAudioSource = require("./audiosource").SoundCloudAudioSource;
var SoundcloudLoader = require("./soundcloudloader");
var Visualizer = require("./visualizer");


window.onload = function init() {

    var visualizer = new Visualizer();
    var player = new Audio();
    var uiUpdater = new UiUpdater();
    var loader = new SoundcloudLoader(player,uiUpdater);

    var audioSource = new SoundCloudAudioSource(player);
    var form = document.getElementById('form');
    var loadAndUpdate = function(trackUrl) {
        loader.loadStream(trackUrl,
            function() {
                uiUpdater.clearInfoPanel();
                audioSource.playStream(loader.streamUrl());
                uiUpdater.update(loader);
                setTimeout(uiUpdater.toggleControlPanel, 3000); // auto-hide the control panel
            },
            function() {
                uiUpdater.displayMessage("Error", loader.errorMessage);
            });
    };

    visualizer.init({
        containerId: 'visualizer',
        audioSource: audioSource
    });


    uiUpdater.toggleControlPanel();
    // on load, check to see if there is a track token in the URL, and if so, load that automatically
    if (window.location.hash) {
        var trackUrl = 'https://soundcloud.com/' + window.location.hash.substr(1);
        loadAndUpdate(trackUrl);
    }

    // handle the form submit event to load the new URL
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var trackUrl = document.getElementById('input').value;
        loadAndUpdate(trackUrl);
    });
    var toggleButton = document.getElementById('toggleButton');
    toggleButton.addEventListener('click', function(e) {
        e.preventDefault();
        uiUpdater.toggleControlPanel();
    });
    var aboutButton = document.getElementById('credit');
    aboutButton.addEventListener('click', function(e) {
        e.preventDefault();
        var message = document.getElementById('info').innerHTML;
        uiUpdater.displayMessage("About", message);
    });

    window.addEventListener("keydown", keyControls, false);
     
    function keyControls(e) {
        switch(e.keyCode) {
            case 32:
                // spacebar pressed
                loader.directStream('toggle');
                break;
            case 37:
                // left key pressed
                loader.directStream('backward');
                break;
            case 39:
                // right key pressed
                loader.directStream('forward');
                break;
        }   
    }


};
},{"./audiosource":1,"./soundcloudloader":4,"./uiupdater":5,"./visualizer":6}],3:[function(require,module,exports){
function prefixMethod(methodName, options){
	options = options || {};
	if (!options.uncapitalized){
		methodName = methodName.charAt(0).toUpperCase() + methodName.slice(1);
	}
	var parent = options.parent || window;
	var prefixes = options.prefixes || ["webkit", "moz", "o", "ms"];

	var i = 0;
	while(!parent[methodName]){
		parent[methodName] = parent[prefixes[i++] + methodName];
	}
	return parent[methodName];
}

module.exports = prefixMethod;
},{}],4:[function(require,module,exports){
/**
 * Makes a request to the Soundcloud API and returns the JSON data.
 */
var SoundcloudLoader = function(player,uiUpdater) {
    var self = this;
    var client_id = "32e4c49c70a9e7e041bf913de7ec38ae"; // to get an ID go to http://developers.soundcloud.com/
    this.sound = {};
    this.streamUrl = "";
    this.errorMessage = "";
    this.player = player;
    this.uiUpdater = uiUpdater;

    /**
     * Loads the JSON stream data object from the URL of the track (as given in the location bar of the browser when browsing Soundcloud),
     * and on success it calls the callback passed to it (for example, used to then send the stream_url to the audiosource object).
     * @param track_url
     * @param callback
     */
    this.loadStream = function(track_url, successCallback, errorCallback) {
        SC.initialize({
            client_id: client_id
        });
        SC.get('/resolve', { url: track_url }, function(sound) {
            if (sound.errors) {
                self.errorMessage = "";
                for (var i = 0; i < sound.errors.length; i++) {
                    self.errorMessage += sound.errors[i].error_message + '<br>';
                }
                self.errorMessage += 'Make sure the URL has the correct format: https://soundcloud.com/user/title-of-the-track';
                errorCallback();
            } else {

                if(sound.kind=="playlist"){
                    self.sound = sound;
                    self.streamPlaylistIndex = 0;
                    self.streamUrl = function(){
                        return sound.tracks[self.streamPlaylistIndex].stream_url + '?client_id=' + client_id;
                    }
                    successCallback();
                }else{
                    self.sound = sound;
                    self.streamUrl = function(){ return sound.stream_url + '?client_id=' + client_id; };
                    successCallback();
                }
            }
        });
    };


    this.directStream = function(direction){
        if(direction=='toggle'){
            if (this.player.paused) {
                this.player.play();
            } else {
                this.player.pause();
            }
        }
        else if(this.sound.kind=="playlist"){
            if(direction=='coasting') {
                this.streamPlaylistIndex++;
            }else if(direction=='forward') {
                if(this.streamPlaylistIndex>=this.sound.track_count-1) this.streamPlaylistIndex = 0;
                else this.streamPlaylistIndex++;
            }else{
                if(this.streamPlaylistIndex<=0) this.streamPlaylistIndex = this.sound.track_count-1;
                else this.streamPlaylistIndex--;
            }
            if(this.streamPlaylistIndex>=0 && this.streamPlaylistIndex<=this.sound.track_count-1) {
               this.player.setAttribute('src',this.streamUrl());
               this.uiUpdater.update(this);
               this.player.play();
            }
        }
    }


};
if (typeof module === "object"){
    module.exports = SoundcloudLoader;
}
},{}],5:[function(require,module,exports){
/**
 * Class to update the UI when a new sound is loaded
 * @constructor
 */
var UiUpdater = function() {
    var controlPanel = document.getElementById('controlPanel');
    var trackInfoPanel = document.getElementById('trackInfoPanel');
    var infoImage = document.getElementById('infoImage');
    var infoArtist = document.getElementById('infoArtist');
    var infoTrack = document.getElementById('infoTrack');
    var messageBox = document.getElementById('messageBox');

    this.clearInfoPanel = function() {
        // first clear the current contents
        infoArtist.innerHTML = "";
        infoTrack.innerHTML = "";
        trackInfoPanel.className = 'hidden';
    };
    this.update = function(loader) {
        // update the track and artist into in the controlPanel
        var artistLink = document.createElement('a');
        artistLink.setAttribute('href', loader.sound.user.permalink_url);
        artistLink.innerHTML = loader.sound.user.username;
        var trackLink = document.createElement('a');
        trackLink.setAttribute('href', loader.sound.permalink_url);

        if(loader.sound.kind=="playlist"){
            trackLink.innerHTML = "<p>" + loader.sound.tracks[loader.streamPlaylistIndex].title + "</p>" + "<p>"+loader.sound.title+"</p>";
        }else{
            trackLink.innerHTML = loader.sound.title;
        }

        var image = loader.sound.artwork_url ? loader.sound.artwork_url : loader.sound.user.avatar_url; // if no track artwork exists, use the user's avatar.
        infoImage.setAttribute('src', image);

        infoArtist.innerHTML = '';
        infoArtist.appendChild(artistLink);

        infoTrack.innerHTML = '';
        infoTrack.appendChild(trackLink);

        // display the track info panel
        trackInfoPanel.className = '';

        // add a hash to the URL so it can be shared or saved
        var trackToken = loader.sound.permalink_url.substr(22);
        window.location = '#' + trackToken;
    };
    this.toggleControlPanel = function() {
        if (controlPanel.className.indexOf('hidden') === 0) {
            controlPanel.className = '';
        } else {
            controlPanel.className = 'hidden';
        }
    };
    this.displayMessage = function(title, message) {
        messageBox.innerHTML = ''; // reset the contents

        var titleElement = document.createElement('h3');
        titleElement.innerHTML = title;

        var messageElement = document.createElement('p');
        messageElement.innerHTML = message;

        var closeButton = document.createElement('a');
        closeButton.setAttribute('href', '#');
        closeButton.innerHTML = 'close';
        closeButton.addEventListener('click', function(e) {
            e.preventDefault();
            messageBox.className = 'hidden';
        });

        messageBox.className = '';
        // stick them into the container div
        messageBox.appendChild(titleElement);
        messageBox.appendChild(messageElement);
        messageBox.appendChild(closeButton);
    };
};
if (typeof module === "object"){
	module.exports = UiUpdater;
}
},{}],6:[function(require,module,exports){
/**
 * The Visualizer object, after being instantiated, must be initialized with the init() method,
 * which takes an options object specifying the element to append the canvases to and the audiosource which will
 * provide the data to be visualized.
 */
var Visualizer = function() {
    var tileSize;
    var tiles = [];
    var stars = [];
    // canvas vars
    var fgCanvas;
    var fgCtx;
    var fgRotation = 0.001;
    var bgCanvas;
    var bgCtx;
    var sfCanvas;
    var sfCtx;
    var audioSource;

    function Polygon(sides, x, y, tileSize, ctx, num) {
        this.sides = sides;
        this.tileSize = tileSize;
        this.ctx = ctx;
        this.num = num; // the number of the tile, starting at 0
        this.high = 0; // the highest colour value, which then fades out
        this.decay = this.num > 42 ? 1.5 : 2; // increase this value to fade out faster.
        this.highlight = 0; // for highlighted stroke effect;
        // figure out the x and y coordinates of the center of the polygon based on the
        // 60 degree XY axis coordinates passed in
        var step = Math.round(Math.cos(Math.PI/6)*tileSize*2);
        this.y = Math.round(step * Math.sin(Math.PI/3) * -y  );
        this.x = Math.round(x * step + y * step/2 );

        // calculate the vertices of the polygon
        this.vertices = [];
        for (var i = 1; i <= this.sides;i += 1) {
            x = this.x + this.tileSize * Math.cos(i * 2 * Math.PI / this.sides + Math.PI/6);
            y = this.y + this.tileSize * Math.sin(i * 2 * Math.PI / this.sides + Math.PI/6);
            this.vertices.push([x, y]);
        }
    }
    Polygon.prototype.rotateVertices = function() {
        // rotate all the vertices to achieve the overall rotational effect
        var rotation = fgRotation;
        rotation -= audioSource.volume > 10000 ? Math.sin(audioSource.volume/800000) : 0;
        for (var i = 0; i <= this.sides-1;i += 1) {
            this.vertices[i][0] = this.vertices[i][0] -  this.vertices[i][1] * Math.sin(rotation);
            this.vertices[i][1] = this.vertices[i][1] +  this.vertices[i][0] * Math.sin(rotation);
        }
    };
    var minMental = 0, maxMental = 0;
    Polygon.prototype.calculateOffset = function(coords) {
        var angle = Math.atan(coords[1]/coords[0]);
        var distance = Math.sqrt(Math.pow(coords[0], 2) + Math.pow(coords[1], 2)); // a bit of pythagoras
        var mentalFactor = Math.min(Math.max((Math.tan(audioSource.volume/6000) * 0.5), -20), 2); // this factor makes the visualization go crazy wild
        /*
        // debug
        minMental = mentalFactor < minMental ? mentalFactor : minMental;
         maxMental = mentalFactor > maxMental ? mentalFactor : maxMental;*/
        var offsetFactor = Math.pow(distance/3, 2) * (audioSource.volume/2000000) * (Math.pow(this.high, 1.3)/300) * mentalFactor;
        var offsetX = Math.cos(angle) * offsetFactor;
        var offsetY = Math.sin(angle) * offsetFactor;
        offsetX *= (coords[0] < 0) ? -1 : 1;
        offsetY *= (coords[0] < 0) ? -1 : 1;
        return [offsetX, offsetY];
    };
    Polygon.prototype.drawPolygon = function() {
        var bucket = Math.ceil(audioSource.streamData.length/tiles.length*this.num);
        var val = Math.pow((audioSource.streamData[bucket]/255),2)*255;
        val *= this.num > 42 ? 1.1 : 1;
        // establish the value for this tile
        if (val > this.high) {
            this.high = val;
        } else {
            this.high -= this.decay;
            val = this.high;
        }

        // figure out what colour to fill it and then draw the polygon
        var r, g, b, a;
        if (val > 0) {
            this.ctx.beginPath();
            var offset = this.calculateOffset(this.vertices[0]);
            this.ctx.moveTo(this.vertices[0][0] + offset[0], this.vertices[0][1] + offset[1]);
            // draw the polygon
            for (var i = 1; i <= this.sides-1;i += 1) {
                offset = this.calculateOffset(this.vertices[i]);
                this.ctx.lineTo (this.vertices[i][0] + offset[0], this.vertices[i][1] + offset[1]);
            }
            this.ctx.closePath();

            if (val > 128) {
                r = (val-128)*2;
                g = ((Math.cos((2*val/128*Math.PI/2)- 4*Math.PI/3)+1)*128);
                b = (val-105)*3;
            }
            else if (val > 175) {
                r = (val-128)*2;
                g = 255;
                b = (val-105)*3;
            }
            else {
                r = ((Math.cos((2*val/128*Math.PI/2))+1)*128);
                g = ((Math.cos((2*val/128*Math.PI/2)- 4*Math.PI/3)+1)*128);
                b = ((Math.cos((2.4*val/128*Math.PI/2)- 2*Math.PI/3)+1)*128);
            }
            if (val > 210) {
                this.cubed = val; // add the cube effect if it's really loud
            }
            if (val > 120) {
                this.highlight = 100; // add the highlight effect if it's pretty loud
            }
            // set the alpha
            var e = 2.7182;
            a = (0.5/(1 + 40 * Math.pow(e, -val/8))) + (0.5/(1 + 40 * Math.pow(e, -val/20)));

            this.ctx.fillStyle = "rgba(" +
                Math.round(r) + ", " +
                Math.round(g) + ", " +
                Math.round(b) + ", " +
                a + ")";
            this.ctx.fill();
            // stroke
            if (val > 20) {
                var strokeVal = 20;
                this.ctx.strokeStyle =  "rgba(" + strokeVal + ", " + strokeVal + ", " + strokeVal + ", 0.5)";
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }
        }
        // display the tile number for debug purposes
        /*this.ctx.font = "bold 12px sans-serif";
         this.ctx.fillStyle = 'grey';
         this.ctx.fillText(this.num, this.vertices[0][0], this.vertices[0][1]);*/
    };
    Polygon.prototype.drawHighlight = function() {
        this.ctx.beginPath();
        // draw the highlight
        var offset = this.calculateOffset(this.vertices[0]);
        this.ctx.moveTo(this.vertices[0][0] + offset[0], this.vertices[0][1] + offset[1]);
        // draw the polygon
        for (var i = 0; i <= this.sides-1;i += 1) {
            offset = this.calculateOffset(this.vertices[i]);
            this.ctx.lineTo (this.vertices[i][0] + offset[0], this.vertices[i][1] + offset[1]);
        }
        this.ctx.closePath();
        var a = this.highlight/100;
        this.ctx.strokeStyle =  "rgba(255, 255, 255, " + a + ")";
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.highlight -= 0.5;
    };

    var makePolygonArray = function() {
        tiles = [];
        /**
         * Arrange into a grid x, y, with the y axis at 60 degrees to the x, rather than
         * the usual 90.
         * @type {number}
         */
        var i = 0; // unique number for each tile
        tiles.push(new Polygon(6, 0, 0, tileSize, fgCtx, i)); // the centre tile
        i++;
        for (var layer = 1; layer < 7; layer++) {
            tiles.push(new Polygon(6, 0, layer, tileSize, fgCtx, i)); i++;
            tiles.push(new Polygon(6, 0, -layer, tileSize, fgCtx, i)); i++;
            for(var x = 1; x < layer; x++) {
                tiles.push(new Polygon(6, x, -layer, tileSize, fgCtx, i)); i++;
                tiles.push(new Polygon(6, -x, layer, tileSize, fgCtx, i)); i++;
                tiles.push(new Polygon(6, x, layer-x, tileSize, fgCtx, i)); i++;
                tiles.push(new Polygon(6, -x, -layer+x, tileSize, fgCtx, i)); i++;
            }
            for(var y = -layer; y <= 0; y++) {
                tiles.push(new Polygon(6, layer, y, tileSize, fgCtx, i)); i++;
                tiles.push(new Polygon(6, -layer, -y, tileSize, fgCtx, i)); i++;
            }
        }
    };

    function Star(x, y, starSize, ctx) {
        this.x = x;
        this.y = y;
        this.angle = Math.atan(Math.abs(y)/Math.abs(x));
        this.starSize = starSize;
        this.ctx = ctx;
        this.high = 0;
    }
    Star.prototype.drawStar = function() {
        var distanceFromCentre = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));

        // stars as lines
        var brightness = 200 + Math.min(Math.round(this.high * 5), 55);
        this.ctx.lineWidth= 0.5 + distanceFromCentre/2000 * Math.max(this.starSize/2, 1);
        this.ctx.strokeStyle='rgba(' + brightness + ', ' + brightness + ', ' + brightness + ', 1)';
        this.ctx.beginPath();
        this.ctx.moveTo(this.x,this.y);
        var lengthFactor = 1 + Math.min(Math.pow(distanceFromCentre,2)/30000 * Math.pow(audioSource.volume, 2)/6000000, distanceFromCentre);
        var toX = Math.cos(this.angle) * -lengthFactor;
        var toY = Math.sin(this.angle) * -lengthFactor;
        toX *= this.x > 0 ? 1 : -1;
        toY *= this.y > 0 ? 1 : -1;
        this.ctx.lineTo(this.x + toX, this.y + toY);
        this.ctx.stroke();
        this.ctx.closePath();

        // starfield movement coming towards the camera
        var speed = lengthFactor/20 * this.starSize;
        this.high -= Math.max(this.high - 0.0001, 0);
        if (speed > this.high) {
            this.high = speed;
        }
        var dX = Math.cos(this.angle) * this.high;
        var dY = Math.sin(this.angle) * this.high;
        this.x += this.x > 0 ? dX : -dX;
        this.y += this.y > 0 ? dY : -dY;

        var limitY = fgCanvas.height/2 + 500;
        var limitX = fgCanvas.width/2 + 500;
        if ((this.y > limitY || this.y < -limitY) || (this.x > limitX || this.x < -limitX)) {
            // it has gone off the edge so respawn it somewhere near the middle.
            this.x = (Math.random() - 0.5) * fgCanvas.width/3;
            this.y = (Math.random() - 0.5) * fgCanvas.height/3;
            this.angle = Math.atan(Math.abs(this.y)/Math.abs(this.x));
        }
    };

    var makeStarArray = function() {
        var x, y, starSize;
        stars = [];
        var limit = fgCanvas.width / 15; // how many stars?
        for (var i = 0; i < limit; i ++) {
            x = (Math.random() - 0.5) * fgCanvas.width;
            y = (Math.random() - 0.5) * fgCanvas.height;
            starSize = (Math.random()+0.1)*3;
            stars.push(new Star(x, y, starSize, sfCtx));
        }
    };


    var drawBg = function() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        var r, g, b, a;
        var val = audioSource.volume/1000;
        r = 200 + (Math.sin(val) + 1) * 28;
        g = val * 2;
        b = val * 8;
        a = Math.sin(val+3*Math.PI/2) + 1;
        bgCtx.beginPath();
        bgCtx.rect(0, 0, bgCanvas.width, bgCanvas.height);
        // create radial gradient
        var grd = bgCtx.createRadialGradient(bgCanvas.width/2, bgCanvas.height/2, val, bgCanvas.width/2, bgCanvas.height/2, bgCanvas.width-Math.min(Math.pow(val, 2.7), bgCanvas.width - 20));
        grd.addColorStop(0, 'rgba(0,0,0,0)');// centre is transparent black
        grd.addColorStop(0.8, "rgba(" +
            Math.round(r) + ", " +
            Math.round(g) + ", " +
            Math.round(b) + ", 0.4)"); // edges are reddish

        bgCtx.fillStyle = grd;
        bgCtx.fill();
        /*
         // debug data
         bgCtx.font = "bold 30px sans-serif";
         bgCtx.fillStyle = 'grey';
         bgCtx.fillText("val: " + val, 30, 30);
         bgCtx.fillText("r: " + r , 30, 60);
         bgCtx.fillText("g: " + g , 30, 90);
         bgCtx.fillText("b: " + b , 30, 120);
         bgCtx.fillText("a: " + a , 30, 150);*/
    };

    this.resizeCanvas = function() {
        if (fgCanvas) {
            // resize the foreground canvas
            fgCanvas.width = window.innerWidth;
            fgCanvas.height = window.innerHeight;
            fgCtx.translate(fgCanvas.width/2,fgCanvas.height/2);

            // resize the bg canvas
            bgCanvas.width = window.innerWidth;
            bgCanvas.height = window.innerHeight;
            // resize the starfield canvas
            sfCanvas.width = window.innerWidth;
            sfCanvas.height = window.innerHeight;
            sfCtx.translate(fgCanvas.width/2,fgCanvas.height/2);

            tileSize = fgCanvas.width > fgCanvas.height ? fgCanvas.width / 25 : fgCanvas.height / 25;

            drawBg();
            makePolygonArray();
            makeStarArray();
        }
    };

    var rotateForeground = function() {
        tiles.forEach(function(tile) {
            tile.rotateVertices();
        });
    };

    var draw = function() {
        fgCtx.clearRect(-fgCanvas.width, -fgCanvas.height, fgCanvas.width*2, fgCanvas.height *2);
        sfCtx.clearRect(-fgCanvas.width/2, -fgCanvas.height/2, fgCanvas.width, fgCanvas.height);

        stars.forEach(function(star) {
            star.drawStar();
        });
        tiles.forEach(function(tile) {
            tile.drawPolygon();
        });
        tiles.forEach(function(tile) {
            if (tile.highlight > 0) {
                tile.drawHighlight();
            }
        });

        // debug
        /* fgCtx.font = "bold 24px sans-serif";
         fgCtx.fillStyle = 'grey';
         fgCtx.fillText("minMental:" + minMental, 10, 10);
         fgCtx.fillText("maxMental:" + maxMental, 10, 40);*/
        requestAnimationFrame(draw);
    };

    this.init = function(options) {
        audioSource = options.audioSource;
        var container = document.getElementById(options.containerId);

        // foreground hexagons layer
        fgCanvas = document.createElement('canvas');
        fgCanvas.setAttribute('style', 'position: absolute; z-index: 10');
        fgCtx = fgCanvas.getContext("2d");
        container.appendChild(fgCanvas);

        // middle starfield layer
        sfCanvas = document.createElement('canvas');
        sfCtx = sfCanvas.getContext("2d");
        sfCanvas.setAttribute('style', 'position: absolute; z-index: 5');
        container.appendChild(sfCanvas);

        // background image layer
        bgCanvas = document.createElement('canvas');
        bgCtx = bgCanvas.getContext("2d");
        container.appendChild(bgCanvas);

        makePolygonArray();
        makeStarArray();

        this.resizeCanvas();
        draw();


        setInterval(drawBg, 100);
        setInterval(rotateForeground, 20);
        // resize the canvas to fill browser window dynamically
        window.addEventListener('resize', this.resizeCanvas, false);
    };
};
module.exports = Visualizer;
},{}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImpzL2F1ZGlvc291cmNlLmpzIiwianMvaW5kZXguanMiLCJqcy9wcmVmaXhtZXRob2QuanMiLCJqcy9zb3VuZGNsb3VkbG9hZGVyLmpzIiwianMvdWl1cGRhdGVyLmpzIiwianMvdmlzdWFsaXplci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgcHJlZml4TWV0aG9kID0gcmVxdWlyZShcIi4vcHJlZml4bWV0aG9kXCIpO1xuXG5wcmVmaXhNZXRob2QoXCJnZXRVc2VyTWVkaWFcIiwge3BhcmVudDpuYXZpZ2F0b3J9KTtcbnByZWZpeE1ldGhvZChcIkF1ZGlvQ29udGV4dFwiKTtcblxuXG4vKipcbiAqIFRoZSAqQXVkaW9Tb3VyY2Ugb2JqZWN0IGNyZWF0ZXMgYW4gYW5hbHl6ZXIgbm9kZSwgc2V0cyB1cCBhIHJlcGVhdGluZyBmdW5jdGlvbiB3aXRoIHNldEludGVydmFsXG4gKiB3aGljaCBzYW1wbGVzIHRoZSBpbnB1dCBhbmQgdHVybnMgaXQgaW50byBhbiBGRlQgYXJyYXkuIFRoZSBvYmplY3QgaGFzIHR3byBwcm9wZXJ0aWVzOlxuICogc3RyZWFtRGF0YSAtIHRoaXMgaXMgdGhlIFVpbnQ4QXJyYXkgY29udGFpbmluZyB0aGUgRkZUIGRhdGFcbiAqIHZvbHVtZSAtIGN1bXVsYXRpdmUgdmFsdWUgb2YgYWxsIHRoZSBiaW5zIG9mIHRoZSBzdHJlYURhdGEuXG4gKlxuICogVGhlIE1pY3JvcGhvbmVBdWRpb1NvdXJjZSB1c2VzIHRoZSBnZXRVc2VyTWVkaWEgaW50ZXJmYWNlIHRvIGdldCByZWFsLXRpbWUgZGF0YSBmcm9tIHRoZSB1c2VyJ3MgbWljcm9waG9uZS4gTm90IHVzZWQgY3VycmVudGx5IGJ1dCBpbmNsdWRlZCBmb3IgcG9zc2libGUgZnV0dXJlIHVzZS5cbiAqL1xuXG5cbnZhciBNaWNyb3Bob25lQXVkaW9Tb3VyY2UgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy52b2x1bWUgPSAwO1xuICAgIHRoaXMuc3RyZWFtRGF0YSA9IG5ldyBVaW50OEFycmF5KDEyOCk7XG4gICAgdmFyIGFuYWx5c2VyO1xuXG4gICAgdmFyIHNhbXBsZUF1ZGlvU3RyZWFtID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGFuYWx5c2VyLmdldEJ5dGVGcmVxdWVuY3lEYXRhKHNlbGYuc3RyZWFtRGF0YSk7XG4gICAgICAgIC8vIGNhbGN1bGF0ZSBhbiBvdmVyYWxsIHZvbHVtZSB2YWx1ZVxuICAgICAgICB2YXIgdG90YWwgPSAwO1xuICAgICAgICBmb3IodmFyIGkgaW4gc2VsZi5zdHJlYW1EYXRhKSB7XG4gICAgICAgICAgICB0b3RhbCArPSBzZWxmLnN0cmVhbURhdGFbaV07XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi52b2x1bWUgPSB0b3RhbDtcbiAgICB9O1xuXG4gICAgLy8gZ2V0IHRoZSBpbnB1dCBzdHJlYW0gZnJvbSB0aGUgbWljcm9waG9uZVxuICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgKCB7IGF1ZGlvOiB0cnVlIH0sIGZ1bmN0aW9uIChzdHJlYW0pIHtcbiAgICAgICAgdmFyIGF1ZGlvQ3R4ID0gbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKTtcbiAgICAgICAgdmFyIG1pYyA9IGF1ZGlvQ3R4LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG4gICAgICAgIGFuYWx5c2VyID0gYXVkaW9DdHguY3JlYXRlQW5hbHlzZXIoKTtcbiAgICAgICAgYW5hbHlzZXIuZmZ0U2l6ZSA9IDI1NjtcbiAgICAgICAgbWljLmNvbm5lY3QoYW5hbHlzZXIpO1xuICAgICAgICBzZXRJbnRlcnZhbChzYW1wbGVBdWRpb1N0cmVhbSwgMjApO1xuICAgIH0sIGZ1bmN0aW9uKCl7IGFsZXJ0KFwiZXJyb3IgZ2V0dGluZyBtaWNyb3Bob25lIGlucHV0LlwiKTsgfSk7XG59O1xuXG52YXIgU291bmRDbG91ZEF1ZGlvU291cmNlID0gZnVuY3Rpb24ocGxheWVyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhbmFseXNlcjtcbiAgICB2YXIgYXVkaW9DdHggPSBuZXcgd2luZG93LkF1ZGlvQ29udGV4dCgpO1xuICAgIGFuYWx5c2VyID0gYXVkaW9DdHguY3JlYXRlQW5hbHlzZXIoKTtcbiAgICBhbmFseXNlci5mZnRTaXplID0gMjU2O1xuICAgIHZhciBzb3VyY2UgPSBhdWRpb0N0eC5jcmVhdGVNZWRpYUVsZW1lbnRTb3VyY2UocGxheWVyKTtcbiAgICBzb3VyY2UuY29ubmVjdChhbmFseXNlcik7XG4gICAgYW5hbHlzZXIuY29ubmVjdChhdWRpb0N0eC5kZXN0aW5hdGlvbik7XG4gICAgdmFyIHNhbXBsZUF1ZGlvU3RyZWFtID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGFuYWx5c2VyLmdldEJ5dGVGcmVxdWVuY3lEYXRhKHNlbGYuc3RyZWFtRGF0YSk7XG4gICAgICAgIC8vIGNhbGN1bGF0ZSBhbiBvdmVyYWxsIHZvbHVtZSB2YWx1ZVxuICAgICAgICB2YXIgdG90YWwgPSAwO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDgwOyBpKyspIHsgLy8gZ2V0IHRoZSB2b2x1bWUgZnJvbSB0aGUgZmlyc3QgODAgYmlucywgZWxzZSBpdCBnZXRzIHRvbyBsb3VkIHdpdGggdHJlYmxlXG4gICAgICAgICAgICB0b3RhbCArPSBzZWxmLnN0cmVhbURhdGFbaV07XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi52b2x1bWUgPSB0b3RhbDtcbiAgICB9O1xuICAgIHNldEludGVydmFsKHNhbXBsZUF1ZGlvU3RyZWFtLCAyMCk7XG4gICAgLy8gcHVibGljIHByb3BlcnRpZXMgYW5kIG1ldGhvZHNcbiAgICB0aGlzLnZvbHVtZSA9IDA7XG4gICAgdGhpcy5zdHJlYW1EYXRhID0gbmV3IFVpbnQ4QXJyYXkoMTI4KTtcbiAgICB0aGlzLnBsYXlTdHJlYW0gPSBmdW5jdGlvbihzdHJlYW1VcmwpIHtcbiAgICAgICAgLy8gZ2V0IHRoZSBpbnB1dCBzdHJlYW0gZnJvbSB0aGUgYXVkaW8gZWxlbWVudFxuICAgICAgICBwbGF5ZXIuYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgc2VsZi5kaXJlY3RTdHJlYW0oJ2NvYXN0aW5nJyk7XG4gICAgICAgIH0pO1xuICAgICAgICBwbGF5ZXIuc2V0QXR0cmlidXRlKCdzcmMnLCBzdHJlYW1VcmwpO1xuICAgICAgICBwbGF5ZXIucGxheSgpO1xuICAgIH07XG59O1xuaWYgKHR5cGVvZiBtb2R1bGUgPT09IFwib2JqZWN0XCIpe1xuXHRtb2R1bGUuZXhwb3J0cyA9IHtcblx0XHRTb3VuZENsb3VkQXVkaW9Tb3VyY2U6IFNvdW5kQ2xvdWRBdWRpb1NvdXJjZSxcblx0XHRNaWNyb3Bob25lQXVkaW9Tb3VyY2U6IE1pY3JvcGhvbmVBdWRpb1NvdXJjZVxuXHR9O1xufSIsInZhciBVaVVwZGF0ZXIgPSByZXF1aXJlKFwiLi91aXVwZGF0ZXJcIik7XG52YXIgU291bmRDbG91ZEF1ZGlvU291cmNlID0gcmVxdWlyZShcIi4vYXVkaW9zb3VyY2VcIikuU291bmRDbG91ZEF1ZGlvU291cmNlO1xudmFyIFNvdW5kY2xvdWRMb2FkZXIgPSByZXF1aXJlKFwiLi9zb3VuZGNsb3VkbG9hZGVyXCIpO1xudmFyIFZpc3VhbGl6ZXIgPSByZXF1aXJlKFwiLi92aXN1YWxpemVyXCIpO1xuXG5cbndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbiBpbml0KCkge1xuXG4gICAgdmFyIHZpc3VhbGl6ZXIgPSBuZXcgVmlzdWFsaXplcigpO1xuICAgIHZhciBwbGF5ZXIgPSBuZXcgQXVkaW8oKTtcbiAgICB2YXIgdWlVcGRhdGVyID0gbmV3IFVpVXBkYXRlcigpO1xuICAgIHZhciBsb2FkZXIgPSBuZXcgU291bmRjbG91ZExvYWRlcihwbGF5ZXIsdWlVcGRhdGVyKTtcblxuICAgIHZhciBhdWRpb1NvdXJjZSA9IG5ldyBTb3VuZENsb3VkQXVkaW9Tb3VyY2UocGxheWVyKTtcbiAgICB2YXIgZm9ybSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmb3JtJyk7XG4gICAgdmFyIGxvYWRBbmRVcGRhdGUgPSBmdW5jdGlvbih0cmFja1VybCkge1xuICAgICAgICBsb2FkZXIubG9hZFN0cmVhbSh0cmFja1VybCxcbiAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHVpVXBkYXRlci5jbGVhckluZm9QYW5lbCgpO1xuICAgICAgICAgICAgICAgIGF1ZGlvU291cmNlLnBsYXlTdHJlYW0obG9hZGVyLnN0cmVhbVVybCgpKTtcbiAgICAgICAgICAgICAgICB1aVVwZGF0ZXIudXBkYXRlKGxvYWRlcik7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCh1aVVwZGF0ZXIudG9nZ2xlQ29udHJvbFBhbmVsLCAzMDAwKTsgLy8gYXV0by1oaWRlIHRoZSBjb250cm9sIHBhbmVsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdWlVcGRhdGVyLmRpc3BsYXlNZXNzYWdlKFwiRXJyb3JcIiwgbG9hZGVyLmVycm9yTWVzc2FnZSk7XG4gICAgICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgdmlzdWFsaXplci5pbml0KHtcbiAgICAgICAgY29udGFpbmVySWQ6ICd2aXN1YWxpemVyJyxcbiAgICAgICAgYXVkaW9Tb3VyY2U6IGF1ZGlvU291cmNlXG4gICAgfSk7XG5cblxuICAgIHVpVXBkYXRlci50b2dnbGVDb250cm9sUGFuZWwoKTtcbiAgICAvLyBvbiBsb2FkLCBjaGVjayB0byBzZWUgaWYgdGhlcmUgaXMgYSB0cmFjayB0b2tlbiBpbiB0aGUgVVJMLCBhbmQgaWYgc28sIGxvYWQgdGhhdCBhdXRvbWF0aWNhbGx5XG4gICAgaWYgKHdpbmRvdy5sb2NhdGlvbi5oYXNoKSB7XG4gICAgICAgIHZhciB0cmFja1VybCA9ICdodHRwczovL3NvdW5kY2xvdWQuY29tLycgKyB3aW5kb3cubG9jYXRpb24uaGFzaC5zdWJzdHIoMSk7XG4gICAgICAgIGxvYWRBbmRVcGRhdGUodHJhY2tVcmwpO1xuICAgIH1cblxuICAgIC8vIGhhbmRsZSB0aGUgZm9ybSBzdWJtaXQgZXZlbnQgdG8gbG9hZCB0aGUgbmV3IFVSTFxuICAgIGZvcm0uYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHZhciB0cmFja1VybCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbnB1dCcpLnZhbHVlO1xuICAgICAgICBsb2FkQW5kVXBkYXRlKHRyYWNrVXJsKTtcbiAgICB9KTtcbiAgICB2YXIgdG9nZ2xlQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RvZ2dsZUJ1dHRvbicpO1xuICAgIHRvZ2dsZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB1aVVwZGF0ZXIudG9nZ2xlQ29udHJvbFBhbmVsKCk7XG4gICAgfSk7XG4gICAgdmFyIGFib3V0QnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NyZWRpdCcpO1xuICAgIGFib3V0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHZhciBtZXNzYWdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2luZm8nKS5pbm5lckhUTUw7XG4gICAgICAgIHVpVXBkYXRlci5kaXNwbGF5TWVzc2FnZShcIkFib3V0XCIsIG1lc3NhZ2UpO1xuICAgIH0pO1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGtleUNvbnRyb2xzLCBmYWxzZSk7XG4gICAgIFxuICAgIGZ1bmN0aW9uIGtleUNvbnRyb2xzKGUpIHtcbiAgICAgICAgc3dpdGNoKGUua2V5Q29kZSkge1xuICAgICAgICAgICAgY2FzZSAzMjpcbiAgICAgICAgICAgICAgICAvLyBzcGFjZWJhciBwcmVzc2VkXG4gICAgICAgICAgICAgICAgbG9hZGVyLmRpcmVjdFN0cmVhbSgndG9nZ2xlJyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDM3OlxuICAgICAgICAgICAgICAgIC8vIGxlZnQga2V5IHByZXNzZWRcbiAgICAgICAgICAgICAgICBsb2FkZXIuZGlyZWN0U3RyZWFtKCdiYWNrd2FyZCcpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAzOTpcbiAgICAgICAgICAgICAgICAvLyByaWdodCBrZXkgcHJlc3NlZFxuICAgICAgICAgICAgICAgIGxvYWRlci5kaXJlY3RTdHJlYW0oJ2ZvcndhcmQnKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfSAgIFxuICAgIH1cblxuXG59OyIsImZ1bmN0aW9uIHByZWZpeE1ldGhvZChtZXRob2ROYW1lLCBvcHRpb25zKXtcblx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdGlmICghb3B0aW9ucy51bmNhcGl0YWxpemVkKXtcblx0XHRtZXRob2ROYW1lID0gbWV0aG9kTmFtZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG1ldGhvZE5hbWUuc2xpY2UoMSk7XG5cdH1cblx0dmFyIHBhcmVudCA9IG9wdGlvbnMucGFyZW50IHx8IHdpbmRvdztcblx0dmFyIHByZWZpeGVzID0gb3B0aW9ucy5wcmVmaXhlcyB8fCBbXCJ3ZWJraXRcIiwgXCJtb3pcIiwgXCJvXCIsIFwibXNcIl07XG5cblx0dmFyIGkgPSAwO1xuXHR3aGlsZSghcGFyZW50W21ldGhvZE5hbWVdKXtcblx0XHRwYXJlbnRbbWV0aG9kTmFtZV0gPSBwYXJlbnRbcHJlZml4ZXNbaSsrXSArIG1ldGhvZE5hbWVdO1xuXHR9XG5cdHJldHVybiBwYXJlbnRbbWV0aG9kTmFtZV07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcHJlZml4TWV0aG9kOyIsIi8qKlxuICogTWFrZXMgYSByZXF1ZXN0IHRvIHRoZSBTb3VuZGNsb3VkIEFQSSBhbmQgcmV0dXJucyB0aGUgSlNPTiBkYXRhLlxuICovXG52YXIgU291bmRjbG91ZExvYWRlciA9IGZ1bmN0aW9uKHBsYXllcix1aVVwZGF0ZXIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGNsaWVudF9pZCA9IFwiMzJlNGM0OWM3MGE5ZTdlMDQxYmY5MTNkZTdlYzM4YWVcIjsgLy8gdG8gZ2V0IGFuIElEIGdvIHRvIGh0dHA6Ly9kZXZlbG9wZXJzLnNvdW5kY2xvdWQuY29tL1xuICAgIHRoaXMuc291bmQgPSB7fTtcbiAgICB0aGlzLnN0cmVhbVVybCA9IFwiXCI7XG4gICAgdGhpcy5lcnJvck1lc3NhZ2UgPSBcIlwiO1xuICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgIHRoaXMudWlVcGRhdGVyID0gdWlVcGRhdGVyO1xuXG4gICAgLyoqXG4gICAgICogTG9hZHMgdGhlIEpTT04gc3RyZWFtIGRhdGEgb2JqZWN0IGZyb20gdGhlIFVSTCBvZiB0aGUgdHJhY2sgKGFzIGdpdmVuIGluIHRoZSBsb2NhdGlvbiBiYXIgb2YgdGhlIGJyb3dzZXIgd2hlbiBicm93c2luZyBTb3VuZGNsb3VkKSxcbiAgICAgKiBhbmQgb24gc3VjY2VzcyBpdCBjYWxscyB0aGUgY2FsbGJhY2sgcGFzc2VkIHRvIGl0IChmb3IgZXhhbXBsZSwgdXNlZCB0byB0aGVuIHNlbmQgdGhlIHN0cmVhbV91cmwgdG8gdGhlIGF1ZGlvc291cmNlIG9iamVjdCkuXG4gICAgICogQHBhcmFtIHRyYWNrX3VybFxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqL1xuICAgIHRoaXMubG9hZFN0cmVhbSA9IGZ1bmN0aW9uKHRyYWNrX3VybCwgc3VjY2Vzc0NhbGxiYWNrLCBlcnJvckNhbGxiYWNrKSB7XG4gICAgICAgIFNDLmluaXRpYWxpemUoe1xuICAgICAgICAgICAgY2xpZW50X2lkOiBjbGllbnRfaWRcbiAgICAgICAgfSk7XG4gICAgICAgIFNDLmdldCgnL3Jlc29sdmUnLCB7IHVybDogdHJhY2tfdXJsIH0sIGZ1bmN0aW9uKHNvdW5kKSB7XG4gICAgICAgICAgICBpZiAoc291bmQuZXJyb3JzKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5lcnJvck1lc3NhZ2UgPSBcIlwiO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc291bmQuZXJyb3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuZXJyb3JNZXNzYWdlICs9IHNvdW5kLmVycm9yc1tpXS5lcnJvcl9tZXNzYWdlICsgJzxicj4nO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzZWxmLmVycm9yTWVzc2FnZSArPSAnTWFrZSBzdXJlIHRoZSBVUkwgaGFzIHRoZSBjb3JyZWN0IGZvcm1hdDogaHR0cHM6Ly9zb3VuZGNsb3VkLmNvbS91c2VyL3RpdGxlLW9mLXRoZS10cmFjayc7XG4gICAgICAgICAgICAgICAgZXJyb3JDYWxsYmFjaygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIGlmKHNvdW5kLmtpbmQ9PVwicGxheWxpc3RcIil7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc291bmQgPSBzb3VuZDtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zdHJlYW1QbGF5bGlzdEluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zdHJlYW1VcmwgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNvdW5kLnRyYWNrc1tzZWxmLnN0cmVhbVBsYXlsaXN0SW5kZXhdLnN0cmVhbV91cmwgKyAnP2NsaWVudF9pZD0nICsgY2xpZW50X2lkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3NDYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNvdW5kID0gc291bmQ7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc3RyZWFtVXJsID0gZnVuY3Rpb24oKXsgcmV0dXJuIHNvdW5kLnN0cmVhbV91cmwgKyAnP2NsaWVudF9pZD0nICsgY2xpZW50X2lkOyB9O1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cblxuICAgIHRoaXMuZGlyZWN0U3RyZWFtID0gZnVuY3Rpb24oZGlyZWN0aW9uKXtcbiAgICAgICAgaWYoZGlyZWN0aW9uPT0ndG9nZ2xlJyl7XG4gICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIucGF1c2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5ZXIucGxheSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBsYXllci5wYXVzZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYodGhpcy5zb3VuZC5raW5kPT1cInBsYXlsaXN0XCIpe1xuICAgICAgICAgICAgaWYoZGlyZWN0aW9uPT0nY29hc3RpbmcnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdHJlYW1QbGF5bGlzdEluZGV4Kys7XG4gICAgICAgICAgICB9ZWxzZSBpZihkaXJlY3Rpb249PSdmb3J3YXJkJykge1xuICAgICAgICAgICAgICAgIGlmKHRoaXMuc3RyZWFtUGxheWxpc3RJbmRleD49dGhpcy5zb3VuZC50cmFja19jb3VudC0xKSB0aGlzLnN0cmVhbVBsYXlsaXN0SW5kZXggPSAwO1xuICAgICAgICAgICAgICAgIGVsc2UgdGhpcy5zdHJlYW1QbGF5bGlzdEluZGV4Kys7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICBpZih0aGlzLnN0cmVhbVBsYXlsaXN0SW5kZXg8PTApIHRoaXMuc3RyZWFtUGxheWxpc3RJbmRleCA9IHRoaXMuc291bmQudHJhY2tfY291bnQtMTtcbiAgICAgICAgICAgICAgICBlbHNlIHRoaXMuc3RyZWFtUGxheWxpc3RJbmRleC0tO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYodGhpcy5zdHJlYW1QbGF5bGlzdEluZGV4Pj0wICYmIHRoaXMuc3RyZWFtUGxheWxpc3RJbmRleDw9dGhpcy5zb3VuZC50cmFja19jb3VudC0xKSB7XG4gICAgICAgICAgICAgICB0aGlzLnBsYXllci5zZXRBdHRyaWJ1dGUoJ3NyYycsdGhpcy5zdHJlYW1VcmwoKSk7XG4gICAgICAgICAgICAgICB0aGlzLnVpVXBkYXRlci51cGRhdGUodGhpcyk7XG4gICAgICAgICAgICAgICB0aGlzLnBsYXllci5wbGF5KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cblxufTtcbmlmICh0eXBlb2YgbW9kdWxlID09PSBcIm9iamVjdFwiKXtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFNvdW5kY2xvdWRMb2FkZXI7XG59IiwiLyoqXG4gKiBDbGFzcyB0byB1cGRhdGUgdGhlIFVJIHdoZW4gYSBuZXcgc291bmQgaXMgbG9hZGVkXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFVpVXBkYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb250cm9sUGFuZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udHJvbFBhbmVsJyk7XG4gICAgdmFyIHRyYWNrSW5mb1BhbmVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RyYWNrSW5mb1BhbmVsJyk7XG4gICAgdmFyIGluZm9JbWFnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbmZvSW1hZ2UnKTtcbiAgICB2YXIgaW5mb0FydGlzdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbmZvQXJ0aXN0Jyk7XG4gICAgdmFyIGluZm9UcmFjayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbmZvVHJhY2snKTtcbiAgICB2YXIgbWVzc2FnZUJveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZXNzYWdlQm94Jyk7XG5cbiAgICB0aGlzLmNsZWFySW5mb1BhbmVsID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIGZpcnN0IGNsZWFyIHRoZSBjdXJyZW50IGNvbnRlbnRzXG4gICAgICAgIGluZm9BcnRpc3QuaW5uZXJIVE1MID0gXCJcIjtcbiAgICAgICAgaW5mb1RyYWNrLmlubmVySFRNTCA9IFwiXCI7XG4gICAgICAgIHRyYWNrSW5mb1BhbmVsLmNsYXNzTmFtZSA9ICdoaWRkZW4nO1xuICAgIH07XG4gICAgdGhpcy51cGRhdGUgPSBmdW5jdGlvbihsb2FkZXIpIHtcbiAgICAgICAgLy8gdXBkYXRlIHRoZSB0cmFjayBhbmQgYXJ0aXN0IGludG8gaW4gdGhlIGNvbnRyb2xQYW5lbFxuICAgICAgICB2YXIgYXJ0aXN0TGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgYXJ0aXN0TGluay5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCBsb2FkZXIuc291bmQudXNlci5wZXJtYWxpbmtfdXJsKTtcbiAgICAgICAgYXJ0aXN0TGluay5pbm5lckhUTUwgPSBsb2FkZXIuc291bmQudXNlci51c2VybmFtZTtcbiAgICAgICAgdmFyIHRyYWNrTGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgdHJhY2tMaW5rLnNldEF0dHJpYnV0ZSgnaHJlZicsIGxvYWRlci5zb3VuZC5wZXJtYWxpbmtfdXJsKTtcblxuICAgICAgICBpZihsb2FkZXIuc291bmQua2luZD09XCJwbGF5bGlzdFwiKXtcbiAgICAgICAgICAgIHRyYWNrTGluay5pbm5lckhUTUwgPSBcIjxwPlwiICsgbG9hZGVyLnNvdW5kLnRyYWNrc1tsb2FkZXIuc3RyZWFtUGxheWxpc3RJbmRleF0udGl0bGUgKyBcIjwvcD5cIiArIFwiPHA+XCIrbG9hZGVyLnNvdW5kLnRpdGxlK1wiPC9wPlwiO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRyYWNrTGluay5pbm5lckhUTUwgPSBsb2FkZXIuc291bmQudGl0bGU7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaW1hZ2UgPSBsb2FkZXIuc291bmQuYXJ0d29ya191cmwgPyBsb2FkZXIuc291bmQuYXJ0d29ya191cmwgOiBsb2FkZXIuc291bmQudXNlci5hdmF0YXJfdXJsOyAvLyBpZiBubyB0cmFjayBhcnR3b3JrIGV4aXN0cywgdXNlIHRoZSB1c2VyJ3MgYXZhdGFyLlxuICAgICAgICBpbmZvSW1hZ2Uuc2V0QXR0cmlidXRlKCdzcmMnLCBpbWFnZSk7XG5cbiAgICAgICAgaW5mb0FydGlzdC5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgaW5mb0FydGlzdC5hcHBlbmRDaGlsZChhcnRpc3RMaW5rKTtcblxuICAgICAgICBpbmZvVHJhY2suaW5uZXJIVE1MID0gJyc7XG4gICAgICAgIGluZm9UcmFjay5hcHBlbmRDaGlsZCh0cmFja0xpbmspO1xuXG4gICAgICAgIC8vIGRpc3BsYXkgdGhlIHRyYWNrIGluZm8gcGFuZWxcbiAgICAgICAgdHJhY2tJbmZvUGFuZWwuY2xhc3NOYW1lID0gJyc7XG5cbiAgICAgICAgLy8gYWRkIGEgaGFzaCB0byB0aGUgVVJMIHNvIGl0IGNhbiBiZSBzaGFyZWQgb3Igc2F2ZWRcbiAgICAgICAgdmFyIHRyYWNrVG9rZW4gPSBsb2FkZXIuc291bmQucGVybWFsaW5rX3VybC5zdWJzdHIoMjIpO1xuICAgICAgICB3aW5kb3cubG9jYXRpb24gPSAnIycgKyB0cmFja1Rva2VuO1xuICAgIH07XG4gICAgdGhpcy50b2dnbGVDb250cm9sUGFuZWwgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKGNvbnRyb2xQYW5lbC5jbGFzc05hbWUuaW5kZXhPZignaGlkZGVuJykgPT09IDApIHtcbiAgICAgICAgICAgIGNvbnRyb2xQYW5lbC5jbGFzc05hbWUgPSAnJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnRyb2xQYW5lbC5jbGFzc05hbWUgPSAnaGlkZGVuJztcbiAgICAgICAgfVxuICAgIH07XG4gICAgdGhpcy5kaXNwbGF5TWVzc2FnZSA9IGZ1bmN0aW9uKHRpdGxlLCBtZXNzYWdlKSB7XG4gICAgICAgIG1lc3NhZ2VCb3guaW5uZXJIVE1MID0gJyc7IC8vIHJlc2V0IHRoZSBjb250ZW50c1xuXG4gICAgICAgIHZhciB0aXRsZUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdoMycpO1xuICAgICAgICB0aXRsZUVsZW1lbnQuaW5uZXJIVE1MID0gdGl0bGU7XG5cbiAgICAgICAgdmFyIG1lc3NhZ2VFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xuICAgICAgICBtZXNzYWdlRWxlbWVudC5pbm5lckhUTUwgPSBtZXNzYWdlO1xuXG4gICAgICAgIHZhciBjbG9zZUJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgY2xvc2VCdXR0b24uc2V0QXR0cmlidXRlKCdocmVmJywgJyMnKTtcbiAgICAgICAgY2xvc2VCdXR0b24uaW5uZXJIVE1MID0gJ2Nsb3NlJztcbiAgICAgICAgY2xvc2VCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICBtZXNzYWdlQm94LmNsYXNzTmFtZSA9ICdoaWRkZW4nO1xuICAgICAgICB9KTtcblxuICAgICAgICBtZXNzYWdlQm94LmNsYXNzTmFtZSA9ICcnO1xuICAgICAgICAvLyBzdGljayB0aGVtIGludG8gdGhlIGNvbnRhaW5lciBkaXZcbiAgICAgICAgbWVzc2FnZUJveC5hcHBlbmRDaGlsZCh0aXRsZUVsZW1lbnQpO1xuICAgICAgICBtZXNzYWdlQm94LmFwcGVuZENoaWxkKG1lc3NhZ2VFbGVtZW50KTtcbiAgICAgICAgbWVzc2FnZUJveC5hcHBlbmRDaGlsZChjbG9zZUJ1dHRvbik7XG4gICAgfTtcbn07XG5pZiAodHlwZW9mIG1vZHVsZSA9PT0gXCJvYmplY3RcIil7XG5cdG1vZHVsZS5leHBvcnRzID0gVWlVcGRhdGVyO1xufSIsIi8qKlxuICogVGhlIFZpc3VhbGl6ZXIgb2JqZWN0LCBhZnRlciBiZWluZyBpbnN0YW50aWF0ZWQsIG11c3QgYmUgaW5pdGlhbGl6ZWQgd2l0aCB0aGUgaW5pdCgpIG1ldGhvZCxcbiAqIHdoaWNoIHRha2VzIGFuIG9wdGlvbnMgb2JqZWN0IHNwZWNpZnlpbmcgdGhlIGVsZW1lbnQgdG8gYXBwZW5kIHRoZSBjYW52YXNlcyB0byBhbmQgdGhlIGF1ZGlvc291cmNlIHdoaWNoIHdpbGxcbiAqIHByb3ZpZGUgdGhlIGRhdGEgdG8gYmUgdmlzdWFsaXplZC5cbiAqL1xudmFyIFZpc3VhbGl6ZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGlsZVNpemU7XG4gICAgdmFyIHRpbGVzID0gW107XG4gICAgdmFyIHN0YXJzID0gW107XG4gICAgLy8gY2FudmFzIHZhcnNcbiAgICB2YXIgZmdDYW52YXM7XG4gICAgdmFyIGZnQ3R4O1xuICAgIHZhciBmZ1JvdGF0aW9uID0gMC4wMDE7XG4gICAgdmFyIGJnQ2FudmFzO1xuICAgIHZhciBiZ0N0eDtcbiAgICB2YXIgc2ZDYW52YXM7XG4gICAgdmFyIHNmQ3R4O1xuICAgIHZhciBhdWRpb1NvdXJjZTtcblxuICAgIGZ1bmN0aW9uIFBvbHlnb24oc2lkZXMsIHgsIHksIHRpbGVTaXplLCBjdHgsIG51bSkge1xuICAgICAgICB0aGlzLnNpZGVzID0gc2lkZXM7XG4gICAgICAgIHRoaXMudGlsZVNpemUgPSB0aWxlU2l6ZTtcbiAgICAgICAgdGhpcy5jdHggPSBjdHg7XG4gICAgICAgIHRoaXMubnVtID0gbnVtOyAvLyB0aGUgbnVtYmVyIG9mIHRoZSB0aWxlLCBzdGFydGluZyBhdCAwXG4gICAgICAgIHRoaXMuaGlnaCA9IDA7IC8vIHRoZSBoaWdoZXN0IGNvbG91ciB2YWx1ZSwgd2hpY2ggdGhlbiBmYWRlcyBvdXRcbiAgICAgICAgdGhpcy5kZWNheSA9IHRoaXMubnVtID4gNDIgPyAxLjUgOiAyOyAvLyBpbmNyZWFzZSB0aGlzIHZhbHVlIHRvIGZhZGUgb3V0IGZhc3Rlci5cbiAgICAgICAgdGhpcy5oaWdobGlnaHQgPSAwOyAvLyBmb3IgaGlnaGxpZ2h0ZWQgc3Ryb2tlIGVmZmVjdDtcbiAgICAgICAgLy8gZmlndXJlIG91dCB0aGUgeCBhbmQgeSBjb29yZGluYXRlcyBvZiB0aGUgY2VudGVyIG9mIHRoZSBwb2x5Z29uIGJhc2VkIG9uIHRoZVxuICAgICAgICAvLyA2MCBkZWdyZWUgWFkgYXhpcyBjb29yZGluYXRlcyBwYXNzZWQgaW5cbiAgICAgICAgdmFyIHN0ZXAgPSBNYXRoLnJvdW5kKE1hdGguY29zKE1hdGguUEkvNikqdGlsZVNpemUqMik7XG4gICAgICAgIHRoaXMueSA9IE1hdGgucm91bmQoc3RlcCAqIE1hdGguc2luKE1hdGguUEkvMykgKiAteSAgKTtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5yb3VuZCh4ICogc3RlcCArIHkgKiBzdGVwLzIgKTtcblxuICAgICAgICAvLyBjYWxjdWxhdGUgdGhlIHZlcnRpY2VzIG9mIHRoZSBwb2x5Z29uXG4gICAgICAgIHRoaXMudmVydGljZXMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPD0gdGhpcy5zaWRlcztpICs9IDEpIHtcbiAgICAgICAgICAgIHggPSB0aGlzLnggKyB0aGlzLnRpbGVTaXplICogTWF0aC5jb3MoaSAqIDIgKiBNYXRoLlBJIC8gdGhpcy5zaWRlcyArIE1hdGguUEkvNik7XG4gICAgICAgICAgICB5ID0gdGhpcy55ICsgdGhpcy50aWxlU2l6ZSAqIE1hdGguc2luKGkgKiAyICogTWF0aC5QSSAvIHRoaXMuc2lkZXMgKyBNYXRoLlBJLzYpO1xuICAgICAgICAgICAgdGhpcy52ZXJ0aWNlcy5wdXNoKFt4LCB5XSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgUG9seWdvbi5wcm90b3R5cGUucm90YXRlVmVydGljZXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gcm90YXRlIGFsbCB0aGUgdmVydGljZXMgdG8gYWNoaWV2ZSB0aGUgb3ZlcmFsbCByb3RhdGlvbmFsIGVmZmVjdFxuICAgICAgICB2YXIgcm90YXRpb24gPSBmZ1JvdGF0aW9uO1xuICAgICAgICByb3RhdGlvbiAtPSBhdWRpb1NvdXJjZS52b2x1bWUgPiAxMDAwMCA/IE1hdGguc2luKGF1ZGlvU291cmNlLnZvbHVtZS84MDAwMDApIDogMDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPD0gdGhpcy5zaWRlcy0xO2kgKz0gMSkge1xuICAgICAgICAgICAgdGhpcy52ZXJ0aWNlc1tpXVswXSA9IHRoaXMudmVydGljZXNbaV1bMF0gLSAgdGhpcy52ZXJ0aWNlc1tpXVsxXSAqIE1hdGguc2luKHJvdGF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMudmVydGljZXNbaV1bMV0gPSB0aGlzLnZlcnRpY2VzW2ldWzFdICsgIHRoaXMudmVydGljZXNbaV1bMF0gKiBNYXRoLnNpbihyb3RhdGlvbik7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHZhciBtaW5NZW50YWwgPSAwLCBtYXhNZW50YWwgPSAwO1xuICAgIFBvbHlnb24ucHJvdG90eXBlLmNhbGN1bGF0ZU9mZnNldCA9IGZ1bmN0aW9uKGNvb3Jkcykge1xuICAgICAgICB2YXIgYW5nbGUgPSBNYXRoLmF0YW4oY29vcmRzWzFdL2Nvb3Jkc1swXSk7XG4gICAgICAgIHZhciBkaXN0YW5jZSA9IE1hdGguc3FydChNYXRoLnBvdyhjb29yZHNbMF0sIDIpICsgTWF0aC5wb3coY29vcmRzWzFdLCAyKSk7IC8vIGEgYml0IG9mIHB5dGhhZ29yYXNcbiAgICAgICAgdmFyIG1lbnRhbEZhY3RvciA9IE1hdGgubWluKE1hdGgubWF4KChNYXRoLnRhbihhdWRpb1NvdXJjZS52b2x1bWUvNjAwMCkgKiAwLjUpLCAtMjApLCAyKTsgLy8gdGhpcyBmYWN0b3IgbWFrZXMgdGhlIHZpc3VhbGl6YXRpb24gZ28gY3Jhenkgd2lsZFxuICAgICAgICAvKlxuICAgICAgICAvLyBkZWJ1Z1xuICAgICAgICBtaW5NZW50YWwgPSBtZW50YWxGYWN0b3IgPCBtaW5NZW50YWwgPyBtZW50YWxGYWN0b3IgOiBtaW5NZW50YWw7XG4gICAgICAgICBtYXhNZW50YWwgPSBtZW50YWxGYWN0b3IgPiBtYXhNZW50YWwgPyBtZW50YWxGYWN0b3IgOiBtYXhNZW50YWw7Ki9cbiAgICAgICAgdmFyIG9mZnNldEZhY3RvciA9IE1hdGgucG93KGRpc3RhbmNlLzMsIDIpICogKGF1ZGlvU291cmNlLnZvbHVtZS8yMDAwMDAwKSAqIChNYXRoLnBvdyh0aGlzLmhpZ2gsIDEuMykvMzAwKSAqIG1lbnRhbEZhY3RvcjtcbiAgICAgICAgdmFyIG9mZnNldFggPSBNYXRoLmNvcyhhbmdsZSkgKiBvZmZzZXRGYWN0b3I7XG4gICAgICAgIHZhciBvZmZzZXRZID0gTWF0aC5zaW4oYW5nbGUpICogb2Zmc2V0RmFjdG9yO1xuICAgICAgICBvZmZzZXRYICo9IChjb29yZHNbMF0gPCAwKSA/IC0xIDogMTtcbiAgICAgICAgb2Zmc2V0WSAqPSAoY29vcmRzWzBdIDwgMCkgPyAtMSA6IDE7XG4gICAgICAgIHJldHVybiBbb2Zmc2V0WCwgb2Zmc2V0WV07XG4gICAgfTtcbiAgICBQb2x5Z29uLnByb3RvdHlwZS5kcmF3UG9seWdvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgYnVja2V0ID0gTWF0aC5jZWlsKGF1ZGlvU291cmNlLnN0cmVhbURhdGEubGVuZ3RoL3RpbGVzLmxlbmd0aCp0aGlzLm51bSk7XG4gICAgICAgIHZhciB2YWwgPSBNYXRoLnBvdygoYXVkaW9Tb3VyY2Uuc3RyZWFtRGF0YVtidWNrZXRdLzI1NSksMikqMjU1O1xuICAgICAgICB2YWwgKj0gdGhpcy5udW0gPiA0MiA/IDEuMSA6IDE7XG4gICAgICAgIC8vIGVzdGFibGlzaCB0aGUgdmFsdWUgZm9yIHRoaXMgdGlsZVxuICAgICAgICBpZiAodmFsID4gdGhpcy5oaWdoKSB7XG4gICAgICAgICAgICB0aGlzLmhpZ2ggPSB2YWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmhpZ2ggLT0gdGhpcy5kZWNheTtcbiAgICAgICAgICAgIHZhbCA9IHRoaXMuaGlnaDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hhdCBjb2xvdXIgdG8gZmlsbCBpdCBhbmQgdGhlbiBkcmF3IHRoZSBwb2x5Z29uXG4gICAgICAgIHZhciByLCBnLCBiLCBhO1xuICAgICAgICBpZiAodmFsID4gMCkge1xuICAgICAgICAgICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgICAgICAgICB2YXIgb2Zmc2V0ID0gdGhpcy5jYWxjdWxhdGVPZmZzZXQodGhpcy52ZXJ0aWNlc1swXSk7XG4gICAgICAgICAgICB0aGlzLmN0eC5tb3ZlVG8odGhpcy52ZXJ0aWNlc1swXVswXSArIG9mZnNldFswXSwgdGhpcy52ZXJ0aWNlc1swXVsxXSArIG9mZnNldFsxXSk7XG4gICAgICAgICAgICAvLyBkcmF3IHRoZSBwb2x5Z29uXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8PSB0aGlzLnNpZGVzLTE7aSArPSAxKSB7XG4gICAgICAgICAgICAgICAgb2Zmc2V0ID0gdGhpcy5jYWxjdWxhdGVPZmZzZXQodGhpcy52ZXJ0aWNlc1tpXSk7XG4gICAgICAgICAgICAgICAgdGhpcy5jdHgubGluZVRvICh0aGlzLnZlcnRpY2VzW2ldWzBdICsgb2Zmc2V0WzBdLCB0aGlzLnZlcnRpY2VzW2ldWzFdICsgb2Zmc2V0WzFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3R4LmNsb3NlUGF0aCgpO1xuXG4gICAgICAgICAgICBpZiAodmFsID4gMTI4KSB7XG4gICAgICAgICAgICAgICAgciA9ICh2YWwtMTI4KSoyO1xuICAgICAgICAgICAgICAgIGcgPSAoKE1hdGguY29zKCgyKnZhbC8xMjgqTWF0aC5QSS8yKS0gNCpNYXRoLlBJLzMpKzEpKjEyOCk7XG4gICAgICAgICAgICAgICAgYiA9ICh2YWwtMTA1KSozO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmFsID4gMTc1KSB7XG4gICAgICAgICAgICAgICAgciA9ICh2YWwtMTI4KSoyO1xuICAgICAgICAgICAgICAgIGcgPSAyNTU7XG4gICAgICAgICAgICAgICAgYiA9ICh2YWwtMTA1KSozO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgciA9ICgoTWF0aC5jb3MoKDIqdmFsLzEyOCpNYXRoLlBJLzIpKSsxKSoxMjgpO1xuICAgICAgICAgICAgICAgIGcgPSAoKE1hdGguY29zKCgyKnZhbC8xMjgqTWF0aC5QSS8yKS0gNCpNYXRoLlBJLzMpKzEpKjEyOCk7XG4gICAgICAgICAgICAgICAgYiA9ICgoTWF0aC5jb3MoKDIuNCp2YWwvMTI4Kk1hdGguUEkvMiktIDIqTWF0aC5QSS8zKSsxKSoxMjgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHZhbCA+IDIxMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY3ViZWQgPSB2YWw7IC8vIGFkZCB0aGUgY3ViZSBlZmZlY3QgaWYgaXQncyByZWFsbHkgbG91ZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHZhbCA+IDEyMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuaGlnaGxpZ2h0ID0gMTAwOyAvLyBhZGQgdGhlIGhpZ2hsaWdodCBlZmZlY3QgaWYgaXQncyBwcmV0dHkgbG91ZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IHRoZSBhbHBoYVxuICAgICAgICAgICAgdmFyIGUgPSAyLjcxODI7XG4gICAgICAgICAgICBhID0gKDAuNS8oMSArIDQwICogTWF0aC5wb3coZSwgLXZhbC84KSkpICsgKDAuNS8oMSArIDQwICogTWF0aC5wb3coZSwgLXZhbC8yMCkpKTtcblxuICAgICAgICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gXCJyZ2JhKFwiICtcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHIpICsgXCIsIFwiICtcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKGcpICsgXCIsIFwiICtcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKGIpICsgXCIsIFwiICtcbiAgICAgICAgICAgICAgICBhICsgXCIpXCI7XG4gICAgICAgICAgICB0aGlzLmN0eC5maWxsKCk7XG4gICAgICAgICAgICAvLyBzdHJva2VcbiAgICAgICAgICAgIGlmICh2YWwgPiAyMCkge1xuICAgICAgICAgICAgICAgIHZhciBzdHJva2VWYWwgPSAyMDtcbiAgICAgICAgICAgICAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9ICBcInJnYmEoXCIgKyBzdHJva2VWYWwgKyBcIiwgXCIgKyBzdHJva2VWYWwgKyBcIiwgXCIgKyBzdHJva2VWYWwgKyBcIiwgMC41KVwiO1xuICAgICAgICAgICAgICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgICAgICAgICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGlzcGxheSB0aGUgdGlsZSBudW1iZXIgZm9yIGRlYnVnIHB1cnBvc2VzXG4gICAgICAgIC8qdGhpcy5jdHguZm9udCA9IFwiYm9sZCAxMnB4IHNhbnMtc2VyaWZcIjtcbiAgICAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICdncmV5JztcbiAgICAgICAgIHRoaXMuY3R4LmZpbGxUZXh0KHRoaXMubnVtLCB0aGlzLnZlcnRpY2VzWzBdWzBdLCB0aGlzLnZlcnRpY2VzWzBdWzFdKTsqL1xuICAgIH07XG4gICAgUG9seWdvbi5wcm90b3R5cGUuZHJhd0hpZ2hsaWdodCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgLy8gZHJhdyB0aGUgaGlnaGxpZ2h0XG4gICAgICAgIHZhciBvZmZzZXQgPSB0aGlzLmNhbGN1bGF0ZU9mZnNldCh0aGlzLnZlcnRpY2VzWzBdKTtcbiAgICAgICAgdGhpcy5jdHgubW92ZVRvKHRoaXMudmVydGljZXNbMF1bMF0gKyBvZmZzZXRbMF0sIHRoaXMudmVydGljZXNbMF1bMV0gKyBvZmZzZXRbMV0pO1xuICAgICAgICAvLyBkcmF3IHRoZSBwb2x5Z29uXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDw9IHRoaXMuc2lkZXMtMTtpICs9IDEpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IHRoaXMuY2FsY3VsYXRlT2Zmc2V0KHRoaXMudmVydGljZXNbaV0pO1xuICAgICAgICAgICAgdGhpcy5jdHgubGluZVRvICh0aGlzLnZlcnRpY2VzW2ldWzBdICsgb2Zmc2V0WzBdLCB0aGlzLnZlcnRpY2VzW2ldWzFdICsgb2Zmc2V0WzFdKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmN0eC5jbG9zZVBhdGgoKTtcbiAgICAgICAgdmFyIGEgPSB0aGlzLmhpZ2hsaWdodC8xMDA7XG4gICAgICAgIHRoaXMuY3R4LnN0cm9rZVN0eWxlID0gIFwicmdiYSgyNTUsIDI1NSwgMjU1LCBcIiArIGEgKyBcIilcIjtcbiAgICAgICAgdGhpcy5jdHgubGluZVdpZHRoID0gMTtcbiAgICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgICAgIHRoaXMuaGlnaGxpZ2h0IC09IDAuNTtcbiAgICB9O1xuXG4gICAgdmFyIG1ha2VQb2x5Z29uQXJyYXkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGlsZXMgPSBbXTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFycmFuZ2UgaW50byBhIGdyaWQgeCwgeSwgd2l0aCB0aGUgeSBheGlzIGF0IDYwIGRlZ3JlZXMgdG8gdGhlIHgsIHJhdGhlciB0aGFuXG4gICAgICAgICAqIHRoZSB1c3VhbCA5MC5cbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHZhciBpID0gMDsgLy8gdW5pcXVlIG51bWJlciBmb3IgZWFjaCB0aWxlXG4gICAgICAgIHRpbGVzLnB1c2gobmV3IFBvbHlnb24oNiwgMCwgMCwgdGlsZVNpemUsIGZnQ3R4LCBpKSk7IC8vIHRoZSBjZW50cmUgdGlsZVxuICAgICAgICBpKys7XG4gICAgICAgIGZvciAodmFyIGxheWVyID0gMTsgbGF5ZXIgPCA3OyBsYXllcisrKSB7XG4gICAgICAgICAgICB0aWxlcy5wdXNoKG5ldyBQb2x5Z29uKDYsIDAsIGxheWVyLCB0aWxlU2l6ZSwgZmdDdHgsIGkpKTsgaSsrO1xuICAgICAgICAgICAgdGlsZXMucHVzaChuZXcgUG9seWdvbig2LCAwLCAtbGF5ZXIsIHRpbGVTaXplLCBmZ0N0eCwgaSkpOyBpKys7XG4gICAgICAgICAgICBmb3IodmFyIHggPSAxOyB4IDwgbGF5ZXI7IHgrKykge1xuICAgICAgICAgICAgICAgIHRpbGVzLnB1c2gobmV3IFBvbHlnb24oNiwgeCwgLWxheWVyLCB0aWxlU2l6ZSwgZmdDdHgsIGkpKTsgaSsrO1xuICAgICAgICAgICAgICAgIHRpbGVzLnB1c2gobmV3IFBvbHlnb24oNiwgLXgsIGxheWVyLCB0aWxlU2l6ZSwgZmdDdHgsIGkpKTsgaSsrO1xuICAgICAgICAgICAgICAgIHRpbGVzLnB1c2gobmV3IFBvbHlnb24oNiwgeCwgbGF5ZXIteCwgdGlsZVNpemUsIGZnQ3R4LCBpKSk7IGkrKztcbiAgICAgICAgICAgICAgICB0aWxlcy5wdXNoKG5ldyBQb2x5Z29uKDYsIC14LCAtbGF5ZXIreCwgdGlsZVNpemUsIGZnQ3R4LCBpKSk7IGkrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvcih2YXIgeSA9IC1sYXllcjsgeSA8PSAwOyB5KyspIHtcbiAgICAgICAgICAgICAgICB0aWxlcy5wdXNoKG5ldyBQb2x5Z29uKDYsIGxheWVyLCB5LCB0aWxlU2l6ZSwgZmdDdHgsIGkpKTsgaSsrO1xuICAgICAgICAgICAgICAgIHRpbGVzLnB1c2gobmV3IFBvbHlnb24oNiwgLWxheWVyLCAteSwgdGlsZVNpemUsIGZnQ3R4LCBpKSk7IGkrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBTdGFyKHgsIHksIHN0YXJTaXplLCBjdHgpIHtcbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgdGhpcy5hbmdsZSA9IE1hdGguYXRhbihNYXRoLmFicyh5KS9NYXRoLmFicyh4KSk7XG4gICAgICAgIHRoaXMuc3RhclNpemUgPSBzdGFyU2l6ZTtcbiAgICAgICAgdGhpcy5jdHggPSBjdHg7XG4gICAgICAgIHRoaXMuaGlnaCA9IDA7XG4gICAgfVxuICAgIFN0YXIucHJvdG90eXBlLmRyYXdTdGFyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBkaXN0YW5jZUZyb21DZW50cmUgPSBNYXRoLnNxcnQoTWF0aC5wb3codGhpcy54LCAyKSArIE1hdGgucG93KHRoaXMueSwgMikpO1xuXG4gICAgICAgIC8vIHN0YXJzIGFzIGxpbmVzXG4gICAgICAgIHZhciBicmlnaHRuZXNzID0gMjAwICsgTWF0aC5taW4oTWF0aC5yb3VuZCh0aGlzLmhpZ2ggKiA1KSwgNTUpO1xuICAgICAgICB0aGlzLmN0eC5saW5lV2lkdGg9IDAuNSArIGRpc3RhbmNlRnJvbUNlbnRyZS8yMDAwICogTWF0aC5tYXgodGhpcy5zdGFyU2l6ZS8yLCAxKTtcbiAgICAgICAgdGhpcy5jdHguc3Ryb2tlU3R5bGU9J3JnYmEoJyArIGJyaWdodG5lc3MgKyAnLCAnICsgYnJpZ2h0bmVzcyArICcsICcgKyBicmlnaHRuZXNzICsgJywgMSknO1xuICAgICAgICB0aGlzLmN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgdGhpcy5jdHgubW92ZVRvKHRoaXMueCx0aGlzLnkpO1xuICAgICAgICB2YXIgbGVuZ3RoRmFjdG9yID0gMSArIE1hdGgubWluKE1hdGgucG93KGRpc3RhbmNlRnJvbUNlbnRyZSwyKS8zMDAwMCAqIE1hdGgucG93KGF1ZGlvU291cmNlLnZvbHVtZSwgMikvNjAwMDAwMCwgZGlzdGFuY2VGcm9tQ2VudHJlKTtcbiAgICAgICAgdmFyIHRvWCA9IE1hdGguY29zKHRoaXMuYW5nbGUpICogLWxlbmd0aEZhY3RvcjtcbiAgICAgICAgdmFyIHRvWSA9IE1hdGguc2luKHRoaXMuYW5nbGUpICogLWxlbmd0aEZhY3RvcjtcbiAgICAgICAgdG9YICo9IHRoaXMueCA+IDAgPyAxIDogLTE7XG4gICAgICAgIHRvWSAqPSB0aGlzLnkgPiAwID8gMSA6IC0xO1xuICAgICAgICB0aGlzLmN0eC5saW5lVG8odGhpcy54ICsgdG9YLCB0aGlzLnkgKyB0b1kpO1xuICAgICAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICAgICAgdGhpcy5jdHguY2xvc2VQYXRoKCk7XG5cbiAgICAgICAgLy8gc3RhcmZpZWxkIG1vdmVtZW50IGNvbWluZyB0b3dhcmRzIHRoZSBjYW1lcmFcbiAgICAgICAgdmFyIHNwZWVkID0gbGVuZ3RoRmFjdG9yLzIwICogdGhpcy5zdGFyU2l6ZTtcbiAgICAgICAgdGhpcy5oaWdoIC09IE1hdGgubWF4KHRoaXMuaGlnaCAtIDAuMDAwMSwgMCk7XG4gICAgICAgIGlmIChzcGVlZCA+IHRoaXMuaGlnaCkge1xuICAgICAgICAgICAgdGhpcy5oaWdoID0gc3BlZWQ7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGRYID0gTWF0aC5jb3ModGhpcy5hbmdsZSkgKiB0aGlzLmhpZ2g7XG4gICAgICAgIHZhciBkWSA9IE1hdGguc2luKHRoaXMuYW5nbGUpICogdGhpcy5oaWdoO1xuICAgICAgICB0aGlzLnggKz0gdGhpcy54ID4gMCA/IGRYIDogLWRYO1xuICAgICAgICB0aGlzLnkgKz0gdGhpcy55ID4gMCA/IGRZIDogLWRZO1xuXG4gICAgICAgIHZhciBsaW1pdFkgPSBmZ0NhbnZhcy5oZWlnaHQvMiArIDUwMDtcbiAgICAgICAgdmFyIGxpbWl0WCA9IGZnQ2FudmFzLndpZHRoLzIgKyA1MDA7XG4gICAgICAgIGlmICgodGhpcy55ID4gbGltaXRZIHx8IHRoaXMueSA8IC1saW1pdFkpIHx8ICh0aGlzLnggPiBsaW1pdFggfHwgdGhpcy54IDwgLWxpbWl0WCkpIHtcbiAgICAgICAgICAgIC8vIGl0IGhhcyBnb25lIG9mZiB0aGUgZWRnZSBzbyByZXNwYXduIGl0IHNvbWV3aGVyZSBuZWFyIHRoZSBtaWRkbGUuXG4gICAgICAgICAgICB0aGlzLnggPSAoTWF0aC5yYW5kb20oKSAtIDAuNSkgKiBmZ0NhbnZhcy53aWR0aC8zO1xuICAgICAgICAgICAgdGhpcy55ID0gKE1hdGgucmFuZG9tKCkgLSAwLjUpICogZmdDYW52YXMuaGVpZ2h0LzM7XG4gICAgICAgICAgICB0aGlzLmFuZ2xlID0gTWF0aC5hdGFuKE1hdGguYWJzKHRoaXMueSkvTWF0aC5hYnModGhpcy54KSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdmFyIG1ha2VTdGFyQXJyYXkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHgsIHksIHN0YXJTaXplO1xuICAgICAgICBzdGFycyA9IFtdO1xuICAgICAgICB2YXIgbGltaXQgPSBmZ0NhbnZhcy53aWR0aCAvIDE1OyAvLyBob3cgbWFueSBzdGFycz9cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW1pdDsgaSArKykge1xuICAgICAgICAgICAgeCA9IChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIGZnQ2FudmFzLndpZHRoO1xuICAgICAgICAgICAgeSA9IChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIGZnQ2FudmFzLmhlaWdodDtcbiAgICAgICAgICAgIHN0YXJTaXplID0gKE1hdGgucmFuZG9tKCkrMC4xKSozO1xuICAgICAgICAgICAgc3RhcnMucHVzaChuZXcgU3Rhcih4LCB5LCBzdGFyU2l6ZSwgc2ZDdHgpKTtcbiAgICAgICAgfVxuICAgIH07XG5cblxuICAgIHZhciBkcmF3QmcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgYmdDdHguY2xlYXJSZWN0KDAsIDAsIGJnQ2FudmFzLndpZHRoLCBiZ0NhbnZhcy5oZWlnaHQpO1xuICAgICAgICB2YXIgciwgZywgYiwgYTtcbiAgICAgICAgdmFyIHZhbCA9IGF1ZGlvU291cmNlLnZvbHVtZS8xMDAwO1xuICAgICAgICByID0gMjAwICsgKE1hdGguc2luKHZhbCkgKyAxKSAqIDI4O1xuICAgICAgICBnID0gdmFsICogMjtcbiAgICAgICAgYiA9IHZhbCAqIDg7XG4gICAgICAgIGEgPSBNYXRoLnNpbih2YWwrMypNYXRoLlBJLzIpICsgMTtcbiAgICAgICAgYmdDdHguYmVnaW5QYXRoKCk7XG4gICAgICAgIGJnQ3R4LnJlY3QoMCwgMCwgYmdDYW52YXMud2lkdGgsIGJnQ2FudmFzLmhlaWdodCk7XG4gICAgICAgIC8vIGNyZWF0ZSByYWRpYWwgZ3JhZGllbnRcbiAgICAgICAgdmFyIGdyZCA9IGJnQ3R4LmNyZWF0ZVJhZGlhbEdyYWRpZW50KGJnQ2FudmFzLndpZHRoLzIsIGJnQ2FudmFzLmhlaWdodC8yLCB2YWwsIGJnQ2FudmFzLndpZHRoLzIsIGJnQ2FudmFzLmhlaWdodC8yLCBiZ0NhbnZhcy53aWR0aC1NYXRoLm1pbihNYXRoLnBvdyh2YWwsIDIuNyksIGJnQ2FudmFzLndpZHRoIC0gMjApKTtcbiAgICAgICAgZ3JkLmFkZENvbG9yU3RvcCgwLCAncmdiYSgwLDAsMCwwKScpOy8vIGNlbnRyZSBpcyB0cmFuc3BhcmVudCBibGFja1xuICAgICAgICBncmQuYWRkQ29sb3JTdG9wKDAuOCwgXCJyZ2JhKFwiICtcbiAgICAgICAgICAgIE1hdGgucm91bmQocikgKyBcIiwgXCIgK1xuICAgICAgICAgICAgTWF0aC5yb3VuZChnKSArIFwiLCBcIiArXG4gICAgICAgICAgICBNYXRoLnJvdW5kKGIpICsgXCIsIDAuNClcIik7IC8vIGVkZ2VzIGFyZSByZWRkaXNoXG5cbiAgICAgICAgYmdDdHguZmlsbFN0eWxlID0gZ3JkO1xuICAgICAgICBiZ0N0eC5maWxsKCk7XG4gICAgICAgIC8qXG4gICAgICAgICAvLyBkZWJ1ZyBkYXRhXG4gICAgICAgICBiZ0N0eC5mb250ID0gXCJib2xkIDMwcHggc2Fucy1zZXJpZlwiO1xuICAgICAgICAgYmdDdHguZmlsbFN0eWxlID0gJ2dyZXknO1xuICAgICAgICAgYmdDdHguZmlsbFRleHQoXCJ2YWw6IFwiICsgdmFsLCAzMCwgMzApO1xuICAgICAgICAgYmdDdHguZmlsbFRleHQoXCJyOiBcIiArIHIgLCAzMCwgNjApO1xuICAgICAgICAgYmdDdHguZmlsbFRleHQoXCJnOiBcIiArIGcgLCAzMCwgOTApO1xuICAgICAgICAgYmdDdHguZmlsbFRleHQoXCJiOiBcIiArIGIgLCAzMCwgMTIwKTtcbiAgICAgICAgIGJnQ3R4LmZpbGxUZXh0KFwiYTogXCIgKyBhICwgMzAsIDE1MCk7Ki9cbiAgICB9O1xuXG4gICAgdGhpcy5yZXNpemVDYW52YXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKGZnQ2FudmFzKSB7XG4gICAgICAgICAgICAvLyByZXNpemUgdGhlIGZvcmVncm91bmQgY2FudmFzXG4gICAgICAgICAgICBmZ0NhbnZhcy53aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xuICAgICAgICAgICAgZmdDYW52YXMuaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xuICAgICAgICAgICAgZmdDdHgudHJhbnNsYXRlKGZnQ2FudmFzLndpZHRoLzIsZmdDYW52YXMuaGVpZ2h0LzIpO1xuXG4gICAgICAgICAgICAvLyByZXNpemUgdGhlIGJnIGNhbnZhc1xuICAgICAgICAgICAgYmdDYW52YXMud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICAgICAgICAgIGJnQ2FudmFzLmhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgICAgICAgICAgIC8vIHJlc2l6ZSB0aGUgc3RhcmZpZWxkIGNhbnZhc1xuICAgICAgICAgICAgc2ZDYW52YXMud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICAgICAgICAgIHNmQ2FudmFzLmhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgICAgICAgICAgIHNmQ3R4LnRyYW5zbGF0ZShmZ0NhbnZhcy53aWR0aC8yLGZnQ2FudmFzLmhlaWdodC8yKTtcblxuICAgICAgICAgICAgdGlsZVNpemUgPSBmZ0NhbnZhcy53aWR0aCA+IGZnQ2FudmFzLmhlaWdodCA/IGZnQ2FudmFzLndpZHRoIC8gMjUgOiBmZ0NhbnZhcy5oZWlnaHQgLyAyNTtcblxuICAgICAgICAgICAgZHJhd0JnKCk7XG4gICAgICAgICAgICBtYWtlUG9seWdvbkFycmF5KCk7XG4gICAgICAgICAgICBtYWtlU3RhckFycmF5KCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdmFyIHJvdGF0ZUZvcmVncm91bmQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGlsZXMuZm9yRWFjaChmdW5jdGlvbih0aWxlKSB7XG4gICAgICAgICAgICB0aWxlLnJvdGF0ZVZlcnRpY2VzKCk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICB2YXIgZHJhdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBmZ0N0eC5jbGVhclJlY3QoLWZnQ2FudmFzLndpZHRoLCAtZmdDYW52YXMuaGVpZ2h0LCBmZ0NhbnZhcy53aWR0aCoyLCBmZ0NhbnZhcy5oZWlnaHQgKjIpO1xuICAgICAgICBzZkN0eC5jbGVhclJlY3QoLWZnQ2FudmFzLndpZHRoLzIsIC1mZ0NhbnZhcy5oZWlnaHQvMiwgZmdDYW52YXMud2lkdGgsIGZnQ2FudmFzLmhlaWdodCk7XG5cbiAgICAgICAgc3RhcnMuZm9yRWFjaChmdW5jdGlvbihzdGFyKSB7XG4gICAgICAgICAgICBzdGFyLmRyYXdTdGFyKCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aWxlcy5mb3JFYWNoKGZ1bmN0aW9uKHRpbGUpIHtcbiAgICAgICAgICAgIHRpbGUuZHJhd1BvbHlnb24oKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRpbGVzLmZvckVhY2goZnVuY3Rpb24odGlsZSkge1xuICAgICAgICAgICAgaWYgKHRpbGUuaGlnaGxpZ2h0ID4gMCkge1xuICAgICAgICAgICAgICAgIHRpbGUuZHJhd0hpZ2hsaWdodCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBkZWJ1Z1xuICAgICAgICAvKiBmZ0N0eC5mb250ID0gXCJib2xkIDI0cHggc2Fucy1zZXJpZlwiO1xuICAgICAgICAgZmdDdHguZmlsbFN0eWxlID0gJ2dyZXknO1xuICAgICAgICAgZmdDdHguZmlsbFRleHQoXCJtaW5NZW50YWw6XCIgKyBtaW5NZW50YWwsIDEwLCAxMCk7XG4gICAgICAgICBmZ0N0eC5maWxsVGV4dChcIm1heE1lbnRhbDpcIiArIG1heE1lbnRhbCwgMTAsIDQwKTsqL1xuICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZHJhdyk7XG4gICAgfTtcblxuICAgIHRoaXMuaW5pdCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgYXVkaW9Tb3VyY2UgPSBvcHRpb25zLmF1ZGlvU291cmNlO1xuICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQob3B0aW9ucy5jb250YWluZXJJZCk7XG5cbiAgICAgICAgLy8gZm9yZWdyb3VuZCBoZXhhZ29ucyBsYXllclxuICAgICAgICBmZ0NhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICBmZ0NhbnZhcy5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywgJ3Bvc2l0aW9uOiBhYnNvbHV0ZTsgei1pbmRleDogMTAnKTtcbiAgICAgICAgZmdDdHggPSBmZ0NhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChmZ0NhbnZhcyk7XG5cbiAgICAgICAgLy8gbWlkZGxlIHN0YXJmaWVsZCBsYXllclxuICAgICAgICBzZkNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICBzZkN0eCA9IHNmQ2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcbiAgICAgICAgc2ZDYW52YXMuc2V0QXR0cmlidXRlKCdzdHlsZScsICdwb3NpdGlvbjogYWJzb2x1dGU7IHotaW5kZXg6IDUnKTtcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKHNmQ2FudmFzKTtcblxuICAgICAgICAvLyBiYWNrZ3JvdW5kIGltYWdlIGxheWVyXG4gICAgICAgIGJnQ2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgICAgIGJnQ3R4ID0gYmdDYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xuICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoYmdDYW52YXMpO1xuXG4gICAgICAgIG1ha2VQb2x5Z29uQXJyYXkoKTtcbiAgICAgICAgbWFrZVN0YXJBcnJheSgpO1xuXG4gICAgICAgIHRoaXMucmVzaXplQ2FudmFzKCk7XG4gICAgICAgIGRyYXcoKTtcblxuXG4gICAgICAgIHNldEludGVydmFsKGRyYXdCZywgMTAwKTtcbiAgICAgICAgc2V0SW50ZXJ2YWwocm90YXRlRm9yZWdyb3VuZCwgMjApO1xuICAgICAgICAvLyByZXNpemUgdGhlIGNhbnZhcyB0byBmaWxsIGJyb3dzZXIgd2luZG93IGR5bmFtaWNhbGx5XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCB0aGlzLnJlc2l6ZUNhbnZhcywgZmFsc2UpO1xuICAgIH07XG59O1xubW9kdWxlLmV4cG9ydHMgPSBWaXN1YWxpemVyOyJdfQ==
