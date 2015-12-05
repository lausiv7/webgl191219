function ispot(x) {
	return (x & (x - 1) == 0);
}

function nearestpot(x) {
	var v = 1;
	while (v < x) {
		v <<= 1;
	}
	
	return v; 
}

function basename(path) {
	return path.replace(/\\/g,'/').replace( /.*\//, '' );
}
	 
function dirname(path) {
	return path.replace(/\\/g,'/').replace(/\/[^\/]*$/, '');
}

function readFile(file, mime) {
	var req = new XMLHttpRequest();
	req.open("GET", file, false);
	if (mime != null) {
		req.overrideMimeType(mime);
	}
	req.send(null);
	return req.responseText;
}

function parseJSON(file) {
	return JSON.parse(readFile(file, "application/json"));
}

function getText(id) {
	var e = document.getElementById(id);
	if (!e) {
		return null;
	}

	return readFile(e.src);
}

function makeShader(type, src) {
	var shader = gl.createShader(type);
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.log(gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}

function makeProgram(vs, fs) {
	var program = gl.createProgram();
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.log(gl.getProgramInfoLog(program));
		return null;
	}
	return program;
}

function makeBuffer(verts) {
	var buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
	return buffer;
}

function makeIndex(indices) {
	var ibo = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
	return ibo;
}

function makeGLContext(id) {
	var gl;
	var c = document.getElementById(id);
			
	try {
		gl = c.getContext("webgl", {stencil: true}) || c.getContext("experimental-webgl", {stencil: true}); 
		gl.viewportWidth = c.width;
		gl.viewportHeight = c.height;
	} catch(e) {}

	if (!gl) {
		alert("Unable to initialize WebGL. Your browser may not support it.");
	}
	
	return gl;
}

function computeModelDimensions(model) {
	var xmin, xmax, ymin, ymax, zmin, zmax;

	xmin = ymin = zmin = Number.POSITIVE_INFINITY;
	xmax = ymax = zmax = Number.NEGATIVE_INFINITY;

	var i, j, k;
	for (i = 0; i < model.nodes.length; i++) {
		var n = model.nodes[i];
		var m = n.modelMatrix;
		for (j = 0; j < n.meshIndices.length; j++) {
			var index = n.meshIndices[j];
			var mesh = model.meshes[index];

			for (k = 0; k < mesh.vertexPositions.length; k += 3) {
				var v = mat4.multiplyVec4(m, [mesh.vertexPositions[k],
				mesh.vertexPositions[k + 1],
				mesh.vertexPositions[k + 2],
				1]);


				xmin = Math.min(xmin, v[0]);
				xmax = Math.max(xmax, v[0]);

				ymin = Math.min(ymin, v[1]);
				ymax = Math.max(ymax, v[1]);

				zmin = Math.min(zmin, v[2]);
				zmax = Math.max(zmax, v[2]);
			}
		}
	}

	var x, y, z;
	var center, diagonal;

	x = xmax - xmin;
	y = ymax - ymin;
	z = zmax - zmin;

	center = [(xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2];
	diagonal = Math.sqrt(x * x + y * y + z * z);

	return [center, diagonal, [xmin, ymin, zmin], [xmax, ymax, zmax]];
}

function loadCubemap(filename) {
	console.log("loading cubemap dir: " + filename);

	var c = parseJSON(filename);
	if (!c.files || c.files.length != 6)
		throw "invalid cubemap json file: " + filename;

	for (var i = 0; i < c.files.length; i++)
		c.files[i] = dirname(filename) + "/" + c.files[i];
	
	return newCubemap(c.files);
}

function newCubemap(texfiles) {
	var tex = gl.createTexture();
   
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
	var directions = [
		gl.TEXTURE_CUBE_MAP_POSITIVE_X,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
		gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
		gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
	];

	function loadCubeFace(index) {
		var image = new Image();
		image.onload = function () {
			console.log("cube map texture: " + image.src + " loaded. " + image.width + "x" + image.height);
			gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
			gl.texImage2D(directions[index], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
		}
		image.src = texfiles[index];
	}
	
	for (var i = 0; i < directions.length; i++) 
		loadCubeFace(i);
	
	return tex;
}

function newTexture(name) {
	var npot = false;
	var tex = gl.createTexture();
	tex.width = 0;
	tex.height = 0;
	
	var img = new Image();

	img.onload = function() {
		gl.bindTexture(gl.TEXTURE_2D, tex);
		if (!ispot(img.width) || !ispot(img.height)) { 
			npot = true;
		}
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
	
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, (npot) ? gl.CLAMP_TO_EDGE : gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, (npot) ? gl.CLAMP_TO_EDGE : gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, npot ? gl.LINEAR : gl.LINEAR_MIPMAP_LINEAR);
	
		if (!npot) {
			gl.generateMipmap(gl.TEXTURE_2D);
		}
		gl.bindTexture(gl.TEXTURE_2D, null);
	
		tex.width = img.width;
		tex.height = img.height;
		
		console.log("loaded texture: " + img.src);
	}
	img.src = name;
	
	return tex;
}

function loadModelFile(path, file) {
	return loadModel(path, parseJSON(file));
}

function loadModel(path, model) {
	var i;
	if (!model) {
		throw "error loading model file";
	}
	
	var buffers = new Array();
	if (model.materials) {
		for (i = 0; i < model.materials.length; i++) {
			var m = model.materials[i];
			if (m.diffuseTexture && m.diffuseTexture[0]) {
				var texfile = path + "/" + m.diffuseTexture[0];
				m.texture = newTexture(texfile);
			}
		}
	}

	if (model.meshes) {
		var dim = computeModelDimensions(model);
		model.center = dim[0];
		model.diagonal = dim[1];
		model.xmin = dim[2][0];
		model.ymin = dim[2][1];
		model.zmin = dim[2][2];
		model.xmax = dim[3][0];
		model.ymax = dim[3][1];
		model.zmax = dim[3][2];
		
		for (i = 0; i < model.meshes.length; i++) {
			var m = model.meshes[i];
			var b = new Object();

			b.position = makeBuffer(m.vertexPositions);
			if (m.vertexNormals) {
				b.normal = makeBuffer(m.vertexNormals);
			}
			
			if (m.vertexTexCoordinates && m.vertexTexCoordinates[0]) {
				b.texcoord = makeBuffer(m.vertexTexCoordinates[0]);
			}
		
			b.indices = null;
			if (m.indices) {
				b.indices = makeIndex(m.indices);
				b.numIndices = m.indices.length;
			} else {
				b.numElements = m.vertexPositions.length / 3;
			}

			if (m.vertexTangents) {
				b.tangent = makeBuffer(m.vertexTangents);
			} else if (b.normal && b.texcoord) {
				var tangents = makeTangents(m.vertexPositions, m.vertexNormals, 
								m.vertexTexCoordinates[0], m.indices);
								
				b.tangent = makeBuffer(tangents);
			}

			buffers.push(b);
		}
	}
	
	model.buffers = buffers;
	return model;
}

function makeCamera(center, diagonal) {
	camera = {};
	camera.at = center;
	camera.eye = [center[0] - 1.5*diagonal, center[1], center[2]];
	camera.up = [0, 1, 0];
	camera.FOV = 40;
	camera.near = 0.1 * diagonal;
	camera.far = 3 * diagonal;

	return camera;
}

function rotateCamera(camera, r) {
	var t = mat4.identity();
	mat4.translate(t, [camera.at[0], camera.at[1], camera.at[2]]);
	var m = mat4.create();
	mat4.rotate(t, r, camera.up, m)
	mat4.translate(m, [-camera.at[0], -camera.at[1], -camera.at[2]]);
	var neweye = vec4.create();
	mat4.multiplyVec4(m, [camera.eye[0], camera.eye[1], camera.eye[2], 1.0], neweye);
	return [neweye, mat4.lookAt([neweye[0], neweye[1], neweye[2]], camera.at, camera.up)];
}

function rad2deg(radians) {
	return radians * (180/Math.PI);
}

function deg2rad(degrees) {
	return degrees * (Math.PI/180);
}

function makePool(model) {
	var p = new Object();
	p.name = "Pool";
	p.materials = [];
	p.meshes = [{}];
	p.meshes[0].vertexPositions = [-1,0,-1,-1,0,1,1,0,1,1,0,-1];
	p.meshes[0].vertexNormals = [0,1,0,0,1,0,0,1,0,0,1,0];
	p.meshes[0].vertexTexCoordinates = [[]];
	p.meshes[0].vertexTexCoordinates[0] = [0,0,1,0,0,1,1,0,1,1,0,1];
	p.meshes[0].vertexTangents = [1,0,0,1,0,0,1,0,0,1,0,0];
	p.meshes[0].indices = [0,1,2,2,3,0];
	p.meshes[0].materialIndex = 0;
	
	var m = model;
	var d = m.diagonal;
	p.nodes = [{}];
	p.nodes[0].modelMatrix = [d,0,0,0,0,d,0,0,0,0,d,0,(m.xmin+m.xmax)/2,m.ymin,(m.zmin+m.zmax)/2,1];
	p.nodes[0].meshIndices = [0];
	
	return loadModel(null, p);
}

// Light: 4 element vector, Q: point on Projection plane, n: normal to the projection plane
function makeShadowProjection(L,Q,n) {	
	var lightIsDirection=(L[3]===0);
	var nDotL = n[0]*L[0]+n[1]*L[1]+n[2]*L[2];
	var nDotQ = n[0]*Q[0]+n[1]*Q[1]+n[2]*Q[2];
	var mat = [];
	
	mat[0] = -nDotL+((lightIsDirection)?0:nDotQ)+n[0]*L[0]; 
	mat[4] = n[1]*L[0]; 
	mat[8] = n[2]*L[0]; 
	mat[12] = -nDotQ*L[0];
	  
	mat[1] = n[0]*L[1];		  
	mat[5] = -nDotL+((lightIsDirection)?0:nDotQ)+n[1]*L[1];
	mat[9] = n[2]*L[1]; 
	mat[13] = -nDotQ*L[1];
	  
	mat[2] = n[0]*L[2];
	mat[6]	= n[1]*L[2]; 
	mat[10] = -nDotL+((lightIsDirection)?0:nDotQ)+n[2]*L[2];
	mat[14] = -nDotQ*L[2];

	mat[3] = (lightIsDirection) ? 0 : n[0];
	mat[7]	= (lightIsDirection)? 0 : n[1]; 
	mat[11] = (lightIsDirection)? 0 : n[2]; 
	mat[15] = -nDotL;
	if (mat[15] < 0) {
		for(var i=0; i<16;i++) 
			mat[i] = -mat[i];
	}
	
	return mat;
}

function makeTangents(vertex, normal, texcoord, indices) {
	var i, j;
	var tangent;
	var tan1, tan2;
	var nverts, ntriangles;
	
	nverts = vertex.length / 3;
	if (!indices) {
		indices = new Array(nverts);
		for (i = 0; i < indices.length; i++) {
			indices[i] = i;
		}
	}
	
	ntriangles = indices.length / 3;
	tan1 = new MatrixArray(3*nverts);
	tan2 = new MatrixArray(3*nverts);
	tangent = new MatrixArray(3*nverts);
	
	for (i = 0; i < ntriangles; i++) {
		var i1, i2, i3;
		var v1, v2, v3;
		var w1, w2, w3;
		var x1, x2, y1, y2, z1, z2;
		var s1, s2, t1, t2;
		var r;
		var sdir, tdir;
		
		i1 = indices[3*i];
		i2 = indices[3*i+1];
		i3 = indices[3*i+2];
		
		v1 = [vertex[3*i1], vertex[3*i1+1], vertex[3*i1+2]];
		v2 = [vertex[3*i2], vertex[3*i2+1], vertex[3*i2+2]];
		v3 = [vertex[3*i3], vertex[3*i3+1], vertex[3*i3+2]];
		
		w1 = [texcoord[2*i1], texcoord[2*i1+1]];
		w2 = [texcoord[2*i2], texcoord[2*i2+1]];
		w3 = [texcoord[2*i3], texcoord[2*i3+1]];
		
		x1 = v2[0] - v1[0];
		x2 = v3[0] - v1[0];
		y1 = v2[1] - v1[1];
		y2 = v3[1] - v1[1];
		z1 = v2[2] - v1[2];
		z2 = v3[2] - v1[2];
		
		s1 = w2[0] - w1[0];
		s2 = w3[0] - w1[0];
		t1 = w2[1] - w1[1];
		t2 = w3[1] - w1[1];
		
		if ((s1*t2 - s2*t1) == 0)
			r = 1.0;
		else
			r = 1.0 / (s1*t2 - s2*t1);
		
		sdir = [(t2*x1 - t1*x2)*r, 
			(t2*y1 - t1*y2)*r, 
			(t2*z1 - t1*z2)*r];
		
		tdir = [(s1*x2 - s2*x1)*r, 
			(s1*y2 - s2*y1)*r,
			(s1*z2 - s2*z1)*r];
	 
		for (j = 0; j < 3; j++) {
			tan1[3*i1+j] += sdir[j];
			tan1[3*i2+j] += sdir[j];
			tan1[3*i3+j] += sdir[j];
			
			tan2[3*i1+j] += tdir[j];
			tan2[3*i2+j] += tdir[j];
			tan2[3*i3+j] += tdir[j];
		}
	}
	
	var n, t, v, dot;
	n = vec3.createFrom(0, 0, 0);
	t = vec3.createFrom(0, 0, 0);
	v = vec3.createFrom(0, 0, 0);
	
	// Gramm-Schmidt orthogonalization
	for (i = 0; i < nverts; i++) {
		j = 3*i;
		vec3.set([normal[j], normal[j+1], normal[j+2]], n);
		vec3.set([tan1[j], tan1[j+1], tan1[j+2]], t);
		
		dot = vec3.dot(n, t);
		vec3.scale(n, dot);
		vec3.subtract(t, n, v);
		vec3.normalize(v);
		
		tangent[j] = v[0];
		tangent[j+1] = v[1];
		tangent[j+2] = v[2];
	}
	
	return tangent;
}
