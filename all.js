/* Global variables and objects */

// Audio stuff
var audio_manager = new AudioManager();
var MONO_MODE = true;

// Sounds and content
var default_query = "Snare";
var sounds = [];
// var extra_descriptors = undefined;
// var extra_descriptors = "ac_analysis.ac_hardness,ac_depth,ac_brightness,ac_roughness,ac_warmth,ac_sharpness,ac_booming";
var extra_descriptors = "";
var map_features = undefined;
var map_type = "tsne";
var n_pages = 3;
var n_pages_received = 0;
var all_loaded = false;
var last_selected_sound_id = undefined;
var num_stimuli_counter = 0;
var num_files = 150;

// t-sne and xy map
var max_tsne_iterations = 500;
var current_it_number = 0;
var epsilon = 10;
var perplexity = 10;
var tsne = undefined;
var max_xy_iterations = 50;
var map_xy_x_max = undefined;
var map_xy_x_min = undefined;
var map_xy_y_max = undefined;
var map_xy_y_min = undefined;

// Canvas and display stuff
var canvas = document.querySelector('canvas');
var ctx = canvas.getContext('2d');
var w = window.innerWidth;
var h = window.innerHeight;
var default_point_modulation = 0.6;
var disp_scale = Math.min(w, h);
var center_x = undefined;  // Set in start()
var center_y = undefined;  // Set in start()
var zoom_factor = undefined;  // Set in start()
var rotation_degrees = undefined;  // Set in start()
var min_zoom = 0.2;
var max_zoom = 15;
var draw_type = "new";

/* Setup and app flow functions */

var lock = false;

function start(){

    // stop all audio
    audio_manager.stopAllBufferNodes();

    // get map descriptors
    setMapDescriptor();
    
    // update axis labels
    update_axis_labels();

    // reset number of found files and draw type
    num_stimuli_counter = 0;
    draw_type = "new";

    // Sounds
    sounds = [];
    n_pages_received = 0;
    all_loaded = false;

    // Canvas
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.addEventListener("mousedown", onMouseDown, false);
    canvas.addEventListener("mouseup", onMouseUp, false);
    canvas.addEventListener("mouseout", onMouseOut, false);
    canvas.addEventListener("wheel", onWheel, false);
    center_x = 0.5;
    center_y = 0.5;
    zoom_factor = 1.0;
    rotation_degrees = 0;

    // Display stuff
    if (w >= h){
        disp_x_offset = (w - h) / 2;
        disp_y_offset = 0.0;
    } else {
        disp_x_offset = 0.0;
        disp_y_offset = (h - w) / 2;
    }

    // t-sne
    current_it_number = 0;
    var opt = {}
    opt.epsilon = epsilon; // epsilon is learning rate (10 = default)
    opt.perplexity = perplexity; // roughly how many neighbors each point influences (30 = default)
    opt.dim = 2; // dimensionality of the embedding (2 = default)
    tsne = new tsnejs.tSNE(opt); // create a tSNE instance

    // var online_offline_state = document.getElementById('myonoffswitch').checked;

    // how many pages to download
    num_files = parseInt(document.getElementById('num_of_files').value, 10);
    n_pages = Math.round(num_files/150) + 1;

    // n_pages = 3;
    //this is in online mode
    var query = document.getElementById('query_terms_input').value;

    // Search sounds in Freesound and start loading them
    if ((query == undefined) || (query=="")){
        query = default_query;
    }
    for (var i=0; i<n_pages; i++){
        var url =  "https://freesound.org/apiv2/search/text/?query=" + query + "&group_by_pack=0" +
            "&filter=ac_brightness:[*+TO+*]"+
            "&fields=id,previews,name,analysis,url,ac_analysis,username,images" +
            "&descriptors=sfx.tristimulus.mean," + extra_descriptors + "&page_size=150" +
            "&token=eecfe4981d7f41d2811b4b03a894643d5e33f812&page=" + (i + 1);

        // "https://freesound.org/apiv2/search/text/?query=" + query + "&" +
        //     "group_by_pack=0&filter=duration:[0+TO+10]&fields=id,previews,name,analysis,url,username,images,ac_analysis" +
        //     extra_descriptors + "&page_size=150" +
        //     "&token=eecfe4981d7f41d2811b4b03a894643d5e33f812&page=" + (i + 1);
        loadJSON(function(data) { load_data_from_fs_json(data); }, url);

        var x = 1;
    }
    // UI
    document.getElementById('query_terms_input').value = query;  // set to what was just searched.
    document.getElementById('info_placeholder').innerHTML = "Searching...";  // change info box to searching.

}

