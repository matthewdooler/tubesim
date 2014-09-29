import SimpleJSON;
import System.IO;

var character : GameObject;
var trainObject : GameObject;

function Start () {

	character = GameObject.Find("Character");

    var sr = new StreamReader(Application.dataPath + "/stations-linked-unique.json");
    var fileContents = sr.ReadToEnd();
    sr.Close();
    var stations : SimpleJSON.JSONNode = JSON.Parse(fileContents);

    trainObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
    trainObject.transform.position = Vector3(0, 2, 0);
    trainObject.transform.localScale = Vector3(3, 0.5, 17);
    trainObject.renderer.material.color = Color32(50,50,50,0);
    
    var material = new PhysicMaterial();
	material.dynamicFriction = 1;
	material.staticFriction = 1;
	trainObject.collider.material = material;
    
    var train : Train = trainObject.AddComponent(Train);
    train.fromStation = getStation(stations, "9400ZZLUTCR"); // Tottenham Court Road
    train.toStation = getStation(stations, "9400ZZLUHBN"); // Holborn
    train.ultimateDestination = getStation(stations, "9400ZZLULVT"); // Liverpool Street
    train.line = "central";
    
    // Add stations
    for(var station : Object in stations) {
    	var stationName : String = station["name"].Value;
    	var stationPos : Vector3 = getStationPos(station);

    	var stationObject : GameObject = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
    	stationObject.transform.position = stationPos;
    	stationObject.transform.localScale = Vector3(2, 2, 2);
    	stationObject.renderer.material.color = Color.gray;
    	
    	// Add links to destination stations
    	for(var link : Object in station["outboundLinks"]) {
    		
    		var dstStation : Object = getStation(stations, link["to"].Value);
    		if(dstStation != null) {

                var dstStationPos : Vector3 = getStationPos(dstStation);
                var distance = Vector3.Distance(stationPos, dstStationPos);
                var line : String = link["line"].Value;
	            var size : Vector2 = getLineCrossSectionSize(line);
	    		
	    	    var linkObject : GameObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
	    	    linkObject.transform.position = Vector3.Lerp(stationPos, dstStationPos, 0.5);
	    	    linkObject.transform.localScale = Vector3(size.x, size.y, distance);
	    		linkObject.transform.LookAt(dstStationPos);
	    		linkObject.renderer.material.color = getLineColor(line);

	    	} else {
	    		print ("WARNING: Could not find station with ATCO code "+link["to"].Value);
	    	}
    	}

    }
    
    // Make the train talk
    // This is -
    var asrc : AudioSource = trainObject.AddComponent("AudioSource") as AudioSource;
    var aclip : AudioClip = Resources.Load("Sound/announcements/misc/this_is") as AudioClip;
    asrc.clip = aclip;
	asrc.Play();
	yield WaitForSeconds(aclip.length);
	
	aclip = Resources.Load("Sound/announcements/stations/"+train.fromStation["atcocode"].Value) as AudioClip;
    asrc.clip = aclip;
	asrc.Play();
	yield WaitForSeconds(aclip.length);
	yield WaitForSeconds(aclip.length);
	
	// This is a {line} line train to -
	aclip = Resources.Load("Sound/announcements/lines/"+train.line) as AudioClip;
    asrc.clip = aclip;
	asrc.Play();
	yield WaitForSeconds(aclip.length);
	
	aclip = Resources.Load("Sound/announcements/stations/"+train.ultimateDestination["atcocode"].Value) as AudioClip;
    asrc.clip = aclip;
	asrc.Play();
	yield WaitForSeconds(aclip.length);
	yield WaitForSeconds(aclip.length);
	
	// The next station is -
    aclip = Resources.Load("Sound/announcements/misc/the_next_station_is") as AudioClip;
    asrc.clip = aclip;
	asrc.Play();
	yield WaitForSeconds(aclip.length);
	
	aclip = Resources.Load("Sound/announcements/stations/"+train.toStation["atcocode"].Value) as AudioClip;
    asrc.clip = aclip;
	asrc.Play();
	yield WaitForSeconds(aclip.length);
    
    
}

