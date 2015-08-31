define(function (require) {
    var PipelineContext = require("PipelineContext");
    var TimeKeeper = require("TimeKeeper");
    var Music = require("Music");
    var Renderer = require("Renderer");
    var Presets = require("Presets");
    var MilkdropPreset = require("MilkDropPreset");
    var RenderItemMatcher = require("RenderItemMatcher");
    var RenderItemMergeFunction = require("RenderItemMergeFunction");

    var Shaker = Class({
        constructor: function (glu, presetChanged) {
            this.settings = {
                meshX: 32,
                meshY: 24,
                textureSize: 1024,
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                smoothPresetDuration: 5,
                presetDuration: 30,
                beatSensitivity: 10,
                aspectCorrection: true
            };
            this.pipelineContext = new PipelineContext();
            this.pipelineContext2 = new PipelineContext();
            this.timeKeeper = new TimeKeeper(this.settings.presetDuration);
            this.music = new Music();
            this.glu = glu;
            this.presetChanged = presetChanged || function () {};

            this.renderer = new Renderer(glu, this.settings.windowWidth, this.settings.windowHeight,
                this.settings.meshX, this.settings.meshY,
                this.settings.textureSize, this.music);

            this.presetNames = [];
            for (var presetName in Presets) {
                this.presetNames.push(presetName);
                Presets[presetName] = new MilkdropPreset(glu, presetName, Presets[presetName],
                    this.settings.meshX, this.settings.meshY);
            }

            this.presetPos = 0;
            this.switchPreset();

            this.matcher = new RenderItemMatcher();
            this.merger = new RenderItemMergeFunction.MasterRenderItemMerge();

            this.merger.add(new RenderItemMergeFunction.ShapeMerge());
            this.merger.add(new RenderItemMergeFunction.BorderMerge());
            //this.matcher.distanceFunction().addMetric(new ShapeXYDistance());

            this.reset();
            this.renderer.correction = this.settings.aspectCorrection;
            this.music.beat_sensitivity = this.settings.beatSensitivity;

            this.timeKeeper.StartPreset();
        },

        reset: function () {
            this.music.reset();
            this.renderer.reset(window.innerWidth, window.innerHeight);
        },

        renderFrame: function () {
            this.timeKeeper.UpdateTimers();
            this.pipelineContext.time = this.timeKeeper.GetRunningTime();
            this.pipelineContext.frame = this.timeKeeper.PresetFrameA();
            this.pipelineContext.progress = this.timeKeeper.PresetProgressA();
            this.music.detectFromSamples();

            /*if (this.renderer.noSwitch == false && !this.havePresets()) {
		if (this.timeKeeper.PresetProgressA() >= 1.0 && !this.timeKeeper.IsSmoothing())
		    this.selectNext(false);
		else if ((this.music.vol - this.music.vol_old > this.music.beat_sensitivity) &&
		          this.timeKeeper.CanHardCut())
		    this.selectNext(true);
	    }
	    if (this.timeKeeper.IsSmoothing() && this.timeKeeper.SmoothRatio() <= 1.0 && !this.havePresets()){
		this.activePreset.Render(this.music, this.pipelineContext);
		this.evaluateSecondPreset();
		var pipeline = new Pipeline();
		pipeline.setStaticPerPixel(this.settings.meshX, this.settings.meshY);
		PipelineMerger.mergePipelines(this.activePreset.pipeline(), this.activePreset2.pipeline(), pipeline,
					      this.matcher.matchResults(), this.merger, this.timeKeeper.SmoothRatio());
		this.renderer.RenderFrame(pipeline, this.pipelineContext);
		pipeline.drawables.clear();
	    } else {
		if (this.timeKeeper.IsSmoothing() && this.timeKeeper.SmoothRatio() > 1.0) {
		    this.activePreset = this.activePreset2;
		    this.timeKeeper.EndSmoothing();
		}
		this.activePreset.Render(this.music, this.pipelineContext);
		this.renderer.RenderFrame(this.activePreset.pipeline(), this.pipelineContext);
		}*/

            this.activePreset.Render(this.music, this.pipelineContext);
            this.renderer.RenderFrame(this.activePreset.pipeline(), this.pipelineContext);
        },

        evaluateSecondPreset: function () {
            this.pipelineContext2.time = this.timeKeeper.GetRunningTime();
            this.pipelineContext2.frame = this.timeKeeper.PresetFrameB();
            this.pipelineContext2.progress = this.timeKeeper.PresetProgressB();
            this.m_activePreset2.Render(this.music, this.pipelineContext2);
        },

        selectNext: function () {
            if (this.presetPos == this.presetNames.length - 1)
                this.presetPos = 0;
            else
                this.presetPos++;
            this.switchPreset();
            this.timeKeeper.StartPreset();
        },

        selectPrev: function () {
            if (this.presetPos == 0)
                this.presetPos = this.presetNames.length - 1;
            else
                this.presetPos--;
            this.switchPreset();
            this.timeKeeper.StartPreset();
        },

        switchPreset: function () {
            this.activePreset = Presets[this.presetNames[this.presetPos]];
            this.renderer.SetPipeline(this.activePreset.pipeline());
            this.presetChanged(this.presetNames[this.presetPos]);
        },

        havePresets: function () {
            return this.presetPos < this.presetNames.length - 1;
        }
    });

    return Shaker;
});