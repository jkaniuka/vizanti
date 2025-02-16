import { rosbridge } from '/js/modules/rosbridge.js';
import { settings } from '/js/modules/persistent.js';

let topic = getTopic("{uniqueID}");
let typedict = {};

const selectionbox = document.getElementById("{uniqueID}_topic");
const icondiv = document.getElementById("{uniqueID}_icon");
const icon = icondiv.getElementsByTagName('img')[0];
const icontext = icondiv.getElementsByTagName('p')[0];
const namebox = document.getElementById("{uniqueID}_name");

namebox.addEventListener('input', function() {
	icontext.textContent = namebox.value;
	saveSettings();
});

//Settings

if(settings.hasOwnProperty("{uniqueID}")){
	const loaded_data  = settings["{uniqueID}"];
	topic = loaded_data.topic;
	namebox.value = loaded_data.text;
	icontext.textContent = loaded_data.text;
	typedict = loaded_data.typedict;
}

function saveSettings(){
	settings["{uniqueID}"] = {
		topic: topic,
		text: namebox.value,
		typedict: typedict
	}
	settings.save();
}

//Messaging

function sendMessage(){
	const publisher = new ROSLIB.Topic({
		ros: rosbridge.ros,
		name: topic,
		messageType: typedict[topic],
	});

	if(typedict[topic] == "std_msgs/Bool"){
		publisher.publish(new ROSLIB.Message({
			data: !value,
		}));
	}else{
		publisher.publish(new ROSLIB.Message({}));
	}

}

let value = false;
let listener = undefined;
let booltopic = undefined;

function connect(){

	if(topic == "")
		return;

	if(booltopic !== undefined){
		booltopic.unsubscribe(listener);
	}

	if(typedict[topic] == "std_msgs/Bool"){

		booltopic = new ROSLIB.Topic({
			ros : rosbridge.ros,
			name : topic,
			messageType : "std_msgs/Bool"
		});	
		
		listener = booltopic.subscribe((msg) => {
			value = msg.data;
			icon.src = "assets/button_"+value+".svg";
		});

		icon.src = "assets/button_false.svg";
	}
	else{
		icon.src = "assets/button.svg";
	}

	

	saveSettings();
}

async function loadTopics(){
	let booltopics = await rosbridge.get_topics("std_msgs/Bool");
	let triggertopics = await rosbridge.get_topics("std_msgs/Empty");
	let topiclist = "";
	booltopics.forEach(element => {
		topiclist += "<option value='"+element+"'>"+element+" (Bool)</option>"
		typedict[element] = "std_msgs/Bool";
	});
	triggertopics.forEach(element => {
		topiclist += "<option value='"+element+"'>"+element+" (Empty)</option>"
		typedict[element] = "std_msgs/Empty";
	});
	selectionbox.innerHTML = topiclist

	if(topic == "")
		topic = selectionbox.value;
	else{
		if(booltopics.includes(topic) || triggertopics.includes(topic)){
			selectionbox.value = topic;
		}else{
			topiclist += "<option value='"+topic+"'>"+topic+"</option>"
			selectionbox.innerHTML = topiclist
			selectionbox.value = topic;
		}
	}
}

selectionbox.addEventListener("change", (event) => {
	topic = selectionbox.value;
	icon.src = "assets/button.svg";
	connect();
});

selectionbox.addEventListener("click", connect);
icon.addEventListener("click", loadTopics);

loadTopics();
connect();

// Long press modal open stuff
let longPressTimer;
let isLongPress = false;

icondiv.addEventListener("click", (event) =>{
	if(!isLongPress){
		sendMessage();
	}else{
		isLongPress = false;
	}
});

icondiv.addEventListener("mousedown", startLongPress);
icondiv.addEventListener("touchstart", startLongPress);

icondiv.addEventListener("mouseup", cancelLongPress);
icondiv.addEventListener("mouseleave", cancelLongPress);
icondiv.addEventListener("touchend", cancelLongPress);
icondiv.addEventListener("touchcancel", cancelLongPress);

icondiv.addEventListener("contextmenu", (event) => {
	event.preventDefault();
});

function startLongPress(event) {
	isLongPress = false;
	longPressTimer = setTimeout(() => {
		isLongPress = true;
		loadTopics();
		connect();
		openModal("{uniqueID}_modal");
	}, 500);
}

function cancelLongPress(event) {
	clearTimeout(longPressTimer);
}

console.log("Button Widget Loaded {uniqueID}")