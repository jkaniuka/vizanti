import { view } from '/js/modules/view.js';
import { tf } from '/js/modules/tf.js';
import { rosbridge } from '/js/modules/rosbridge.js';
import { settings } from '/js/modules/persistent.js';

let topic = getTopic("{uniqueID}");
let listener = undefined;
let poses_topic = undefined;

let poses = [];
let frame = "";

const scaleSlider = document.getElementById('{uniqueID}_scale');
const scaleSliderValue = document.getElementById('{uniqueID}_scale_value');

scaleSlider.addEventListener('input', function () {
	scaleSliderValue.textContent = this.value;
});

scaleSlider.addEventListener('change', saveSettings);

const selectionbox = document.getElementById("{uniqueID}_topic");
const icon = document.getElementById("{uniqueID}_icon").getElementsByTagName('img')[0];

const canvas = document.getElementById('{uniqueID}_canvas');
const ctx = canvas.getContext('2d');

//Settings
if(settings.hasOwnProperty("{uniqueID}")){
	const loaded_data  = settings["{uniqueID}"];
	topic = loaded_data.topic;

	scaleSlider.value = loaded_data.scale;
	scaleSliderValue.textContent = scaleSlider.value;
}

function saveSettings(){
	settings["{uniqueID}"] = {
		topic: topic,
		scale: parseFloat(scaleSlider.value)
	}
	settings.save();
}

//Rendering

function drawArrows(){

	function drawArrow(size){
		const height = parseInt(size*0.5);
		const width = parseInt(size*0.01)+1;
		const tip = parseInt(size*0.07)+1;
		const tipwidth = parseInt(size*0.07)+1;

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

	const unit = view.getMapUnitsInPixels(1.0);

	const wid = canvas.width;
    const hei = canvas.height;

	const scale = unit*parseFloat(scaleSlider.value);

	ctx.clearRect(0, 0, wid, hei);
	ctx.fillStyle = "darkred";

	if(frame === tf.fixed_frame){
		poses.forEach((p) => {

			const screenpos = view.fixedToScreen(p);

			ctx.save();
			ctx.translate(screenpos.x, screenpos.y);
			ctx.scale(1, -1);
			ctx.rotate(p.yaw);

			drawArrow(scale);

			ctx.restore();
		});
	}
}

//Topic
function connect(){

	if(topic == "")
		return;

	if(poses_topic !== undefined){
		poses_topic.unsubscribe(listener);
	}

	poses_topic = new ROSLIB.Topic({
		ros : rosbridge.ros,
		name : topic,
		messageType : 'geometry_msgs/PoseArray',
		throttle_rate: 50
	});
	
	listener = poses_topic.subscribe((msg) => {

		if(!tf.absoluteTransforms[msg.header.frame_id])
			return;

		poses = [];
		frame = tf.fixed_frame;

		msg.poses.forEach(p => {
			const transformed = tf.transformPose(
				msg.header.frame_id, 
				tf.fixed_frame, 
				p.position, 
				p.orientation
			);

			poses.push({
				x: transformed.translation.x,
				y: transformed.translation.y,
				yaw: transformed.rotation.toEuler().h
			});
		});
		drawArrows();
	});

	saveSettings();
}

async function loadTopics(){
	let result = await rosbridge.get_topics("geometry_msgs/PoseArray");

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
	drawArrows();
}

window.addEventListener("tf_changed", drawArrows);
window.addEventListener("view_changed", drawArrows);
window.addEventListener('resize', resizeScreen);
window.addEventListener('orientationchange', resizeScreen);

resizeScreen();

console.log("PoseArray Widget Loaded {uniqueID}")

