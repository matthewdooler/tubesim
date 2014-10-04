import SimpleJSON;
import System.IO;

var character : GameObject;
var trainObject : GameObject;

function Start () {

    character = GameObject.Find("Character");

    // Load station data
    var stationsJson : SimpleJSON.JSONNode = readJSONFile(Application.dataPath + "/Resources/Data/stations-linked-unique.json");
    var stations : Hashtable = parseStationsJSON(stationsJson);

    trainObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
    trainObject.transform.position = Vector3(0, 2, 0);
    trainObject.transform.localScale = Vector3(3, 0.5, 17);
    trainObject.renderer.material.color = Color32(50,50,50,0);
    
    var material = new PhysicMaterial();
    material.dynamicFriction = 1;
    material.staticFriction = 1;
    trainObject.collider.material = material;
    
    var train : Train = trainObject.AddComponent(Train);
    train.fromStation = stations["9400ZZLUTCR"]; // Tottenham Court Road
    train.toStation = stations["9400ZZLUHBN"]; // Holborn
    train.ultimateDestination = stations["9400ZZLULVT"]; // Liverpool Street
    train.line = "central";

    // DLR and underground routes aren't connected so we have to do two separate traversals
    var lugStationRoutes : Array = getStationRoutes(stations, stations["9400ZZLUTCR"]); // Tottenham Court Road (LUL)
    var dlrStationRoutes : Array = getStationRoutes(stations, stations["9400ZZDLPOP"]); // Poplar (DLR)
    var stationRoutes : Array = lugStationRoutes;
    for(var route : Array in dlrStationRoutes) {
        stationRoutes.Push(route);
    }
    print ("Routes = "+stationRoutes.length);
    // TODO: a better algorithm will reduce the number of routes (currently 83)
    
    for(var route : Array in stationRoutes) {
        var routePositions : Array = new Array();
        for(var track : Track in route) {
            routePositions.Push(stations[track.from].pos);
        }
        routePositions.Push(stations[route[route.length-1].to].pos); // add position of final station on route
        //print ("Route positions (i.e., stations) = "+routePositions.length);

        var routeGuidePoints : Array = guidePointsToMeshPoints(routePositions, 0.2);
        //print ("Route guide points = "+routeGuidePoints.length);

        // Add guidepoints to track metadata
        var j : int = 0;

        for(var track : Track in route) {
            // Add all of the guidepoints to this track
            //print ("Adding guidepoints for "+station.stationName);
            for(i = 0; i < 6; i++) { // TODO: 165/33 - the distribution of guidepoints is even
                if(j < routeGuidePoints.length) {
                    var point : Vector3 = routeGuidePoints[j];
                    track.guidepoints.Push(point);
                    j++;
                } else {
                    //print ("No guidepoints left for track from "+station.stationName+" to "+stations[track.to].stationName);
                    // TODO: we're always missing the extra guidepoint on the last track in the route
                    print ("No guidepoints left for track");
                }
            }
            j--; // allow the last point to be plotted again for the next station
        }
    }
    
    //print ("Outbound tracks from "+stations["9400ZZLUNHG"].stationName+":");
    //for(var track : Track in stations["9400ZZLUNHG"].outboundTracks) {
    //    print ("  |----> " + stations[track.to].stationName + " ("+track.guidepoints.length+" guidepoints)");
    //}
    
    // Add stations
    for(var station : Station in stations.Values) {

        var stationObject : GameObject = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        stationObject.name = "Station ("+station.stationName+")";
        stationObject.transform.position = station.pos;
        stationObject.transform.localScale = Vector3(2, 2, 2);
        stationObject.renderer.material.color = Color.gray;
        
        // Add links to destination stations
        for(var track : Track in station.outboundTracks) {
            var dstStation : Station = stations[track.to];
            // TODO - should still be able to lay track without guidepoints.. they just need to be set to station src/dst
            if(track.guidepoints.length > 1) {
                var commonLines : Array = getCommonLines(station.lines, dstStation.lines);
                layRail(station.pos, dstStation.pos, track.guidepoints, commonLines); // TODO: pass in lines[], as this rail will be able to handle multiple lines when the above TODO is resolved
                //print ("Laid rail from " + station.stationName + " to " + dstStation.stationName);
            } else {
                print ("WARNING: Track has no guidepoints");
            }
        }

    }
    
    //talk(trainObject);
}

function Update() {
    var x = trainObject.transform.position.x;
    var y = trainObject.transform.position.y;
    var z = trainObject.transform.position.z;
    trainObject.transform.position = Vector3(x+0.02, y, z);
}

