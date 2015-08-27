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
var PerPixelMesh = require("./PerPixelMesh");

var Renderer = Class.extend({

    init: function (glu, width, height, gx, gy, texsize, music) {
        this.presetName = "None";
        this.vw = width;
        this.vh = height;
        this.texsize = texsize;
        this.mesh = new PerPixelMesh(gx, gy);
        this.totalframes = 1;
        this.noSwitch = false;
        this.realfps = 0;
        this.correction = true;
        this.aspect = height / width;
        this.renderTarget = new RenderTarget(glu, texsize, width, height);
        this.music = music;
        this.renderContext = {};
        this.glu = glu;

        var gl = glu.gl;

        this.p = new Float32Array(this.mesh.width * 2 * 2);
        this.pbuf = gl.createBuffer();

        this.t = new Float32Array(this.mesh.width * 2 * 2);
        this.tbuf = gl.createBuffer();

        this.cot = new Float32Array([0, 1, 0, 0, 1, 0, 1, 1])
        this.cotbuf = gl.createBuffer();

        this.cop = new Float32Array([-0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5])
        this.copbuf = gl.createBuffer();
    },

    ResetTextures: function () {
        delete this.renderTarget;
        this.reset(this.vw, this.vh);
    },

    SetupPass1: function () {
        var glu = this.glu;
        var gl = glu.gl;

        this.totalframes++;
        this.renderTarget.lock();
        gl.viewport(0, 0, this.renderTarget.texsize, this.renderTarget.texsize);

        glu.EnableClientState(glu.TEXTURE_COORD_ARRAY);

        glu.MatrixMode(glu.TEXTURE);
        glu.LoadIdentity();
        glu.MatrixMode(glu.PROJECTION);
        glu.LoadIdentity();
        glu.Orthof(0.0, 1, 0.0, 1, -40, 40);
        glu.MatrixMode(glu.MODELVIEW);
        glu.LoadIdentity();
    },

    RenderItems: function (pipeline, pipelineContext) {
        this.renderContext.time = pipelineContext.time;
        this.renderContext.texsize = this.texsize;
        this.renderContext.aspectCorrect = this.correction;
        this.renderContext.aspectRatio = this.aspect;
        this.renderContext.music = this.music;

        for (var pos = 0; pos < pipeline.drawables.length; pos++)
            if (pipeline.drawables[pos] != null)
                pipeline.drawables[pos].Draw(this.renderContext);
    },

    FinishPass1: function () {
        this.renderTarget.unlock();
    },

    Pass2: function (pipeline, pipelineContext) {
        var glu = this.glu;
        var gl = glu.gl;

        gl.viewport(0, 0, this.vw, this.vh);
        gl.bindTexture(gl.TEXTURE_2D, this.renderTarget.textureID[0]);
        glu.MatrixMode(glu.PROJECTION);
        glu.LoadIdentity();
        glu.Orthof(-0.5, 0.5, -0.5, 0.5, -40, 40);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.lineWidth(this.renderTarget.texsize < 512 ? 1 : this.renderTarget.texsize / 512.0);
        this.CompositeOutput(pipeline, pipelineContext);

        glu.MatrixMode(glu.MODELVIEW);
        glu.LoadIdentity();
        glu.Translatef(-0.5, -0.5, 0);
        glu.Translatef(0.5, 0.5, 0);
    },

    RenderFrame: function (pipeline, pipelineContext) {
        this.SetupPass1();
        this.Interpolation(pipeline);
        this.RenderItems(pipeline, pipelineContext);
        this.FinishPass1();
        this.Pass2(pipeline, pipelineContext);
    },

    Interpolation: function (pipeline) {
        var glu = this.glu;
        var gl = glu.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.renderTarget.textureID[1]);
        if (pipeline.textureWrap == 0) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        }

        glu.MatrixMode(glu.TEXTURE);
        glu.LoadIdentity();
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ZERO);

        glu.Color4f(1.0, 1.0, 1.0, pipeline.screenDecay);

        glu.EnableClientState(glu.VERTEX_ARRAY);
        glu.EnableClientState(glu.TEXTURE_COORD_ARRAY);
        glu.DisableClientState(glu.COLOR_ARRAY);

        glu.VertexPointer(2, gl.FLOAT, 0, this.pbuf);
        glu.TexCoordPointer(2, gl.FLOAT, 0, this.tbuf);

        function round(val, n) {
            return Math.round(val * Math.pow(10, n)) / Math.pow(10, n);
        }

        if (pipeline.staticPerPixel) {
            for (var j = 0; j < this.mesh.height - 1; j++) {
                for (var i = 0; i < this.mesh.width; i++) {
                    this.t[i * 4] = pipeline.x_mesh[i][j];
                    this.t[i * 4 + 1] = pipeline.y_mesh[i][j];
                    this.t[i * 4 + 2] = pipeline.x_mesh[i][j + 1];
                    this.t[i * 4 + 3] = pipeline.y_mesh[i][j + 1];

                    var index = j * this.mesh.width + i;
                    var index2 = (j + 1) * this.mesh.width + i;

                    this.p[i * 4] = this.mesh.identity[index].x;
                    this.p[i * 4 + 1] = this.mesh.identity[index].y;
                    this.p[i * 4 + 2] = this.mesh.identity[index2].x;
                    this.p[i * 4 + 3] = this.mesh.identity[index2].y;
                }
                gl.bindBuffer(gl.ARRAY_BUFFER, this.tbuf);
                gl.bufferData(gl.ARRAY_BUFFER, this.t, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf);
                gl.bufferData(gl.ARRAY_BUFFER, this.p, gl.STATIC_DRAW);
                glu.DrawArrays(gl.TRIANGLE_STRIP, 0, this.mesh.width * 2);
            }
        } else {
            print("not static per pixel");
        }

        glu.DisableClientState(glu.TEXTURE_COORD_ARRAY);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    },

    reset: function (w, h) {
        var glu = this.glu;
        var gl = glu.gl;

        this.aspect = h / w;
        this.vw = w;
        this.vh = h;
        gl.cullFace(gl.BACK);
        gl.clearColor(0, 0, 0, 0);
        gl.viewport(0, 0, w, h);
        glu.MatrixMode(glu.TEXTURE);
        glu.LoadIdentity();
        glu.MatrixMode(glu.PROJECTION);
        glu.LoadIdentity();
        glu.MatrixMode(glu.MODELVIEW);
        glu.LoadIdentity();
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    },

    CompositeOutput: function (pipeline, pipelineContext) {
        var glu = this.glu;
        var gl = glu.gl;

        glu.MatrixMode(glu.TEXTURE);
        glu.LoadIdentity();
        glu.MatrixMode(glu.MODELVIEW);
        glu.LoadIdentity();

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ZERO);
        glu.Color4f(1.0, 1.0, 1.0, 1.0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cotbuf);
        gl.bufferData(gl.ARRAY_BUFFER, this.cot, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.copbuf);
        gl.bufferData(gl.ARRAY_BUFFER, this.cop, gl.STATIC_DRAW);

        glu.EnableClientState(glu.VERTEX_ARRAY);
        glu.DisableClientState(glu.COLOR_ARRAY);
        glu.EnableClientState(glu.TEXTURE_COORD_ARRAY);

        glu.VertexPointer(2, gl.FLOAT, 0, this.copbuf);
        glu.TexCoordPointer(2, gl.FLOAT, 0, this.cotbuf);

        glu.DrawArrays(gl.TRIANGLE_FAN, 0, 4);
        glu.DisableClientState(glu.TEXTURE_COORD_ARRAY);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        for (var pos = 0; pos < pipeline.compositeDrawables; pos++)
            pipeline.compositeDrawables[pos].Draw(this.renderContext);
    },

    SetPipeline: function (pipeline) {
        this.currentPipe = pipeline;
    },

    PerPixel: function (p, context) {
        return p;
        //return Renderer.currentPipe.PerPixel(p,context);
    }
});

