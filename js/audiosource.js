var prefixMethod = require("./prefixmethod");

prefixMethod("getUserMedia", {
    parent: navigator
});
prefixMethod("AudioContext");


/**
 * The *AudioSource object creates an analyzer node, sets up a repeating function with setInterval
 * which samples the input and turns it into an FFT array. The object has two properties:
 * streamData - this is the Uint8Array containing the FFT data
 * volume - cumulative value of all the bins of the streaData.
 *
 * The MicrophoneAudioSource uses the getUserMedia interface to get real-time data from the user's microphone. Not used currently but included for possible future use.
 */


var MicrophoneAudioSource = function () {
    var self = this;
    this.volume = 0;
    this.streamData = new Uint8Array(128);
    var analyser;

    var sampleAudioStream = function () {
        analyser.getByteFrequencyData(self.streamData);
        // calculate an overall volume value
        var total = 0;
        for (var i in self.streamData) {
            total += self.streamData[i];
        }
        self.volume = total;
    };

    // get the input stream from the microphone
    navigator.getUserMedia({
        audio: true
    }, function (stream) {
        var audioCtx = new window.AudioContext();
        var mic = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        mic.connect(analyser);
        setInterval(sampleAudioStream, 20);
    }, function () {
        alert("error getting microphone input.");
    });
};

var SoundCloudAudioSource = function (loader, player) {
    var self = this;
    var audioCtx = new window.AudioContext();
    var leftAnalyser = audioCtx.createAnalyser();
    var rightAnalyser = audioCtx.createAnalyser();
    var splitter = audioCtx.createChannelSplitter(2);
    var merger = audioCtx.createChannelMerger(2);
    var source = audioCtx.createMediaElementSource(player);

    // Smallest fftSize possible to speed up calculations
    leftAnalyser.fftSize = 512;
    rightAnalyser.fftSize = 512;

    source.connect(splitter);
    splitter.connect(leftAnalyser, 0);
    splitter.connect(rightAnalyser, 1);
    leftAnalyser.connect(merger, 0, 0);
    rightAnalyser.connect(merger, 0, 1);
    merger.connect(audioCtx.destination);

    // FIXME: not used, remove
    var sampleAudioStream = function () {
        analyser.getByteFrequencyData(self.streamData);
        // calculate an overall volume value
        var total = 0;
        for (var i = 0; i < 80; i++) { // get the volume from the first 80 bins, else it gets too loud with treble
            total += self.streamData[i];
        }
        self.volume = total;
    };
    //setInterval(sampleAudioStream, 20);
    // public properties and methods
    //this.volume = 0;
    //this.streamData = new Uint8Array(128);
    this.playStream = function (streamUrl) {
        // get the input stream from the audio element
        player.addEventListener('ended', function () {
            loader.directStream('coasting');
        });
        player.setAttribute('src', streamUrl);
        player.play();
    };

    this.getPCM = function () {
        var leftDataArray = new Float32Array(leftAnalyser.fftSize);
        leftAnalyser.getFloatTimeDomainData(leftDataArray);
        var rightDataArray = new Float32Array(rightAnalyser.fftSize);
        rightAnalyser.getFloatTimeDomainData(rightDataArray);
        return [leftDataArray, rightDataArray];
    }
};
if (typeof module === "object") {
    module.exports = {
        SoundCloudAudioSource: SoundCloudAudioSource,
        MicrophoneAudioSource: MicrophoneAudioSource
    };
}