import { view } from '/js/modules/view.js';
import { tf } from '/js/modules/tf.js';
import { rosbridge } from '/js/modules/rosbridge.js';
import { settings } from '/js/modules/persistent.js';

let topic = getTopic("{uniqueID}");
let listener = undefined;
let marker_topic = undefined;

let markers = {};

const selectionbox = document.getElementById("{uniqueID}_topic");
const icon = document.getElementById("{uniqueID}_icon").getElementsByTagName('img')[0];

const canvas = document.getElementById('{uniqueID}_canvas');
const ctx = canvas.getContext('2d');

//Settings
if(settings.hasOwnProperty("{uniqueID}")){
	const loaded_data  = settings["{uniqueID}"];
	topic = loaded_data.topic;
}

function saveSettings(){
	settings["{uniqueID}"] = {
		topic: topic
	}
	settings.save();
}

//Rendering

/* 
Header header                        # header for time/frame information
string ns                            # Namespace to place this object in... used in conjunction with id to create a unique name for the object
int32 id                           # object ID useful in conjunction with the namespace for manipulating and deleting the object later
int32 type                         # Type of object
int32 action                         # 0 add/modify an object, 1 (deprecated), 2 deletes an object, 3 deletes all objects
geometry_msgs/Pose pose                 # Pose of the object
geometry_msgs/Vector3 scale             # Scale of the object 1,1,1 means default (usually 1 meter square)
std_msgs/ColorRGBA color             # Color [0.0-1.0]
duration lifetime                    # How long the object should last before being automatically deleted.  0 means forever
bool frame_locked                    # If this marker should be frame-locked, i.e. retransformed into its frame every timestep

#Only used if the type specified has some use for them (eg. POINTS, LINE_STRIP, ...)
geometry_msgs/Point[] points
#Only used if the type specified has some use for them (eg. POINTS, LINE_STRIP, ...)
#number of colors must either be 0 or equal to the number of points
#NOTE: alpha is not yet used
std_msgs/ColorRGBA[] colors

# NOTE: only used for text markers
string text

# NOTE: only used for MESH_RESOURCE markers
string mesh_resource
bool mesh_use_embedded_materials */

function rgbaToFillColor(rosColorRGBA) {

	// Clamp the RGBA values between 0 and 1
	const r = Math.min(Math.max(rosColorRGBA.r, 0), 1);
	const g = Math.min(Math.max(rosColorRGBA.g, 0), 1);
	const b = Math.min(Math.max(rosColorRGBA.b, 0), 1);
	const a = Math.min(Math.max(rosColorRGBA.a, 0), 1);
  
	// Convert the RGBA values from the range [0, 1] to the range [0, 255]
	const r255 = Math.round(r * 255);
	const g255 = Math.round(g * 255);
	const b255 = Math.round(b * 255);
  
	// Return the RGBA color string for HTML canvas context
	return `rgba(${r255}, ${g255}, ${b255}, ${a})`;
}

function rgbaToStrokeColor(rosColorRGBA) {

	// Clamp the RGBA values between 0 and 1
	const r = Math.min(Math.max(rosColorRGBA.r, 0), 1);
	const g = Math.min(Math.max(rosColorRGBA.g, 0), 1);
	const b = Math.min(Math.max(rosColorRGBA.b, 0), 1);
  
	// Convert the RGBA values from the range [0, 1] to the range [0, 255]
	const r255 = Math.round(r * 255);
	const g255 = Math.round(g * 255);
	const b255 = Math.round(b * 255);

	console.log(rosColorRGBA)
  
	// Return the RGBA color string for HTML canvas context
	return `rgb(${r255}, ${g255}, ${b255})`;
}

