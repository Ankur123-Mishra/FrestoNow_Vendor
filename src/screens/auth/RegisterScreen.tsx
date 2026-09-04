import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ImagePlus } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppSwitchRow, Chip } from '@/components/ui/AppSwitchRow';
import { getModuleMeta } from '@/config/modules';
import type { ModuleType } from '@/config/constants';
import { GeoLocationField, placeToStoreFields } from '@/shared/location/GeoLocationField';
import type { PlaceSelection } from '@/shared/location/googleMaps';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import type {
  AuthNavigation,
  PickedImage,
  RegisterPayload,
  RegisterRoute,
  RegisterStorePayload,
} from '@/types';
import {
  digitsPhone,
  isValidEmail,
  isValidPhone,
  isValidPincode,
} from '@/utils/validators';

type Step = 'account' | 'business' | 'stores' | 'review';
type StoreModule = 'FOOD' | 'GROCERY';

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

const MAX_STORE_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_FSSAI_FILE_SIZE = 10 * 1024 * 1024;

type StoreDraft = {
  displayName: string;
  storeType: string;
  contactPhone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  openTime: string;
  closeTime: string;
  fssaiLicenseNo: string;
  deliveryRadiusKm: string;
  avgPrepTimeMins: string;
  minOrderValue: string;
  description: string;
  hasColdStorage: boolean;
  expressDelivery: boolean;
};

type StoreMedia = {
  logo: PickedImage | null;
  cover: PickedImage | null;
  fssai: PickedImage | null;
};

const EMPTY_STORE: StoreDraft = {
  displayName: '',
  storeType: '',
  contactPhone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  latitude: '',
  longitude: '',
  openTime: '09:00',
  closeTime: '22:00',
  fssaiLicenseNo: '',
  deliveryRadiusKm: '5',
  avgPrepTimeMins: '30',
  minOrderValue: '',
  description: '',
  hasColdStorage: false,
  expressDelivery: false,
};

const EMPTY_MEDIA: StoreMedia = {
  logo: null,
  cover: null,
  fssai: null,
};

