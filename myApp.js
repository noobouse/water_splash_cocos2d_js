var audioEngine;
var winSize;
var director;

var MyLayer = cc.LayerColor.extend({
    ctor: function() {
        this._super();
        this.init();
        //this.setColor(cc.c4(255, 255, 255, 255));
        //this.setPosition(0, 0);
        this.water = new WaterNode();
        this.addChild(this.water, 0);
        this.scheduleUpdate();
        this.enableEvents(true);
    },
    enableEvents: function(enabled) {
        if ('touches' in sys.capabilities) {
            this.setTouchEnabled(true);
            this.setTouchMode(cc.TOUCH_ONE_BY_ONE);
        } else if ('mouse' in sys.capabilities)
            this.setMouseEnabled(true);
    },
    onTouchBegan: function(touch, event) {
        return this.onMouseDown({
            _point: touch.getLocation()
        }); // return true is required, otherwise on TouchEnded will not be called.
    },
    onMouseDown: function(event) {
        var p = event._point;
        this.water.Splash(p.x, p.y);
        return true;
    },
});

// Main entry point - html5
var MyScene = cc.Scene.extend({
    ctor: function() {
        this._super();
        audioEngine = cc.AudioEngine.getInstance();
        director = cc.Director.getInstance();
        winSize = director.getWinSize();
        sys.dumpRoot();
        sys.garbageCollect();
    },

    onEnter: function() {
        var scene = cc.Scene.create();
        scene.addChild(new MyLayer());
        director.replaceScene(scene);
    }
});
