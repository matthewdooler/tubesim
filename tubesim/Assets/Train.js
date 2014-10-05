#pragma strict

class Train extends MonoBehaviour {

    var stations : Hashtable;
    var fromStation : Station;
    var toStation : Station;
    var track : Track;
    var currentTrackGuidepoint : int;
    var ultimateDestination : Station;
    var line : String;
    var speed : float;
    var rotSpeed : float;
    var heightAboveTrack : float;

    function Start () {
        currentTrackGuidepoint = 0;
        speed = 10.0;
        rotSpeed = 1.0; // TODO: slow this down when we have real platforms
        heightAboveTrack = 1.7;

        transform.localScale = Vector3(2.6, 3.0, 17);//3,0.5,17
        transform.position = getCurrentTrackGuidepoint();
        renderer.material.color = Color32(50,50,50,0);
        transform.LookAt(getNextTrackGuidepoint());
    }

    function Update () {
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
        return normaliseTrackPointHeight(track.meshpoints[currentTrackGuidepoint]);
    }

    function getNextTrackGuidepoint() : Vector3 {
        if(currentTrackGuidepoint+1 < track.meshpoints.length) {
            // Return the next guidepoint in this track
            return normaliseTrackPointHeight(track.meshpoints[currentTrackGuidepoint+1]);
        } else {
            // This track doesn't have any more guidepoints, so move to the next track
            // TODO: this can sometimes take input from the player
            fromStation = toStation;
            track = getNextTrack();
            toStation = stations[track.to];
            currentTrackGuidepoint = 0;
            //talk();
            return getNextTrackGuidepoint();
        }
    }

    // Create a copy of the point, adjusted for the required height of the train above the track
    function normaliseTrackPointHeight(p : Vector3) : Vector3 {
        return new Vector3(p.x, p.y+heightAboveTrack, p.z);
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

    function talk() {

        // Make the train talk
        // This is -
        var asrc : AudioSource = gameObject.AddComponent("AudioSource") as AudioSource;
        var aclip : AudioClip = Resources.Load("Sound/announcements/misc/this_is") as AudioClip;
        asrc.clip = aclip;
        asrc.Play();
        yield WaitForSeconds(aclip.length);
        
        aclip = Resources.Load("Sound/announcements/stations/"+fromStation.atcocode) as AudioClip;
        asrc.clip = aclip;
        asrc.Play();
        yield WaitForSeconds(aclip.length);
        yield WaitForSeconds(aclip.length);
        
        // This is a {line} line train to -
        aclip = Resources.Load("Sound/announcements/lines/"+line) as AudioClip;
        asrc.clip = aclip;
        asrc.Play();
        yield WaitForSeconds(aclip.length);
        
        aclip = Resources.Load("Sound/announcements/stations/"+ultimateDestination.atcocode) as AudioClip;
        asrc.clip = aclip;
        asrc.Play();
        yield WaitForSeconds(aclip.length);
        yield WaitForSeconds(aclip.length);
        
        // The next station is -
        aclip = Resources.Load("Sound/announcements/misc/the_next_station_is") as AudioClip;
        asrc.clip = aclip;
        asrc.Play();
        yield WaitForSeconds(aclip.length);
        
        aclip = Resources.Load("Sound/announcements/stations/"+toStation.atcocode) as AudioClip;
        asrc.clip = aclip;
        asrc.Play();
        yield WaitForSeconds(aclip.length);
    }
}