const axios = require('axios');

/**
 * Geocode a street/city address into { lat, lng } using OpenStreetMap Nominatim API.
 */
async function geocodeAddress(address) {
  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: { q: address, format: 'json', limit: 1 },
    headers: { 'User-Agent': 'FleetManagementSystem/1.0 (admin@fleet.local)' },
    timeout: 5000
  });

  if (!response.data || response.data.length === 0) {
    throw new Error(`Unable to geocode address: "${address}"`);
  }

  return {
    lat: parseFloat(response.data[0].lat),
    lng: parseFloat(response.data[0].lon),
    displayName: response.data[0].display_name
  };
}

/**
 * Haversine formula to compute distance in kilometers between two GPS coordinates.
 */
function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Filter vehicles within radiusKm of (centerLat, centerLng).
 */
function findNearbyVehicles(vehicles, centerLat, centerLng, radiusKm) {
  return vehicles
    .filter((v) => v.location && typeof v.location.lat === 'number')
    .map((v) => ({
      ...v,
      distanceKm: calculateDistanceKm(centerLat, centerLng, v.location.lat, v.location.lng)
    }))
    .filter((v) => v.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

module.exports = { geocodeAddress, calculateDistanceKm, findNearbyVehicles };
