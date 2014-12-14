#!/usr/bin/env python
import requests
import json

def find_link(link, links):
    return [element for element in links if element['line'] == link['line'] and element['to'] == link['to']]

def find_station(station, stations):
    return [element for element in stations if element['atcocode'] == station['atcocode']]

def find_platform(platforms, stationName, line, direction):
    # TODO: handle direction (1 is northbound/eastbound and 2 is southbound/westbound)
    # TODO: hopefully this is given away in the atco code :D
    # TODO: if we found multiple matching platforms, debug this
    for platform in platforms:
        if platform["name"] == stationName and line in platform["lines"]:
            return platform
    return None

def get_platform_level(platform, stationLevels, direction):
    for line, lineStationLevels in stationLevels.iteritems():
        if line in platform["lines"]:
            for stationLevel in lineStationLevels:
                if stationLevel["name"] == platform["name"]:
                    if direction == 1:
                        return stationLevel["platform1"]
                    elif direction == 2:
                        return stationLevel["platform2"]
    return None


if __name__ == "__main__":

    stationLevels = json.load(open('../../data/tfl-platform-levels/station-levels.json'))
    platforms = json.load(open('../../data/stations-linked.json'))

    for platform in platforms:
        # TODO: determine direction of platform (1 is northbound/eastbound and 2 is southbound/westbound)
        platformLevel = get_platform_level(platform, stationLevels, 1)
        if platformLevel != None:
            platform["location"]["level"] = platformLevel
        else:
            print "Platform "+platform["atcocode"]+" for "+platform["name"]+" ("+str(platform["lines"])+") has no level data"
            platform["location"]["level"] = 0


    # Write the stations JSON
    with open('../../data/platforms-linked.json', 'w+') as outfile:
        json.dump(platforms, outfile, indent=4)


