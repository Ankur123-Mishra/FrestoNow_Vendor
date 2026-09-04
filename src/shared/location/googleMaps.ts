import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { ENV } from '@/config/env';

export const DEFAULT_MAP_CENTER = { lat: 28.6139, lng: 77.209 };
export const DEFAULT_MAP_ZOOM = 15;

export type PlaceSelection = {
  label: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  street?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
};

export type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type PlacePrediction = {
  placeId: string;
  label: string;
};

export function getGoogleMapsApiKey(): string | undefined {
  const key = ENV.GOOGLE_MAPS_API_KEY?.trim();
  return key || undefined;
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

function mapsUrl(path: string, params: Record<string, string | number | undefined>) {
  const key = getGoogleMapsApiKey();
  const search = new URLSearchParams();
  if (key) {
    search.set('key', key);
  }
  Object.entries(params).forEach(([name, value]) => {
    if (value != null && value !== '') {
      search.set(name, String(value));
    }
  });
  return `https://maps.googleapis.com/maps/api/${path}?${search.toString()}`;
}

function componentLongName(components: AddressComponent[] | undefined, type: string) {
  return components?.find(item => item.types.includes(type))?.long_name;
}

function componentShortName(components: AddressComponent[] | undefined, type: string) {
  return components?.find(item => item.types.includes(type))?.short_name;
}

export function parseAddressComponents(
  components: AddressComponent[] | undefined,
): Pick<PlaceSelection, 'street' | 'city' | 'district' | 'state' | 'country' | 'pincode'> {
  const streetNumber = componentLongName(components, 'street_number');
  const route = componentLongName(components, 'route');
  const premise = componentLongName(components, 'premise');
  const sublocality =
    componentLongName(components, 'sublocality_level_1') ||
    componentLongName(components, 'sublocality') ||
    componentLongName(components, 'neighborhood');

  const streetParts = [streetNumber, route || premise, sublocality].filter(Boolean);
  const city =
    componentLongName(components, 'locality') ||
    componentLongName(components, 'administrative_area_level_2') ||
    componentLongName(components, 'postal_town');
  const district =
    componentLongName(components, 'administrative_area_level_3') ||
    componentLongName(components, 'administrative_area_level_2') ||
    city;
  const state = componentLongName(components, 'administrative_area_level_1');
  const country =
    componentLongName(components, 'country') || componentShortName(components, 'country');
  const pincode = componentLongName(components, 'postal_code');

  return {
    street: streetParts.join(', ') || undefined,
    city: city || undefined,
    district: district || undefined,
    state: state || undefined,
    country: country || undefined,
    pincode: pincode || undefined,
  };
}

function latLngFromLocation(location: unknown): { lat: number; lng: number } | null {
  if (!location || typeof location !== 'object') {
    return null;
  }
  const record = location as { lat?: unknown; lng?: unknown };
  const lat = typeof record.lat === 'function' ? record.lat() : Number(record.lat);
  const lng = typeof record.lng === 'function' ? record.lng() : Number(record.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

export function geocodeResultToSelection(
  result: {
    formatted_address?: string;
    name?: string;
    place_id?: string;
    address_components?: AddressComponent[];
    geometry?: { location?: unknown };
  },
  fallbackLat?: number,
  fallbackLng?: number,
): PlaceSelection | null {
  const coords = latLngFromLocation(result.geometry?.location);
  const latitude = coords?.lat ?? fallbackLat;
  const longitude = coords?.lng ?? fallbackLng;
  if (latitude == null || longitude == null) {
    return null;
  }
  const parsed = parseAddressComponents(result.address_components);
  return {
    label:
      result.formatted_address ||
      result.name ||
      `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    latitude,
    longitude,
    placeId: result.place_id,
    ...parsed,
  };
}

export function newPlacesSessionToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchPlacePredictions(
  input: string,
  options?: {
    sessionToken?: string;
    bias?: { lat: number; lng: number } | null;
  },
): Promise<PlacePrediction[]> {
  const query = input.trim();
  if (!query || !isGoogleMapsConfigured()) {
    return [];
  }
  const url = mapsUrl('place/autocomplete/json', {
    input: query,
    components: 'country:in',
    types: 'geocode',
    sessiontoken: options?.sessionToken,
    location:
      options?.bias != null ? `${options.bias.lat},${options.bias.lng}` : undefined,
    radius: options?.bias != null ? 25000 : undefined,
  });
  const res = await fetch(url);
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    predictions?: Array<{ description?: string; place_id?: string }>;
  };
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Places search failed (${data.status})`);
  }
  return (data.predictions || [])
    .map(item => ({
      placeId: item.place_id || '',
      label: item.description || '',
    }))
    .filter(item => item.placeId && item.label);
}

export async function fetchPlaceDetails(
  placeId: string,
  sessionToken?: string,
): Promise<PlaceSelection | null> {
  if (!placeId || !isGoogleMapsConfigured()) {
    return null;
  }
  const url = mapsUrl('place/details/json', {
    place_id: placeId,
    fields: 'formatted_address,geometry,name,place_id,address_components',
    sessiontoken: sessionToken,
  });
  const res = await fetch(url);
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    result?: Parameters<typeof geocodeResultToSelection>[0];
  };
  if (data.status && data.status !== 'OK') {
    throw new Error(data.error_message || `Place details failed (${data.status})`);
  }
  return data.result ? geocodeResultToSelection(data.result) : null;
}

export async function reverseGeocodeLatLng(
  latitude: number,
  longitude: number,
): Promise<PlaceSelection | null> {
  if (!isGoogleMapsConfigured()) {
    return {
      label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      latitude,
      longitude,
    };
  }
  const url = mapsUrl('geocode/json', {
    latlng: `${latitude},${longitude}`,
  });
  const res = await fetch(url);
  const data = (await res.json()) as {
    status?: string;
    results?: Array<Parameters<typeof geocodeResultToSelection>[0]>;
  };
  const result = data.results?.[0];
  if (!result) {
    return {
      label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      latitude,
      longitude,
    };
  }
  return geocodeResultToSelection(result, latitude, longitude);
}

export function parseCoord(value: string): number | null {
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location access',
      message: 'FrestoNow Vendor uses your location to fill the store address.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function getCurrentCoordinates(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({ latitude: coords.latitude, longitude: coords.longitude });
      },
      error => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  });
}
