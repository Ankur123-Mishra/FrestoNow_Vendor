import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius } from '@/theme';
import {
  DEFAULT_MAP_CENTER,
  getGoogleMapsApiKey,
  isGoogleMapsConfigured,
  reverseGeocodeLatLng,
  type PlaceSelection,
} from './googleMaps';

type MapWebViewHandle = {
  injectJavaScript: (js: string) => void;
};

type MapWebViewProps = {
  ref?: React.Ref<MapWebViewHandle | null>;
  originWhitelist?: string[];
  source: { html: string };
  style?: { height: number };
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  scrollEnabled?: boolean;
  nestedScrollEnabled?: boolean;
  setSupportMultipleWindows?: boolean;
  mixedContentMode?: 'never' | 'always' | 'compatibility';
  onLoadEnd?: () => void;
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
};

const MapWebView = WebView as unknown as React.ComponentType<MapWebViewProps>;

type LocationMapPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onPick: (place: PlaceSelection) => void;
  height?: number;
  radiusKm?: number | null;
  hint?: string;
};

function mapHtml(apiKey: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body, #map { margin: 0; height: 100%; width: 100%; background: #f8fafc; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      const DEFAULT = { lat: ${DEFAULT_MAP_CENTER.lat}, lng: ${DEFAULT_MAP_CENTER.lng} };
      let map, marker, circle;
      function post(lat, lng) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: lat, longitude: lng }));
      }
      function placeMarker(lat, lng) {
        const pos = { lat: Number(lat), lng: Number(lng) };
        if (!marker) {
          marker = new google.maps.Marker({ map: map, position: pos, draggable: true });
          marker.addListener('dragend', function (event) {
            post(event.latLng.lat(), event.latLng.lng());
          });
        } else {
          marker.setPosition(pos);
        }
        map.panTo(pos);
      }
      window.setPin = function (lat, lng, radiusKm, zoom) {
        if (lat == null || lng == null || !map) return;
        placeMarker(lat, lng);
        if (circle) circle.setMap(null);
        if (radiusKm && Number(radiusKm) > 0) {
          circle = new google.maps.Circle({
            map: map,
            center: { lat: Number(lat), lng: Number(lng) },
            radius: Number(radiusKm) * 1000,
            fillColor: '#2563eb',
            fillOpacity: 0.12,
            strokeColor: '#2563eb',
            strokeOpacity: 0.7,
            strokeWeight: 2,
            clickable: false
          });
        }
        map.setZoom(zoom || 15);
      };
      function init() {
        map = new google.maps.Map(document.getElementById('map'), {
          center: DEFAULT,
          zoom: 5,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false
        });
        map.addListener('click', function (event) {
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          placeMarker(lat, lng);
          post(lat, lng);
        });
        window.ReactNativeWebView.postMessage(JSON.stringify({ ready: true }));
      }
    </script>
    <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=init" async defer></script>
  </body>
</html>`;
}

export function LocationMapPicker({
  latitude,
  longitude,
  onPick,
  height = 240,
  radiusKm = null,
  hint = 'Click the map or drag the pin to set the exact location.',
}: LocationMapPickerProps) {
  const webRef = useRef<MapWebViewHandle>(null);
  const configured = isGoogleMapsConfigured();
  const apiKey = getGoogleMapsApiKey();
  const html = useMemo(() => (apiKey ? mapHtml(apiKey) : ''), [apiKey]);

  const syncPin = () => {
    if (latitude == null || longitude == null) {
      return;
    }
    const zoom = radiusKm != null && radiusKm > 0 ? 11 : 15;
    webRef.current?.injectJavaScript(
      `window.setPin && window.setPin(${latitude}, ${longitude}, ${radiusKm ?? 'null'}, ${zoom}); true;`,
    );
  };

  useEffect(() => {
    syncPin();
  }, [latitude, longitude, radiusKm]);

  if (!configured || !html) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <MapWebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={{ height }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        mixedContentMode="compatibility"
        onLoadEnd={syncPin}
        onMessage={event => {
          try {
            const payload = JSON.parse(event.nativeEvent.data) as {
              ready?: boolean;
              latitude?: number;
              longitude?: number;
            };
            if (payload.ready) {
              syncPin();
              return;
            }
            if (payload.latitude == null || payload.longitude == null) {
              return;
            }
            void reverseGeocodeLatLng(payload.latitude, payload.longitude).then(place => {
              onPick(
                place ?? {
                  label: `${payload.latitude!.toFixed(5)}, ${payload.longitude!.toFixed(5)}`,
                  latitude: payload.latitude!,
                  longitude: payload.longitude!,
                },
              );
            });
          } catch {
            // ignore malformed webview messages
          }
        }}
      />
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