function numOrNull(value: string): number | null {
  const v = value.trim();
  if (!v) {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function validLatLng(lat: string, lng: string) {
  const latitude = numOrNull(lat);
  const longitude = numOrNull(lng);
  return (
    latitude != null &&
    longitude != null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function mapPicked(asset: { uri?: string; type?: string; fileName?: string; fileSize?: number } | undefined): PickedImage | null {
  if (!asset?.uri) {
    return null;
  }
  return { uri: asset.uri, type: asset.type, fileName: asset.fileName };
}

async function pickGalleryImage() {
  const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
  if (result.didCancel) {
    return null;
  }
  const asset = result.assets?.[0];
  if (asset?.fileSize && asset.fileSize > MAX_STORE_IMAGE_SIZE) {
    throw new Error('Image must be 5MB or smaller');
  }
  return mapPicked(asset);
}

async function pickFssaiFile() {
  const result = await launchImageLibrary({
    mediaType: 'mixed',
    quality: 0.8,
    selectionLimit: 1,
  });
  if (result.didCancel) {
    return null;
  }
  const asset = result.assets?.[0];
  if (asset?.fileSize && asset.fileSize > MAX_FSSAI_FILE_SIZE) {
    throw new Error('FSSAI document must be 10MB or smaller');
  }
  return mapPicked(asset);
}

function ImagePickerRow({
  label,
  hint,
  previewUri,
  fileName,
  cover,
  onPick,
}: {
  label: string;
  hint: string;
  previewUri?: string;
  fileName?: string;
  cover?: boolean;
  onPick: () => void;
}) {
  return (
    <View style={styles.imageBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
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
            <Text style={styles.imageText}>{fileName || label}</Text>
            <Text style={styles.imageHint}>{hint}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

function StepBar({
  steps,
  current,
}: {
  steps: Step[];
  current: Step;
}) {
  const labels: Record<Step, string> = {
    account: 'Account',
    business: 'Business',
    stores: 'Store',
    review: 'Review',
  };
  const index = steps.indexOf(current);
  return (
    <View style={styles.stepBar}>
      {steps.map((step, i) => {
        const active = i === index;
        const done = i < index;
        return (
          <View key={step} style={styles.stepItem}>
            <View style={[styles.stepDot, (active || done) && styles.stepDotOn]}>
              <Text style={[styles.stepDotText, (active || done) && styles.stepDotTextOn]}>
                {i + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelOn]}>{labels[step]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) {
    return null;
  }
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

export function RegisterScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const route = useRoute<RegisterRoute>();
  const services = route.params?.services ?? [];
  const register = useAuthStore(s => s.register);
  const loading = useAuthStore(s => s.loading);
  const showToast = useToastStore(s => s.show);

  const needsStores = services.includes('FOOD') || services.includes('GROCERY');
  const storeModules = useMemo(
    () => (['FOOD', 'GROCERY'] as const).filter(m => services.includes(m)),
    [services],
  );

  const steps = useMemo(() => {
    const list: Step[] = ['account', 'business'];
    if (needsStores) {
      list.push('stores');
    }
    list.push('review');
    return list;
  }, [needsStores]);

  const [step, setStep] = useState<Step>('account');
  const [name, setName] = useState('');
  const [shopname, setShopname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [eidNo, setEidNo] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupPin, setPickupPin] = useState('');
  const [pickupLatitude, setPickupLatitude] = useState('');
  const [pickupLongitude, setPickupLongitude] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [foodStore, setFoodStore] = useState<StoreDraft>({ ...EMPTY_STORE });
  const [groceryStore, setGroceryStore] = useState<StoreDraft>({ ...EMPTY_STORE });
  const [foodMedia, setFoodMedia] = useState<StoreMedia>({ ...EMPTY_MEDIA });
  const [groceryMedia, setGroceryMedia] = useState<StoreMedia>({ ...EMPTY_MEDIA });

  useEffect(() => {
    if (!services.length) {
      navigation.replace('ModuleSelect');
    }
  }, [services.length, navigation]);

  const stepIndex = steps.indexOf(step);
  const serviceLabels = services.map(s => getModuleMeta(s as ModuleType).label).join(', ');

  function seedStoreDefaults() {
    setFoodStore(s => ({
      ...s,
      displayName: s.displayName || shopname.trim(),
      contactPhone: s.contactPhone || phone.trim(),
    }));
    setGroceryStore(s => ({
      ...s,
      displayName: s.displayName || shopname.trim(),
      contactPhone: s.contactPhone || phone.trim(),
    }));
  }

  function validateStep(current: Step): string | null {
    if (current === 'account') {
      if (!name.trim() || !shopname.trim() || !email.trim() || !phone.trim() || !password) {
        return 'Fill name, shop name, email, phone and password';
      }
      if (!isValidEmail(email)) {
        return 'Enter a valid email';
      }
      if (!isValidPhone(digitsPhone(phone))) {
        return 'Enter a 10-digit phone';
      }
      if (password.length < 6) {
        return 'Password must be at least 6 characters';
      }
    }
    if (current === 'business') {
      if (
        !pickupLocation.trim() ||
        !pickupPin.trim() ||
        !bankName.trim() ||
        !bankAccount.trim() ||
        !bankIfsc.trim()
      ) {
        return 'Pickup address and bank details are required for approval';
      }
      if (!isValidPincode(pickupPin)) {
        return 'Enter a 6-digit PIN code';
      }
    }
    if (current === 'stores') {
      for (const moduleType of storeModules) {
        const store = moduleType === 'FOOD' ? foodStore : groceryStore;
        const media = moduleType === 'FOOD' ? foodMedia : groceryMedia;
        const label = moduleType === 'FOOD' ? 'Food' : 'Grocery';
        if (!store.storeType) {
          return `${label}: select store type`;
        }
        if (
          !store.displayName.trim() ||
          !store.contactPhone.trim() ||
          !store.address.trim() ||
          !store.city.trim() ||
          !store.state.trim() ||
          !store.pincode.trim() ||
          !store.openTime ||
          !store.closeTime
        ) {
          return `${label}: fill name, phone, full address and hours`;
        }
        if (!isValidPhone(digitsPhone(store.contactPhone))) {
          return `${label}: enter a 10-digit phone`;
        }
        if (!isValidPincode(store.pincode)) {
          return `${label}: enter a 6-digit PIN code`;
        }
        if (!validLatLng(store.latitude, store.longitude)) {
          return `${label}: set map location (latitude / longitude)`;
        }
        if (moduleType === 'FOOD' && !store.fssaiLicenseNo.trim()) {
          return 'Food: FSSAI license number is required';
        }
        if (moduleType === 'FOOD' && !media.fssai) {
          return 'Food: upload FSSAI certificate (image or PDF)';
        }
      }
    }
    return null;
  }

  function goNext() {
    const problem = validateStep(step);
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    if (step === 'account') {
      seedStoreDefaults();
    }
    const next = steps[stepIndex + 1];
    if (next) {
      setStep(next);
    }
  }

  function goBack() {
    if (stepIndex <= 0) {
      navigation.goBack();
      return;
    }
    setStep(steps[stepIndex - 1]);
  }

  function buildStorePayload(moduleType: StoreModule, store: StoreDraft): RegisterStorePayload {
    return {
      moduleType,
      displayName: store.displayName.trim(),
      storeType: store.storeType,
      contactPhone: digitsPhone(store.contactPhone),
      address: store.address.trim(),
      city: store.city.trim(),
      state: store.state.trim(),
      pincode: store.pincode.trim(),
      latitude: Number(store.latitude),
      longitude: Number(store.longitude),
      openTime: store.openTime,
      closeTime: store.closeTime,
      fssaiLicenseNo: store.fssaiLicenseNo.trim() || undefined,
      deliveryRadiusKm: numOrNull(store.deliveryRadiusKm) ?? undefined,
      avgPrepTimeMins: numOrNull(store.avgPrepTimeMins) ?? undefined,
      minOrderValue: numOrNull(store.minOrderValue) ?? undefined,
      description: store.description.trim() || undefined,
      hasColdStorage: store.hasColdStorage,
      expressDelivery: store.expressDelivery,
    };
  }

  async function onPickStoreImage(moduleType: StoreModule, kind: 'logo' | 'cover') {
    try {
      const file = await pickGalleryImage();
      if (!file) {
        return;
      }
      const setMedia = moduleType === 'FOOD' ? setFoodMedia : setGroceryMedia;
      setMedia(m => ({ ...m, [kind]: file }));
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  async function onPickFssai(moduleType: StoreModule) {
    try {
      const file = await pickFssaiFile();
      if (!file) {
        return;
      }
      const setMedia = moduleType === 'FOOD' ? setFoodMedia : setGroceryMedia;
      setMedia(m => ({ ...m, fssai: file }));
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  async function onSubmit() {
    for (const s of steps) {
      if (s === 'review') {
        continue;
      }
      const problem = validateStep(s);
      if (problem) {
        showToast(problem, 'error');
        setStep(s);
        return;
      }
    }

    const stores = storeModules.map(moduleType =>
      buildStorePayload(moduleType, moduleType === 'FOOD' ? foodStore : groceryStore),
    );

    const payload: RegisterPayload = {
      name: name.trim(),
      shopname: shopname.trim(),
      email: email.trim(),
      phone: digitsPhone(phone),
      password,
      services,
      moduleType: services[0],
      gst_no: gstNo.trim() || undefined,
      eid_no: eidNo.trim() || undefined,
      pickup_location: pickupLocation.trim(),
      pickup_pin_code: pickupPin.trim(),
      bank_name: bankName.trim(),
      bank_account_no: bankAccount.trim(),
      bank_ifsc: bankIfsc.trim().toUpperCase(),
      stores: stores.length ? stores : undefined,
      foodMedia: services.includes('FOOD') ? foodMedia : undefined,
      groceryMedia: services.includes('GROCERY') ? groceryMedia : undefined,
    };

    try {
      const message = await register(payload);
      showToast(message, 'success');
      navigation.navigate('Login');
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  function renderStoreFields(
    moduleType: StoreModule,
    store: StoreDraft,
    setStore: React.Dispatch<React.SetStateAction<StoreDraft>>,
    media: StoreMedia,
  ) {
    const types = moduleType === 'FOOD' ? FOOD_STORE_TYPES : GROCERY_STORE_TYPES;
    const title = moduleType === 'FOOD' ? 'Food outlet / restaurant' : 'Grocery store';
    const fssaiRequired = moduleType === 'FOOD';

    return (
      <View key={moduleType} style={styles.storeBlock}>
        <Text style={styles.storeTitle}>{title}</Text>
        <AppInput
          label="Display name"
          value={store.displayName}
          onChangeText={v => setStore(s => ({ ...s, displayName: v }))}
        />
        <Text style={styles.fieldLabel}>Store type</Text>
        <View style={styles.chips}>
          {types.map(type => (
            <Chip
              key={type.value}
              label={type.label}
              selected={store.storeType === type.value}
              onPress={() => setStore(s => ({ ...s, storeType: type.value }))}
            />
          ))}
        </View>
        <ImagePickerRow
          label="Logo"
          hint="JPEG, PNG or WebP · up to 5MB"
          previewUri={media.logo?.uri}
          onPick={() => onPickStoreImage(moduleType, 'logo')}
        />
        <ImagePickerRow
          label="Cover image"
          hint="Optional background image"
          previewUri={media.cover?.uri}
          cover
          onPick={() => onPickStoreImage(moduleType, 'cover')}
        />
        <AppInput
          label="Contact phone"
          keyboardType="phone-pad"
          maxLength={10}
          value={store.contactPhone}
          onChangeText={v => setStore(s => ({ ...s, contactPhone: digitsPhone(v) }))}
        />
        <AppInput
          label="Address"
          value={store.address}
          onChangeText={v => setStore(s => ({ ...s, address: v }))}
          multiline
        />
        <AppInput
          label="City"
          value={store.city}
          onChangeText={v => setStore(s => ({ ...s, city: v }))}
        />
        <AppInput
          label="State"
          value={store.state}
          onChangeText={v => setStore(s => ({ ...s, state: v }))}
        />
        <AppInput
          label="PIN code"
          keyboardType="number-pad"
          maxLength={6}
          value={store.pincode}
          onChangeText={v => setStore(s => ({ ...s, pincode: v.replace(/\D/g, '').slice(0, 6) }))}
        />
        <GeoLocationField
          latitude={store.latitude}
          longitude={store.longitude}
          initialQuery={store.address || store.city}
          radiusKm={store.deliveryRadiusKm ? Number(store.deliveryRadiusKm) : null}
          hint="Map location is required for Food / Grocery approval."
          onPick={(place: PlaceSelection) => {
            const fields = placeToStoreFields(place);
            setStore(s => ({
              ...s,
              address: fields.address || place.label || s.address,
              city: fields.city || s.city,
              state: fields.state || s.state,
              pincode: fields.pincode || s.pincode,
              latitude: fields.latitude,
              longitude: fields.longitude,
            }));
          }}
          onLatLngChange={(lat, lng) => {
            setStore(s => ({ ...s, latitude: lat, longitude: lng }));
          }}
        />
        <AppInput
          label="Opening time"
          value={store.openTime}
          onChangeText={v => setStore(s => ({ ...s, openTime: v }))}
          placeholder="09:00"
        />
        <AppInput
          label="Closing time"
          value={store.closeTime}
          onChangeText={v => setStore(s => ({ ...s, closeTime: v }))}
          placeholder="22:00"
        />
        <AppInput
          label={fssaiRequired ? 'FSSAI license no' : 'FSSAI license no (optional)'}
          value={store.fssaiLicenseNo}
          onChangeText={v => setStore(s => ({ ...s, fssaiLicenseNo: v }))}
        />
        <ImagePickerRow
          label={fssaiRequired ? 'FSSAI certificate' : 'FSSAI certificate (optional)'}
          hint="JPEG, PNG, WebP or PDF · up to 10MB"
          previewUri={media.fssai?.type?.includes('pdf') ? undefined : media.fssai?.uri}
          fileName={media.fssai?.fileName}
          onPick={() => onPickFssai(moduleType)}
        />
        <AppInput
          label="Delivery radius (km)"
          keyboardType="decimal-pad"
          value={store.deliveryRadiusKm}
          onChangeText={v => setStore(s => ({ ...s, deliveryRadiusKm: v }))}
        />
        {moduleType === 'FOOD' ? (
          <AppInput
            label="Avg prep time (mins)"
            keyboardType="number-pad"
            value={store.avgPrepTimeMins}
            onChangeText={v => setStore(s => ({ ...s, avgPrepTimeMins: v }))}
          />
        ) : (
          <>
            <AppInput
              label="Min order value (₹)"
              keyboardType="decimal-pad"
              value={store.minOrderValue}
              onChangeText={v => setStore(s => ({ ...s, minOrderValue: v }))}
            />
            <AppSwitchRow
              label="Cold storage available"
              value={store.hasColdStorage}
              onValueChange={v => setStore(s => ({ ...s, hasColdStorage: v }))}
            />
          </>
        )}
        <AppInput
          label="Short description"
          value={store.description}
          onChangeText={v => setStore(s => ({ ...s, description: v }))}
          multiline
          optional
        />
      </View>
    );
  }

  if (!services.length) {
    return null;
  }

  return (
    <Screen scroll>
      <AppHeader
        title="Become a seller"
        subtitle={`Services: ${serviceLabels}`}
        showBack
        onBack={goBack}
      />
      <StepBar steps={steps} current={step} />

      <View style={styles.card}>
        {step === 'account' ? (
          <>
            <Text style={styles.sectionTitle}>Account</Text>
            <AppInput
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Jane Doe"
            />
            <AppInput
              label="Shop / brand name"
              value={shopname}
              onChangeText={setShopname}
              placeholder="My Store"
            />
            <AppInput
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="vendor@example.com"
            />
            <AppInput
              label="Phone"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={v => setPhone(digitsPhone(v))}
              placeholder="9876543210"
              maxLength={10}
            />
            <AppInput
              label="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Min 6 characters"
            />
          </>
        ) : null}

        {step === 'business' ? (
          <>
            <Text style={styles.sectionTitle}>Business & bank</Text>
            <AppInput
              label="Pickup / warehouse address"
              value={pickupLocation}
              onChangeText={setPickupLocation}
              placeholder="Main Warehouse"
            />
            <AppInput
              label="Pickup PIN code"
              keyboardType="number-pad"
              value={pickupPin}
              onChangeText={v => setPickupPin(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="110001"
              maxLength={6}
            />
            <GeoLocationField
              latitude={pickupLatitude}
              longitude={pickupLongitude}
              initialQuery={pickupLocation}
              showCoordinates={false}
              searchPlaceholder="Search pickup address or landmark"
              hint="Search, use current location, or drop a pin. Pickup address and PIN fill automatically."
              onPick={(place: PlaceSelection) => {
                setPickupLocation(place.street || place.label || pickupLocation);
                if (place.pincode) {
                  setPickupPin(place.pincode);
                }
                setPickupLatitude(String(place.latitude));
                setPickupLongitude(String(place.longitude));
              }}
              onLatLngChange={(lat, lng) => {
                setPickupLatitude(lat);
                setPickupLongitude(lng);
              }}
            />
            <AppInput
              label="GST number"
              value={gstNo}
              onChangeText={setGstNo}
              optional
              autoCapitalize="characters"
              placeholder="Optional"
            />
            <AppInput
              label="EID / trade license"
              value={eidNo}
              onChangeText={setEidNo}
              optional
              placeholder="Optional"
            />
            <AppInput
              label="Bank name"
              value={bankName}
              onChangeText={setBankName}
              placeholder="State Bank"
            />
            <AppInput
              label="Bank account no"
              keyboardType="number-pad"
              value={bankAccount}
              onChangeText={setBankAccount}
              placeholder="012345678912"
            />
            <AppInput
              label="Bank IFSC"
              autoCapitalize="characters"
              value={bankIfsc}
              onChangeText={setBankIfsc}
              placeholder="SBIN0001234"
            />
          </>
        ) : null}

        {step === 'stores' ? (
          <>
            <Text style={styles.sectionTitle}>Store / restaurant</Text>
            <Text style={styles.helpText}>
              Complete a profile for each Food / Grocery service you selected. Food requires FSSAI.
            </Text>
            {storeModules.map(moduleType =>
              renderStoreFields(
                moduleType,
                moduleType === 'FOOD' ? foodStore : groceryStore,
                moduleType === 'FOOD' ? setFoodStore : setGroceryStore,
                moduleType === 'FOOD' ? foodMedia : groceryMedia,
              ),
            )}
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <Text style={styles.sectionTitle}>Review & submit</Text>
            <ReviewRow label="Services" value={serviceLabels} />
            <ReviewRow label="Owner" value={name} />
            <ReviewRow label="Shop" value={shopname} />
            <ReviewRow label="Email" value={email} />
            <ReviewRow label="Phone" value={phone} />
            <ReviewRow label="Pickup" value={`${pickupLocation}, ${pickupPin}`} />
            {gstNo.trim() ? <ReviewRow label="GST" value={gstNo} /> : null}
            <ReviewRow label="Bank" value={`${bankName} · ${bankIfsc.toUpperCase()}`} />
            {storeModules.map(moduleType => {
              const store = moduleType === 'FOOD' ? foodStore : groceryStore;
              return (
                <ReviewRow
                  key={moduleType}
                  label={moduleType === 'FOOD' ? 'Food store' : 'Grocery store'}
                  value={`${store.displayName} (${store.storeType}) · ${store.city}`}
                />
              );
            })}
            <Text style={styles.helpText}>
              After submit, wait for admin approval. You can login once the account is activated.
            </Text>
          </>
        ) : null}

        <View style={styles.actions}>
          {step === 'review' ? (
            <AppButton title="Submit for approval" onPress={onSubmit} loading={loading} />
          ) : (
            <AppButton title="Continue" onPress={goNext} />
          )}
          <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkWrap}>
            <Text style={styles.link}>Already registered? Login</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  helpText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 4,
  },
  stepItem: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepDotOn: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  stepDotText: { fontSize: 12, fontWeight: '800', color: colors.muted },
  stepDotTextOn: { color: colors.white },
  stepLabel: { fontSize: 10, fontWeight: '700', color: colors.muted },
  stepLabelOn: { color: colors.brand[800] },
  storeBlock: {
    marginBottom: 20,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  storeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  imageBlock: { marginBottom: 12 },
  imagePressable: { borderRadius: radius.lg, overflow: 'hidden' },
  imagePlaceholder: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand[50],
  },
  coverPlaceholder: { minHeight: 110, justifyContent: 'center' },
  imageText: { fontWeight: '800', color: colors.brand[800], fontSize: 13 },
  imageHint: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  previewWrap: { position: 'relative' },
  logoPreview: { width: 88, height: 88, borderRadius: radius.lg },
  coverPreview: { width: '100%', height: 140, borderRadius: radius.lg },
  previewOverlay: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  previewOverlayText: { color: colors.white, fontWeight: '700', fontSize: 11 },
  reviewRow: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reviewLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  reviewValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  actions: { marginTop: 8 },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  link: { color: colors.brand[700], fontWeight: '700' },
});
