import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MapPin } from 'lucide-react-native';
import { colors, radius, shadows } from '@/theme';
import { moderateScale } from '@/utils/responsive';
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  isGoogleMapsConfigured,
  newPlacesSessionToken,
  type PlacePrediction,
  type PlaceSelection,
} from './googleMaps';

type PlacesAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: PlaceSelection) => void;
  placeholder?: string;
  bias?: { lat: number; lng: number } | null;
};

export function PlacesAutocompleteInput({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Search area, address or landmark',
  bias,
}: PlacesAutocompleteInputProps) {
  const configured = isGoogleMapsConfigured();
  const sessionTokenRef = useRef(newPlacesSessionToken());
  const skipSearchRef = useRef(false);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setPredictions([]);
      return;
    }
    const query = value.trim();
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    if (query.length < 2) {
      setPredictions([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const next = await fetchPlacePredictions(query, {
          sessionToken: sessionTokenRef.current,
          bias,
        });
        if (!cancelled) {
          setPredictions(next);
          setError(null);
        }
      } catch (reason) {
        if (!cancelled) {
          setPredictions([]);
          setError((reason as Error).message || 'Could not search places');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bias?.lat, bias?.lng, configured, value]);

  const selectPlace = async (prediction: PlacePrediction) => {
    skipSearchRef.current = true;
    setPredictions([]);
    onChange(prediction.label);
    try {
      const place = await fetchPlaceDetails(prediction.placeId, sessionTokenRef.current);
      sessionTokenRef.current = newPlacesSessionToken();
      if (place) {
        skipSearchRef.current = true;
        onChange(place.label);
        onPlaceSelect(place);
      }
    } catch (reason) {
      setError((reason as Error).message || 'Could not load place details');
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <MapPin size={16} color={colors.muted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={configured ? placeholder : 'Maps API key missing'}
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.input}
        />
        {loading ? <ActivityIndicator size="small" color={colors.brand[600]} /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {predictions.length > 0 ? (
        <View style={styles.dropdown}>
          {predictions.map(item => (
            <Pressable
              key={item.placeId}
              onPress={() => selectPlace(item)}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
              <MapPin size={14} color={colors.brand[700]} />
              <Text style={styles.optionText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 20 },
  field: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: moderateScale(15),
    paddingVertical: 12,
  },
  error: { color: colors.danger, marginTop: 6, fontSize: 12 },
  dropdown: {
    marginTop: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadows.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionPressed: { backgroundColor: colors.brand[50] },
  optionText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600', lineHeight: 18 },
});
