precision mediump float;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

attribute vec3 position;
attribute vec2 texcoord;
attribute vec3 normal;
attribute vec3 tangent;

varying vec3 ex_position;
varying vec2 ex_texcoord;
varying vec3 ex_normal;
varying vec3 ex_tangent;

void main() {
	gl_Position = projection * view * model * vec4(position, 1.0);
	ex_position = position;
	ex_texcoord = texcoord;
	ex_normal = normal;
	ex_tangent = tangent;
}