function getCommonLines(lines, otherLines) : Array {
    var commonLines : Array = new Array();
    for(var line : String in lines) {
        if(ArrayUtility.Contains(otherLines, line)) {
            commonLines.Push(line);
        }
    }
    return commonLines;
}

// Load JSON data from a file
function readJSONFile(filepath : String) : SimpleJSON.JSONNode {
    var sr = new StreamReader(filepath);
    var fileContents = sr.ReadToEnd();
    sr.Close();
    return JSON.Parse(fileContents);
}

// Load JSON station data into a hashtable
function parseStationsJSON(stationsJson : SimpleJSON.JSONNode) : Hashtable {

    var stations : Hashtable = new Hashtable();

    for(var stationJson : Object in stationsJson) {

        var atcocode : String = stationJson["atcocode"].Value;
        var name : String = stationJson["name"].Value;
        var location : Vector3 = getStationPos(stationJson);
        var lines : Array = new Array();

        for(var line : SimpleJSON.JSONNode in stationJson["lines"]) {
            lines.Push(line.Value);
        }

        var outboundLinks : Array = new Array();
        var outboundTracks : Array = new Array();
        for(var linkJson : Object in stationJson["outboundLinks"]) {
            var link : Link = new Link();
            link.to = linkJson["to"].Value;
            link.from = atcocode;
            link.line = linkJson["line"].Value;
            outboundLinks.Push(link);

            // Also create a physical track for the link, but don't add it if there is already a track going to that destination
            // This makes sure we don't get parallel track running between stations connected by a number of shared lines (e.g., circle/met/hammersmith)
            var track : Track = new Track();
            track.to = linkJson["to"].Value;
            track.from = atcocode;
            track.guidepoints = new Array();
            if(!containsTrack(outboundTracks, track)) {
                outboundTracks.Push(track);
            }
        }

        var station : Station = new Station();
        station.atcocode = atcocode;
        station.stationName = name;
        station.pos = location;
        station.lines = lines;
        station.outboundLinks = outboundLinks;
        station.outboundTracks = outboundTracks;
        stations[atcocode] = station;
    }
    print ("Loaded "+stations.Count+" stations");
    return stations;
}

// Each station has a number of outbound tracks, forming a directed graph of stations linked by tracks
// This function converts this graph into a set of station lists that can be read sequentially
// TODO: if this doesn't produce very good results, you could make choices non-deterministically, and run the algorithm multiple times to get the best result (lowest number of routes, etc)
function getStationRoutes(stations : Hashtable, startStation : Station) : Array {

    var previousStation : Station = startStation;
    var station : Station = stations[previousStation.outboundTracks[0].to];

    print ("Start station is " + station.stationName + " (from "+previousStation.stationName+")");

    var backloggedTracks : Array = new Array();
    backloggedTracks.Push(previousStation.outboundTracks[0]);

    // TODO: tracks in different routes should never overlap!

    var routes : Array = new Array();
    var i : int = 0;
    while(backloggedTracks.length > 0) {
        
        var route : Array = new Array();

        var backloggedTrack : Track = backloggedTracks.Pop();
        previousStation = stations[backloggedTrack.from];
        station = stations[backloggedTrack.to];
        route.push(backloggedTrack);
        //print (i+". Processing backlogged track " + stations[backloggedTrack.from].stationName + " |---> " + stations[backloggedTrack.to].stationName);

        var newlyBackloggedTracks : Array = new Array();

        // Traverse new route
        // TODO: realistically, we're not going to get a route longer than 200 stops
        var skipRouteTraversal : boolean = false;
        for(j = 0; j < 200; j++) {

            // Choose a track to take, backlogging the tracks that we don't take so that we can visit them on another route
            var tracksTaken : int = 0;
            for(var track : Track in station.outboundTracks) {
                if(routesContainTrack(routes, track)) {
                    // If this track already belongs to another route then stop creating this route
                    // TODO: actually.. if the track belongs to another route then just don't take it. this might then end up being end of the line, or there could be a different valid track.
                    //skipRouteTraversal = true;
                    //break;
                } else if(tracksTaken == 0 && track.to != previousStation.atcocode) {
                    var dstStation : Station = stations[track.to];
                    previousStation = station;
                    station = dstStation;
                    tracksTaken = 1;
                    //print (i+","+j+". "+station.stationName);
                    // TODO: Add track to route
                    // TODO: If track is in the backlog then remove it
                    // TODO: might want to remove it from newlyBackloggedTracks too
                    //removeTrackIfFound(backloggedTracks, track);
                    route.push(track);
                } else {
                    // Not traversing this link in this route, so store it in the backlog
                    // Don't add the link to the backlog if it's already there
                    //print ("Backlogging " + stations[track.from].stationName + " |---> " + stations[track.to].stationName);
                    if(!containsTrack(newlyBackloggedTracks, track)) {
                        newlyBackloggedTracks.Push(track);
                    }
                }
            }

            if(skipRouteTraversal) {
                //print (i+","+j+". Duplicate track detected in route, so skipping traversal of this route");
                break;
            }

            if(tracksTaken == 0) {
                //print (i+","+j+". Found end of route at " + station.stationName);
                break;
            }

            if(j >= 199) {
                // TODO: this is expected behaviour, but we need to detect it properly and use the minimal route (not a route 200 stops long)
                print (i+","+j+". Probably got caught in an infinite loop (never found end of route)"); // TODO
                break;
            }
        }

        // Add the route if it is complete (i.e., we didn't skip traversal prematurely due to detection of overlapping rails)
        if(!skipRouteTraversal) {

            if(route.length > 1) {
                //print ("Route: "+stations[route[0].from].stationName+" --> "+stations[route[route.length-1].to].stationName+" (len="+route.length+") (backlog_len="+backloggedTracks.length+")");
                routes.Push(route);

                // Add new backlog items
                for(var track : Track in newlyBackloggedTracks) {
                    if(!containsTrack(backloggedTracks, track)) {
                        backloggedTracks.Push(track);
                    }
                }

            } else if(route.length == 1) {
                // TODO: what do we do with tiny routes..?
            }
        }

        if(i >= 500) {
            print (i+","+j+". Probably got caught in an infinite loop (backlog never became empty)"); // TODO
            break;
        }
        i++;
    }
    print ("Reached end of backlog");

    return routes;
}

