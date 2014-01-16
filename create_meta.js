/*
 * sfiddle.net
 * http://jsfiddle.net/zhouhuab/p5kLQ/
 * <canvas id="canvas"></canvas>
 * body{background:#000;}
 */
canvas = document.getElementById("canvas"),
ctx = canvas.getContext("2d"),
width = 64,
height = width,
colors = {
    r: 255,
    g: 255,
    b: 255
}, cycle = 0,

canvas.width = width;
canvas.height = height;

var x = width / 2,
    y = height / 2,
    size = width / 2;

ctx.beginPath();
var grad = ctx.createRadialGradient(x, y, 1, x, y, size);
grad.addColorStop(0, 'rgba(' + colors.r + ',' + colors.g + ',' + colors.b + ',1)');
grad.addColorStop(1, 'rgba(' + colors.r + ',' + colors.g + ',' + colors.b + ',0)');
ctx.fillStyle = grad;
ctx.arc(x, y, size, 0, Math.PI * 2);
ctx.fill();
var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"); //Convert image to 'octet-stream' (Just a download, really)
window.location.href = image;
