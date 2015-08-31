define(function () {

    var GLU = Class({
        PROJECTION: 0,
        MODELVIEW: 1,
        TEXTURE: 2,

        VERTEX_ARRAY: 0,
        TEXTURE_COORD_ARRAY: 1,
        COLOR_ARRAY: 2,

        constructor: function (gl) {
            this.gl = gl;

            this.mvMatrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            this.prMatrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            this.mvpMatrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            this.txMatrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

            this.activeMatrix = this.prMatrix;
            this.mvStack = [];
            this.prStack = [];
            this.txStack = [];
            this.activeStack = this.prStack;
            this.enablestex = false;
            this.enablevco = false;
            this.upointsize = 1.0;
            this.ucolr = 1.0;
            this.ucolg = 1.0;
            this.ucolb = 1.0;
            this.ucola = 1.0;

            var vertexShader = this.loadShader(gl.VERTEX_SHADER,
                "precision mediump float; \
       attribute vec4 a_position; \
       attribute vec4 a_texCoord; \
       varying vec4 v_texCoord; \
       attribute vec4 a_color; \
       uniform vec4 u_color; \
       varying vec4 v_color; \
       uniform bool enable_v_color; \
       uniform float u_pointsize; \
       uniform mat4 mvp_matrix; \
       uniform mat4 tx_matrix; \
       void main() { \
         gl_Position = mvp_matrix * a_position; \
         v_texCoord = tx_matrix * a_texCoord; \
         if (enable_v_color) \
           v_color = a_color; \
         else \
           v_color = u_color; \
         gl_PointSize = u_pointsize; \
       }");

            var fragmentShader = this.loadShader(gl.FRAGMENT_SHADER,
                "precision mediump float; \
            varying vec4 v_texCoord; \
           uniform sampler2D s_texture; \
      varying vec4 v_color; \
      uniform bool enable_s_texture; \
      void main() { \
        if (enable_s_texture) \
          gl_FragColor = v_color * texture2D(s_texture, v_texCoord.st); \
        else \
          gl_FragColor = v_color; \
      }");

            var shaderProgram = gl.createProgram();
            gl.attachShader(shaderProgram, vertexShader);
            gl.attachShader(shaderProgram, fragmentShader);
            gl.linkProgram(shaderProgram);
            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
                throw Error("Unable to initialize the shader program.");
            gl.useProgram(shaderProgram);

            this.vertexPos = gl.getAttribLocation(shaderProgram, "a_position");
            this.colorPos = gl.getAttribLocation(shaderProgram, "a_color");
            this.texCoordPos = gl.getAttribLocation(shaderProgram, "a_texCoord");
            this.ucolorloc = gl.getUniformLocation(shaderProgram, "u_color");
            this.stextureloc = gl.getUniformLocation(shaderProgram, "s_texture");
            this.upointsizeloc = gl.getUniformLocation(shaderProgram, "u_pointsize");
            this.mvpmatrixloc = gl.getUniformLocation(shaderProgram, "mvp_matrix");
            this.txmatrixloc = gl.getUniformLocation(shaderProgram, "tx_matrix");
            this.enablestexloc = gl.getUniformLocation(shaderProgram, "enable_s_texture");
            this.enablevcoloc = gl.getUniformLocation(shaderProgram, "enable_v_color");
        },

        loadShader: function (type, source) {
            var shader;
            var gl = this.gl;
            shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
                throw Error("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
            return shader;
        },

        MatrixMode: function (mode) {
            if (mode == this.PROJECTION) {
                this.activeMatrix = this.prMatrix;
                this.activeStack = this.prStack;
            } else if (mode == this.MODELVIEW) {
                this.activeMatrix = this.mvMatrix;
                this.activeStack = this.mvStack;
            } else if (mode == this.TEXTURE) {
                this.activeMatrix = this.txMatrix;
                this.activeStack = this.txStack;
            }
        },

        LoadIdentity: function () {
            var m = this.activeMatrix;
            m[0] = 1;
            m[1] = 0;
            m[2] = 0;
            m[3] = 0;
            m[4] = 0;
            m[5] = 1;
            m[6] = 0;
            m[7] = 0;
            m[8] = 0;
            m[9] = 0;
            m[10] = 1;
            m[11] = 0;
            m[12] = 0;
            m[13] = 0;
            m[14] = 0;
            m[15] = 1;
        },

        multiply: function (result, srcA, srcB) {
            var tmp = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

            for (var i = 0; i < 4; i++) {
                var a = 4 * i;
                var b = a + 1;
                var c = a + 2;
                var d = a + 3;
                tmp[a] = srcA[a] * srcB[0] +
                    srcA[b] * srcB[4] +
                    srcA[c] * srcB[8] +
                    srcA[d] * srcB[12];
                tmp[b] = srcA[a] * srcB[1] +
                    srcA[b] * srcB[5] +
                    srcA[c] * srcB[9] +
                    srcA[d] * srcB[13];
                tmp[c] = srcA[a] * srcB[2] +
                    srcA[b] * srcB[6] +
                    srcA[c] * srcB[10] +
                    srcA[d] * srcB[14];
                tmp[d] = srcA[a] * srcB[3] +
                    srcA[b] * srcB[7] +
                    srcA[c] * srcB[11] +
                    srcA[d] * srcB[15];
            }
            for (var i = 0; i < 16; i++)
                result[i] = tmp[i];
        },

        MultMatrix: function (mat) {
            this.multiply(this.activeMatrix, mat, this.activeMatrix);
        },

        Translatef: function (x, y, z) {
            var m = this.activeMatrix;
            m[12] += m[0] * x + m[4] * y + m[8] * z;
            m[13] += m[1] * x + m[5] * y + m[9] * z;
            m[14] += m[2] * x + m[6] * y + m[10] * z;
            m[15] += m[3] * x + m[7] * y + m[11] * z;
        },

        Rotatef: function (angle, x, y, z) {
            angle = -angle;
            var c = Math.cos(angle * Math.PI / 180.0);
            var s = Math.sin(angle * Math.PI / 180.0);
            var omc = 1.0 - c;
            var mag = Math.sqrt(x * x + y * y + z * z);
            if (mag != 0.0 && mag != 1.0) {
                x = x / mag;
                y = y / mag;
                z = z / mag;
            }

            var xy = x * y;
            var yz = y * z;
            var zx = z * x;
            var ys = y * s;
            var xs = x * s;
            var zs = z * s;

            var rot = new Float32Array([omc * x * x + c, omc * xy - zs, omc * zx + ys, 0.0,
                omc * xy + zs, omc * y * y + c, omc * yz - xs, 0.0,
                omc * zx - ys, omc * yz + xs, omc * z * z + c, 0.0,
                0.0, 0.0, 0.0, 1.0
            ]);
            this.MultMatrix(rot);
        },

        Scalef: function (x, y, z) {
            var m = this.activeMatrix;
            m[0] *= x;
            m[1] *= x;
            m[2] *= x;
            m[3] *= x;

            m[4] *= y;
            m[5] *= y;
            m[6] *= y;
            m[7] *= y;

            m[8] *= z;
            m[9] *= z;
            m[10] *= z;
            m[11] *= z;
        },

        Orthof: function (left, right, bottom, top, near, far) {
            var dX = right - left;
            var dY = top - bottom;
            var dZ = far - near;
            var orth = new Float32Array([2 / dX, 0, 0, 0,
                0, 2 / dY, 0, 0,
                0, 0, -2 / dZ, 0, -(right + left) / dX, -(top + bottom) / dY, -(near + far) / dZ, 1.0
            ]);
            this.MultMatrix(orth);
        },

        PushMatrix: function () {
            var store = new Float32Array(16);
            for (var i = 0; i < 16; i++)
                store[i] = this.activeMatrix[i];
            this.activeStack.push(store);
        },

        PopMatrix: function () {
            var restore = this.activeStack.pop();
            for (var i = 0; i < 16; i++)
                this.activeMatrix[i] = restore[i];
        },

        Color4f: function (r, g, b, a) {
            this.ucolr = r;
            this.ucolg = g;
            this.ucolb = b;
            this.ucola = a;
        },

        PointSize: function (size) {
            this.upointsize = size;
        },

        VertexPointer: function (size, type, stride, buf) {
            var gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.vertexAttribPointer(this.vertexPos, size, type, false, size * 4, 0);
            gl.enableVertexAttribArray(this.vertexPos);
        },

        ColorPointer: function (size, type, stride, buf) {
            var gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.vertexAttribPointer(this.colorPos, size, type, false, size * 4, 0);
            gl.enableVertexAttribArray(this.colorPos);
        },

        TexCoordPointer: function (size, type, stride, buf) {
            var gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.vertexAttribPointer(this.texCoordPos, size, type, false, size * 4, 0);
            gl.enableVertexAttribArray(this.texCoordPos);
        },


        EnableClientState: function (state) {
            if (state == this.TEXTURE_COORD_ARRAY)
                this.enablestex = true;
            else if (state == this.COLOR_ARRAY)
                this.enablevco = true;
        },

        DisableClientState: function (state) {
            if (state == this.TEXTURE_COORD_ARRAY)
                this.enablestex = false;
            else if (state == this.COLOR_ARRAY)
                this.enablevco = false;
        },

        DrawArrays: function (mode, first, count) {
            var gl = this.gl;
            gl.uniform1i(this.enablestexloc, this.enablestex);
            gl.uniform1i(this.enablevcoloc, this.enablevco);
            gl.uniform1f(this.upointsizeloc, this.upointsize);
            gl.uniform4f(this.ucolorloc, this.ucolr, this.ucolg, this.ucolb, this.ucola);
            gl.activeTexture(gl.TEXTURE0);
            gl.uniform1i(this.stextureloc, 0);
            this.multiply(this.mvpMatrix, this.mvMatrix, this.prMatrix);
            gl.uniformMatrix4fv(this.mvpmatrixloc, false, this.mvpMatrix);
            gl.uniformMatrix4fv(this.txmatrixloc, false, this.txMatrix);
            if (!this.enablestex)
                gl.disableVertexAttribArray(this.texCoordPos);
            if (!this.enablevco)
                gl.disableVertexAttribArray(this.colorPos);
            gl.drawArrays(mode, first, count);
        }
    });

    return GLU;
});