window.requestAnimFrame = (function(){ // This is called when code reaches this point
    return  window.requestAnimationFrame       ||
                    window.webkitRequestAnimationFrame ||
                    window.mozRequestAnimationFrame    ||
                    function( callback ){
                        window.setTimeout(callback, 1000 / 60);
                    };
})();

(function init(){ // This is called when code reaches this point
    window.addEventListener("keydown", onKeyDown, false);
    window.addEventListener("keyup", onKeyUp, false);
    setMapDescriptor();
})();

(function loop(){  // This is called when code reaches this point
    if (map_type == "tsne") {
        // Compute new position of sounds in tsne and update sounds xy
        if ((all_loaded == true) && (current_it_number <= max_tsne_iterations)){
            document.getElementById('info_placeholder').innerHTML = 'Projecting sounds...';
            tsne.step();
            Y = tsne.getSolution();
            var xx = [];
            var yy = [];
            for (i in Y){
                xx.push(Y[i][0]);
                yy.push(Y[i][1]);
            }
            min_xx = Math.min(...xx);
            max_xx = Math.max(...xx);
            min_yy = Math.min(...yy);
            max_yy = Math.max(...yy);
            var delta_xx = max_xx - min_xx;
            var delta_yy = max_yy - min_yy;
            for (i in sounds){
                var sound = sounds[i];
                var x = Y[i][0];
                var y = Y[i][1];
                sound.x = -min_xx/delta_xx + x/delta_xx;
                sound.y = -min_yy/delta_yy + y/delta_yy;
                if (delta_xx > delta_yy){
                    sound.y = sound.y * (delta_yy/delta_xx); // Preserve tsne aspect ratio
                } else {
                    sound.x = sound.x * (delta_xx/delta_yy); // Preserve tsne aspect ratio
                }
                sound.x = sound.x * Math.pow(100, current_it_number/max_tsne_iterations - 1) + 0.5 * (1 - Math.pow(100, current_it_number/max_tsne_iterations - 1)); // Smooth position at the beginning
                sound.y = sound.y * Math.pow(100, current_it_number/max_tsne_iterations - 1) + 0.5 * (1 - Math.pow(100, current_it_number/max_tsne_iterations - 1)); // Smooth position at the beginning
            }
            current_it_number += 1;
        }
        if (current_it_number >= max_tsne_iterations) {
            document.getElementById('info_placeholder').innerHTML = "Done, " + sounds.length + " sounds loaded!";
        }
    } else if (map_type == "xy") {
        if (draw_type === "new") {
            // Get sound's xy position and scale it smoothly to create an animation effect
            if ((all_loaded === true) && (current_it_number <= max_xy_iterations)) {
                document.getElementById('info_placeholder').innerHTML = 'Projecting sounds...';
                for (i in sounds) {
                    var sound = sounds[i];
                    sound.x = sound.computed_x * Math.pow(100, current_it_number / max_xy_iterations - 1) + 0.5 * (1 - Math.pow(100, current_it_number / max_xy_iterations - 1)); // Smooth position at the beginning
                    sound.y = sound.computed_y * Math.pow(100, current_it_number / max_xy_iterations - 1) + 0.5 * (1 - Math.pow(100, current_it_number / max_xy_iterations - 1)); // Smooth position at the beginning
                }
                current_it_number += 1;
            }
            if (current_it_number >= max_xy_iterations - 1) {
                document.getElementById('info_placeholder').innerHTML = "Done, " + sounds.length + " sounds loaded!";
            }
        } else if (draw_type === "move") {
            // Get sound's xy position and scale it smoothly to create an animation effect
            if ((all_loaded === true) && (current_it_number < max_xy_iterations)) {
                document.getElementById('info_placeholder').innerHTML = 'Moving sounds...';
                var sigmoid_value = sigmoid(current_it_number);
                for (i in sounds) {
                    var sound = sounds[i];

                    var x_distance_to_move = sound.computed_x - sound.previous_x;
                    var y_distance_to_move = sound.computed_y - sound.previous_y;
                    sound.x = sound.previous_x + x_distance_to_move * sigmoid_value;
                    sound.y = sound.previous_y + y_distance_to_move * sigmoid_value;

                    // sound.x = sound.computed_x * Math.pow(100, current_it_number / max_xy_iterations - 1) + 0.5 * (1 - Math.pow(100, current_it_number / max_xy_iterations - 1)); // Smooth position at the beginning
                    // sound.y = sound.computed_y * Math.pow(100, current_it_number / max_xy_iterations - 1) + 0.5 * (1 - Math.pow(100, current_it_number / max_xy_iterations - 1)); // Smooth position at the beginning
                }
                current_it_number += 1;
                if (current_it_number >= max_xy_iterations - 1) {
                    sound.x = sound.computed_x;
                    sound.y = sound.computed_y;
                }
            }

            if (current_it_number >= max_xy_iterations - 1) {
                document.getElementById('info_placeholder').innerHTML = "Done, " + sounds.length + " sounds loaded!";
            }


        }


    }
    draw();
    requestAnimFrame(loop);
})();


