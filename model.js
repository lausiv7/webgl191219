var gl;
var program;
var at;
var uni;
var projection;
var reflection;
var camera = {};
var model;
var pool;
var rotz;
var rotzinc;
var srotz;
var srotzinc;
var lightpointdir;
var renderid;

function initGL() {
	gl = makeGLContext("glcanvas");
	
	var vs = makeShader(gl.VERTEX_SHADER, getText("shader-vs"));
	var fs = makeShader(gl.FRAGMENT_SHADER, getText("shader-fs"));
	program = makeProgram(vs, fs);
	if (!program) {
		alert("Could not initialize shaders");
		throw "failed to load gl";
	}
	
	gl.useProgram(program);
	
	at = new Object();
	at.position = gl.getAttribLocation(program, "position");
	at.texcoord = gl.getAttribLocation(program, "texcoord");
	at.normal = gl.getAttribLocation(program, "normal");
	at.tangent = gl.getAttribLocation(program, "tangent");
	
	uni = new Object();
	uni.model = gl.getUniformLocation(program, "model");
	uni.modelit = gl.getUniformLocation(program, "modelit");
	uni.view = gl.getUniformLocation(program, "view");
	uni.projection = gl.getUniformLocation(program, "projection");
	
	uni.hasTexture = gl.getUniformLocation(program, "hasTexture");
	uni.tex = gl.getUniformLocation(program, "tex");
	uni.texnormal = gl.getUniformLocation(program, "texnormal");
	uni.texcube = gl.getUniformLocation(program, "texcube");
	uni.viewpos = gl.getUniformLocation(program, "viewpos");
	
	uni.alpha = gl.getUniformLocation(program, "alpha");
	uni.shadow = gl.getUniformLocation(program, "shadow");
	
	uni.bumpmap = gl.getUniformLocation(program, "bumpmap");
	uni.lighting = gl.getUniformLocation(program, "lighting");
	uni.shininess =	 gl.getUniformLocation(program, "shininess");
	uni.diffuse = gl.getUniformLocation(program, "diffuse");
	uni.specular = gl.getUniformLocation(program, "specular");
	uni.ambient = gl.getUniformLocation(program, "ambient");
	uni.light = gl.getUniformLocation(program, "light");
}

function loadScene(modelFile) {
	var oldModel = model;
	
	if (renderid) {
		clearInterval(renderid);
	}

	try {
		model = loadModelFile(dirname(modelFile), modelFile);
		pool = makePool(model);
			
		changeCubeMap(selectValue('cubemapList'));
		changeNormalMap(selectValue('normalmapList'));
	} catch (e) {
		alert("failed to load model: " + modelFile + ": " + e);
		model = oldModel;
		renderid = setInterval(render, 1000/30);
		return;
	}
	
	camera = makeCamera(model.center, model.diagonal);
	var aspect = gl.viewportWidth / gl.viewportHeight;
	projection = mat4.perspective(camera.FOV, aspect, camera.near, camera.far);
	reflection = [1,0,0,0,0,-1,0,0,0,0,1,0,0,2*model.ymin,0,1];

	rotz = 0;
	srotz = 50;

	renderid = setInterval(render, 1000/30);
}

function changeCubeMap(filename) {
	var texcube;
	
	try {
		texcube = loadCubemap(filename);
	} catch (e) {
		alert(e);
		return;
	}
	
	model.texcube = texcube;
	pool.texcube = texcube;
}

function changeNormalMap(filename) {
	var texnormal;
	
	try {
		texnormal = newTexture(filename);
	} catch (e) {
		alert(e);
		return;
	}
	model.texnormal = texnormal;
	pool.texnormal = texnormal;
}

