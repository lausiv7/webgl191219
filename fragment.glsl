precision mediump float;

uniform mat4 model;
uniform mat4 modelit;
uniform vec3 viewpos;

uniform sampler2D tex;
uniform sampler2D texnormal;
uniform samplerCube texcube;

uniform int hasTexture;
uniform int shadow;
uniform int lighting;
uniform int bumpmap;
uniform float alpha;

uniform float shininess;
uniform vec3 diffuse;
uniform vec3 ambient;
uniform vec3 specular;
uniform vec4 light;

varying vec3 ex_position;
varying vec2 ex_texcoord;
varying vec3 ex_normal;
varying vec3 ex_tangent;

vec3 rv;
vec3 normal;
vec3 wspos;
vec3 wsnorm;
vec3 wrnorm;
vec3 wstan;
vec3 wsview;
vec3 wslight;
vec4 outColor;

void calcWorldPos() {
	wspos = (model * vec4(ex_position, 1.0)).xyz;
	wsnorm = normalize(model * vec4(ex_normal, 0.0)).xyz;
	wstan = normalize(model * vec4(ex_tangent, 0.0)).xyz;
}

vec3 bump() {
	mat3 TBN;
	vec3 T, B, N;
	vec3 n;
	
	n = texture2D(texnormal, ex_texcoord).rgb*2.0 - 1.0;
	N = wsnorm;
	T = wstan;
	B = cross(N, T);
	
	return normalize(mat3(T, B, N) * n);
}

void calcReflection() {
	vec3 viewdir;
	
	viewdir = normalize(wspos-viewpos); 
	rv = reflect(viewdir, wrnorm);
	
	wsview = viewpos-wspos; 
	if (light.w == 0.0)
		wslight = light.xyz;
	else
		wslight = light.xyz-wspos;
	
	wsview = normalize(wsview);
	wslight = normalize(wslight);
}

vec4 phong() {
	float s, cosTheta, cosPhi;
	vec3 V, L, N, R;
	vec3 kd, ka, ks;
	vec3 I0;
	vec3 c;
	
	I0 = vec3(1, 1, 1);
	kd = diffuse;
	ka = ambient;
	ks = specular;
	s = shininess;
	if (s <= 1.0)
		s = 20.0;
		
	V = wsview; 
	L = wslight;
	N = normal;
	R = reflect(-L, N);
	
	cosTheta = max(dot(L, N), 0.0);
	cosPhi = max(dot(R, V), 0.0);
	
	c = I0*(outColor.rgb*kd*cosTheta + ks*pow(cosPhi, s) + 0.1*ka)*1.5;
	return vec4(c, 1);
}

void main() {
	calcWorldPos();
	
	if (bumpmap == 1) {
		normal = bump();
		wrnorm = normal;
	} else {
		normal = ex_normal;
		wrnorm = normalize(modelit * vec4(normal, 0)).xyz;
	}
	calcReflection();

	if (hasTexture == 1) 
		outColor = texture2D(tex, ex_texcoord);
	else 
		outColor = textureCube(texcube, rv);

	if (shadow == 1)
		outColor = vec4(.2, .2, .2, 1);
	else if (lighting == 1)
		outColor = phong();
	
	gl_FragColor = vec4(outColor.rgb, alpha);
}
