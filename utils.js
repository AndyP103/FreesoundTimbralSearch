/* Audio stuff */

var AudioManager = function() {};

AudioManager.prototype.playSoundByName = function(name, time) {
    if (time == undefined){
        time = 0;
    }
    if (name in this){
        playSound(this[name], time, function(){
            finishPlayingSound(name);
        }, name);  
    } else {
        console.log("ERROR: sound " + name + " not available!")
    }
}

AudioManager.prototype.loadSound = function(name, url) {
    var name = name.toString();
    var soundMap = {}
    soundMap[name] = url
    loadSounds(this, soundMap, function(){
        audio_manager.playSoundByName(name);
    });
}

AudioManager.prototype.stopAllBufferNodes = function() {
    for(var key in TIMERS){
        clearTimeout(TIMERS[key]);
    }
    TIMERS = [];
    for(var key in BUFFER_NODES){
        var node = BUFFER_NODES[key];
        if (node !== undefined){
            BUFFER_NODES[key].node.stop();  
            finishPlayingSound(BUFFER_NODES[key].sound_id);
        }
    BUFFER_NODES = [];
    }
}

/* Distance measures */

function computeEuclideanDistance(p1x, p1y, p2x, p2y){  
    return Math.sqrt( Math.pow(p2x - p1x, 2) + Math.pow(p2y - p1y, 2) );
}

function computeEuclideanDistance3d(p1x, p1y, p1z, p2x, p2y, p2z){  
    return Math.sqrt( Math.pow(p2x - p1x, 2) + Math.pow(p2y - p1y, 2) + Math.pow(p2z - p1z, 2) );
}

/* Colors */

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    // usage: rgbToHex(0, 51, 255); // #0033ff
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

/* JSON requests */

function loadJSON(callback, url) {   
    var xhr = new XMLHttpRequest();
    xhr.open('get', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
        var status = xhr.status;
        n_pages_received += 1;
        if (status == 200) {
            callback(xhr.response);
        } else {
            console.log('Error getting data from Freesound, status code: ' + xhr.status);
        }
    };
    xhr.send();
}

/* Request parameters */

function get_req_param(name){
     if(name=(new RegExp('[?&]'+encodeURIComponent(name)+'=([^&]*)')).exec(location.search))
            return decodeURIComponent(name[1]);
}

/* Coordinates and mapping from normalised map to display map */

function normCoordsToDisplayCoords(x, y){

    // First rotate
    x -= center_x;
    y -= center_y;
    var sin = Math.sin(rotation_degrees);
    var cos = Math.cos(rotation_degrees);
    var x_r = x * cos - y * sin;
    var y_r = x * sin + y * cos;
    x_r += center_x;
    y_r += center_y;

    // Then translate
    var x_rt = Math.round(((x_r - center_x) * zoom_factor * disp_scale) + disp_scale / 2 + disp_x_offset);
    var y_rt = Math.round(((y_r - center_y) * zoom_factor * disp_scale) + disp_scale / 2 + disp_y_offset);
    return [x_rt, y_rt];
}

function displayCoordsToNormCoords(x, y){

    // First translate
    var x_t = ((x - disp_scale / 2 - disp_x_offset) / (zoom_factor * disp_scale)) + center_x;
    var y_t = ((y - disp_scale / 2 - disp_y_offset) / (zoom_factor * disp_scale)) + center_y;

    // Then rotate
    x_t -= center_x;
    y_t -= center_y;
    var sin = Math.sin(rotation_degrees);
    var cos = Math.cos(rotation_degrees);
    var y_tr = (y_t * cos - x_t * sin) / (cos * cos + sin * sin);
    var x_tr = (x_t + y_tr * sin) / cos;
    x_tr += center_x;
    y_tr += center_y;
    return [x_tr, y_tr];
}

/* Access nested object attributes by string */
// Example usage: Object.byString(someObj, 'part3[0].name');
Object.byString = function(o, s) {
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');           // strip a leading dot
    var a = s.split('.');
    for (var i = 0, n = a.length; i < n; ++i) {
            var k = a[i];
            if (k in o) {
                    o = o[k];
            } else {
                    return;
            }
    }
    return o;
};


// function control_display() {
//     var online_form = document.getElementById("online-query-form");
//     var offline_form = document.getElementById("offline-query-form");
//     // var toggle_value = document.getElementById('myonoffswitch').checked;
//
//     if (online_form.style.display === "none") {
//         online_offline_state = "online";
//         offline_form.style.display = "none";
//         online_form.style.display = "block";
//         start()
//     } else {
//         online_offline_state = "offline";
//         online_form.style.display = "none";
//         offline_form.style.display = "block";
//         start();
//     }
// }

function sigmoid(x, base = -0.2, max_x= 50) {
    x = x - (max_x / 2.0);  // get x into the correct range
    // calculate tyhe sigmoid
    return (1.0 / (1.0 + Math.exp(base * x)))

}
