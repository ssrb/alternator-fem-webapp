// Copyright (c) 2016, Sebastien Sydney Robert Bigot
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this
//    list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// The views and conclusions contained in the software and documentation are those
// of the authors and should not be interpreted as representing official policies,
// either expressed or implied, of the FreeBSD Project.

import Mesh = require('./mesh');
import MeshArtist = require('./mesh-artist');
import Progress = require('./progress');

var glmat = require('gl-matrix');

debugger;

window.onload = () => {

    var canvas = <HTMLCanvasElement>document.getElementById("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    var overlay = <HTMLCanvasElement>document.getElementById("overlay");
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;

    var gl = <WebGLRenderingContext>canvas.getContext("webgl", {});
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearDepth(1.0);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 1);

    var ctx2d = overlay.getContext("2d");
    var progress = new Progress(ctx2d);

    var statorreq = new XMLHttpRequest();
    statorreq.open('GET', 'msh/stator012.msh');
    statorreq.onload = function () {

        var rotorreq = new XMLHttpRequest();
        rotorreq.open('GET', 'msh/rotor012.msh');
        rotorreq.onload = function () {

            var stator = Mesh.load(statorreq);
            var rotor = Mesh.load(rotorreq);

            var sols: number[][][] = null;
            var magnitude = 0;

            var myWorker = new Worker("solver-webworker.js");
            myWorker.onmessage = function (e) {

                var msg = e.data;

                switch (msg.type) {
                    case 'progress':
                        progress.update(msg.progress);
                        break;
                    case 'result':
                        sols = msg.sols;
                        magnitude = msg.magnitude;
                        progress.update(1);
                        myWorker.terminate();
                        break;
                }
            }
            myWorker.postMessage([rotor, stator]);

            var sartist = new MeshArtist(gl, stator);
            var rartist = new MeshArtist(gl, rotor);

            var theta = 0;
            var lastTime = new Date().getTime();

            function animate() {

                var timeNow = new Date().getTime();

                var width = window.innerWidth - 50;
                var height = window.innerHeight - 10;

                gl.viewport(0, 0, width, height);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

                var mvMatrix = <Float32Array>glmat.mat4.create();
                glmat.mat4.translate(mvMatrix, mvMatrix, [0, 0, -0.5]);

                var prMatrix = <Float32Array>glmat.mat4.create();
                glmat.mat4.ortho(prMatrix, - 0.3 * width / height, 0.3 * width / height, -0.3, 0.3, -1, 1);

                // Rotate the rotor
                var dt = (timeNow - lastTime) / (60 * 1000);
                theta += 2 * Math.PI * 5 * dt
                while (theta >= Math.PI / 6) {
                    theta -= 2 * Math.PI / 6;
                }

                if (sols) {
                    // Rotor angle is a multiple of phi = Pi / (6 * 32) (32 intervals on a PI / 6 domain).
                    // We got 64 != rotor/stator angle [-32 * phi; 32 * phi[.
                    // Angle -32 * phi matches solution index 0, angles 0 matches solution index 32.
                    var idx = Math.floor(theta / (Math.PI / (6 * 32))) + 32;

                    var rsol = sols[idx][0], ssol = sols[idx][1];

                    sartist.drawSol(ssol, magnitude, prMatrix, mvMatrix);
                    sartist.draw(prMatrix, mvMatrix);

                    glmat.mat4.rotateZ(mvMatrix, mvMatrix, theta);

                    rartist.drawSol(rsol, magnitude, prMatrix, mvMatrix);
                    rartist.draw(prMatrix, mvMatrix);
                } else {
                    sartist.draw(prMatrix, mvMatrix);
                    glmat.mat4.rotateZ(mvMatrix, mvMatrix, theta);
                    rartist.draw(prMatrix, mvMatrix);
                }

                ctx2d.clearRect(0, 0, overlay.width, overlay.height);
                progress.animate(timeNow);

                gl.flush();

                lastTime = timeNow;

                requestAnimationFrame(animate);
            }

            animate();

        }

        rotorreq.send();
    }

    statorreq.send();
}