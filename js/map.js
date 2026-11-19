// Colorado Abandoned Mining Operations - Hazard Risk Map
// Logic for base layers, clustered mine sites, hazard overlays, layers menu, and legend.

// Hazard classification metadata:
//   color/stroke/text  -> individual site marker + popup
//   badgeOuter/Inner/Text -> soft two-tone cluster badge (highest hazard in the cluster)
var riskMeta = [
  { name: "Non-Hazardous",  color: "#2ecc71", stroke: "#1f8b4c", text: "#222222", badgeOuter: "#b5e28c", badgeInner: "#6ecc39", badgeText: "#234d2e" },
  { name: "Moderate Hazard", color: "#f1c40f", stroke: "#b7960b", text: "#222222", badgeOuter: "#f1d357", badgeInner: "#f0c20c", badgeText: "#4a3d00" },
  { name: "Extreme Hazard",  color: "#e74c3c", stroke: "#a93226", text: "#ffffff", badgeOuter: "#fd9c73", badgeInner: "#f18017", badgeText: "#4a1a0e" }
];

var map = L.map('map', { center: [39.0, -105.5], zoom: 7, zoomControl: true });

// ---- Base layers (switchable in the Layers menu) ----
var esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 18,
  attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, USGS, FAO, NPS'
}).addTo(map);

var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
});

// ---- Custom pane so spiderfied mine markers render above the cluster badges ----
map.createPane('sitesPane');
map.getPane('sitesPane').style.zIndex = 620;          // above markerPane(600), below tooltip(650)/popup(700)
map.getPane('sitesPane').style.pointerEvents = 'auto';

// ---- Mine site clusters (badge color = highest hazard among clustered sites) ----
var markers = L.markerClusterGroup({
  maxClusterRadius: 40,
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  spiderfyDistanceMultiplier: 2,
  iconCreateFunction: function (cluster) {
    var child = cluster.getAllChildMarkers();
    var max = 0;
    for (var i = 0; i < child.length; i++) {
      var c = child[i].riskCode || 0;
      if (c > max) { max = c; }
    }
    var meta = riskMeta[max];
    var count = cluster.getChildCount();
    return L.divIcon({
      className: 'risk-cluster',
      iconSize: L.point(40, 40),
      html: '<div class="risk-cluster-outer" style="background:' + meta.badgeOuter + ';">' +
            '<div class="risk-cluster-inner" style="background:' + meta.badgeInner +
            ';color:' + meta.badgeText + ';">' + count + '</div></div>'
    });
  }
});

points.forEach(function (p) {
  var lat = p[0], lng = p[1], code = p[2], count = p[3], hazards = p[4];
  var meta = riskMeta[code];
  var marker = L.circleMarker([lat, lng], {
    pane: 'sitesPane',
    radius: 6,
    color: meta.stroke,
    weight: 1,
    fillColor: meta.color,
    fillOpacity: 0.85
  });
  marker.riskCode = code;   // read by iconCreateFunction to pick the badge color
  marker.bindPopup(
    '<div style="font-family:Arial,Helvetica,sans-serif;min-width:200px;">' +
    '<div style="font-weight:bold;font-size:14px;margin-bottom:4px;">' +
    '<span style="color:' + meta.color + ';">&#9679;</span> ' + meta.name + '</div>' +
    '<b>Hazard Class:</b> ' + meta.name + '<br>' +
    '<b>Count:</b> ' + count + '<br>' +
    '<b>Hazards Present:</b> ' + hazards +
    '</div>'
  );
  markers.addLayer(marker);
});
map.addLayer(markers);   // Mine Sites shown by default

// ---- Hazard overlay layers (off by default; add them via the Layers menu) ----
var alluvialStyle   = { color: '#1b4f72', weight: 1, fillColor: '#2980b9', fillOpacity: 0.30 };
var municipalStyle  = { color: '#5b2c6f', weight: 1, fillColor: '#8e44ad', fillOpacity: 0.30 };
var streamsStyle    = { color: '#0e6655', weight: 1, fillColor: '#16a085', fillOpacity: 0.35 };

var alluvialLayer  = L.geoJSON(null, { style: alluvialStyle });
var municipalLayer = L.geoJSON(null, { style: municipalStyle });

// Streams layer from the ArcGIS FeatureServer (Esri Leaflet).
// NOTE: this service is currently NOT shared publicly and returns "Token Required".
// To make the Streams layer display, either:
//   (a) share the FeatureServer item with Everyone in ArcGIS Online, or
//   (b) paste an ArcGIS token into STREAMS_TOKEN below.
var STREAMS_URL   = 'https://services1.arcgis.com/KNdRU5cN6ENqCTjk/arcgis/rest/services/Streams_Buffered_100_feet/FeatureServer/0';
var STREAMS_TOKEN = '';   // <- paste a token here if the service stays private
var streamsLayer = L.esri.featureLayer({
  url: STREAMS_URL,
  token: STREAMS_TOKEN || undefined,
  style: streamsStyle
});
streamsLayer.on('loaderror', function (e) {
  console.warn('Streams ArcGIS layer failed to load (the service may require a token).', e && e.error);
});

// Preload the two local GeoJSON layers (single source of truth = the .geojson files).
// These are fetched over HTTP, so open the map via a local server (or the deployed
// GitHub Pages site) rather than file:// for these layers to load.
function loadGeoJSON(layer, url, label) {
  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (data) { layer.addData(data); })
    .catch(function (err) { console.warn(label + ' failed to load from ' + url, err); });
}
loadGeoJSON(alluvialLayer,  'Data/Colorado_Alluvial_Aquifers_Buffered_1.7_km.geojson', 'Alluvial Aquifers');
loadGeoJSON(municipalLayer, 'Data/Colorado_Municipalities_Buffered_100_feet.geojson', 'Municipal Boundaries');

// ---- Layers menu: base layers + overlays (hazard layers off by default) ----
var baseLayers = {
  "Esri World Topo": esriTopo,
  "OpenStreetMap": osm
};
var overlays = {
  "Mine Sites": markers,
  "Alluvial Aquifers": alluvialLayer,
  "Municipal Boundaries": municipalLayer,
  "Streams": streamsLayer
};
L.control.layers(baseLayers, overlays, { collapsed: false, position: 'topleft' }).addTo(map);

// ---- Legend (mine hazard classes) ----
var legend = L.control({ position: 'topright' });
legend.onAdd = function () {
  var div = L.DomUtil.create('div', 'info legend');
  div.innerHTML = '<h4>Hazard Risk</h4>';
  riskMeta.forEach(function (m) {
    div.innerHTML +=
      '<div class="row"><span class="swatch" style="background:' + m.color + ';"></span>' +
      '<b>' + m.name + '</b></div>';
  });
  return div;
};
legend.addTo(map);
