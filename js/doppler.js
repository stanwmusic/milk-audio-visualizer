window.doppler = (function () {
    var AuContext = (window.AudioContext ||
        window.webkitAudioContext ||
        window.mozAudioContext ||
        window.oAudioContext ||
        window.msAudioContext);

    var ctx = new AuContext();
    var osc = ctx.createOscillator();
    // This is just preliminary, we'll actually do a quick scan
    // (as suggested in the paper) to optimize this.
    var freq = 20000;

    var getBandwidth = function (analyser, freqs) {
        var primaryTone = freqToIndex(analyser, freq);
        var primaryVolume = freqs[primaryTone];
        // These ratios are totally empirical (aka trial-and-error).
        var maxVolumeRatio = 0.1;
        var secondPeakRatio = 0.3;
        // See paper for this particular choice of frequencies
        var relevantFreqWindow = 33;
        var secondScanFlag = 0;

        // This function steps through frequencies until signal drops, then raises, then drops again
        function findBandwidth(step) {
            var bandwidth = 0;
            do {
                bandwidth += step;
                var volume = freqs[primaryTone + bandwidth];
                var normalizedVolume = volume / primaryVolume;
                if (normalizedVolume < maxVolumeRatio)
                    break;
            } while (Math.abs(bandwidth) < relevantFreqWindow);

            var secondScanBandwidth = bandwidth;

            do {
                secondScanBandwidth += step;
                var volume = freqs[primaryTone + secondScanBandwidth];
                var normalizedVolume = volume / primaryVolume;

                if (normalizedVolume >= secondPeakRatio)
                    secondScanFlag = 1;

                if (secondScanFlag == 1 && normalizedVolume < maxVolumeRatio)
                    break;
            } while (Math.abs(secondScanBandwidth) < relevantFreqWindow);

            if (secondScanFlag == 1)
                bandwidth = secondScanBandwidth;

            return bandwidth * step;
        }

        leftBandwidth = findBandwidth(-1);
        rightBandwidth = findBandwidth(1);

        return {
            left: leftBandwidth,
            right: rightBandwidth
        };
    };

    var freqToIndex = function (analyser, freq) {
        var nyquist = ctx.sampleRate / 2;
        return Math.round(freq / nyquist * analyser.frequencyBinCount);
    };

    var indexToFreq = function (analyser, index) {
        var nyquist = ctx.sampleRate / 2;
        return nyquist / (analyser.frequencyBinCount) * index;
    };

    var optimizeFrequency = function (osc, analyser, freqSweepStart, freqSweepEnd) {
        var oldFreq = osc.frequency.value;

        var audioData = new Uint8Array(analyser.frequencyBinCount);
        var maxAmp = 0;
        var maxAmpIndex = 0;

        var from = freqToIndex(analyser, freqSweepStart);
        var to = freqToIndex(analyser, freqSweepEnd);
        for (var i = from; i < to; i++) {
            osc.frequency.value = indexToFreq(analyser, i);
            analyser.getByteFrequencyData(audioData);

            if (audioData[i] > maxAmp) {
                maxAmp = audioData[i];
                maxAmpIndex = i;
            }
        }
        // Sometimes the above procedure seems to fail, not sure why.
        // If that happends, just use the old value.
        if (maxAmpIndex == 0) {
            var freq = oldFreq;
        } else {
            var freq = indexToFreq(analyser, maxAmpIndex);
        }
        console.log("optimized frequency: " + freq);
        return freq;
    };

    var readMicInterval = 0;
    var readMic = function (analyser) {
        var audioData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(audioData);

        var band = getBandwidth(analyser, audioData);
        return band;
    };

    var handleMic = function (stream, userCallback) {
        // Mic
        var mic = ctx.createMediaStreamSource(stream);
        var splitter = ctx.createChannelSplitter(2);
        var leftAnalyser = ctx.createAnalyser();
        var rightAnalyser = ctx.createAnalyser();

        leftAnalyser.smoothingTimeConstant = rightAnalyser.smoothingTimeConstant = 0.5;
        leftAnalyser.fftSize = rightAnalyser.fftSize = 2048;

        mic.connect(splitter);
        splitter.connect(leftAnalyser, 0);
        splitter.connect(rightAnalyser, 1);

        // Doppler tone
        osc.frequency.value = freq;
        osc.type = "sine";
        osc.start(0);
        osc.connect(ctx.destination);

        // There seems to be some initial "warm-up" period
        // where all frequencies are significantly louder.
        // A quick timeout will hopefully decrease that bias effect.
        setTimeout(function () {
            // Optimize doppler tone
            freq = optimizeFrequency(osc, leftAnalyser, rightAnalyser, 18000, 22000);
            osc.frequency.value = freq;

            clearInterval(readMicInterval);
            readMicInterval = setInterval(function () {
                var leftBand = readMic(leftAnalyser);
                var rightBand = readMic(rightAnalyser);
                userCallback(leftBand, rightBand);
            }, 0);
        }, 1000);
    };

    return {
        init: function (callback) {
            navigator.getUserMedia_ = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
            navigator.getUserMedia_({
                audio: {
                    optional: [{
                        echoCancellation: false
                    }]
                }
            }, function (stream) {
                handleMic(stream, callback);
            }, function () {
                console.log('Error!')
            });
        },
        stop: function () {
            clearInterval(readMicInterval);
        }
    }
})(window, document);