var camera = new Camera();
camera.setOrthographic(3, 3, 16);
camera.position = camera.position.rotateX(Math.PI / 4);

function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srctType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srctType, pixel);
  const image = new Image();
  image.onload = function() {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat,
                  srctType, image);

    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
  };
  
  image.src = url;

  return texture;
}

function loadMdt(url) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = 'arraybuffer';
    req.onload = function() {
      if (req.status === 200) {
        resolve(req.response);
      } else {
        reject(Error('No se ha podido cargar los datos de altitud:' + req.statusText));
      }
    };
    req.send();
  });
}

function isPowerOf2(value) {
  return (value & (value -1 )) == 0;
}

function createShader(gl, shader_info) {
  var shader = gl.createShader(shader_info.type);
  var i = 0;
  var shader_source = document.getElementById(shader_info.name).text;
  /* skip whitespace to avoid glsl compiler complaining about
  #version not being on the first line*/
  while (/\s/.test(shader_source[i])) i++;
  shader_source = shader_source.slice(i);
  gl.shaderSource(shader, shader_source);
  gl.compileShader(shader);
  var compile_status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compile_status) {
    var error_message = gl.getShaderInfoLog(shader);
    throw "Could not compile shader \"" +
          shader_info.name +
          "\" \n" +
          error_message;
  }
  return shader;
}

/* Creates an OpenGL program object.
   `gl' shall be a WebGL 2 context.
   `shader_list' shall be a list of objects, each of which have a `name'
      and `type' properties. `name' will be used to locate the script tag
      from which to load the shader. `type' shall indicate shader type (i. e.
      gl.FRAGMENT_SHADER, gl.VERTEX_SHADER, etc.)
  `transform_feedback_varyings' shall be a list of varying that need to be
    captured into a transform feedback buffer.*/
function createGLProgram(gl, shader_list, transform_feedback_varyings) {
  var program = gl.createProgram();
  for (var i = 0; i < shader_list.length; i++) {
    var shader_info = shader_list[i];
    var shader = createShader(gl, shader_info);
    gl.attachShader(program, shader);
  }

  /* Specify varyings that we want to be captured in the transform
     feedback buffer. */
  if (transform_feedback_varyings != null) {
    gl.transformFeedbackVaryings(program,
                                 transform_feedback_varyings,
                                 gl.INTERLEAVED_ATTRIBS);
  }
  gl.linkProgram(program);
  var link_status = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!link_status) {
    var error_message = gl.getProgramInfoLog(program);
    throw "Could not link program.\n" + error_message;
  }
  return program;
}

function randomRGData(size_x, size_y) {
  var d = [];
  for (var i = 0; i < size_x * size_y; ++i) {
    d.push(Math.random() * 255.0);
    d.push(Math.random() * 255.0);
  }
  return new Uint8Array(d);
}

function initialParticleData() {
  var data = [];
  for (var i = 0; i < 3000; i++) {

    var age = Math.random() + 0.5;

    var orig = [Math.random() * 2 - 1, Math.random() * 2 - 1];
    var Pto1 = [orig, orig, orig, 0, 0, age, 0].flat(); //Los dos primeros números son los coeficientes y los dos últimos life y age
    var Pto2 = [orig, orig, orig, 0, 1, age, 0].flat();
    var Pto3 = [orig, orig, orig, 1, 0, age, 0].flat();
    var Pto4 = [orig, orig, orig, 1, 1, age, 0].flat();
    var Pto5 = [orig, orig, orig, 2, 0, age, 0].flat();
    var Pto6 = [orig, orig, orig, 2, 1, age, 0].flat();

    data.push(Pto3, Pto1, Pto2, Pto3, Pto2, Pto4, Pto5, Pto3, Pto4, Pto5, Pto4, Pto6); 
    data = data.flat();
  }

  return data;
}

