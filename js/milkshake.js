/**
 * milkshake -- WebGL Milkdrop-esque visualisation (port of projectM)
 * Copyright (C)2011 Matt Gattis and contributors
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 * See 'LICENSE.txt' included within this release
 *
 */
"use strict";

var Class = require("class.extend");
var Shaker = require("./Shaker");
var GLU = require("./glu");
var textures = require("./Renderable").textures;

var Milkshake = Class.extend({

    /* 
     * JavaScipt Class Includes 
     *
     * Resolved by the build process
     */


    /* 
     * Core Animation Interface 
     */

    load: function (url) {
        this.audio.loadSample(url);
    },

    init: function (options) {
        this.texture_list = ["./assets/title.png"];

        var audio = options.audioSource;
        var prevButton = document.getElementById(options.prevPresetId);
        var nextButton = document.getElementById(options.nextPresetId);
        var canvas = document.getElementById(options.containerId);
        var presetName = document.getElementById(options.presetNameId);

        // resize the canvas to fill browser window dynamically
        window.addEventListener('resize', resizeCanvas, false);

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();

        this.initGL(canvas, (function (glu) {
            var shaker = new Shaker(glu, function (name) {
                presetName.textContent = name;
            });
            prevButton.addEventListener("click", function () {
                shaker.selectPrev();
            }, false);
            nextButton.addEventListener("click", function () {
                shaker.selectNext(true);
            }, false);
            //this.shaker.selectNext(true);
            function animationLoop(when) {
                shaker.music.addPCM.apply(shaker.music, audio.getPCM());
                shaker.renderFrame();
                window.requestAnimationFrame(animationLoop);
            }
            window.requestAnimationFrame(animationLoop);
            /*setInterval(function() {
              shaker.selectNext(true);
            }, 100);
            /* setTimeout(function() {
              setInterval(function() {
                shaker.selectPrev();
              }, 10000);
            }, 5000); */
        }));
    },

    /* 
     * Global WebGL, Programmable Shader, and Linear Algebra Routines 
     */

    initGL: function (canvas, callback) {
        var gl = canvas.getContext("experimental-webgl", {
            alpha: false,
            depth: false,
            stencil: false,
            antialias: false,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
        });
        var glu = new GLU(gl);

        var texloads = 0;
        for (var i = 0; i < this.texture_list.length; i++) {
            var img = new Image();
            img.tex = gl.createTexture();
            img.onload = (function () {
                gl.bindTexture(gl.TEXTURE_2D, img.tex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.bindTexture(gl.TEXTURE_2D, null);
                textures[img.src.split("/").pop()] = img.tex;
                texloads += 1;
                if (texloads == this.texture_list.length)
                    callback(glu);
            }).bind(this);
            img.src = this.texture_list[i];
        }
    },

    checkError: function (source) {
        var error = this.gl.getError();
        if (error == this.gl.NO_ERROR)
            return;
        throw Error("OpenGL Error from " + source + ": " + error);
    }
});

module.exports = Milkshake;