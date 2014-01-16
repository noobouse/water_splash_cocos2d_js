require("jsb.js");

var appFiles = [
    'resource.js',
    'myApp.js'
];

for(var i=0; i < appFiles.length; i++) {
    require(appFiles[i]);
}

var scene = new MyScene;
var runningScene = director.getRunningScene();
if (runningScene === null)
    director.runWithScene(scene);
else
    director.replaceScene(cc.TransitionFade.create(0.5, scene));