function setupParticleBufferVAO(gl, buffers, vao) {
  gl.bindVertexArray(vao);
  for (var i = 0; i < buffers.length; i++) {
    var buffer = buffers[i];
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer_object);
    var offset = 0;
    for (var attrib_name in buffer.attribs) {
      if (buffer.attribs.hasOwnProperty(attrib_name)) {
        var attrib_desc = buffer.attribs[attrib_name];
        gl.enableVertexAttribArray(attrib_desc.location);
        gl.vertexAttribPointer(
          attrib_desc.location,
          attrib_desc.num_components,
          attrib_desc.type,
          false, 
          buffer.stride,
          offset);
        var type_size = 4; /* we're only dealing with types of 4 byte size in this demo, unhardcode if necessary */
        offset += attrib_desc.num_components * type_size; 
        if (attrib_desc.hasOwnProperty("divisor")) {
          gl.vertexAttribDivisor(attrib_desc.location, attrib_desc.divisor);
        }
      }
    }
  }
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function init(
    gl,
    p,
    num_particles,
    particle_birth_rate,
    min_age,
    max_age) {
  if (max_age < min_age) {
    throw "Invalid min-max age range.";
  }
  gl.enable(gl.DEPTH_TEST);
  var update_program = createGLProgram(
    gl,
    [
      {name: "particle-update-vert", type: gl.VERTEX_SHADER},
      {name: "passthru-frag-shader", type: gl.FRAGMENT_SHADER},
    ],
    [
      "v_Position",
      "v_Start",
      "v_Orig",
      "v_Order",
      "v_Offset",
      "v_Life",
      "v_Age",
    ]);
  var render_program = createGLProgram(
    gl,
    [
      {name: "particle-render-vert", type: gl.VERTEX_SHADER},
      {name: "particle-render-frag", type: gl.FRAGMENT_SHADER},
    ],
    null);
  var cube_program = createGLProgram(
    gl,
    [
      {name: "cube-render-vert", type: gl.VERTEX_SHADER},
      {name: "cube-render-frag", type: gl.FRAGMENT_SHADER},
    ],
    null);
  var update_attrib_locations = {
    i_Position: {
      location: gl.getAttribLocation(update_program, "i_Position"),
      num_components: 2,
      type: gl.FLOAT
    },
    i_Start: {
      location: gl.getAttribLocation(update_program, "i_Start"),
      num_components: 2,
      type: gl.FLOAT
    },
    i_Orig: {
      location: gl.getAttribLocation(update_program, "i_Orig"),
      num_components: 2,
      type: gl.FLOAT
    },
    i_Order: {
      location: gl.getAttribLocation(update_program, "i_Order"),
      num_components: 1,
      type: gl.FLOAT
    },
    i_Offset: {
      location: gl.getAttribLocation(update_program, "i_Offset"),
      num_components: 1,
      type: gl.FLOAT
    },
    i_Life: {
      location: gl.getAttribLocation(update_program, "i_Life"),
      num_components: 1,
      type: gl.FLOAT
    },
    i_Age: {
      location: gl.getAttribLocation(update_program, "i_Age"),
      num_components: 1,
      type: gl.FLOAT
    },
  };
  var render_attrib_locations = {
    i_Position: {
      location: gl.getAttribLocation(render_program, "i_Position"),
      num_components: 2,
      type: gl.FLOAT
    },
  };
  var vaos = [
    gl.createVertexArray(),
    gl.createVertexArray(),
    gl.createVertexArray(),
    gl.createVertexArray()
  ];
  var buffers = [
    gl.createBuffer(),
    gl.createBuffer(),
  ];
  var vao_desc = [
    {
      vao: vaos[0],
      buffers: [{
        buffer_object: buffers[0],
        stride: 4 * 10,
        attribs: update_attrib_locations
      }]
    },
    {
      vao: vaos[1],
      buffers: [{
        buffer_object: buffers[1],
        stride: 4 * 10,
        attribs: update_attrib_locations
      }]
    },
    {
      vao: vaos[2],
      buffers: [{
        buffer_object: buffers[0],
        stride: 4 * 10,
        attribs: render_attrib_locations
      }],
    },
    {
      vao: vaos[3],
      buffers: [{
        buffer_object: buffers[1],
        stride: 4 * 10,
        attribs: render_attrib_locations
      }],
    },
  ];
  var initial_data =
    new Float32Array(initialParticleData());
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers[0]);
  gl.bufferData(gl.ARRAY_BUFFER, initial_data, gl.STREAM_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers[1]);
  gl.bufferData(gl.ARRAY_BUFFER, initial_data, gl.STREAM_DRAW);
  for (var i = 0; i < vao_desc.length; i++) {
    setupParticleBufferVAO(gl, vao_desc[i].buffers, vao_desc[i].vao);
  }

  //BUFFER DEL PLANO

  var cubePositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubePositionBuffer);

  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array(p),
    gl.STATIC_DRAW);

  var cubePositionAttributeLocation = gl.getAttribLocation(cube_program, 'nm_Position');

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  var rg_noise_texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, rg_noise_texture);
  gl.texImage2D(gl.TEXTURE_2D,
                0, 
                gl.RG8,
                512, 512,
                0,
                gl.RG,
                gl.UNSIGNED_BYTE,
                randomRGData(512, 512));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  var vel_texture = loadTexture(gl, 'vel.jpg');
  var ang_texture = loadTexture(gl, 'ang.jpg');
  var mdt_texture = loadTexture(gl, 'mdt.jpg');
  var grad_texture = loadTexture(gl, 'gradiente2.jpg');
  return {
    particle_sys_buffers: buffers,
    particle_sys_vaos: vaos,
    read: 0,
    write: 1,
    particle_update_program: update_program,
    particle_render_program: render_program,
    cube_program: cube_program,
    cLocation: cubePositionAttributeLocation,
    cBuffer: cubePositionBuffer,
    num_particles: initial_data.length / 6,
    old_timestamp: 0.0,
    rg_noise: rg_noise_texture,
    vel: vel_texture,
    ang: ang_texture,
    mdt: mdt_texture,
    gradiente: grad_texture,
    total_time: 0.0,
    born_particles: 0,
    birth_rate: particle_birth_rate
  };
}