function drawMarkers(){

	function drawCircle(marker, size){
		ctx.scale(marker.scale.x, marker.scale.y);
		ctx.beginPath();
		ctx.arc(0, 0, size/2, 0, 2 * Math.PI, false);
		ctx.fill();
	}

	function drawCube(marker, size){
		ctx.scale(marker.scale.x, marker.scale.y);
		ctx.fillRect(-size/4, -size/4, size/2, size/2);
	}

	function drawArrow(marker, size){
		const height = parseInt(size*marker.scale.x);
		const width = parseInt(size*0.2*marker.scale.y)+1;
		const tip = parseInt(size*0.3*marker.scale.x)+1;
		const tipwidth = parseInt(size*0.6*marker.scale.y)+1;

		ctx.beginPath();
		ctx.moveTo(0, -width);
		ctx.lineTo(height - tip, -width);
		ctx.lineTo(height - tip, -tipwidth);
		ctx.lineTo(height, 0);
		ctx.lineTo(height - tip, tipwidth);
		ctx.lineTo(height - tip, width);
		ctx.lineTo(0, width);
		ctx.lineTo(0, -width);
		ctx.fill();
	}

	function drawLine(marker, size){
		ctx.lineWidth = parseInt(marker.scale.x*size);
		ctx.strokeStyle = rgbaToFillColor(marker.colors[0]); // for now

		ctx.beginPath();
		marker.points.forEach((point, index) => {
			const x = point.x * size;
			const y = point.y * size;
			if (index === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		});

		ctx.stroke();
	}

	function drawText(marker, size){

		ctx.scale(0.1, -0.1);

		ctx.font = (1.2*size)+"px Monospace";
		ctx.textAlign = "center";
		ctx.fillStyle = "white";
	
		ctx.strokeStyle = "#161B21";
		ctx.lineWidth = 0.3*size;

		ctx.strokeText(marker.text, 0, 0);
		ctx.fillText(marker.text, 0, 0);	
	}

	const unit = view.getMapUnitsInPixels(1.0);

	const wid = canvas.width;
    const hei = canvas.height;

	ctx.clearRect(0, 0, wid, hei);

	for (const [key, marker] of Object.entries(markers)) {
		ctx.fillStyle = rgbaToFillColor(marker.color);

		const frame = tf.absoluteTransforms[marker.header.frame_id];

		if(!frame)
			continue;

		let transformed = tf.transformPose(
			marker.header.frame_id, 
			tf.fixed_frame, 
			marker.pose.position, 
			marker.pose.orientation
		);

		const pos = view.fixedToScreen({
			x: transformed.translation.x,
			y: transformed.translation.y
		});

		const yaw = transformed.rotation.toEuler().h;

		ctx.save();
		ctx.translate(pos.x, pos.y);
		ctx.scale(1.0, -1.0);

		if(marker.type != 9)
			ctx.rotate(yaw);

		switch(marker.type)
		{
			case 0: drawArrow(marker, unit); break;//ARROW=0
			case 1: drawCube(marker, unit);break;//CUBE=1
			case 2: 
			case 3: drawCircle(marker, unit); break; //SPHERE=2 CYLINDER=3
			case 4: drawLine(marker, unit); break; //LINE_STRIP=4
			case 5: break; //LINE_LIST=5
			case 6: break; //CUBE_LIST=6
			case 7: break; //SPHERE_LIST=7
			case 8: break; //POINTS=8
			case 9: drawText(marker, unit); //TEXT_VIEW_FACING=9
			case 10: break; //MESH_RESOURCE=10
			case 11: break; //TRIANGLE_LIST=11
		}
		ctx.restore();
	}
}

//Topic
function connect(){

	if(topic == "")
		return;

	if(marker_topic !== undefined){
		marker_topic.unsubscribe(listener);
	}

	marker_topic = new ROSLIB.Topic({
		ros : rosbridge.ros,
		name : topic,
		messageType : 'visualization_msgs/MarkerArray'
	});
	
	listener = marker_topic.subscribe((msg) => {
		msg.markers.forEach(m => {
			if(m.action == 3){
				markers = {};
				return;
			}
			const id = m.ns + m.id;
			if(m.action == 2){
				if(markers.hasOwnProperty(id)){
					delete markers[id];
				}
				return;
			}

			const q = m.pose.orientation;
			if(q.x == 0 && q.y == 0 && q.z == 0 && q.w == 0)
				m.pose.orientation = new Quaternion();
		
			markers[id] = m;
		});
		drawMarkers();
	});

	saveSettings();
}

async function loadTopics(){
	let result = await rosbridge.get_topics("visualization_msgs/MarkerArray");

	let topiclist = "";
	result.forEach(element => {
		topiclist += "<option value='"+element+"'>"+element+"</option>"
	});
	selectionbox.innerHTML = topiclist

	if(topic == "")
		topic = selectionbox.value;
	else{
		if(result.includes(topic)){
			selectionbox.value = topic;
		}else{
			topiclist += "<option value='"+topic+"'>"+topic+"</option>"
			selectionbox.innerHTML = topiclist
			selectionbox.value = topic;
		}
	}
	connect();
}

selectionbox.addEventListener("change", (event) => {
	topic = selectionbox.value;
	markers = {};
	connect();
});

selectionbox.addEventListener("click", (event) => {
	connect();
});

icon.addEventListener("click", (event) => {
	loadTopics();
});

loadTopics();

function resizeScreen(){
	canvas.height = window.innerHeight;
	canvas.width = window.innerWidth;
	drawMarkers();
}

window.addEventListener("tf_changed", drawMarkers);
window.addEventListener("view_changed", drawMarkers);
window.addEventListener('resize', resizeScreen);
window.addEventListener('orientationchange', resizeScreen);

resizeScreen();

console.log("MarkerArray Widget Loaded {uniqueID}")

