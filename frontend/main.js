$(document).ready(function () {
	//GEOCODING

	var searchMarker = null;
	var stationsList = null;
	var threeClosestStations = L.layerGroup();

	const searchInput = document.getElementById('searchInput');
	const suggestionsContainer = document.getElementById('suggestionsContainer');

	const handleInputDebounced = debounce(handleInput, 300);
	searchInput.addEventListener('input', handleInputDebounced);

	$.ajax({
		url: '../backend/trova_stazioni.php',
		type: 'GET',
		data: {
			action: 'getAllStations',
		},
		success: function (response) {
			console.log(response);
			stationsList = response;
		},
		error: function (xhr, status, error) {
			console.log(error);
		},
	});

	// SEARCH BAR SUGGESTIONS

	function debounce(func, delay) {
		let timeout;
		return function (...args) {
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(this, args), delay);
		};
	}

	async function handleInput(e) {
		const searchText = e.target.value;

		if (searchText.trim() === '') {
			clearSuggestions();
			return;
		}

		try {
			const suggestions = await getSuggestions(searchText);
			displaySuggestions(suggestions);
		} catch (error) {
			console.error(error);
		}
	}

	function getSuggestions(query) {
		return new Promise((resolve, reject) => {
			const params = new URLSearchParams({
				q: query,
				format: 'json',
				bounded: 1,
				viewbox: '-74.257,40.495,-73.699,40.915',
				countrycodes: 'us',
			});

			const url = `https://nominatim.openstreetmap.org/search?${params}`;

			fetch(url)
				.then((response) => response.json())
				.then((data) => {
					const suggestions = data.map((item) => ({
						display_name: item.display_name,
						lat: item.lat,
						lon: item.lon,
					}));
					resolve(suggestions);
				})
				.catch((error) => {
					reject(error);
				});
		});
	}

	function displaySuggestions(suggestions) {
		clearSuggestions();

		const maxSuggestions = Math.min(suggestions.length, 5); // Prende le prime 5 suggestion

		for (let i = 0; i < maxSuggestions; i++) {
			const suggestion = suggestions[i];
			const suggestionItem = createSuggestion(suggestion);
			suggestionsContainer.appendChild(suggestionItem);
			if (searchInput.value == '') {
				clearSuggestions();
				return;
			}
		}
	}

	function createSuggestion(suggestion) {
		const li = document.createElement('li');
		li.textContent = suggestion.display_name;
		li.addEventListener('click', () => handleSuggestionClick(suggestion));
		return li;
	}

	function clearSuggestions() {
		while (suggestionsContainer.firstChild) {
			suggestionsContainer.removeChild(suggestionsContainer.firstChild);
		}
	}

	function handleSuggestionClick(suggestion) {
		clearSuggestions();
		threeClosestStations.clearLayers();
		if (searchMarker) {
			map.removeLayer(searchMarker);
		}

		var lat = suggestion.lat;
		var lon = suggestion.lon;
		searchInput.value = suggestion.display_name;
		clearSuggestions();
		map.setView([lat, lon], 14);
		searchMarker = L.marker([lat, lon], {
			icon: searchPointer,
		})
			.addTo(map)
			.bindPopup(suggestion.display_name)
			.openPopup();
		findStationsNearSuggestion(suggestion);
		clearSuggestions();
	}

	function findStationsNearSuggestion(suggestion) {
		var lat = suggestion.lat;
		var lon = suggestion.lon;

		$.ajax({
			url: '../backend/trova_stazioni.php',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({
				lat: lat,
				lon: lon,
				action: 'getThreeClosestStations',
			}),
			success: function (response) {
				console.log(response);
				var closestStations = response.closestStations;
				var marker1 = L.marker(
					[closestStations[0].lat, closestStations[0].lon],
					{
						icon: station,
					}
				).bindPopup(createPopupContent(closestStations[0]));

				threeClosestStations.addLayer(marker1);

				var marker2 = L.marker(
					[closestStations[1].lat, closestStations[1].lon],
					{
						icon: station,
					}
				).bindPopup(createPopupContent(closestStations[1]));

				threeClosestStations.addLayer(marker2);

				var marker3 = L.marker(
					[closestStations[2].lat, closestStations[2].lon],
					{
						icon: station,
					}
				).bindPopup(createPopupContent(closestStations[2]));

				threeClosestStations.addLayer(marker3);
				threeClosestStations.addTo(map);
			},
			error: function (xhr, status, error) {
				console.log(error);
			},
		});
	}

	// Inizializza mappa

	var map = L.map('map').setView([40.7128, -74.006], 13);

	var station = L.icon({
		iconUrl: 'assets/bikeicon.png',
		iconSize: [60, 60],
	});

	var activeStation = L.icon({
		iconUrl: 'assets/greenbike.png',
		iconSize: [30, 30],
	});

	var inactiveStation = L.icon({
		iconUrl: 'assets/redbike.png',
		iconSize: [30, 30],
	});

	var searchPointer = L.icon({
		iconUrl: 'assets/pointer.png',
		iconSize: [30, 50],
	});

	var stazioniVisualizzate = false;

	document
		.getElementById('visualizza-stazioni')
		.addEventListener('click', visualizzaStazioni);

	document
		.getElementById('reset-pin')
		.addEventListener('click', resetStartFinish);

	var allStationsGroup = L.layerGroup();
	var startFinish = L.layerGroup();

	function visualizzaStazioni() {
		stazioniVisualizzate = !stazioniVisualizzate;

		if (stazioniVisualizzate) {
			document.getElementById('visualizza-stazioni').textContent =
				'Hide stations';

			stationsList.forEach(function (station) {
				var marker = L.marker([station.lat, station.lon], {
					icon:
						station.status === 'In Service' ? activeStation : inactiveStation,
				}).bindPopup(createPopupContent(station));

				allStationsGroup.addLayer(marker);
			});

			allStationsGroup.addTo(map);
		} else {
			document.getElementById('visualizza-stazioni').textContent =
				'Show all stations';
			allStationsGroup.clearLayers();
		}
	}

	function createPopupContent(station) {
		var popupContent = `
				<div class="station-popup">
					<h3>${station.name}</h3>
					<p>Available Bikes: ${station.num_bikes_available}</p>
					<p>Total bikes: ${station.capacity}</p>
				</div>
			`;
		return popupContent;
	}

	function resetStartFinish() {
		searchInput.value = '';
		map.setView([40.7128, -74.006], 13);

		if (startPointMarker) {
			map.removeLayer(startPointMarker);
			startPointMarker = null;
		}

		if (finishPointMarker) {
			map.removeLayer(finishPointMarker);
			map.removeLayer(startStationPointMarker);
			map.removeLayer(finishStationPointMarker);
			finishPointMarker = null;
			startStationPointMarker = null;
			finishStationPointMarker = null;
		}

		if (searchMarker) {
			map.removeLayer(searchMarker);
			searchMarker = null;
		}

		startFinish.clearLayers();
		threeClosestStations.clearLayers();

		map.on('click', handleMapClick);

		map.eachLayer(function (layer) {
			if (layer instanceof L.Polyline) {
				map.removeLayer(layer);
			}
		});
	}

	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution:
			'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	}).addTo(map);

	var startPointMarker = null;
	var finishPointMarker = null;
	var startStationPointMarker = null;
	var finishStationPointMarker = null;

	function handleMapClick(e) {
		var clickedCoordinate = e.latlng;

		if (startPointMarker === null) {
			startPointMarker = L.marker(clickedCoordinate)
				.addTo(map)
				.bindPopup('Start')
				.openPopup();
		} else if (startPointMarker && finishPointMarker === null) {
			finishPointMarker = L.marker(clickedCoordinate)
				.addTo(map)
				.bindPopup('Destination')
				.openPopup();
		}

		if (startPointMarker && finishPointMarker) {
			var startLatLng = startPointMarker.getLatLng();
			var finishLatLng = finishPointMarker.getLatLng();

			var startLat = startLatLng.lat;
			var startLng = startLatLng.lng;
			var finishLat = finishLatLng.lat;
			var finishLng = finishLatLng.lng;

			$.ajax({
				url: '../backend/trova_stazioni.php',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({
					startLat: startLat,
					startLng: startLng,
					finishLat: finishLat,
					finishLng: finishLng,
					action: 'getClosestStations',
				}),
				success: function (response) {
					console.log(response);
					var startStation = response.startStation;
					var finishStation = response.finishStation;
					console.log(startStation);

					startStationPointMarker = L.marker(
						[startStation.lat, startStation.lon],
						{
							icon: station,
						}
					)
						.addTo(map)
						.bindPopup(createPopupContent(startStation));

					finishStationPointMarker = L.marker(
						[finishStation.lat, finishStation.lon],
						{
							icon: station,
						}
					)
						.addTo(map)
						.bindPopup(createPopupContent(finishStation));
				},
				error: function (xhr, status, error) {
					console.log(error);
				},
			});
		}

		var polyline = L.polyline(
			[startPointMarker.getLatLng(), finishPointMarker.getLatLng()],
			{ color: 'red' }
		).addTo(map);

		startFinish.addLayer(polyline);

		map.off('click', handleMapClick);
	}

	map.on('click', handleMapClick);
});