function render(gl, state, timestamp_millis) {
  var num_part = state.born_particles;
  var time_delta = 0.0;
  if (state.old_timestamp != 0) {
    time_delta = timestamp_millis - state.old_timestamp;
  }
  if (state.born_particles < state.num_particles) {
    state.born_particles = Math.min(state.num_particles,
                    Math.floor(state.born_particles + state.birth_rate * time_delta));
  state.old_timestamp = timestamp_millis;
  }
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //// AÑADO UN OBJETO A MODO DE PRUEBA
  
  gl.useProgram(state.cube_program);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.cBuffer);
  gl.enableVertexAttribArray(state.cLocation);
  gl.vertexAttribPointer(
    state.cLocation, 3, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(
    gl.getUniformLocation(state.cube_program, "view"),
    false,
    camera.getInversePosition().fields);
  gl.uniformMatrix4fv(
    gl.getUniformLocation(state.cube_program, "projection"),
    false,
    camera.projection.fields);
  gl.drawArrays(gl.TRIANGLES, 0, 710016);

  gl.useProgram(state.particle_update_program);
  gl.uniform1f(
    gl.getUniformLocation(state.particle_update_program, "u_TimeDelta"),
    time_delta / 1000.0);
  gl.uniform1f(
    gl.getUniformLocation(state.particle_update_program, "u_TotalTime"),
    state.total_time);
  state.total_time += time_delta;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.vel);
  gl.uniform1i(
    gl.getUniformLocation(state.particle_update_program, "u_Vel"),
    0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.ang);
  gl.uniform1i(
    gl.getUniformLocation(state.particle_update_program, "u_Ang"),
    1);
  gl.bindVertexArray(state.particle_sys_vaos[state.read]);
  gl.bindBufferBase(
    gl.TRANSFORM_FEEDBACK_BUFFER, 0, state.particle_sys_buffers[state.write]);
  gl.enable(gl.RASTERIZER_DISCARD);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, 12 * 3000);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
  gl.bindVertexArray(state.particle_sys_vaos[state.read + 2]);

  gl.useProgram(state.particle_render_program);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.particle_sys_buffers[state.write]);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(
    0, 2, gl.FLOAT, false, 4 * 10, 0);
  gl.uniformMatrix4fv(
    gl.getUniformLocation(state.particle_render_program, "view"),
    false,
    camera.getInversePosition().fields);
  gl.uniformMatrix4fv(
    gl.getUniformLocation(state.particle_render_program, "projection"),
    false,
    camera.projection.fields);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.mdt);
  gl.uniform1i(
    gl.getUniformLocation(state.particle_render_program, "u_Mdt"),
    0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.vel);
  gl.uniform1i(
    gl.getUniformLocation(state.particle_render_program, "u_Vel"),
    1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, state.gradiente);
  gl.uniform1i(
    gl.getUniformLocation(state.particle_render_program, "u_Grad"),
    2);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, state.rg_noise);
  gl.uniform1i(
    gl.getUniformLocation(state.particle_render_program, "u_Noise"),
    3);
  gl.drawArrays(gl.TRIANGLES, 0, 12 * 3000);
  var tmp = state.read;
  state.read = state.write;
  state.write = tmp;
  

  window.requestAnimationFrame(function(ts) { render(gl, state, ts); });
}

function main() {
  var canvas_element = document.createElement("canvas");
  canvas_element.width = 900;
  canvas_element.height = 900;
  var webgl_context = canvas_element.getContext("webgl2");
  if (webgl_context != null) {
    document.body.appendChild(canvas_element);
    loadMdt('mdt.bin').then(function(response) {
    var array = new Uint8Array(response);
    var vertices = [];
    var indices = [];
    var positions = [];
    for (var i = 0; i < 345; i++) {
      var coordy = 1 - i * (2 / 345) ;
      for (var n = 0; n < 345; n++) {
        var coordx = n * (2 / 345) - 1;
        var coordz = (array[345 * i + n] /  (255 * 3)) * -1;
        vertices.push(coordx, coordy, coordz);

        // indices 

        if (i != 345 -1 && n != 345 - 1) {
          var a = n + 345 * i;
          var b = n + 345 * (i + 1);
          var c = (n + 1) + 345 * (i + 1);
          var d = (n + 1) + 345 * i;
          indices.push(a, d, b);
          indices.push(b, d, c);
        }

      }
    }

    for (var i = 0; i < indices.length; i++) {
      positions.push(vertices[indices[i] * 3], vertices[indices[i] * 3 + 1], -vertices[indices[i] * 3 + 2]);
    }
    var state =
      init(
        webgl_context,
        positions,
        10000,
        0.6,
        3.01, 3.15);
    window.requestAnimationFrame(
      function(ts) { render(webgl_context, state, ts); });

    });
  } else {
    document.write("WebGL2 is not supported by your browser");
  }

}
