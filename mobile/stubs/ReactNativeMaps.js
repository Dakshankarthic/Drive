// Stub for react-native-maps on web
// react-native-maps is native-only and crashes Metro when bundling for web.
// This stub provides safe no-op replacements.

const React = require('react');
const { View } = require('react-native');

const MapView = (props) => React.createElement(View, props, props.children);
MapView.Marker = (props) => React.createElement(View, props);
MapView.Callout = (props) => React.createElement(View, props, props.children);
MapView.Polygon = (props) => React.createElement(View, props);
MapView.Polyline = (props) => React.createElement(View, props);
MapView.Circle = (props) => React.createElement(View, props);

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = MapView.Marker;
module.exports.Callout = MapView.Callout;
module.exports.Polygon = MapView.Polygon;
module.exports.Polyline = MapView.Polyline;
module.exports.Circle = MapView.Circle;
module.exports.PROVIDER_GOOGLE = null;
module.exports.PROVIDER_DEFAULT = null;
