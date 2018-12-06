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
class Progress {

	public constructor(ctx: CanvasRenderingContext2D) {
		this.ctx = ctx;
		this.visible = false;
		this.progress = 0;
		this.completeTick = -1;
	}

	public update(progress: number) {
		this.progress = progress;
	}

	public animate(tick: number) {

		if (!this.visible) {
			return;
		}

		this.ctx.save();

		var progressX = this.ctx.canvas.width / 2;
		var progressY = this.ctx.canvas.height / 2;
		var halfProgressWidth = this.ctx.canvas.width / 8;
		var halfProgressHeight = halfProgressWidth / 10;

		var textX = progressX;
		var textY = progressY - 3 * halfProgressHeight;
		var fontSize = 2 * halfProgressHeight + "px serif";

		this.ctx.font = fontSize;
		this.ctx.textAlign = "center";
		this.ctx.fillStyle = 'white';
		this.ctx.strokeStyle = 'black';
		var msg = "Computing  magnetic vector potential";
		this.ctx.fillText(msg, textX, textY);
		this.ctx.strokeText(msg, textX, textY);

		this.ctx.fillStyle = 'white';
		this.ctx.strokeStyle = 'white';

		this.ctx.beginPath();
		this.ctx.moveTo(progressX - halfProgressWidth, progressY - halfProgressHeight);
		this.ctx.lineTo(progressX - halfProgressWidth, progressY + halfProgressHeight);
		this.ctx.lineTo(progressX + halfProgressWidth, progressY + halfProgressHeight);
		this.ctx.lineTo(progressX + halfProgressWidth, progressY - halfProgressHeight);
		this.ctx.lineTo(progressX - halfProgressWidth, progressY - halfProgressHeight);
		this.ctx.closePath();

		this.ctx.stroke();

		var proccessedRatio = this.progress;

		this.ctx.beginPath();
		this.ctx.moveTo(progressX - halfProgressWidth, progressY - halfProgressHeight);
		this.ctx.lineTo(progressX - halfProgressWidth, progressY + halfProgressHeight);
		this.ctx.lineTo(progressX - halfProgressWidth * (1 - 2 * proccessedRatio), progressY + halfProgressHeight);
		this.ctx.lineTo(progressX - halfProgressWidth * (1 - 2 * proccessedRatio), progressY - halfProgressHeight);
		this.ctx.lineTo(progressX - halfProgressWidth, progressY - halfProgressHeight);
		this.ctx.closePath();

		this.ctx.fill();

		this.ctx.restore();
	}

	ctx: CanvasRenderingContext2D
	visible: boolean;
	completeTick: number;
	progress: number;
};
export = Progress;