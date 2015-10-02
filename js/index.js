requirejs.config({
    baseUrl: 'js',
    paths: {
        "domready": "//cdnjs.cloudflare.com/ajax/libs/require-domReady/2.0.1/domReady.min"
    }
});

requirejs(["domready!", "uiupdater", "audiosource", "soundcloudloader", "visualizer", "milkshake"],
    function (document, UiUpdater, AudioSource, SoundcloudLoader, Visualizer, Milkshake) {

        var player = document.getElementById('player');
        var uiUpdater = new UiUpdater();
        var loader = new SoundcloudLoader(player, uiUpdater);

        var audioSource = new AudioSource.SoundCloudAudioSource(loader, player);
        var form = document.getElementById('form');
        var loadAndUpdate = function (trackUrl) {
            loader.loadStream(trackUrl,
                function () {
                    uiUpdater.clearInfoPanel();
                    audioSource.playStream(loader.streamUrl());
                    uiUpdater.update(loader);
                    //setTimeout(uiUpdater.toggleControlPanel, 3000); // auto-hide the control panel
                },
                function () {
                    uiUpdater.displayMessage("Error", loader.errorMessage);
                });
        };

        var visualizer = new Milkshake({
            canvas: document.getElementById('visualizer'),
            presetNameId: 'presetName',
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
        var canvas = document.getElementById('visualizer');
        canvas.addEventListener('click', function (e) {
            e.preventDefault();
            uiUpdater.toggleControlPanel();
        });
        var aboutButton = document.getElementById('credit');
        aboutButton.addEventListener('click', function (e) {
            e.preventDefault();
            var message = document.getElementById('info').innerHTML;
            uiUpdater.displayMessage("About", message);
        });

        var prevPreset = document.getElementById('prevPreset');
        prevPreset.addEventListener("click", function () {
            visualizer.shaker.selectPrev();
        }, false);

        var nextPreset = document.getElementById('nextPreset');
        nextPreset.addEventListener("click", function () {
            visualizer.shaker.selectNext(true);
        }, false);

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
            case 78:
                // n key pressed
                visualizer.shaker.selectNext(true);
                break;
            case 80:
                // p key pressed
                visualizer.shaker.selectPrev();
                break;
            }
        }

    });