/* Sounds stuff */

function SoundFactory(id, preview_url, analysis, url, name, username, image){
    this.x =  0.5; //Math.random();
    this.previous_x = 0.5;
    this.previous_y = 0.5;
    this.y =  0.5; //Math.random();
    this.rad = 15;
    this.mod_position = Math.random();
    this.mod_inc = 0.1;
    this.mod_amp = default_point_modulation;
    this.selected = false;

    this.id = id;
    this.preview_url = preview_url;
    this.analysis = analysis;

    // Set color of the points
    var color = rgbToHex(
        Math.floor(255 * analysis['sfx']['tristimulus']['mean'][0]),
        Math.floor(255 * analysis['sfx']['tristimulus']['mean'][1]),
        Math.floor(255 * analysis['sfx']['tristimulus']['mean'][2])
    );
    this.rgba = color;

    this.url = url;
    this.name = name;
    this.username = username;
    this.image = image; 
}

function load_data_from_fs_json(data) {
    for (i in data['results']) {
        var sound_json = data['results'][i];
        if (sound_json["ac_analysis"] != undefined && sound_json["analysis"] != undefined && num_stimuli_counter < num_files) {
            num_stimuli_counter++;
            var sound = new SoundFactory(
                id = sound_json['id'],
                preview_url = sound_json['audio'] || sound_json['previews']['preview-lq-mp3'],
                analysis = sound_json['analysis'],
                url = sound_json['url'],
                name = sound_json['name'],
                username = sound_json['username'],
                image = sound_json['image'] || sound_json['images']['spectral_m'],
            );
            var timbre = {
                hardness: sound_json.ac_analysis.ac_hardness,
                depth: sound_json.ac_analysis.ac_depth,
                brightness: sound_json.ac_analysis.ac_brightness,
                roughness: sound_json.ac_analysis.ac_roughness,
                sharpness: sound_json.ac_analysis.ac_sharpness,
                boominess: sound_json.ac_analysis.ac_booming
            }
            sound.analysis.timbre = timbre;
            sounds.push(sound);
        }
    }

    if (n_pages_received == n_pages) {
        if (map_type == "xy") {
            // Get max and min values for the 2 axis
            for (i in sounds) {
                var sound = sounds[i];
                x = Object.byString(sound, 'analysis.' + map_features[0]);
                y = Object.byString(sound, 'analysis.' + map_features[1]);

                // init max min vars if eneded
                if (i == 0) {
                    map_xy_x_max = x;
                    map_xy_x_min = x;
                    map_xy_y_max = y;
                    map_xy_y_min = y;
                }

                if (x > map_xy_x_max) {
                    map_xy_x_max = x;
                }
                if (y > map_xy_y_max) {
                    map_xy_y_max = y;
                }
                if (x < map_xy_x_min) {
                    map_xy_x_min = x;
                }
                if (y < map_xy_y_min) {
                    map_xy_y_min = y;
                }
            }
            // Compute sounds x, y position in the normalized space
            for (i in sounds) {
                var sound = sounds[i];
                x = Object.byString(sound, 'analysis.' + map_features[0]);
                y = Object.byString(sound, 'analysis.' + map_features[1]);
                sound.computed_x = (x - map_xy_x_min) / (map_xy_x_max - map_xy_x_min);
                sound.computed_y = 1 - (y - map_xy_y_min) / (map_xy_y_max - map_xy_y_min);
            }
        }
        all_loaded = true;
        console.log('Loaded map with ' + sounds.length + ' sounds')
    }
}