function renderNode(model, meshindex) {
	var b = model.buffers[meshindex];
	
	gl.enableVertexAttribArray(at.position);
	gl.bindBuffer(gl.ARRAY_BUFFER, b.position); 
	gl.vertexAttribPointer(at.position, 3, gl.FLOAT, false, 0, 0);

	gl.enableVertexAttribArray(at.normal);
	gl.bindBuffer(gl.ARRAY_BUFFER, b.normal);
	gl.vertexAttribPointer(at.normal, 3, gl.FLOAT, false, 0, 0);
	
	if (b.tangent) {
		gl.enableVertexAttribArray(at.tangent);
		gl.bindBuffer(gl.ARRAY_BUFFER, b.tangent);
		gl.vertexAttribPointer(at.tangent, 3, gl.FLOAT, false, 0, 0);
		gl.uniform1i(uni.bumpmap, 1);
	} else {
		gl.uniform1i(uni.bumpmap, 0);
	}
	
	if (b.texcoord) {
		gl.enableVertexAttribArray(at.texcoord);
		gl.bindBuffer(gl.ARRAY_BUFFER, b.texcoord);
		gl.vertexAttribPointer(at.texcoord, 2, gl.FLOAT, false, 0, 0);
	} else {
		gl.disableVertexAttribArray(at.texcoord);
	}
	
	var tex;
	var i = model.meshes[meshindex].materialIndex;

	if (typeof i === "number" && i < model.materials.length) {
		var mat = model.materials[i];
		var dif = mat.diffuseReflectance;
		var amb = mat.ambientReflectance;
		var spec = mat.specularReflectance;
		
		gl.uniform1f(uni.shininess, mat.shininess);
		gl.uniform3f(uni.diffuse, dif[0], dif[1], dif[2]);
		gl.uniform3f(uni.ambient, amb[0], amb[1], amb[2]);
		gl.uniform3f(uni.specular, spec[0], spec[1], spec[2]);
		tex = mat.texture;
		
		gl.uniform1i(uni.lighting, 1);
	} else {
		gl.uniform1i(uni.lighting, 0);
	}
	
	if (model.texnormal) {
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, model.texnormal);
		gl.uniform1i(uni.texnormal, 2);
	}

	if (tex) {
		if (tex.width == 0 || tex.height == 0)
			return;
		
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.uniform1i(uni.hasTexture, 1);
		gl.uniform1i(uni.tex, 0);
	} else {
		gl.uniform1i(uni.hasTexture, 0);
		if (!model.texcube)
			return;

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, model.texcube);
		gl.uniform1i(uni.texcube, 1);
	}
	
	if (b.indices) {
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.indices);
		gl.drawElements(gl.TRIANGLES, b.numIndices, gl.UNSIGNED_SHORT, 0);
	} else {
		gl.drawArrays(gl.TRIANGLES, 0, b.numElements);
	}
			
	gl.disableVertexAttribArray(at.position);
	gl.disableVertexAttribArray(at.normal);
	gl.disableVertexAttribArray(at.tangent);
	if (b.texcoord)
		gl.disableVertexAttribArray(at.texcoord);
	if (b.tangent)
		gl.disableVertexAttribArray(at.tangent);
}

function renderModel(model) {
	if (!model)
		return;
	
	for (var i = 0; i < model.nodes.length; i++) {
		var n = model.nodes[i];

		var modelit = mat4.create(n.modelMatrix);
		modelit = mat4.inverse(modelit);
		modelit = mat4.transpose(modelit);

		gl.uniformMatrix4fv(uni.model, false, n.modelMatrix);
		gl.uniformMatrix4fv(uni.modelit, false, modelit);
		for (var j = 0; j < n.meshIndices.length; j++) {
			renderNode(model, n.meshIndices[j]);
		}
	} 
}

