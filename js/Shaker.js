"use strict";

var PipelineContext = require("./PipelineContext");
var TimeKeeper = require("./TimeKeeper");
var Music = require("./Music");
var Renderer = require("./Renderer");
var Presets = require("./Presets");
var MilkdropPreset = require("./MilkDropPreset");
var RenderItemMatcher = require("./RenderItemMatcher");
var RenderItemMergeFunction = require("./RenderItemMergeFunction");

var Shaker = Class.extend({
    init: function (glu) {
        this.settings = {
            meshX: 32,
            meshY: 24,
            fps: 60,
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
        if (this.settings.fps > 0)
            this.mspf = Math.floor(1000.0 / this.settings.fps);
        else this.mspf = 0;
        this.timed = 0;
        this.timestart = 0;
        this.count = 0;
        this.fpsstart = 0;

        this.renderer = new Renderer(glu, this.settings.windowWidth, this.settings.windowHeight,
            this.settings.meshX, this.settings.meshY,
            this.settings.textureSize, this.music);
        this.running = true;

        this.presetNames = [];
        for (var presetName in Presets) {
            this.presetNames.push(presetName);
            Presets[presetName] = new MilkdropPreset(glu, presetName, Presets[presetName],
                this.settings.meshX, this.settings.meshY);
        }

        this.presetPos = 0;
        this.activePreset = this.loadPreset();
        this.renderer.SetPipeline(this.activePreset.pipeline());

        this.matcher = new RenderItemMatcher();
        this.merger = new RenderItemMergeFunction.MasterRenderItemMerge();

        this.merger.add(new RenderItemMergeFunction.ShapeMerge());
        this.merger.add(new RenderItemMergeFunction.BorderMerge());
        //this.matcher.distanceFunction().addMetric(new ShapeXYDistance());

        this.reset();
        this.renderer.reset(this.settings.windowWidth, this.settings.windowHeight);

        this.renderer.correction = this.settings.aspectCorrection;
        this.music.beat_sensitivity = this.settings.beatSensitivity;

        this.infoMessages = {};
        this.infoBoxPos = -1;
        this.timeKeeper.StartPreset();
    },

    reset: function () {
        this.mspf = 0;
        this.timed = 0;
        this.timestart = 0;
        this.count = 0;
        this.fpsstart = 0;
        this.music.reset();
    },

    renderFrame: function () {
        this.timestart = this.timeKeeper.getTicks(this.timeKeeper.startTime);
        this.timeKeeper.UpdateTimers();
        this.mspf = Math.floor(1000.0 / this.settings.fps);
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

        this.count++;
        if (this.count % 100 == 0) {
            this.renderer.realfps = 100.0 / ((this.timeKeeper.getTicks(this.timeKeeper.startTime) - this.fpsstart) / 1000);
            this.infoMessages["fps"] = "rendering at " + Math.round(this.renderer.realfps * 100) / 100 + " frames per second";
            this.fpsstart = this.timeKeeper.getTicks(this.timeKeeper.startTime);
        }

        var timediff = this.timeKeeper.getTicks(this.timeKeeper.startTime) - this.timestart;
        if (timediff < this.mspf)
            return Math.floor(this.mspf - timediff);
        return 0;
    },

    evaluateSecondPreset: function () {
        this.pipelineContext2.time = this.timeKeeper.GetRunningTime();
        this.pipelineContext2.frame = this.timeKeeper.PresetFrameB();
        this.pipelineContext2.progress = this.timeKeeper.PresetProgressB();
        this.m_activePreset2.Render(this.music, this.pipelineContext2);
    },

    selectNext: function (hardCut) {
        if (this.presetPos >= this.presetNames.length - 1)
            return;
        if (!hardCut)
            this.timeKeeper.StartSmoothing();
        this.presetPos++;
        if (!hardCut) {
            this.activePreset2 = this.switchPreset();
        } else {
            this.activePreset = this.switchPreset();
            this.timeKeeper.StartPreset();
        }
        this.presetSwitchedEvent(hardCut, this.presetPos);
    },

    selectPrev: function () {
        if (this.presetPos == 0)
            return;
        this.presetPos--;
        this.activePreset = this.switchPreset();
        this.timeKeeper.StartPreset();
    },

    switchPreset: function () {
        var targetPreset = this.loadPreset();
        this.renderer.SetPipeline(targetPreset.pipeline());
        return targetPreset;
    },

    loadPreset: function () {
        var preset = Presets[this.presetNames[this.presetPos]];
        return preset;
    },

    havePresets: function () {
        return this.presetPos < this.presetNames.length - 1;
    },

    presetSwitchedEvent: function () {}
});

module.exports = Shaker;