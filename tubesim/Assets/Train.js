#pragma strict

var stations : Hashtable;
var fromStation : Station;
var toStation : Station;
var track : Track;
var currentTrackGuidepoint : int;
var ultimateDestination : Station;
var line : String;
var speed : float;
var rotSpeed : float;

function Start () {
    currentTrackGuidepoint = 0;
    speed = 10.0;
    rotSpeed = 1.0; // TODO: slow this down when we have real tracks

    transform.localScale = Vector3(3, 8, 17);//3,0.5,17
    transform.position = getCurrentTrackGuidepoint();
    renderer.material.color = Color32(50,50,50,0);
    transform.LookAt(getNextTrackGuidepoint());
}

function Update () {
    var x = transform.position.x;
    var y = transform.position.y;
    var z = transform.position.z;

    var guidepoint : Vector3 = getNextTrackGuidepoint();
    
    var rotStep = rotSpeed * Time.deltaTime;
    var targetDir = guidepoint - transform.position;
    var newDir = Vector3.RotateTowards(transform.forward, targetDir, rotStep, 0.0);
    transform.rotation = Quaternion.LookRotation(newDir);

    var step = speed * Time.deltaTime;
    transform.position = Vector3.MoveTowards(transform.position, guidepoint, step);
    tryAdvanceToNextTrackGuidepoint();
}

function getCurrentTrackGuidepoint() : Vector3 {
    return track.meshpoints[currentTrackGuidepoint];
}

function getNextTrackGuidepoint() : Vector3 {
    if(currentTrackGuidepoint+1 < track.meshpoints.length) {
        // Return the next guidepoint in this track
        return track.meshpoints[currentTrackGuidepoint+1];
    } else {
        // This track doesn't have any more guidepoints, so move to the next track
        // TODO: this can sometimes take input from the player
        fromStation = toStation;
        track = getNextTrack();
        toStation = stations[track.to];
        currentTrackGuidepoint = 0;
        return getNextTrackGuidepoint();
    }
}

function getNextTrack() : Track {
    // TODO: take better guesses - maybe read the route lists so we don't repeat all that horrible route traversal logic
    return fromStation.outboundTracks[Random.Range(0, fromStation.outboundTracks.length)];
}

function tryAdvanceToNextTrackGuidepoint() {
    if(transform.position == getNextTrackGuidepoint()) {
        currentTrackGuidepoint = Mathf.Min(track.meshpoints.length-1, currentTrackGuidepoint+1);
    }
}