var RenderContext = Class.extend({
    init: function () {
        this.time = 0;
        this.texsize = 1024;
        this.aspectRatio = 1;
        this.aspectCorrect = false;
    }
});

var RenderTarget = Class.extend({
    init: function (glu, texsize, width, height) {
        var mindim = 0;
        var origtexsize = 0;

        this.texsize = texsize;
        this.glu = glu;

        var gl = glu.gl;
        var fb, depth_rb, rgba_tex, other_tex;
        fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

        depth_rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth_rb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.texsize, this.texsize);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth_rb);
        this.fbuffer = [fb];
        this.depthb = [depth_rb];

        other_tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, other_tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, this.texsize, this.texsize, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
        gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        rgba_tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, rgba_tex);
        gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, this.texsize, this.texsize, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rgba_tex, 0);
        this.textureID = [rgba_tex, other_tex];
        var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status != gl.FRAMEBUFFER_COMPLETE)
            print("ERR FRAMEBUFFER STATUS: " + status);
    },

    lock: function () {
        var gl = this.glu.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbuffer[0]);
    },

    unlock: function () {
        var gl = this.glu.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.textureID[1]);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, this.texsize, this.texsize);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },

    nearestPower2: function (value, scaleRule) {
        var x = value;
        var power = 0;
        while ((x & 0x01) != 1)
            x >>= 1;
        if (x == 1)
            return value;
        x = value;
        while (x != 0) {
            x >>= 1;
            power++;
        }
        if (scaleRule == this.SCALE_NEAREST) {
            if (((1 << power) - value) <= (value - (1 << (power - 1))))
                return 1 << power;
            else
                return 1 << (power - 1);
        }
        if (scaleRule == this.SCALE_MAGNIFY)
            return 1 << power;
        if (scaleRule == this.SCALE_MINIFY)
            return 1 << (power - 1);
        return 0;
    },

    SCALE_NEAREST: 0,
    SCALE_MAGNIFY: 1,
    SCALE_MINIFY: 2,
});

module.exports = Renderer;