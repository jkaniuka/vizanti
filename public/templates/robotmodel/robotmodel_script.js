import { view } from '/js/modules/view.js';
import { tf } from '/js/modules/tf.js';
import { settings } from '/js/modules/persistent.js';

let models = {};

const fileListResponse = await fetch('/assets/robot_model/files');
const fileList = await fileListResponse.json();
fileList.map(file => {
	const name = file.split('.png')[0].split("_")[1];
	models[name] = new Image();
	models[name].src = "assets/robot_model/"+file.substring(1);
});

const canvas = document.getElementById('{uniqueID}_canvas');
const ctx = canvas.getContext('2d');

const icon = document.getElementById("{uniqueID}_icon").getElementsByTagName('img')[0];
const frameSelector = document.getElementById("{uniqueID}_frame");
const spriteSelector = document.getElementById("{uniqueID}_sprite");
const lengthSelector = document.getElementById("{uniqueID}_length");
const previewImg = document.getElementById("{uniqueID}_previewimg");

let frame = "base_link";
let sprite = "4wd";

if(settings.hasOwnProperty("{uniqueID}")){
	const loaded_data  = settings["{uniqueID}"];
	frame = loaded_data.frame;
	lengthSelector.value = loaded_data.length;

	sprite = loaded_data.sprite;
	spriteSelector.value = sprite;
	previewImg.src = models[sprite].src;
}

function saveSettings(){
	settings["{uniqueID}"] = {
		frame: frame,
		sprite: sprite,
		length: lengthSelector.value
	}
	settings.save();
}

function drawRobot() {

	const unit = view.getMapUnitsInPixels(lengthSelector.value);

    const wid = canvas.width;
    const hei = canvas.height;

    ctx.clearRect(0, 0, wid, hei);

	const robotframe = tf.absoluteTransforms[frame];
	const modelimg = models[sprite];

	if(robotframe){
		let pos = view.fixedToScreen({
			x: robotframe.translation.x,
			y: robotframe.translation.y,
		});
	
		let yaw = robotframe.rotation.toEuler().h;

		let ratio = modelimg.naturalHeight/modelimg.naturalWidth;

		ctx.save();
		ctx.translate(pos.x, pos.y);
		ctx.scale(1.0, 1.0);
		ctx.rotate(Math.PI-yaw);
		ctx.drawImage(modelimg, -unit/2, -(unit*ratio)/2, unit, unit*ratio);
		ctx.restore();
	}

}

function resizeScreen(){
	canvas.height = window.innerHeight;
	canvas.width = window.innerWidth;
	drawRobot();
}

window.addEventListener("tf_changed", drawRobot);
window.addEventListener("view_changed", drawRobot);
window.addEventListener('resize', resizeScreen);
window.addEventListener('orientationchange', resizeScreen);

// TF frame list
function setFrameList(){

	let framelist = "";
	for (const key of tf.frame_list.values()) {
		framelist += "<option value='"+key+"'>"+key+"</option>"
	}
	frameSelector.innerHTML = framelist;

	if(tf.transforms.hasOwnProperty(frame)){
		frameSelector.value = frame;
	}else{
		framelist += "<option value='"+frame+"'>"+frame+"</option>"
		frameSelector.innerHTML = framelist
		frameSelector.value = frame;
	}

	let spritelist = "";
	for (const [key, value] of Object.entries(models)) {
		spritelist += "<option value='"+key+"'>"+key+"</option>"
	}

	spriteSelector.innerHTML = spritelist;
	spriteSelector.value = sprite;
}

frameSelector.addEventListener("change", (event) => {
	frame = frameSelector.value;
	saveSettings();
});

spriteSelector.addEventListener("change", (event) => {
	sprite = spriteSelector.value;
	previewImg.src = models[sprite].src;
	saveSettings();
});

lengthSelector.addEventListener("input", saveSettings);

frameSelector.addEventListener("click", setFrameList);
icon.addEventListener("click", setFrameList);



frameSelector.addEventListener("change", (event) =>{
	frame = frameSelector.value;
	drawRobot();
	saveSettings();
});

resizeScreen();


console.log("Model Widget Loaded {uniqueID}")