var audioEngine;
var winSize;
var director;

var COLUMN_COUNT = 80;
var WATER_HEIGHT = 200

var TENSION = 0.025;
var DAMPENING = 0.025;
var SPREAD = 0.25;

function Particle(pos, vel, scale, ori) {
    this.Position = pos;
    this.Velocity = vel;
    this.Scale = scale;
    this.Orientation = ori;
}

function WaterColumn() {
    this.TargetHeight = WATER_HEIGHT;
    this.Height = WATER_HEIGHT;
    this.Speed = 0;
}

WaterColumn.prototype.update = function(dampening, tension) {
    var x = this.TargetHeight - this.Height;
    this.Speed += tension * x - this.Speed * dampening;
    this.Height += this.Speed;
};

var WaterNode = cc.Node.extend({
    ctor: function() {
        this._super();
        this.init();
        this._leftDeltas = [];
        this._rightDeltas = [];
        this._vertexArray = new Float32Array(COLUMN_COUNT * 4);
        this._colorArray = new Float32Array(COLUMN_COUNT * 8);

        this._columns = [];
        for (var i = 0; i < COLUMN_COUNT; ++i)
            this._columns.push(new WaterColumn);

        var lightBlue = cc.c4FFromccc4B(cc.c4(0, 50, 200, 255));
        var darkBlue = cc.c4FFromccc4B(cc.c4(0, 50, 100, 255));

        for (var i = 0; i < COLUMN_COUNT; ++i) {
            var j = 8 * i;
            this._colorArray[j++] = lightBlue.r;
            this._colorArray[j++] = lightBlue.g;
            this._colorArray[j++] = lightBlue.b;
            this._colorArray[j++] = lightBlue.a;
            this._colorArray[j++] = darkBlue.r;
            this._colorArray[j++] = darkBlue.g;
            this._colorArray[j++] = darkBlue.b;
            this._colorArray[j++] = darkBlue.a;
        }

        this._scale = winSize.width / (COLUMN_COUNT - 1);

        this._shaderProgram = cc.ShaderCache.getInstance().programForKey(cc.SHADER_POSITION_COLOR);
        this._pointBuffer = gl.createBuffer();
        this._colorBuffer = gl.createBuffer();

        var target = cc.RenderTexture.create(winSize.width, winSize.height);
        target.setPosition(winSize.width / 2, winSize.height / 2);
        this.addChild(target, 1);
        this._target = target; // in js-binding, we can not overwrite draw() by default, so we use RenderTexture draw with opengl

        this._particles = [];
        target = cc.RenderTexture.create(winSize.width, winSize.height);
        target.setPosition(winSize.width / 2, winSize.height / 2);
        this._particlesTarget = target;
        var sp = this._particleSprite = cc.Sprite.create(s_MetaParticalPNG);
        sp.setColor(cc.c3b(0, 50, 200));

        this.scheduleUpdate();
    },
    update: function(dt) {
        //if(this.particleTest) return;
        var cs = this._columns;
        for (var i = 0; i < COLUMN_COUNT; i++)
            cs[i].update(DAMPENING, TENSION);

        var leftDeltas = this._leftDeltas;
        var rightDeltas = this._rightDeltas;

        for (var j = 0; j < 8; j++) {
            for (var i = 0; i < COLUMN_COUNT; i++) {
                if (i > 0) {
                    leftDeltas[i] = SPREAD * (cs[i].Height - cs[i - 1].Height);
                    cs[i - 1].Speed += leftDeltas[i];
                }
                if (i < COLUMN_COUNT - 1) {
                    rightDeltas[i] = SPREAD * (cs[i].Height - cs[i + 1].Height);
                    cs[i + 1].Speed += rightDeltas[i];
                }
            }

            for (var i = 0; i < COLUMN_COUNT; i++) {
                if (i > 0)
                    cs[i - 1].Height += leftDeltas[i];
                if (i < COLUMN_COUNT - 1)
                    cs[i + 1].Height += rightDeltas[i];
            }
        }

        var verts = this._vertexArray;
        for (var i = 0; i < COLUMN_COUNT; i++) {
            var x = i * this._scale;
            var y = cs[i].Height;
            var j = 4 * i;
            verts[j++] = x;
            verts[j++] = y;
            verts[j++] = x;
            verts[j++] = 0;
        }

        var particles = this._particles;
        for (var i = 0; i < particles.length; ++i) {
            this.UpdateParticle(particles[i]);
        }
        particles = [];
        for (var i = 0; i < this._particles.length; ++i) {
            var pt = this._particles[i];
            var p = pt.Position;
            if (!(p.x <= 0 || p.x >= winSize.width || p.y + 5 <= this.GetHeight(p.x) || p.y >= winSize.height)) particles.push(pt);
        }
        this._particles = particles;

        if (!this.isVisible()) return;

        var sprite = this._particleSprite;
        this._particlesTarget.clear(0, 0, 0, 0);
        this._particlesTarget.begin();
        for (var i = 0; i < this._particles.length; ++i) {
            var pt = this._particles[i];
            var p = pt.Position;
            sprite.setPosition(p);
            sprite.setScaleX(pt.Scale.x);
            sprite.setScaleY(pt.Scale.y);
            sprite.setRotation(pt.Orientation);
            sprite.visit();
        }
        this._particlesTarget.end();

        this._target.clear(0, 0, 0, 0);
        this._target.begin();
        this.draw_();

        var alphaTestShader = cc.ShaderCache.getInstance().programForKey(cc.SHADER_POSITION_TEXTURECOLORALPHATEST);
        var glprogram = alphaTestShader.getProgram();
        var alphaValueLocation = gl.getUniformLocation(glprogram, cc.UNIFORM_ALPHA_TEST_VALUE_S);
        // set alpha test value
        // NOTE: alpha test shader is hard-coded to use the equivalent of a glAlphaFunc(GL_GREATER) comparison                                                                                      
        gl.useProgram(glprogram);
        alphaTestShader.setUniformLocationF32(alphaValueLocation, 0.25);
        this._particlesTarget.getSprite().setShaderProgram(alphaTestShader);

        this._particlesTarget.visit();
        this._target.end();
        if (this._particles.length) this.particleTest = true;
    },
    draw_: function() {
        var gl = cc.renderContext;
        this._shaderProgram.use();
        this._shaderProgram.setUniformForModelViewProjectionMatrix();
        cc.glEnableVertexAttribs(cc.VERTEX_ATTRIB_FLAG_POSITION | cc.VERTEX_ATTRIB_FLAG_COLOR);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._pointBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this._vertexArray, gl.STATIC_DRAW);
        gl.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, gl.FLOAT, false, 0, 0);
        //gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_FLAG_POSITION);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this._colorArray, gl.STATIC_DRAW);
        gl.vertexAttribPointer(cc.VERTEX_ATTRIB_COLOR, 4, gl.FLOAT, false, 0, 0);
        //gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_FLAG_COLOR);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, COLUMN_COUNT * 2);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    },
    GetHeight: function(x) {
        var index = Math.floor(x / this._scale);
        if (index > 0 && index < COLUMN_COUNT)
            return this._columns[index].Height;
        return WATER_HEIGHT;
    },
    Splash: function(x, speed) {
        var index = Math.floor(x / this._scale);
        if (index > 0 && index < COLUMN_COUNT)
            this._columns[index].Speed = speed / 2;
        this.CreateSplashParticles(x, speed);
    },
    FromPolar: function(angle, magnitude) {
        return cc.p(magnitude * Math.cos(angle), magnitude * Math.sin(angle));
    },
    GetRandomFloat: function(min, max) {
        return Math.random() * (max - min) + min;
    },
    GetRandomVector2: function(maxLength) {
        return this.FromPolar(this.GetRandomFloat(-Math.PI, Math.PI), this.GetRandomFloat(0, maxLength));
    },
    CreateSplashParticles: function(x, speed) {
        var y = this.GetHeight(x);
        for (var i = 0; i < speed / 8; i++) {
            var randv = this.GetRandomVector2(100);
            var pos = cc.p(x + randv.x, y + randv.y);
            var vel = this.FromPolar(Math.PI / 180 * this.GetRandomFloat(-150, -30), -this.GetRandomFloat(0, 0.5 * Math.sqrt(speed)));
            this._particles.push(new Particle(pos, vel, cc.p(0.5 + Math.random() / 2, 0.5 + Math.random() / 2), 0));
            var pos = cc.p(pos.x + 16 * Math.random(), pos.y + 16 * Math.random());
            var vel = this.FromPolar(Math.PI / 180 * this.GetRandomFloat(-150, -30), -this.GetRandomFloat(0, 0.5 * Math.sqrt(speed)));
            this._particles.push(new Particle(pos, vel, cc.p(0.5 + Math.random() / 2, 0.5 + Math.random() / 2), 0));
        }
    },
    GetAngle: function(vector) {
        return Math.atan2(vector.y, vector.x) * 180 / Math.PI;
    },
    UpdateParticle: function(particle) {
        var Gravity = -0.3;
        particle.Velocity.y += Gravity;
        particle.Position.x += particle.Velocity.x;
        particle.Position.y += particle.Velocity.y;
        particle.Orientation = this.GetAngle(particle.Velocity);
    }
});

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
    onTouchEnded: function(touch, event) {
        return this.onMouseUp({
            _point: touch.getLocation()
        });
    },
    onTouchMoved: function(touch, event) {
        return this.onMouseDragged({
            _point: touch.getLocation()
        });
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