function routesContainTrack(routes : Array, track : Track) {
    for(var route : Array in routes) {
        if(containsTrack(route, track)) {
            return true;
        }
    }
    return false;
}

function containsTrack(tracks : Array, track : Track) {
    for(var t : Track in tracks) {
        if(t.from == track.from && t.to == track.to) {
            return true;
        }
    }
    return false;
}

function removeTrackIfFound(tracks : Array, track : Track) {
    for(var i = 0; i < tracks.length; i++) {
        var t : Track = tracks[i];
        if(t.from == track.from && t.to == track.to) {
            tracks.RemoveAt(i);
            return true;
        }
    }
    return false;
}

function layRail(srcStationPos : Vector3, dstStationPos : Vector3, guidePoints : Array, lines : Array) {
    var distance = Vector3.Distance(srcStationPos, dstStationPos);
    var size : Vector2 = getLineCrossSectionSize(lines[0]);
    
    //var linkObject : GameObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
    //linkObject.transform.position = Vector3.Lerp(srcStationPos, dstStationPos, 0.5);
    //linkObject.transform.localScale = Vector3(size.x, size.y, distance);
    //linkObject.transform.LookAt(dstStationPos);
    //linkObject.renderer.material.color = getLineColor(line);
    
    var rail : GameObject = new GameObject("Rail ("+lines+" lines)");

    var mesh : Mesh = new Mesh();
    var filter = rail.AddComponent("MeshFilter");
    var renderer = rail.AddComponent("MeshRenderer");
    mesh = createRailMesh(guidePoints);
    filter.mesh = mesh;
    
    //rail.transform.position = Vector3.Lerp(srcStationPos, dstStationPos, 0.5); // TODO: just start from src
    if(lines.length == 0) {
        print ("WARNING: No lines passed to layRail, so cannot perform colouring");
    } else if(lines.length == 1) {
        rail.renderer.material.color = getLineColor(lines[0]);
    } else {
        // TODO: render multiple colours
        rail.renderer.material.color = getLineColor(lines[0]);
    }
}

