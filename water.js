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
        this._edgeVertexArray = new Float32Array(COLUMN_COUNT * 4);
        this._edgeColorArray = new Float32Array(COLUMN_COUNT * 8);

        this._columns = [];
        for (var i = 0; i < COLUMN_COUNT; ++i)
            this._columns.push(new WaterColumn);

        var lightBlue = cc.c4f(0, 50 / 255, 200 / 255, 1);
        var darkBlue = cc.c4f(0, 50 / 255, 100 / 255, 1);

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

        for (var i = 0; i < COLUMN_COUNT; ++i) {
            var j = 8 * i;
            this._edgeColorArray[j++] = lightBlue.r;
            this._edgeColorArray[j++] = lightBlue.g;
            this._edgeColorArray[j++] = lightBlue.b;
            this._edgeColorArray[j++] = 0;
            this._edgeColorArray[j++] = lightBlue.r;
            this._edgeColorArray[j++] = lightBlue.g;
            this._edgeColorArray[j++] = lightBlue.b;
            this._edgeColorArray[j++] = lightBlue.a;
        }

        this._scale = winSize.width / (COLUMN_COUNT - 1);

        this._shaderProgram = cc.ShaderCache.getInstance().getProgram("ShaderPositionColor");
        this._alphaTestShader = cc.ShaderCache.getInstance().getProgram("ShaderPositionTextureColorAlphaTest");
        this._glprogram = this._alphaTestShader.getProgram();
        this._alphaValueLocation = gl.getUniformLocation(this._glprogram, "CC_alpha_value"); //cc.UNIFORM_ALPHA_TEST_VALUE_S has wrong value "CC_AlphaValue" in cocos2dx-v2.2.1
        this._pointBuffer = gl.createBuffer();
        this._colorBuffer = gl.createBuffer();

        var target = cc.RenderTexture.create(winSize.width, winSize.height);
        target.setPosition(winSize.width / 2, winSize.height / 2);
        this.addChild(target, 1);
        this._target = target; // in js-binding, we can not overwrite draw() by default, so we use RenderTexture draw with opengl

        this._particles = [];

        this.scheduleUpdate();
    },
    onEnter: function() {
        this._super();
        var target = cc.RenderTexture.create(winSize.width, winSize.height);
        target.setPosition(winSize.width / 2, winSize.height / 2);
        this._particlesTarget = target;
        target.retain(); // since it is not added as child, so we need to call this for js-binding so that native object not autoreleased. call release when not used
        var sp = this._particleSprite = cc.Sprite.create(s_MetaParticalPNG);
        sp.setColor(cc.c3b(0, 50, 200));
        sp.retain();
    },
    onExit: function() {
        this._super();
        this._particlesTarget.release();
        this._particleSprite.release();
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
        var edges = this._edgeVertexArray;
        for (var i = 0; i < COLUMN_COUNT; i++) {
            var x = i * this._scale;
            var y = cs[i].Height;
            var j = 4 * i;
            edges[j] = x;
            verts[j++] = x;
            edges[j] = y+10;
            verts[j++] = y;
            edges[j] = x;
            verts[j++] = x;
            edges[j] = y;
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

        // set alpha test value
        // NOTE: alpha test shader is hard-coded to use the equivalent of a glAlphaFunc(GL_GREATER) comparison                                                                                      
        this._alphaTestShader.use();
        this._alphaTestShader.setUniformsForBuiltins();
        this._alphaTestShader.setUniformLocationF32(this._alphaValueLocation, sys.platform == "browser" ? 0.25 : 0.8);
        this._particlesTarget.getSprite().setShaderProgram(this._alphaTestShader);

        this._particlesTarget.visit();
        this._target.end();
        if (this._particles.length) this.particleTest = true;
    },
    draw_: function() {
        this._shaderProgram.use();
        this._shaderProgram.setUniformsForBuiltins();
        cc.glEnableVertexAttribs(cc.VERTEX_ATTRIB_FLAG_POSITION | cc.VERTEX_ATTRIB_FLAG_COLOR);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._pointBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this._vertexArray, gl.STATIC_DRAW);
        gl.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this._colorArray, gl.STATIC_DRAW);
        gl.vertexAttribPointer(cc.VERTEX_ATTRIB_COLOR, 4, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, COLUMN_COUNT * 2);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._pointBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this._edgeVertexArray, gl.STATIC_DRAW);
        gl.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this._edgeColorArray, gl.STATIC_DRAW);
        gl.vertexAttribPointer(cc.VERTEX_ATTRIB_COLOR, 4, gl.FLOAT, false, 0, 0);

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
            this._columns[index].Speed = speed / 4;
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