function checkSelectSound(x, y){
    var min_dist = 9999;
    var selected_sound = false;
    for(i in sounds){
        var sound = sounds[i];
        var dist = computeEuclideanDistance(sound.x, sound.y, x, y);
        if (dist < min_dist){
            min_dist = dist;
            selected_sound = sound;
        }
    }

    if (min_dist < 0.01){
        if (!selected_sound.selected){
            // throttle(function() {
            //     selectSound(selected_sound);
            // }, 250);
            selectSound(selected_sound);
        }
    }
}

function selectSound(selected_sound){
    if (!selected_sound.selected){
        selected_sound.selected = true;
        selected_sound.mod_amp = 5.0;
        if (MONO_MODE) {
            audio_manager.stopAllBufferNodes();
        }
        audio_manager.loadSound(selected_sound.id, selected_sound.preview_url);
        showSoundInfo(selected_sound);
        last_selected_sound_id = selected_sound['id']
    } else {
        selected_sound.selected = false;
        selected_sound.mod_amp = default_point_modulation;
    }
}

function finishPlayingSound(sound_id){
    var sound = getSoundFromId(sound_id);
    sound.selected = false;
    sound.mod_amp = default_point_modulation;
}

function selectSoundFromId(sound_id){
    var sound = getSoundFromId(sound_id);
    selectSound(sound);
}

function getSoundFromId(sound_id){
    for (i in sounds){
        var sound = sounds[i];
        if (sound.id == parseInt(sound_id)){
            return sound;
        }
    }
}

function showSoundInfo(sound){
    var html = '';
    if ((sound.image !== undefined) && (sound.image !== '')){
        html += '<img src="' + sound.image + '"/ class="sound_image"><br>';
    }
    html += sound.name + ' by <a href="' + sound.url + '" target="_blank">' + sound.username + '</a>';
    document.getElementById('sound_info_box').innerHTML = html;
}

function setMapDescriptor(){
    // var selected_descriptors = document.getElementById('map_descriptors_selector').value;
    //
    // The following is used when querying Freesound to decide which descriptors to include in the response
    // if (selected_descriptors.startsWith("tsne&")) {
    //     map_type = "tsne";
    //     extra_descriptors = selected_descriptors.split('&')[1];
    //     map_features = [extra_descriptors];
    // } else if (selected_descriptors.startsWith("xy&")) {
    //     map_type = "xy";
    //     extra_descriptors = selected_descriptors.split('&')[1] + ',' + selected_descriptors.split('&')[2];
    //     map_features = [selected_descriptors.split('&')[1], selected_descriptors.split('&')[2]];
    // }  else {
    map_type = "xy";
    var x_descriptor = document.getElementById('x_axis_map_descriptors_selector').value;
    var y_descriptor = document.getElementById('y_axis_map_descriptors_selector').value;
    map_features = [x_descriptor, y_descriptor];

    // }
}

