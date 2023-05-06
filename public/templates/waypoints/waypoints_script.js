import { view } from '/js/modules/view.js';
import { tf } from '/js/modules/tf.js';
import { rosbridge } from '/js/modules/rosbridge.js';
import { settings } from '/js/modules/persistent.js';

let topic = "/waypoints"
let seq = 0;
let active = false;
let points = [];

if(settings.hasOwnProperty("{uniqueID}")){
	const loaded_data  = settings["{uniqueID}"];
	topic = loaded_data.topic;
	points = loaded_data.points;
}

function saveSettings(){
	settings["{uniqueID}"] = {
		topic: topic,
		points: points
	}
	settings.save();
}

function getStamp(){
	const currentTime = new Date();
	const currentTimeSecs = Math.floor(currentTime.getTime() / 1000);
	const currentTimeNsecs = (currentTime.getTime() % 1000) * 1e6;

	return {
		secs: currentTimeSecs,
		nsecs: currentTimeNsecs
	}
}

function sendMessage(pointlist){
	let timeStamp = getStamp();
	let poseList = [];

	console.log(pointlist)

	if(pointlist.length > 0)
	{
		if(pointlist.length  == 1){
			poseList.push(new ROSLIB.Message({
				header: {
					seq: index,
					stamp: timeStamp,
					frame_id: tf.fixed_frame
				},
				pose: {
					position: {
						x: poseList[0].x,
						y: poseList[0].y,
						z: 0.0
					},
					orientation: new Quaternion()
				}
			}));
		}
		else
		{
			pointlist.forEach((point, index) => {
				let p0;
				let p1;

				if(index < pointlist.length-1){
					p0 = point;
					p1 = pointlist[index+1];
				}else{
					p0 = pointlist[index-1];
					p1 = point;
				}

				poseList.push(new ROSLIB.Message({
					header: {
						seq: index,
						stamp: timeStamp,
						frame_id: tf.fixed_frame
					},
					pose: {
						position: {
							x: point.x,
							y: point.y,
							z: 0.0
						},
						orientation: Quaternion.fromEuler(Math.atan2(p0.y - p1.y, -(p0.x - p1.x)), 0, 0, 'ZXY')
					}
				}));
			});
		}
	}

	const publisher = new ROSLIB.Topic({
		ros: rosbridge.ros,
		name: topic,
		messageType: 'nav_msgs/Path',
		latched: true
	});

	const pathMessage = new ROSLIB.Message({
		header: {
			seq: seq++,
			stamp: timeStamp,
			frame_id: tf.fixed_frame
		},
		poses: poseList
	});
	publisher.publish(pathMessage);

}

const canvas = document.getElementById('{uniqueID}_canvas');
const ctx = canvas.getContext('2d');

const view_container = document.getElementById("view_container");

const icon = document.getElementById("{uniqueID}_icon");
const iconImg = icon.getElementsByTagName('img')[0];

const startButton = document.getElementById("{uniqueID}_start");
const stopButton = document.getElementById("{uniqueID}_stop");

startButton.addEventListener('click', ()=>{sendMessage(points)});
stopButton.addEventListener('click', ()=>{sendMessage([])});

function drawWaypoints() {

    const wid = canvas.width;
    const hei = canvas.height;

    ctx.clearRect(0, 0, wid, hei);
	ctx.lineWidth = 3;
	ctx.strokeStyle = "#EBCE00"; 
	ctx.fillStyle = active ? "white" : "#EBCE00";

	const viewPoints = points.map((point) =>
		view.mapToScreen(point)
	);

	ctx.beginPath();
	viewPoints.forEach((pos, index) => {
		if (index === 0) {
			ctx.moveTo(pos.x, pos.y);
		} else {
			ctx.lineTo(pos.x, pos.y);
		}
	});
	ctx.stroke();

	viewPoints.forEach((pos) => {		
		ctx.save();
		ctx.translate(pos.x, pos.y);

		ctx.beginPath();
		ctx.arc(0, 0, 9, 0, 2 * Math.PI, false);
		ctx.fill();
		ctx.restore();
	});

	ctx.font = "bold 13px Monospace";
	ctx.textAlign = "center";
	ctx.fillStyle = "#212E4A";

	viewPoints.forEach((pos, index) => {
		ctx.fillText(index, pos.x, pos.y+5);
	});
}

let start_point = undefined;
let delta = undefined;
let drag_point = -1;

function findPoint(newpoint){
	let i = -1;
	points.forEach((point, index) => {
		const screenpoint = view.mapToScreen(point);
		const dist = Math.hypot(
			screenpoint.x - newpoint.x,
			screenpoint.y - newpoint.y,
		)
		if(dist < 15){
			i = index;
		}
	});
	return i;
}

function startDrag(event){
	const { clientX, clientY } = event.touches ? event.touches[0] : event;
	start_point = {
		x: clientX,
		y: clientY
	};

	drag_point = findPoint(start_point);
	if(drag_point >= 0){
		view.setInputMovementEnabled(false);
	}
}

