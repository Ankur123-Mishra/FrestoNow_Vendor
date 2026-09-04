import React, { useCallback, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ImagePlus } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { Chip } from '@/components/ui/AppSwitchRow';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { buildStoreFormData, vendorService } from '@/api/services/vendorService';
import { GeoLocationField, placeToStoreFields } from '@/shared/location/GeoLocationField';
import type { PlaceSelection } from '@/shared/location/googleMaps';
import { getModuleMeta } from '@/config/modules';
import { getActiveModule, useModuleStore } from '@/store/moduleStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import type { PickedImage } from '@/types';
import { getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { pickString } from '@/utils/format';
import { resolveMediaUrl } from '@/utils/media';

const FOOD_STORE_TYPES = [
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'CAFE', label: 'Cafe' },
  { value: 'FAST_FOOD', label: 'Fast food' },
  { value: 'BAKERY', label: 'Bakery' },
  { value: 'SWEETS', label: 'Sweets shop' },
  { value: 'CLOUD_KITCHEN', label: 'Cloud kitchen' },
  { value: 'DHABA', label: 'Dhaba' },
] as const;

const GROCERY_STORE_TYPES = [
  { value: 'KIRANA', label: 'Kirana / General store' },
  { value: 'SUPERMARKET', label: 'Supermarket' },
  { value: 'SPECIALTY', label: 'Specialty store' },
  { value: 'PHARMA', label: 'Pharmacy' },
  { value: 'WHOLESALE', label: 'Wholesale' },
] as const;

const SCHEDULE_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AppCard style={styles.section}>
      <SectionTitle title={title} />
      {children}
    </AppCard>
  );
}

function mapPicked(asset: { uri?: string; type?: string; fileName?: string } | undefined): PickedImage | null {
  if (!asset?.uri) {
    return null;
  }
  return { uri: asset.uri, type: asset.type, fileName: asset.fileName };
}

async function pickStoreImage() {
  const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
  if (result.didCancel) {
    return null;
  }
  return mapPicked(result.assets?.[0]);
}