/* Drawing */

function draw(){
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for(i in sounds){
        var sound = sounds[i];
        var disp_x, disp_y;
        [disp_x, disp_y] = normCoordsToDisplayCoords(sound.x, sound.y)

        if (!sound.selected){
            ctx.fillStyle = sound.rgba;
            ctx.strokeStyle = sound.rgba;
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#ffffff';
        }

        // if (last_selected_sound_id == sound['id']){
        //     ctx.fillStyle = '#ffffff';
        // }

        ctx.beginPath();
        ctx.arc(disp_x, disp_y, sound.rad*zoom_factor*Math.pow(0.9,zoom_factor), 0, Math.PI*2, true);
        ctx.fill();
        ctx.closePath();

        ctx.beginPath();
        ctx.arc(disp_x, disp_y, (sound.rad+5+(sound.mod_amp*Math.cos(sound.mod_position)))*zoom_factor*Math.pow(0.9,zoom_factor), 0, Math.PI*2, true);
        ctx.stroke();
        ctx.closePath();

        sound.mod_position += sound.mod_inc;
    }
}

// form submit event handler
(function() {
  var formSubmitHandler = function formSubmitHandler(event) {
    event.preventDefault();
    start();
  }
  document.getElementById('online-query-form').onsubmit = formSubmitHandler;
})()

// axis text label drawing
function update_axis_labels(){
	if (map_type == "tsne") {
		nice_x_text = "Similarity";
		nice_y_text = "Similarity";
    	document.getElementById('y_axis_box').innerHTML = "Similarity";
	} else {
		var nice_x_text = convert_to_nice_string(map_features[0])
		var nice_y_text = convert_to_nice_string(map_features[1])
	}
	
	// update the text boxes
    document.getElementById('x_axis_box').innerHTML = nice_x_text;
    document.getElementById('y_axis_box').innerHTML = nice_y_text;
    
}

// convert text in the form timbral.brightness to Brightness
function convert_to_nice_string(axis_string){
	// convert to array at the dot
	var str = axis_string.split(".")
	// remove the timbral component
	var nice_str = str[1]
	// return the attribute with first letter as uppercase
	return nice_str.charAt(0).toUpperCase() + nice_str.slice(1);

}


function move_stimuli_positions(){
    // stop all audio
    audio_manager.stopAllBufferNodes();

    draw_type = "move";

    // get previous positions for each sound
    for (i in sounds) {
        var sound = sounds[i];
        sound.previous_x = sound.x;
        sound.previous_y = sound.y;
    }

    // update the map descriptors
    setMapDescriptor();
    update_axis_labels();

    // get new axis attribute values and identify max/min
    for (i in sounds){
        var sound = sounds[i];
        x = Object.byString(sound, 'analysis.' + map_features[0]);
        y = Object.byString(sound, 'analysis.' + map_features[1]);

        // init max min vars if eneded
        if (i == 0) {
            map_xy_x_max = x;
            map_xy_x_min = x;
            map_xy_y_max = y;
            map_xy_y_min = y;
        }

        if (x > map_xy_x_max) {
            map_xy_x_max = x;
        }
        if (y > map_xy_y_max) {
            map_xy_y_max = y;
        }
        if (x < map_xy_x_min) {
            map_xy_x_min = x;
        }
        if (y < map_xy_y_min) {
            map_xy_y_min = y;
        }
    }
    // Compute sounds x, y position in the normalized space
    for (i in sounds){
        var sound = sounds[i];
        x = Object.byString(sound, 'analysis.' + map_features[0]);
        y = Object.byString(sound, 'analysis.' + map_features[1]);
        sound.computed_x = (x - map_xy_x_min) / (map_xy_x_max - map_xy_x_min);
        sound.computed_y = 1 - (y - map_xy_y_min) / (map_xy_y_max - map_xy_y_min);
    }

    // set the itteration number back to zero
    current_it_number = 0;
}
