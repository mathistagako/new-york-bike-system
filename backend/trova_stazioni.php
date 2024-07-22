<?php

$stationInfoUrl = 'https://gbfs.citibikenyc.com/gbfs/en/station_information.json';
$stationStatusUrl = 'https://gbfs.citibikenyc.com/gbfs/en/station_status.json';

$stationInfoJson = file_get_contents($stationInfoUrl);
$stationStatusJson = file_get_contents($stationStatusUrl);

if ($stationInfoJson === FALSE || $stationStatusJson === FALSE) {
    http_response_code(500);
    echo json_encode(['error' => 'Error fetching data from the API']);
    exit();
}

$stationInfoData = json_decode($stationInfoJson, true);
$stationStatusData = json_decode($stationStatusJson, true);

$stations = [];
foreach ($stationInfoData['data']['stations'] as $info) {
    $stations[$info['station_id']] = $info;
}

foreach ($stationStatusData['data']['stations'] as $status) {
    if (isset($stations[$status['station_id']])) {
        $stations[$status['station_id']]['num_bikes_available'] = $status['num_bikes_available'];
        $stations[$status['station_id']]['num_docks_available'] = $status['num_docks_available'];
        $stations[$status['station_id']]['status'] = $status['is_installed'] && $status['is_renting'] ? "In Service" : "Out of Service";
    }
}

$stationList = array_values($stations);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if ($input['action'] === "getClosestStations") {
        $startLat = $input['startLat'];
        $startLng = $input['startLng'];
        $finishLat = $input['finishLat'];
        $finishLng = $input['finishLng'];

        $startStation = findClosestStation($stationList, $startLat, $startLng);
        $finishStation = findClosestStation($stationList, $finishLat, $finishLng);

        $response = [
            'startStation' => $startStation,
            'finishStation' => $finishStation
        ];

        header('Content-Type: application/json');
        echo json_encode($response);
        exit();
    } elseif ($input['action'] === "getThreeClosestStations") {
        $lat = $input['lat'];
        $lon = $input['lon'];

        $response = [
            'closestStations' => findClosestStations($stationList, $lat, $lon, 3),
        ];

        header('Content-Type: application/json');
        echo json_encode($response);
        exit();
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        exit();
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $response = $stationList;

    header('Content-Type: application/json');
    echo json_encode($response);
    exit();
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// FUNCTIONS

function findClosestStation($stations, $latitude, $longitude) {
    $closestStation = null;
    $closestDistance = null;

    foreach ($stations as $station) {
        if ($station['status'] == "In Service") {
            $stationLat = $station['lat'];
            $stationLng = $station['lon'];

            $distance = haversineDistance($latitude, $longitude, $stationLat, $stationLng);

            if ($closestDistance === null || $distance < $closestDistance) {
                $closestDistance = $distance;
                $closestStation = $station;
            }
        }
    }

    return $closestStation;
}

function findClosestStations($stations, $latitude, $longitude, $numStations) {
    $closestStations = [];
    $closestDistance = null;

    while (count($closestStations) < $numStations) {
        $closestStation = null;
        foreach ($stations as $station) {
            if ($station['status'] == "In Service") {
                $stationLat = $station['lat'];
                $stationLng = $station['lon'];

                $distance = haversineDistance($latitude, $longitude, $stationLat, $stationLng);

                if (($closestDistance === null || $distance < $closestDistance) && !in_array($station, $closestStations)) {
                    $closestDistance = $distance;
                    $closestStation = $station;
                }
            }
        }
        if ($closestStation) {
            $closestStations[] = $closestStation;
        }
        $closestDistance = null;
    }

    return $closestStations;
}

function haversineDistance($lat1, $lng1, $lat2, $lng2) {
    $earthRadius = 6371;

    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);

    $a = sin($dLat / 2) * sin($dLat / 2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) * sin($dLng / 2);
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

    return $earthRadius * $c;
}
?>