function numOrNull(value: string): number | null {
  const v = value.trim();
  if (!v) {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseWeeklySchedule(value: string) {
  const schedule: Record<string, Array<{ open: string; close: string }>> = {};
  for (const line of value
    .split('\n')
    .map(part => part.trim())
    .filter(Boolean)) {
    const match = /^([a-z]{3})(?:-([a-z]{3}))?\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/i.exec(line);
    if (!match) {
      throw new Error(`Invalid schedule line: ${line}`);
    }
    const from = SCHEDULE_DAYS.indexOf(match[1].toLowerCase());
    const to = SCHEDULE_DAYS.indexOf((match[2] || match[1]).toLowerCase());
    if (from < 0 || to < 0) {
      throw new Error(`Invalid schedule day: ${line}`);
    }
    const indexes =
      from <= to
        ? SCHEDULE_DAYS.slice(from, to + 1)
        : [...SCHEDULE_DAYS.slice(from), ...SCHEDULE_DAYS.slice(0, to + 1)];
    for (const day of indexes) {
      schedule[day] = [{ open: match[3], close: match[4] }];
    }
  }
  return schedule;
}

function formatWeeklySchedule(
  schedule: Record<string, Array<{ open: string; close: string }>> | null | undefined,
) {
  return SCHEDULE_DAYS.flatMap(day => {
    const window = schedule?.[day]?.[0];
    return window ? [`${day[0].toUpperCase()}${day.slice(1)} ${window.open}-${window.close}`] : [];
  }).join('\n');
}

function fssaiDocumentUrlFromStore(store: Record<string, unknown>) {
  const docs = store.documents;
  if (docs && typeof docs === 'object' && !Array.isArray(docs)) {
    const url = (docs as { fssaiDocumentUrl?: string }).fssaiDocumentUrl;
    return url ? String(url) : null;
  }
  return null;
}

function documentUrlsFromStore(store: Record<string, unknown>): string {
  const metadata = (store.metadata ?? {}) as Record<string, unknown>;
  const food = (metadata.food ?? {}) as Record<string, unknown>;
  if (Array.isArray(food.documentUrls)) {
    return food.documentUrls.map(String).join('\n');
  }
  const docs = store.documents;
  if (Array.isArray(docs)) {
    return docs.join('\n');
  }
  if (docs && typeof docs === 'object' && Array.isArray((docs as { urls?: unknown }).urls)) {
    return ((docs as { urls: unknown[] }).urls || []).map(String).join('\n');
  }
  return '';
}

function normalizeStoreType(raw: string, module: string) {
  if (!raw) {
    return '';
  }
  const options = module === 'FOOD' ? FOOD_STORE_TYPES : GROCERY_STORE_TYPES;
  const upper = raw.toUpperCase().replace(/\s+/g, '_');
  const byValue = options.find(item => item.value === upper);
  if (byValue) {
    return byValue.value;
  }
  const byLabel = options.find(item => item.label.toLowerCase() === raw.toLowerCase());
  return byLabel?.value || raw;
}

function ImagePickerRow({
  label,
  hint,
  previewUri,
  cover,
  onPick,
}: {
  label: string;
  hint: string;
  previewUri?: string;
  cover?: boolean;
  onPick: () => void;
}) {
  return (
    <View style={styles.imageBlock}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onPick} style={styles.imagePressable}>
        {previewUri ? (
          <View style={styles.previewWrap}>
            <Image
              source={{ uri: previewUri }}
              style={cover ? styles.coverPreview : styles.logoPreview}
              resizeMode="cover"
            />
            <View style={styles.previewOverlay}>
              <ImagePlus size={16} color={colors.white} />
              <Text style={styles.previewOverlayText}>Change</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.imagePlaceholder, cover ? styles.coverPlaceholder : null]}>
            <ImagePlus size={22} color={colors.brand[700]} />
            <Text style={styles.imageText}>{label}</Text>
            <Text style={styles.imageHint}>{hint}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function StoreProfileScreen() {
  const showToast = useToastStore(s => s.show);
  const activeModule = useModuleStore(s => s.activeModule);
  const meta = getModuleMeta(activeModule);
  const isFood = activeModule === 'FOOD';
  const isGrocery = activeModule === 'GROCERY';
  const storeTypes = isFood ? FOOD_STORE_TYPES : GROCERY_STORE_TYPES;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingMetadata, setExistingMetadata] = useState<Record<string, unknown>>({});
  const [existingFssaiDocUrl, setExistingFssaiDocUrl] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [storeType, setStoreType] = useState('');
  const [fssaiLicenseNo, setFssaiLicenseNo] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [packagingCharge, setPackagingCharge] = useState('');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('');
  const [avgPrepTimeMins, setAvgPrepTimeMins] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState('');
  const [weeklySchedule, setWeeklySchedule] = useState('');
  const [temporarilyClosedUntil, setTemporarilyClosedUntil] = useState('');
  const [documentUrls, setDocumentUrls] = useState('');
  const [hasColdStorage, setHasColdStorage] = useState(false);
  const [expressDelivery, setExpressDelivery] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const [logoImage, setLogoImage] = useState<PickedImage | null>(null);
  const [coverImage, setCoverImage] = useState<PickedImage | null>(null);
  const [fssaiDocument, setFssaiDocument] = useState<PickedImage | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const [coverPreview, setCoverPreview] = useState<string | undefined>();

  const load = useCallback(async () => {
    try {
      const res = await vendorService.getStoreProfile(getActiveModule());
      const payload = unwrapPayload(res.data) as { store?: Record<string, unknown> } | Record<string, unknown>;
      const store =
        payload && typeof payload === 'object' && 'store' in payload
          ? ((payload as { store?: Record<string, unknown> }).store || {})
          : ((payload as Record<string, unknown>) || {});

      const metadata = (store.metadata ?? {}) as Record<string, unknown>;
      const food = (metadata.food ?? {}) as Record<string, unknown>;
      setExistingMetadata(metadata);

      setDisplayName(pickString(store.displayName, store.shopname, store.name));
      setContactPhone(pickString(store.contactPhone, store.phone));
      setWhatsappPhone(pickString(store.whatsappPhone));
      setAddress(pickString(store.address, store.addressLine1));
      setCity(pickString(store.city));
      setStateName(pickString(store.state));
      setPincode(pickString(store.pincode));
      setLatitude(store.latitude != null && store.latitude !== '' ? String(store.latitude) : '');
      setLongitude(store.longitude != null && store.longitude !== '' ? String(store.longitude) : '');
      setOpenTime(pickString(store.openTime, '09:00'));
      setCloseTime(pickString(store.closeTime, '22:00'));
      setStoreType(normalizeStoreType(pickString(store.storeType), getActiveModule()));
      setFssaiLicenseNo(pickString(store.fssaiLicenseNo));
      setMinOrderValue(store.minOrderValue != null ? String(store.minOrderValue) : '');
      setPackagingCharge(store.packagingCharge != null ? String(store.packagingCharge) : '');
      setDeliveryRadiusKm(store.deliveryRadiusKm != null ? String(store.deliveryRadiusKm) : '');
      setAvgPrepTimeMins(store.avgPrepTimeMins != null ? String(store.avgPrepTimeMins) : '');
      setDeliveryFee(
        store.baseDeliveryFee != null
          ? String(store.baseDeliveryFee)
          : food.deliveryFee != null
            ? String(food.deliveryFee)
            : '',
      );
      setFreeDeliveryAbove(food.freeDeliveryAbove != null ? String(food.freeDeliveryAbove) : '');
      setWeeklySchedule(
        formatWeeklySchedule(store.weeklyHours as Record<string, Array<{ open: string; close: string }>>) ||
          pickString(food.weeklySchedule),
      );
      const closedUntil = pickString(store.temporaryClosedUntil, food.temporarilyClosedUntil);
      setTemporarilyClosedUntil(closedUntil ? closedUntil.slice(0, 16) : '');
      setDocumentUrls(documentUrlsFromStore(store));
      setHasColdStorage(Boolean(store.hasColdStorage));
      setExpressDelivery(Boolean(store.expressDelivery));
      setApprovalStatus(pickString(store.approvalStatus));
      setRejectionReason(pickString(store.rejectionReason));

      setLogoImage(null);
      setCoverImage(null);
      setFssaiDocument(null);
      setLogoPreview(resolveMediaUrl(pickString(store.logoUrl, store.image)));
      setCoverPreview(resolveMediaUrl(pickString(store.coverImageUrl, store.coverImage)));
      setExistingFssaiDocUrl(fssaiDocumentUrlFromStore(store));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load store profile'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const onPickLogo = async () => {
    const picked = await pickStoreImage();
    if (!picked) {
      return;
    }
    setLogoImage(picked);
    setLogoPreview(picked.uri);
  };

  const onPickCover = async () => {
    const picked = await pickStoreImage();
    if (!picked) {
      return;
    }
    setCoverImage(picked);
    setCoverPreview(picked.uri);
  };

  const onPickFssai = async () => {
    const picked = await pickStoreImage();
    if (!picked) {
      return;
    }
    setFssaiDocument(picked);
  };

  const onSave = async () => {
    if (!displayName.trim()) {
      showToast('Store name is required', 'error');
      return;
    }

    let weeklyHours: Record<string, Array<{ open: string; close: string }>> | undefined;
    if (isFood && weeklySchedule.trim()) {
      try {
        weeklyHours = parseWeeklySchedule(weeklySchedule);
      } catch (error) {
        showToast(getErrorMessage(error, 'Invalid weekly schedule'), 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const docUrlList = documentUrls
        .split('\n')
        .map(value => value.trim())
        .filter(Boolean);

      const payload = {
        moduleType: activeModule,
        displayName: displayName.trim(),
        contactPhone: contactPhone.trim(),
        whatsappPhone: isFood ? whatsappPhone.trim() : undefined,
        address: address.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        latitude: numOrNull(latitude),
        longitude: numOrNull(longitude),
        openTime: openTime.trim(),
        closeTime: closeTime.trim(),
        minOrderValue: numOrNull(minOrderValue),
        packagingCharge: numOrNull(packagingCharge),
        deliveryRadiusKm: numOrNull(deliveryRadiusKm),
        avgPrepTimeMins: numOrNull(avgPrepTimeMins),
        storeType: storeType || undefined,
        fssaiLicenseNo: fssaiLicenseNo.trim(),
        hasColdStorage: isGrocery ? hasColdStorage : false,
        expressDelivery: isGrocery ? expressDelivery : false,
        weeklyHours: isFood ? weeklyHours : undefined,
        temporaryClosedUntil: isFood ? temporarilyClosedUntil.trim() || null : undefined,
        baseDeliveryFee: numOrNull(deliveryFee),
        documents: isFood
          ? {
              urls: docUrlList,
              ...(existingFssaiDocUrl ? { fssaiDocumentUrl: existingFssaiDocUrl } : {}),
            }
          : undefined,
        metadata: isFood
          ? {
              ...existingMetadata,
              food: {
                weeklySchedule: weeklySchedule.trim(),
                temporarilyClosedUntil: temporarilyClosedUntil.trim() || null,
                deliveryFee: numOrNull(deliveryFee),
                freeDeliveryAbove: numOrNull(freeDeliveryAbove),
                documentUrls: docUrlList,
              },
            }
          : existingMetadata,
      };

      await vendorService.upsertStore(
        buildStoreFormData(payload, {
          image: logoImage,
          coverImage,
          fssaiDocument,
        }),
      );
      showToast('Store profile saved', 'success');
      setLogoImage(null);
      setCoverImage(null);
      setFssaiDocument(null);
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not save store profile'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppLoader label="Loading store profile" />
      </Screen>
    );
  }

  const fssaiLabel = fssaiDocument?.fileName || (existingFssaiDocUrl ? 'View current document' : null);

  return (
    <Screen scroll>
      <AppHeader
        title="My store"
        subtitle={isFood ? 'Restaurant profile' : `${meta.label} storefront setup`}
        showBack
      />

      {isFood && (approvalStatus || rejectionReason) ? (
        <AppCard style={styles.section}>
          <Text style={styles.approvalTitle}>
            Restaurant approval: {approvalStatus || 'Pending'}
          </Text>
          {rejectionReason ? <Text style={styles.rejection}>Reason: {rejectionReason}</Text> : null}
          <Text style={styles.helpText}>
            FSSAI and document references are sent with the restaurant profile for admin review.
          </Text>
        </AppCard>
      ) : null}

      <FormSection title="Identity & media">
        <AppInput label="Store name" value={displayName} onChangeText={setDisplayName} />
        <ImagePickerRow
          label={isFood ? 'Restaurant logo' : 'Store logo'}
          hint="JPEG, PNG or WebP · up to 5MB"
          previewUri={logoPreview}
          onPick={onPickLogo}
        />
        <ImagePickerRow
          label="Background / cover image"
          hint="Shown on your restaurant page"
          previewUri={coverPreview}
          cover
          onPick={onPickCover}
        />
        <AppInput
          label="Contact phone"
          value={contactPhone}
          onChangeText={setContactPhone}
          keyboardType="phone-pad"
          optional
        />
        {isFood ? (
          <AppInput
            label="WhatsApp number"
            value={whatsappPhone}
            onChangeText={setWhatsappPhone}
            keyboardType="phone-pad"
            optional
            placeholder="Restaurant WhatsApp number"
          />
        ) : null}
      </FormSection>

      <FormSection title="Address & location">
        <AppInput
          label="Address"
          value={address}
          onChangeText={setAddress}
          multiline
          optional
        />
        <AppInput label="City" value={city} onChangeText={setCity} optional />
        <AppInput label="State" value={stateName} onChangeText={setStateName} optional />
        <AppInput
          label="PIN code"
          value={pincode}
          onChangeText={setPincode}
          keyboardType="number-pad"
          optional
        />
        <GeoLocationField
          latitude={latitude}
          longitude={longitude}
          initialQuery={address || city}
          radiusKm={deliveryRadiusKm ? Number(deliveryRadiusKm) : null}
          hint="Location is required to appear in nearby search. Use current location, search, tap map, or drag the pin."
          onPick={(place: PlaceSelection) => {
            const fields = placeToStoreFields(place);
            setAddress(fields.address || place.label || address);
            setCity(fields.city || city);
            setStateName(fields.state || stateName);
            setPincode(fields.pincode || pincode);
            setLatitude(fields.latitude);
            setLongitude(fields.longitude);
          }}
          onLatLngChange={(lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
        />
      </FormSection>

      <FormSection title="Hours & type">
        <AppInput label="Opening time" value={openTime} onChangeText={setOpenTime} placeholder="09:00" optional />
        <AppInput label="Closing time" value={closeTime} onChangeText={setCloseTime} placeholder="22:00" optional />
        <Text style={styles.label}>Store type</Text>
        <View style={styles.chips}>
          {storeTypes.map(type => (
            <Chip
              key={type.value}
              label={type.label}
              selected={storeType === type.value}
              onPress={() => setStoreType(type.value)}
            />
          ))}
        </View>
        {isFood ? (
          <>
            <AppInput
              label="Weekly schedule"
              value={weeklySchedule}
              onChangeText={setWeeklySchedule}
              multiline
              optional
              placeholder={'Mon-Fri 09:00-22:30\nSat-Sun 10:00-23:00'}
              style={styles.multiline}
            />
            <Text style={styles.helpText}>
              One day or day range per line, e.g. Mon-Fri 09:00-22:30
            </Text>
            <AppInput
              label="Temporarily closed until"
              value={temporarilyClosedUntil}
              onChangeText={setTemporarilyClosedUntil}
              optional
              placeholder="2026-09-10T18:00"
            />
          </>
        ) : null}
      </FormSection>

      <FormSection title="Delivery settings">
        <AppInput
          label="Min order value (₹)"
          value={minOrderValue}
          onChangeText={setMinOrderValue}
          keyboardType="decimal-pad"
          optional
        />
        <AppInput
          label="Packaging charge (₹)"
          value={packagingCharge}
          onChangeText={setPackagingCharge}
          keyboardType="decimal-pad"
          optional
        />
        <AppInput
          label="Delivery radius (km)"
          value={deliveryRadiusKm}
          onChangeText={setDeliveryRadiusKm}
          keyboardType="decimal-pad"
          optional
        />
        <AppInput
          label="Avg prep time (mins)"
          value={avgPrepTimeMins}
          onChangeText={setAvgPrepTimeMins}
          keyboardType="number-pad"
          optional
        />
        {isFood ? (
          <>
            <AppInput
              label="Delivery fee (₹)"
              value={deliveryFee}
              onChangeText={setDeliveryFee}
              keyboardType="decimal-pad"
              optional
            />
            <AppInput
              label="Free delivery above (₹)"
              value={freeDeliveryAbove}
              onChangeText={setFreeDeliveryAbove}
              keyboardType="decimal-pad"
              optional
            />
          </>
        ) : (
          <AppInput
            label="Base delivery fee"
            value={deliveryFee}
            onChangeText={setDeliveryFee}
            keyboardType="decimal-pad"
            optional
          />
        )}
        {isGrocery ? (
          <>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Cold storage</Text>
              <Switch
                value={hasColdStorage}
                onValueChange={setHasColdStorage}
                trackColor={{ false: colors.borderStrong, true: colors.brand[400] }}
                thumbColor={colors.white}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Express delivery</Text>
              <Switch
                value={expressDelivery}
                onValueChange={setExpressDelivery}
                trackColor={{ false: colors.borderStrong, true: colors.brand[400] }}
                thumbColor={colors.white}
              />
            </View>
          </>
        ) : null}
      </FormSection>

      <FormSection title="Compliance">
        <AppInput
          label="FSSAI license no."
          value={fssaiLicenseNo}
          onChangeText={setFssaiLicenseNo}
          autoCapitalize="characters"
          optional
          placeholder={isFood ? 'Restaurant FSSAI number' : 'For packaged food'}
        />
        <Text style={styles.label}>FSSAI certificate</Text>
        <Pressable onPress={onPickFssai} style={styles.docButton}>
          <ImagePlus size={18} color={colors.brand[700]} />
          <Text style={styles.docButtonText}>
            {fssaiDocument ? 'Change FSSAI file' : 'Upload FSSAI'}
          </Text>
        </Pressable>
        {fssaiLabel ? (
          <Pressable
            onPress={() => {
              if (!fssaiDocument && existingFssaiDocUrl) {
                const url = resolveMediaUrl(existingFssaiDocUrl);
                if (url) {
                  Linking.openURL(url).catch(() => undefined);
                }
              }
            }}
          >
            <Text style={styles.docLink}>{fssaiLabel}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.helpText}>JPEG, PNG or WebP · up to 10MB</Text>
        {isFood ? (
          <AppInput
            label="Compliance document URLs"
            value={documentUrls}
            onChangeText={setDocumentUrls}
            multiline
            optional
            placeholder="One secure document URL per line"
            style={styles.multiline}
          />
        ) : null}
      </FormSection>

      <AppButton title="Save store profile" onPress={onSave} loading={saving} style={styles.btn} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 17,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  switchRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  switchLabel: { color: colors.text, fontWeight: '600', fontSize: 15 },
  btn: { marginTop: 8, marginBottom: 24 },
  imageBlock: { marginBottom: 14 },
  imagePressable: { alignSelf: 'stretch' },
  previewWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.md,
  },
  logoPreview: { width: 96, height: 96, borderRadius: radius.md },
  coverPreview: { width: '100%', height: 140, borderRadius: radius.md },
  previewOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  previewOverlayText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  imagePlaceholder: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 4,
  },
  coverPlaceholder: { minHeight: 120 },
  imageText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  imageHint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  docButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  docButtonText: { color: colors.brand[700], fontWeight: '700' },
  docLink: { color: colors.brand[700], fontWeight: '600', marginBottom: 6 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  approvalTitle: { color: colors.text, fontWeight: '700', marginBottom: 6 },
  rejection: { color: colors.danger, marginBottom: 6 },
});
