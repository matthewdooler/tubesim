#!/usr/bin/env python
import requests
import json
from xml.etree import ElementTree as ET

# Add link to a station identified by its ATOC code
# A link is a (line,destination) tuple
# Duplicate links are ignored
# This doesn't add an inbound link, as the link could be one-way with the return train taking a different route
def add_link(stations, fromStation, link):
    stationFound = False
    for station in stations:
        if(station['atcocode'] == fromStation):
            stationFound = True
            # Add the link if it doesn't already exist (the TFL data is a bit verbose)
            # and if this station actually serves this line
            if(link['line'] in station['lines']):
                if(len(find_link(link, station['outboundLinks'])) == 0):
                    station['outboundLinks'].append(link)
            else:
                print "WARNING: Link cannot route to this station because it is not on the "+link['line']+" line"
    if(not stationFound):
        print "WARNING: Station with ATCO Code "+fromStation+" could not be found ("+link['line']+" line link from "+fromStation+" to "+toStation+")"

def find_link(link, links):
    return [element for element in links if element['line'] == link['line'] and element['to'] == link['to']]

def find_station(station, stations):
    return [element for element in stations if element['atcocode'] == station['atcocode']]

if __name__ == "__main__":

    # Retrieved manually from http://transportapi.com/v3/uk/tube.json?api_key=API_KEY&app_id=APP_ID
    lines = {
        "bakerloo": "Bakerloo",
        "central": "Central",
        "circle": "Circle",
        "district": "District",
        "hammersmith": "Hammersmith & City",
        "jubilee": "Jubilee",
        "metropolitan": "Metropolitan",
        "northern": "Northern",
        "piccadilly": "Piccadilly",
        "victoria": "Victoria",
        "waterlooandcity": "Waterloo & City",
        "dlr": "DLR"
    }

    stations = []

    for lineKey, lineName in lines.iteritems():
        print "Loading "+lineName+" line data..."
        txns = "http://www.transxchange.org.uk/"
        timetable = ET.parse('../../data/tfl-timetables/'+lineKey+'.xml').getroot()
        stopPoints = timetable.findall(".//{"+txns+"}StopPoint")
        routeLinks = timetable.findall(".//{"+txns+"}RouteLink")
        print "Loaded "+str(len(stopPoints))+" stop points"
        print "Loaded "+str(len(routeLinks))+" route links"

        # Add stop points to the list of stations
        # (don't add duplicate stations to the list - distinguished by atco code)
        for stopPoint in stopPoints:
            atcoCode = stopPoint.findall("./{"+txns+"}AtcoCode")[0].text
            name = stopPoint.findall("./{"+txns+"}Descriptor/{"+txns+"}CommonName")[0].text
            location = stopPoint.findall("./{"+txns+"}Place/{"+txns+"}Location")[0]
            easting = location.findall("./{"+txns+"}Easting")[0].text
            northing = location.findall("./{"+txns+"}Northing")[0].text
            if(easting == "0" or northing == "0"):
                print "WARNING: Loation not set for " + name

            station = {
                'name': name,
                'atcocode': atcoCode,
                'lines': [lineKey],
                'outboundLinks': [],
                'location': {
                    'easting': easting,
                    'northing': northing
                }
            }
            existingStation = find_station(station, stations)
            if(len(existingStation) == 0):
                # Station does not exist, so add it
                stations.append(station)
            else:
                # Station already exists, but we might need to add this line to it
                existingStation = existingStation[0]
                if(lineKey not in existingStation['lines']):
                    existingStation['lines'].append(lineKey)
        
        # Add each route link to the corresponding station in our existing JSON structure
        for routeLink in routeLinks:
            fromStation = routeLink.findall("./{"+txns+"}From/{"+txns+"}StopPointRef")[0].text
            toStation = routeLink.findall("./{"+txns+"}To/{"+txns+"}StopPointRef")[0].text
            link = { "line": lineKey, "to": toStation }
            add_link(stations, fromStation, link)

    print "Stations: "+str(len(stations))+" (includes duplication caused by stations with multiple platforms)"

    # Write the stations JSON
    with open('../../data/stations-linked.json', 'w+') as outfile:
        json.dump(stations, outfile, indent=4)

    # Remove duplicate stations (useful for announcements, maps, etc)
    # These 'shared' stations have different ATCO codes, but are actually the same if we remove the last character
    uniqueStations = []
    for station in stations:
        station['atcocode'] = station['atcocode'][:-1]
        for link in station['outboundLinks']:
            link['to'] = link['to'][:-1]
        existingStation = find_station(station, uniqueStations)
        if(len(existingStation) == 0):
            uniqueStations.append(station)
        else:
            # Duplicate station, so add in our line+link information
            existingStation = existingStation[0]
            for line in station['lines']:
                if(line not in existingStation['lines']):
                    existingStation['lines'].append(line)
            for link in station['outboundLinks']:
                add_link(uniqueStations, station['atcocode'], link)
            if(station['name'] != existingStation['name']):
                print "WARNING: "+existingStation['name']+" is also known as "+station['name'] 

    print "Unique stations: "+str(len(uniqueStations))

    # Write the unique staitons
    with open('../../data/stations-linked-unique.json', 'w+') as outfile:
        json.dump(uniqueStations, outfile, indent=4)