function Update () {
	var x = trainObject.transform.position.x;
	var y = trainObject.transform.position.y;
	var z = trainObject.transform.position.z;
	trainObject.transform.position = Vector3(x+0.02, y, z);
}

function getStation(stations : SimpleJSON.JSONNode, atcoCode : String) : Object {
	for(var station : Object in stations) {
		var tmpAtcoCode : String = station["atcocode"].Value;
		if(tmpAtcoCode == atcoCode) {
			return station;
		}
	}
	return null;
}

function getStationPos(station : Object) : Vector3 {
	var x : int = (station["location"]["easting"].AsInt - 529744)/20;
   	var z : int = (station["location"]["northing"].AsInt - 181375)/20;
   	return Vector3(x, 0, z);
}

function getLineColor(line : String) : Color32 {
	var lineColor : Color32;
	var a : float = 0;
	if(line == "bakerloo") {
		lineColor = Color32(137,78,36,a);
	} else if(line == "central") {
		lineColor = Color32(220,36,31,a);
	} else if(line == "circle") {
		lineColor = Color32(255,206,0,a);
	} else if(line == "district") {
		lineColor = Color32(0,114,41,a);
	} else if(line == "hammersmith") {
		lineColor = Color32(215,153,175,a);
	} else if(line == "jubilee") {
		lineColor = Color32(134,143,152,a);
	} else if(line == "metropolitan") {
		lineColor = Color32(117,16,86,a);
	} else if(line == "northern") {
		lineColor = Color32(0,0,0,a);
	} else if(line == "piccadilly") {
		lineColor = Color32(0,25,168,a);
	} else if(line == "victoria") {
		lineColor = Color32(0,160,226,a);
	} else if(line == "waterlooandcity") {
		lineColor = Color32(118,208,189,a);
	} else if(line == "dlr") {
		lineColor = Color32(0,175,173,a);
	} else {
		print ("WARNING: Unknown line");
	}
	return lineColor;
}

function getLineCrossSectionSize(line : String) : Vector2 {
	var size : Vector2;
	if(line == "bakerloo") {
		size = Vector2(0.3,2.5);
	} else if(line == "central") {
		size = Vector2(0.5,2.3);
	} else if(line == "circle") {
		size = Vector2(0.7,2.1);
	} else if(line == "district") {
		size = Vector2(0.9,1.9);
	} else if(line == "hammersmith") {
		size = Vector2(1.1,1.7);
	} else if(line == "jubilee") {
		size = Vector2(1.3,1.5);
	} else if(line == "metropolitan") {
		size = Vector2(1.5,1.3);
	} else if(line == "northern") {
		size = Vector2(1.7,1.1);
	} else if(line == "piccadilly") {
		size = Vector2(1.9,0.9);
	} else if(line == "victoria") {
		size = Vector2(2.1,0.7);
	} else if(line == "waterlooandcity") {
		size = Vector2(2.3,0.5);
	} else if(line == "dlr") {
		size = Vector2(2.5,0.3);
	} else {
		print ("WARNING: Unknown line");
	}
	return size;
}

function signedAngleBetween(a : Vector3,  b : Vector3, n : Vector3) : float {
    // angle in [0,180]
    var angle : float = Vector3.Angle(a,b);
    var sign : float = Mathf.Sign(Vector3.Dot(n,Vector3.Cross(a,b)));

    // angle in [-179,180]
    var signed_angle : float = angle * sign;

    // angle in [0,360] (not used but included here for completeness)
    var angle360 : float =  (signed_angle + 180) % 360;

    return angle360;
}

function getTrackBetween(fromStation : Object, toStation : Object, line : String) : Object {
	var track : Object = Object();
	return track;
}