// TODO: may be possible to cache some of these meshes (rendering is fine, but generation is a big bottleneck)
function createRailMesh(guidePoints : Array) {
    
    //print ("Interpolating rail with "+guidePoints.length+" guide points");

    var granularity : float = 0.2; // value between 0.0-1.0, where a smaller value increases granularity
    var meshPoints : Array = guidePointsToMeshPoints(guidePoints, granularity);
    //print ("Creating rail mesh with "+meshPoints.length+" mesh points");

    var d : float = 1.0;
    var height : float = 0;
    var nodePositions = new Array();
    
    for(var point : Vector3 in meshPoints) {
        // TODO: align the endpoint Y faces with the direction of the segment (not that important as we never see endpoints)
        // TODO: align the corner Y faces correctly (might not be a problem if we have a large number of meshpoints)
        // TODO: this becomes a much more important problem when the rail runs along the y axis, as the rail gets thinner lolz
        nodePositions.Push(Vector3(point.x,   height,   point.z));
        nodePositions.Push(Vector3(point.x+d, height,   point.z));
        nodePositions.Push(Vector3(point.x+d, height+d, point.z));
        nodePositions.Push(Vector3(point.x,   height+d, point.z));
    }
    
    var x : int; 
    var mesh : Mesh = new Mesh();
    var vertex = new Vector3[nodePositions.length];
   
    for(x = 0; x < nodePositions.length; x++) {
        vertex[x] = nodePositions[x];
    }

    var uvs = new Vector2[vertex.length];
    for(x = 0; x < vertex.length; x++) {
        if((x%2) == 0) {
            uvs[x] = Vector2(0,0);
        } else {
            uvs[x] = Vector2(1,1);
        }
    }
    
    var tris = new int[(meshPoints.length-1)*18];
    // Front face
    //tris[0] = 2;
    //tris[1] = 1;
    //tris[2] = 0;
    //tris[3] = 0;
    //tris[4] = 3;
    //tris[5] = 2;
    
    // Opposite face (add 4 to use opposite vertices, and switch ordering to allow view from opposite direction)
    //tris[6] = tris[2] + 4;
    //tris[7] = tris[1] + 4;
    //tris[8] = tris[0] + 4;
    //tris[9] = tris[5] + 4;
    //tris[10] = tris[4] + 4;
    //tris[11] = tris[3] + 4;
    
    // Add triangles to the mesh
    // Each iteration of the loop adds faces between two meshpoints (so there are length-1 iterations)
    var tidx : int = 0;
    var startx : int = 6;
    var starty : int = 0;
    for(x = 1; x < meshPoints.length; x++) {

        // Side L
        tris[tidx] = startx;
        tris[tidx+1] = tris[tidx] - 1;
        tris[tidx+2] = tris[tidx+1] - 4;
        tris[tidx+3] = tris[tidx+2];
        tris[tidx+4] = tris[tidx+3] + 1;
        tris[tidx+5] = tris[tidx];

        // Side R
        tris[tidx+6] = starty;
        tris[tidx+7] = tris[tidx+6] + 4;
        tris[tidx+8] = tris[tidx+7] + 3;
        tris[tidx+9] = tris[tidx+8];
        tris[tidx+10] = tris[tidx+9] - 4;
        tris[tidx+11] = tris[tidx+6];
        
        // Top
        tris[tidx+12] = tris[tidx+8];
        tris[tidx+13] = tris[tidx+12] - 1;
        tris[tidx+14] = tris[tidx+13] - 4;
        tris[tidx+15] = tris[tidx+14];
        tris[tidx+16] = tris[tidx+15] + 1;
        tris[tidx+17] = tris[tidx+12];
        
        startx += 4;
        starty += 4;
        tidx += 18; // added 18 triangles
    }
    
    mesh.vertices = vertex;
    mesh.uv = uvs;
    mesh.triangles = tris;
    mesh.RecalculateNormals();
    mesh.RecalculateBounds();  
    mesh.Optimize();
    mesh.name = "RailMesh";
    return mesh;
}

// Translate a list of guidepoints to a larger fine-grained list of mesh points that can be used to render a curved line
// The guidepoints express the general shape of the line, while the meshpoints represent the individual straight edges
// Increasing the number of meshpoints produces a smoother line at the cost of high polycount
function guidePointsToMeshPoints(guidePoints : Array, granularity : float) : Array {
  var meshPoints : Array = new Array();
    var length = guidePoints.length;
    for(var i = 0; i < length-1; i++) {
        var ui = 0;
        for (var u = 0.0; u < 1.0; u += granularity) {
            var vec = new Vector3();
            vec = interpolatedPosition(guidePoints[Mathf.Max(0, i-1)], guidePoints[i], guidePoints[Mathf.Min(i+1, length-1)], guidePoints[Mathf.Min(i+2, length-1)], u);
            meshPoints.push(vec);
            ui++;
        }
    }
  return meshPoints;
}

// Catmull-Rom interpolation
function interpolatedPosition(P0, P1, P2, P3, u) {
    var u3 = u * u * u;
    var u2 = u * u;
    var f1 = -0.5 * u3 + u2 - 0.5 * u;
    var f2 =  1.5 * u3 - 2.5 * u2 + 1.0;
    var f3 = -1.5 * u3 + 2.0 * u2 + 0.5 * u;
    var f4 =  0.5 * u3 - 0.5 * u2;
    var x = P0.x * f1 + P1.x * f2 + P2.x * f3 + P3.x * f4;
    var z = P0.z * f1 + P1.z * f2 + P2.z * f3 + P3.z * f4;
    return (new Vector3(x, 0.0, z));
}

function talk(trainObject : GameObject) {
    var train : Train = trainObject.GetComponent(Train);

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