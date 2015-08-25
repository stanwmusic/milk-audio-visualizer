var UiUpdater = require("./uiupdater");
var SoundCloudAudioSource = require("./audiosource").SoundCloudAudioSource;
var SoundcloudLoader = require("./soundcloudloader");
var Visualizer = require("./visualizer");
var Milkshake = require("./milkshake");


window.onload = function init() {

    var player = document.getElementById('player');
    var uiUpdater = new UiUpdater();
    var loader = new SoundcloudLoader(player, uiUpdater);

    var audioSource = new SoundCloudAudioSource(loader, player);
    var form = document.getElementById('form');
    var loadAndUpdate = function (trackUrl) {
        loader.loadStream(trackUrl,
            function () {
                uiUpdater.clearInfoPanel();
                audioSource.playStream(loader.streamUrl());
                uiUpdater.update(loader);
                setTimeout(uiUpdater.toggleControlPanel, 3000); // auto-hide the control panel
            },
            function () {
                uiUpdater.displayMessage("Error", loader.errorMessage);
            });
    };

    visualizer = new Milkshake({
        containerId: 'visualizer',
        prevPresetId: 'prevPreset',
        nextPresetId: 'nextPreset',
        randPresetId: 'randPreset',
        audioSource: audioSource
    });


    uiUpdater.toggleControlPanel();
    // on load, check to see if there is a track token in the URL, and if so, load that automatically
    if (window.location.hash) {
        var trackUrl = 'https://soundcloud.com/' + window.location.hash.substr(1);
        loadAndUpdate(trackUrl);
    }

    // handle the form submit event to load the new URL
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var trackUrl = document.getElementById('input').value;
        loadAndUpdate(trackUrl);
    });
    var toggleButton = document.getElementById('toggleButton');
    toggleButton.addEventListener('click', function (e) {
        e.preventDefault();
        uiUpdater.toggleControlPanel();
    });
    var aboutButton = document.getElementById('credit');
    aboutButton.addEventListener('click', function (e) {
        e.preventDefault();
        var message = document.getElementById('info').innerHTML;
        uiUpdater.displayMessage("About", message);
    });

    window.addEventListener("keydown", keyControls, false);

    function keyControls(e) {
        switch (e.keyCode) {
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