import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { colors } from '@/theme';
import { LocationMapPicker } from './LocationMapPicker';
import { PlacesAutocompleteInput } from './PlacesAutocompleteInput';
import {
  getCurrentCoordinates,
  isGoogleMapsConfigured,
  parseCoord,
  requestLocationPermission,
  reverseGeocodeLatLng,
  type PlaceSelection,
} from './googleMaps';

export type GeoLocationValue = {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude: string;
  longitude: string;
};

type GeoLocationFieldProps = {
  latitude: string;
  longitude: string;
  initialQuery?: string;
  onPick: (place: PlaceSelection) => void;
  onLatLngChange: (latitude: string, longitude: string) => void;
  radiusKm?: number | null;
  hint?: string;
  searchPlaceholder?: string;
  showCoordinates?: boolean;
};

export function GeoLocationField({
  latitude,
  longitude,
  initialQuery: _initialQuery = '',
  onPick,
  onLatLngChange,
  radiusKm = null,
  hint,
  searchPlaceholder = 'Search store address or landmark',
  showCoordinates = true,
}: GeoLocationFieldProps) {
  const mapsConfigured = isGoogleMapsConfigured();
  // Search starts empty — suggestions only appear when the user types.
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const lat = parseCoord(latitude);
  const lng = parseCoord(longitude);
  const bias = lat != null && lng != null ? { lat, lng } : null;

  const handlePick = (place: PlaceSelection) => {
    setQuery(place.label);
    setLocationError(null);
    onPick(place);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const allowed = await requestLocationPermission();
      if (!allowed) {
        setLocationError('Location permission was denied. Allow access or search/pick on the map.');
        return;
      }
      const coords = await getCurrentCoordinates();
      const place = await reverseGeocodeLatLng(coords.latitude, coords.longitude);
      handlePick(
        place ?? {
          label: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
      );
    } catch {
      setLocationError('Could not determine your location. Try search or pick on the map.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <AppButton
        title={locating ? 'Detecting location…' : 'Use current location'}
        variant="outline"
        onPress={useCurrentLocation}
        loading={locating}
        disabled={locating}
      />
      {locationError ? (
        <Text style={styles.error}>{locationError}</Text>
      ) : (
        <Text style={styles.hint}>Auto-fills address, city, state and PIN from Google Maps.</Text>
      )}

      {mapsConfigured ? (
        <>
          <Text style={styles.label}>Search on map</Text>
          <PlacesAutocompleteInput
            value={query}
            onChange={setQuery}
            onPlaceSelect={handlePick}
            placeholder={searchPlaceholder}
            bias={bias}
          />
          <LocationMapPicker
            latitude={lat}
            longitude={lng}
            onPick={handlePick}
            radiusKm={radiusKm}
            hint={
              hint ??
              'Use current location, search, tap the map, or drag the pin. Address fields fill automatically.'
            }
          />
        </>
      ) : (
        <Text style={styles.hint}>Google Maps key is missing. Enter the address manually.</Text>
      )}

      {showCoordinates ? (
        <View style={styles.coordRow}>
          <View style={styles.coordField}>
            <AppInput
              label="Latitude"
              value={latitude}
              onChangeText={value => onLatLngChange(value, longitude)}
              keyboardType="decimal-pad"
              placeholder="e.g. 28.6139"
              optional
            />
          </View>
          <View style={styles.coordField}>
            <AppInput
              label="Longitude"
              value={longitude}
              onChangeText={value => onLatLngChange(latitude, value)}
              keyboardType="decimal-pad"
              placeholder="e.g. 77.2090"
              optional
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function placeToStoreFields(place: PlaceSelection): GeoLocationValue {
  return {
    address: place.street || place.label,
    city: place.city || '',
    state: place.state || '',
    pincode: place.pincode || '',
    latitude: String(place.latitude),
    longitude: String(place.longitude),
  };
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 14 },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  hint: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  coordRow: { flexDirection: 'row', gap: 10 },
  coordField: { flex: 1 },
});