function render() {
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	gl.clearStencil(0);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
	
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);
	
	// calculate light vector
	var n = camera.up;
	var c = model.center;
	var d = model.diagonal;
	var Q = [c[0], model.ymin, c[2]];
	var L;
	var t, rx, rz;
	
	t = deg2rad(srotz);
	if (lightpointdir == 1) {
		L = [c[0]+5*d, c[1]+3*d, c[2], 1];
		rx = (L[0]-c[0])*Math.cos(t) - (L[2]-c[2])*Math.sin(t);
		rz = (L[0]-c[0])*Math.sin(t) + (L[2]-c[2])*Math.cos(t);
		L[0] = rx;
		L[2] = rz;
	} else {
		rx = Math.cos(t) - Math.sin(t);
		rz = Math.cos(t) + Math.sin(t);
		L = [1, 1, 0, 0];
		L[0] = rx;
		L[2] = rz;
	}
	gl.uniform4f(uni.light, L[0], L[1], L[2], L[3]);
	
	var eyeview = rotateCamera(camera, deg2rad(rotz));
	var eye = eyeview[0];
	var view = eyeview[1];
	var rview = mat4.create();
	mat4.multiply(view, reflection, rview);
	
	gl.uniform3f(uni.viewpos, eye[0], eye[1], eye[2]);
	gl.uniformMatrix4fv(uni.projection, false, projection);
	
	// stencil pool
	gl.disable(gl.DEPTH_TEST);
	gl.depthMask(false);
	gl.colorMask(false, false, false, false);
	gl.enable(gl.STENCIL_TEST);
	gl.clear(gl.STENCIL_BUFFER_BIT);
	gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE);
	gl.stencilFunc(gl.ALWAYS, 1, 0xFFFFFFFF);
	gl.uniformMatrix4fv(uni.view, false, view);
	renderModel(pool);
	
	// reflection
	gl.depthMask(true);
	gl.colorMask(true, true, true, true);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.STENCIL_TEST);
	gl.stencilFunc(gl.EQUAL, 1, 0xFFFFFFFF); 
	gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
	
	gl.uniformMatrix4fv(uni.view, false, rview);
	gl.uniform1i(uni.shadow, 0);
	gl.uniform1f(uni.alpha, .8);
	renderModel(model);
	gl.disable(gl.STENCIL_TEST);

	// pool
	gl.uniform1f(uni.alpha, 1);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.DST_ALPHA);
	gl.uniformMatrix4fv(uni.view, false, view);
	renderModel(pool);
	gl.disable(gl.BLEND);
	
	// shadows
	gl.uniform1i(uni.shadow, 1);
	var shadow = makeShadowProjection(L, Q, n);
	var viewShadow = mat4.create();
	mat4.multiply(view, shadow, viewShadow);
	gl.uniformMatrix4fv(uni.view, false, viewShadow);
	gl.enable(gl.STENCIL_TEST);
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.ALWAYS);
	
	renderModel(model);
	
	gl.disable(gl.STENCIL_TEST);
	gl.depthFunc(gl.LEQUAL);
	gl.uniform1i(uni.shadow, 0);
	
	// model
	gl.uniformMatrix4fv(uni.view, false, view);
	renderModel(model);

	rotz = (rotz + rotzinc) % 360;
	srotz = (srotz + srotzinc) % 360;
	showLightValues(L);
}

function selectValue(tag) {
	var sel = document.getElementById(tag);
	return sel.options[sel.selectedIndex].value;
}

function changeLightSource() {
	var source = selectValue('lightSourceList');
	
	if (source == "point") {
		lightpointdir = 1;
	} else if (source == "direction") {
		lightpointdir = 0;
	} else {
		throw "unknown light source";
	}
}

function changeLightRotate() {
	var toggle = selectValue('lightRotateToggle');
	
	if (toggle == "on") {
		srotzinc = 1;
	} else if (toggle == "off") {
		srotzinc = 0;
	} else {
		throw "unknown light rotate value";
	}
}

function changeModelRotate() {
	var toggle = selectValue('modelRotateToggle');
	
	if (toggle == "on") {
		rotzinc = 1;
	} else if (toggle == "off") {
		rotzinc = 0;
	} else {
		throw "unknown model rotate value";
	}
}


function showLightValues(L) {
	var str = "";
	if (L[3] == 0)
		str += "Light Direction: ";
	else
		str += "Light Position: ";
	
	str += "[ ";
	for (var i = 0; i < 3; i++)
		str += L[i].toFixed(2) + " ";
	str += "]";
	
	document.getElementById("light").innerHTML = str;
}

function main() {
	initGL();
	changeModelRotate();
	changeLightSource();
	changeLightRotate();
	loadScene(selectValue('modelList'));
}
