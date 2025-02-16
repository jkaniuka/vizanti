import { view } from '/js/modules/view.js';
import { tf } from '/js/modules/tf.js';
import { rosbridge } from '/js/modules/rosbridge.js';
import { settings } from '/js/modules/persistent.js';

async function saveMap(save_path, topic) {
	const saveMapService = new ROSLIB.Service({
		ros: rosbridge.ros,
		name: "/vizanti/save_map",
		serviceType: "vizanti/SaveMap",
	});

	const request = new ROSLIB.ServiceRequest({
		file_path: save_path,
		topic: topic
	});

	return new Promise((resolve, reject) => {
		saveMapService.callService(request, (result) => {
			resolve(result);
		}, (error) => {
			reject(error);
		});
	});
}

async function loadMap(load_path, topic) {
	const loadMapService = new ROSLIB.Service({
		ros: rosbridge.ros,
		name: "/vizanti/load_map",
		serviceType: "vizanti/LoadMap",
	});

	const request = new ROSLIB.ServiceRequest({
		file_path: load_path,
		topic: topic,
	});

	return new Promise((resolve, reject) => {
		loadMapService.callService(request, (result) => {
			resolve(result);
		}, (error) => {
			reject(error);
		});
	});
}

let topic = getTopic("{uniqueID}");
let listener = undefined;

let map_topic = undefined;
let map_data = undefined;
let map_canvas = undefined;

const selectionbox = document.getElementById("{uniqueID}_topic");
const icon = document.getElementById("{uniqueID}_icon").getElementsByTagName('img')[0];

const opacitySlider = document.getElementById('{uniqueID}_opacity');
const opacityValue = document.getElementById('{uniqueID}_opacity_value');

const loadPathBox = document.getElementById("{uniqueID}_loadpath");
const loadTopicBox = document.getElementById("{uniqueID}_loadtopic");
const savePathBox = document.getElementById("{uniqueID}_savepath");
const loadButton = document.getElementById('{uniqueID}_load');
const saveButton = document.getElementById('{uniqueID}_save');

loadButton.addEventListener('click',  async () => {
	let path = loadPathBox.value;

	if (path.endsWith(".pgm")) {
		path = path.slice(0, -4) + ".yaml";
	} else if (!path.endsWith(".yaml")) {
		path += ".yaml";
	}

	loadPathBox.value = path;

	try {
		const result = await loadMap(path, loadTopicBox.value);
		alert(result.message);
	} catch (error) {
		alert(error);
	}
});

saveButton.addEventListener('click', async () => {
	let path = savePathBox.value;

	if (path.endsWith(".pgm")) {
		path = path.slice(0, -4);
	} else if (path.endsWith(".yaml")) {
		path = path.slice(0, -5);
	}

	savePathBox.value = path;

	try {
		const result = await saveMap(path, topic);
		alert(result.message);
	} catch (error) {
		alert(error);
	}
});

opacitySlider.addEventListener('input', () =>  {
	opacityValue.textContent = this.value;
	saveSettings();
});

const canvas = document.getElementById('{uniqueID}_canvas');
const ctx = canvas.getContext('2d');

//Settings

if(settings.hasOwnProperty("{uniqueID}")){
	const loaded_data  = settings["{uniqueID}"];
	topic = loaded_data.topic;

	opacitySlider.value = loaded_data.opacity;
	opacityValue.innerText = loaded_data.opacity;
}

function saveSettings(){
	settings["{uniqueID}"] = {
		topic: topic,
		opacity: opacitySlider.value
	}
	settings.save();
}

//Rendering

function drawMap(){
	const wid = canvas.width;
    const hei = canvas.height;

	ctx.clearRect(0, 0, wid, hei);
	ctx.imageSmoothingEnabled = false;

	if(!map_canvas)
		return;

	const map_width = view.getMapUnitsInPixels(
		map_canvas.width * map_data.info.resolution
	);

	const map_height = view.getMapUnitsInPixels(
		map_canvas.height * map_data.info.resolution
	);

	const frame = tf.absoluteTransforms[map_data.header.frame_id];

	if(frame){

		let transformed = tf.transformPose(
			map_data.header.frame_id,
			tf.fixed_frame,
			map_data.info.origin.position,
			map_data.info.origin.orientation
		);

		const pos = view.fixedToScreen({
			x: transformed.translation.x,
			y: transformed.translation.y,
		});
	
		const yaw = transformed.rotation.toEuler().h;

		ctx.save();
		ctx.globalAlpha = opacitySlider.value;
		ctx.translate(pos.x, pos.y);
		ctx.scale(1.0, -1.0);
		ctx.rotate(yaw);
		ctx.drawImage(map_canvas, 0, 0, map_width, map_height);
		ctx.restore();
	}
}

//Topic

function connect(){

	if(topic == "")
		return;

	if(map_topic !== undefined){
		map_topic.unsubscribe(listener);
	}

	map_topic = new ROSLIB.Topic({
		ros : rosbridge.ros,
		name : topic,
		messageType : 'nav_msgs/OccupancyGrid',
		throttle_rate: 2000 // throttle to once every two seconds max
	});
	
	listener = map_topic.subscribe((msg) => {

		map_data = msg;
		map_canvas = document.createElement('canvas');

		const mapctx = map_canvas.getContext('2d');

		const width = msg.info.width;
		const height = msg.info.height;
		const data = msg.data;
	  
		map_canvas.width = width;
		map_canvas.height = height;
	  
		let map_img = mapctx.createImageData(width, height);
	  
		// 3. Iterate through the data array and set the canvas pixel colors
		for (let i = 0; i < data.length; i++) {
			let occupancyValue = data[i];
			let color = 255; // White for unknown

			if(occupancyValue < 0)
				occupancyValue = 50;

			if (occupancyValue >= 0 && occupancyValue <= 100) {
				color = 255 - (occupancyValue * 255) / 100; // Grayscale for occupancy probability
			}

			map_img.data[i * 4] = color; // R
			map_img.data[i * 4 + 1] = color; // G
			map_img.data[i * 4 + 2] = color; // B
			map_img.data[i * 4 + 3] = 255; // A
		}

		mapctx.putImageData(map_img, 0, 0);

		drawMap();
	});

	saveSettings();
}

async function loadTopics(){
	let result = await rosbridge.get_topics("nav_msgs/OccupancyGrid");

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
	map_data = undefined;
	map_canvas = undefined;
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
	drawMap();
}

window.addEventListener("tf_changed", drawMap);
window.addEventListener("view_changed", drawMap);
window.addEventListener('resize', resizeScreen);
window.addEventListener('orientationchange', resizeScreen);

resizeScreen();

console.log("Map Widget Loaded {uniqueID}")