function drag(event){
	const { clientX, clientY } = event.touches ? event.touches[0] : event;
	if(drag_point >= 0){
		points[drag_point] = view.screenToMap({
			x: clientX,
			y: clientY
		})
	}

	if (start_point === undefined) 
		return;

	delta = {
		x: start_point.x - clientX,
		y: start_point.y - clientY,
	};
}

function distancePointToLineSegment(px, py, x1, y1, x2, y2) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lengthSquared = dx * dx + dy * dy;

	let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
	t = Math.max(0, Math.min(1, t));

	const closestX = x1 + t * dx;
	const closestY = y1 + t * dy;

	const distanceSquared = (px - closestX) * (px - closestX) + (py - closestY) * (py - closestY);

	return Math.sqrt(distanceSquared);
}

function endDrag(event){

	if(drag_point >= 0){
		view.setInputMovementEnabled(true);
		drag_point = -1;
	}

	let moveDist = 0;

	if(delta !== undefined){
		moveDist = Math.hypot(delta.x,delta.y);
	}

	if(moveDist < 10){

		const { clientX, clientY } = event.touches ? event.touches[0] : event;
		const newpoint = {
			x: clientX,
			y: clientY
		};

		let index = findPoint(newpoint);

		if(index >= 0)
			points.splice(index, 1);
		else
		{
			let after = -1;
			for (let i = 0; i < points.length - 1; i++) {
				const p0 = view.mapToScreen(points[i]);
				const p1 = view.mapToScreen(points[i+1]);

				const distance = distancePointToLineSegment(
					newpoint.x, newpoint.y,
					p0.x, p0.y,
					p1.x, p1.y
				);

				if (distance <= 10) {
					after = i+1;
					break;
				}
			}
		
			if(after > 0){
				points.splice(after, 0, view.screenToMap(newpoint));
			}else{
				points.push(view.screenToMap(newpoint));
			}

			
		}

		saveSettings();
	}

	drawWaypoints();

	start_point = undefined;
	delta = undefined;
}

function resizeScreen(){
	canvas.height = window.innerHeight;
	canvas.width = window.innerWidth;
	drawWaypoints();
}

window.addEventListener('resize', resizeScreen);
window.addEventListener('orientationchange', resizeScreen);
window.addEventListener("tf_changed", drawWaypoints);
window.addEventListener("view_changed", drawWaypoints);

function addListeners(){
	view_container.addEventListener('mousedown', startDrag);
	view_container.addEventListener('mousemove', drag);
	view_container.addEventListener('mouseup', endDrag);

	view_container.addEventListener('touchstart', startDrag);
	view_container.addEventListener('touchmove', drag);
	view_container.addEventListener('touchend', endDrag);	
}

function removeListeners(){
	view_container.removeEventListener('mousedown', startDrag);
	view_container.removeEventListener('mousemove', drag);
	view_container.removeEventListener('mouseup', endDrag);

	view_container.removeEventListener('touchstart', startDrag);
	view_container.removeEventListener('touchmove', drag);
	view_container.removeEventListener('touchend', endDrag);	
}

function setActive(value){
	active = value;

	if(active){
		addListeners();
		icon.style.backgroundColor = "rgba(255, 255, 255, 1.0)";
		view_container.style.cursor = "pointer";
	}else{
		removeListeners()
		icon.style.backgroundColor = "rgba(124, 124, 124, 0.3)";
		view_container.style.cursor = "";
	}
}

// Topics

const selectionbox = document.getElementById("{uniqueID}_topic");

async function loadTopics(){
	let result = await rosbridge.get_topics("nav_msgs/Path");

	let topiclist = "";
	result.forEach(element => {
		topiclist += "<option value='"+element+"'>"+element+"</option>"
	});
	selectionbox.innerHTML = topiclist

	if(result.includes(topic)){
		selectionbox.value = topic;
	}else{
		topiclist += "<option value='"+topic+"'>"+topic+"</option>"
		selectionbox.innerHTML = topiclist
		selectionbox.value = topic;
	}
}

selectionbox.addEventListener("change", (event) => {
	topic = selectionbox.value;
	saveSettings();
});

loadTopics();

// Long press modal open stuff

let longPressTimer;
let isLongPress = false;

icon.addEventListener("click", (event) =>{
	if(!isLongPress)
		setActive(!active);
	else
		isLongPress = false;
});

icon.addEventListener("mousedown", startLongPress);
icon.addEventListener("touchstart", startLongPress);

icon.addEventListener("mouseup", cancelLongPress);
icon.addEventListener("mouseleave", cancelLongPress);
icon.addEventListener("touchend", cancelLongPress);
icon.addEventListener("touchcancel", cancelLongPress);

icon.addEventListener("contextmenu", (event) => {
	event.preventDefault();
});

function startLongPress(event) {
	isLongPress = false;
	longPressTimer = setTimeout(() => {
		isLongPress = true;
		loadTopics();
		openModal("{uniqueID}_modal");
	}, 500);
}

function cancelLongPress(event) {
	clearTimeout(longPressTimer);
}

resizeScreen();

console.log("Waypoints Widget Loaded {uniqueID}")