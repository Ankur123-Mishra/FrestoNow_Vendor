import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ChevronDown, ChevronUp, ImagePlus, Plus, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { AppSelect, type AppSelectOption } from '@/components/ui/AppSelect';
import { AppSwitchRow, Chip } from '@/components/ui/AppSwitchRow';
import { SectionTitle } from '@/components/ui/SectionTitle';
import {
  DIMENSION_UNITS,
  META_ROBOTS_OPTIONS,
  WEIGHT_UNITS,
} from '@/config/constants';
import { brandService, categoryService, foodService, productService } from '@/api/services';
import { useModuleStore } from '@/store/moduleStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { toDisplayString } from '@/utils/format';
import { resolveMediaUrl } from '@/utils/media';
import { required } from '@/utils/validators';
import {
  emptyFoodProfile,
  FOOD_DIET_TYPES,
  FOOD_SPICE_LEVELS,
  FOOD_TAG_OPTIONS,
  readFoodProfile,
  toFoodProfilePayload,
  toggleChip,
  type FoodProfileForm,
} from '@/utils/foodFields';
import type {
  AppNavigation,
  Brand,
  Category,
  FoodSection,
  PickedImage,
  Product,
  ProductAttributeInput,
  ProductFormRoute,
  ProductOptionInput,
  ProductPayload,
  ProductSpecInput,
  ProductVariantInput,
} from '@/types';

type OptionRow = { id: string; name: string; values: string };
type SpecRow = { id: string; key: string; value: string };
type AttributeRow = { id: string; key: string; value: string };
type VariantRow = {
  id: string;
  sku: string;
  barcode: string;
  stock: string;
  lowStockAt: string;
  continueSellingWhenOos: boolean;
  sellingprice: string;
  originalPrice: string;
  costPrice: string;
  weight: string;
  weightUnit: string;
  length: string;
  breadth: string;
  height: string;
  dimensionUnit: string;
  attributes: AttributeRow[];
  image: PickedImage | null;
  existingImage?: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function asText(value: unknown) {
  if (value == null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map(item => toDisplayString(item).trim()).filter(Boolean).join(', ');
  }
  return toDisplayString(value);
}

function asNumber(value: string) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function optionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }
  return asNumber(value);
}

function optionalText(value: string) {
  const text = value.trim();
  return text || undefined;
}

function emptyOption(): OptionRow {
  return { id: uid(), name: '', values: '' };
}

function emptySpec(): SpecRow {
  return { id: uid(), key: '', value: '' };
}

function emptyAttribute(): AttributeRow {
  return { id: uid(), key: '', value: '' };
}

function FormSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AppCard style={styles.section}>
      <SectionTitle title={title} action={action} />
      {children}
    </AppCard>
  );
}

function toSelectOptions(items: Array<{ id?: number | string; name?: string }>): AppSelectOption[] {
  return items.map(item => {
    const value = String(item.id ?? '');
    return { value, label: String(item.name || value) };
  });
}

function emptyVariant(): VariantRow {
  return {
    id: uid(),
    sku: '',
    barcode: '',
    stock: '0',
    lowStockAt: '5',
    continueSellingWhenOos: false,
    sellingprice: '',
    originalPrice: '',
    costPrice: '',
    weight: '',
    weightUnit: 'g',
    length: '',
    breadth: '',
    height: '',
    dimensionUnit: 'cm',
    attributes: [emptyAttribute()],
    image: null,
  };
}

function pickImageAsset(selectionLimit = 1) {
  return launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit });
}

function mapPicked(asset: { uri?: string; type?: string; fileName?: string } | undefined): PickedImage | null {
  if (!asset?.uri) {
    return null;
  }
  return { uri: asset.uri, type: asset.type, fileName: asset.fileName };
}

function mapOptions(product: Product): OptionRow[] {
  const raw = (product.productOptions ?? product.options) as unknown;
  const list = Array.isArray(raw) ? raw : [];
  const rows = list.map((item: ProductOptionInput) => ({
    id: uid(),
    name: toDisplayString(item?.name),
    values: asText(item?.values),
  }));
  return rows.length ? rows : [emptyOption()];
}

function mapSpecs(product: Product): SpecRow[] {
  const raw = (product.productSpecs ?? product.specs) as unknown;
  const list = Array.isArray(raw) ? raw : [];
  const rows = list.map((item: ProductSpecInput) => ({
    id: uid(),
    key: toDisplayString(item?.key),
    value: toDisplayString(item?.value),
  }));
  return rows.length ? rows : [emptySpec()];
}

function mapAttributes(raw: unknown): AttributeRow[] {
  const list = Array.isArray(raw) ? raw : [];
  const rows = list.map((item: ProductAttributeInput) => ({
    id: uid(),
    key: toDisplayString(item?.key),
    value: toDisplayString(item?.value),
  }));
  return rows.length ? rows : [emptyAttribute()];
}

function mapVariants(product: Product): VariantRow[] {
  const raw = (product.variants ?? product.productVariants) as unknown;
  const list = Array.isArray(raw) ? (raw as ProductVariantInput[]) : [];
  const rows = list.map((item, index) => {
    const images = (item as { images?: string[]; image?: string }).images;
    const image = (item as { image?: string }).image || images?.[0];
    const productImages = product.images;
    return {
      id: uid(),
      sku: String(item.sku || ''),
      barcode: String(item.barcode || ''),
      stock: String(item.stock ?? 0),
      lowStockAt: String(item.lowStockAt ?? 5),
      continueSellingWhenOos: Boolean(item.continueSellingWhenOos),
      sellingprice: String(item.sellingprice ?? (item as { sellingPrice?: number }).sellingPrice ?? ''),
      originalPrice: String(item.originalPrice ?? ''),
      costPrice: String(item.costPrice ?? ''),
      weight: String(item.weight ?? ''),
      weightUnit: String(item.weightUnit || 'g'),
      length: String(item.length ?? ''),
      breadth: String(item.breadth ?? ''),
      height: String(item.height ?? ''),
      dimensionUnit: String(item.dimensionUnit || 'cm'),
      attributes: mapAttributes(item.attributes),
      image: null,
      existingImage: typeof image === 'string' ? image : productImages?.[index],
    };
  });
  return rows.length ? rows : [emptyVariant()];
}

const OptionCard = React.memo(function OptionCard({
  row,
  index,
  canRemove,
  onChangeName,
  onChangeValues,
  onRemove,
}: {
  row: OptionRow;
  index: number;
  canRemove: boolean;
  onChangeName: (id: string, text: string) => void;
  onChangeValues: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>Option {index + 1}</Text>
        {canRemove ? (
          <Pressable onPress={() => onRemove(row.id)} hitSlop={8}>
            <Trash2 size={16} color={colors.danger} />
          </Pressable>
        ) : null}
      </View>
      <AppInput
        label="Name"
        value={row.name}
        onChangeText={text => onChangeName(row.id, text)}
        placeholder="Color"
      />
      <AppInput
        label="Values"
        value={row.values}
        onChangeText={text => onChangeValues(row.id, text)}
        placeholder="Black, White"
      />
    </View>
  );
});

const SpecCard = React.memo(function SpecCard({
  row,
  index,
  canRemove,
  onChangeKey,
  onChangeValue,
  onRemove,
}: {
  row: SpecRow;
  index: number;
  canRemove: boolean;
  onChangeKey: (id: string, text: string) => void;
  onChangeValue: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>Spec {index + 1}</Text>
        {canRemove ? (
          <Pressable onPress={() => onRemove(row.id)} hitSlop={8}>
            <Trash2 size={16} color={colors.danger} />
          </Pressable>
        ) : null}
      </View>
      <AppInput
        label="Key"
        value={row.key}
        onChangeText={text => onChangeKey(row.id, text)}
        placeholder="Battery Life"
      />
      <AppInput
        label="Value"
        value={row.value}
        onChangeText={text => onChangeValue(row.id, text)}
        placeholder="20 Hours"
      />
    </View>
  );
});

const VariantCard = React.memo(function VariantCard({
  row,
  index,
  canRemove,
  expanded,
  onToggle,
  onRemove,
  onChange,
  onAttributeChange,
  onAddAttribute,
  onPickImage,
}: {
  row: VariantRow;
  index: number;
  canRemove: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<VariantRow>) => void;
  onAttributeChange: (variantId: string, attributeId: string, patch: Partial<AttributeRow>) => void;
  onAddAttribute: (id: string) => void;
  onPickImage: (id: string) => void;
}) {
  const variantPreview = row.image?.uri || resolveMediaUrl(row.existingImage);
  const summary = [row.sku || 'No SKU', row.sellingprice ? `₹${row.sellingprice}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card} collapsable>
      <Pressable onPress={() => onToggle(row.id)} style={[styles.cardHead, !expanded && styles.cardHeadCollapsed]}>
        <View style={styles.cardHeadText}>
          <Text style={styles.cardTitle}>Variant {index + 1}</Text>
          {!expanded ? (
            <Text style={styles.collapsedMeta} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <View style={styles.cardHeadActions}>
          {canRemove ? (
            <Pressable onPress={() => onRemove(row.id)} hitSlop={8}>
              <Trash2 size={16} color={colors.danger} />
            </Pressable>
          ) : null}
          {expanded ? (
            <ChevronUp size={18} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={18} color={colors.textSecondary} />
          )}
        </View>
      </Pressable>
      {expanded ? (
        <View>
          <AppInput
            label="SKU"
            value={row.sku}
            onChangeText={text => onChange(row.id, { sku: text })}
            placeholder="WH-X1-BLK"
            autoCapitalize="characters"
          />
          <AppInput
            label="Barcode"
            value={row.barcode}
            onChangeText={text => onChange(row.id, { barcode: text })}
            optional
            placeholder="123456789012"
            keyboardType="number-pad"
          />
          <View style={styles.row2}>
            <View style={styles.col}>
              <AppInput
                label="Stock"
                keyboardType="number-pad"
                value={row.stock}
                onChangeText={text => onChange(row.id, { stock: text })}
              />
            </View>
            <View style={styles.col}>
              <AppInput
                label="Low stock at"
                keyboardType="number-pad"
                value={row.lowStockAt}
                onChangeText={text => onChange(row.id, { lowStockAt: text })}
              />
            </View>
          </View>
          <AppSwitchRow
            label="Continue selling when out of stock"
            value={row.continueSellingWhenOos}
            onValueChange={value => onChange(row.id, { continueSellingWhenOos: value })}
          />
          <AppInput
            label="Selling price"
            keyboardType="decimal-pad"
            value={row.sellingprice}
            onChangeText={text => onChange(row.id, { sellingprice: text })}
            placeholder="2999"
          />
          <View style={styles.row2}>
            <View style={styles.col}>
              <AppInput
                label="Original price"
                keyboardType="decimal-pad"
                value={row.originalPrice}
                onChangeText={text => onChange(row.id, { originalPrice: text })}
                optional
                placeholder="3999"
              />
            </View>
            <View style={styles.col}>
              <AppInput
                label="Cost price"
                keyboardType="decimal-pad"
                value={row.costPrice}
                onChangeText={text => onChange(row.id, { costPrice: text })}
                optional
                placeholder="1500"
              />
            </View>
          </View>
          <View style={styles.row2}>
            <View style={styles.col}>
              <AppInput
                label="Weight"
                keyboardType="decimal-pad"
                value={row.weight}
                onChangeText={text => onChange(row.id, { weight: text })}
                optional
                placeholder="300"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Weight unit</Text>
              <View style={styles.chips}>
                {WEIGHT_UNITS.map(unit => (
                  <Chip
                    key={unit}
                    label={unit}
                    selected={row.weightUnit === unit}
                    onPress={() => onChange(row.id, { weightUnit: unit })}
                  />
                ))}
              </View>
            </View>
          </View>
          <View style={styles.row3}>
            <View style={styles.col}>
              <AppInput
                label="Length"
                keyboardType="decimal-pad"
                value={row.length}
                onChangeText={text => onChange(row.id, { length: text })}
                optional
              />
            </View>
            <View style={styles.col}>
              <AppInput
                label="Breadth"
                keyboardType="decimal-pad"
                value={row.breadth}
                onChangeText={text => onChange(row.id, { breadth: text })}
                optional
              />
            </View>
            <View style={styles.col}>
              <AppInput
                label="Height"
                keyboardType="decimal-pad"
                value={row.height}
                onChangeText={text => onChange(row.id, { height: text })}
                optional
              />
            </View>
          </View>
          <Text style={styles.label}>Dimension unit</Text>
          <View style={styles.chips}>
            {DIMENSION_UNITS.map(unit => (
              <Chip
                key={unit}
                label={unit}
                selected={row.dimensionUnit === unit}
                onPress={() => onChange(row.id, { dimensionUnit: unit })}
              />
            ))}
          </View>
          <Text style={styles.label}>Attributes</Text>
          {row.attributes.map(attr => (
            <View key={attr.id} style={styles.row2}>
              <View style={styles.col}>
                <AppInput
                  label="Key"
                  value={attr.key}
                  onChangeText={text => onAttributeChange(row.id, attr.id, { key: text })}
                  placeholder="Color"
                />
              </View>
              <View style={styles.col}>
                <AppInput
                  label="Value"
                  value={attr.value}
                  onChangeText={text => onAttributeChange(row.id, attr.id, { value: text })}
                  placeholder="Black"
                />
              </View>
            </View>
          ))}
          <Pressable onPress={() => onAddAttribute(row.id)} style={styles.addLink}>
            <Plus size={14} color={colors.brand[700]} />
            <Text style={styles.addLinkText}>Add attribute</Text>
          </Pressable>
          <Text style={styles.label}>Variant image</Text>
          <Pressable onPress={() => onPickImage(row.id)} style={styles.imagePick}>
            {variantPreview ? (
              <Image source={{ uri: variantPreview }} style={styles.previewSmall} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholderSmall}>
                <ImagePlus size={18} color={colors.brand[700]} />
                <Text style={styles.imageText}>Upload images_{index}</Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

export function ProductFormScreen() {
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<ProductFormRoute>();
  const productId = route.params?.productId;
  const isEdit = Boolean(productId);
  const showToast = useToastStore(s => s.show);
  const activeModule = useModuleStore(s => s.activeModule);
  const isFood = activeModule === 'FOOD';

  const [booting, setBooting] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [tags, setTags] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaRobots, setMetaRobots] = useState('index, follow');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [minQty, setMinQty] = useState('1');
  const [maxQty, setMaxQty] = useState('10');
  const [options, setOptions] = useState<OptionRow[]>([emptyOption()]);
  const [specs, setSpecs] = useState<SpecRow[]>([emptySpec()]);
  const seedVariant = React.useMemo(() => emptyVariant(), []);
  const [variants, setVariants] = useState<VariantRow[]>(() => [seedVariant]);
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(seedVariant.id);
  const [isActive, setIsActive] = useState(true);
  const [thumbnail, setThumbnail] = useState<PickedImage | null>(null);
  const [existingThumb, setExistingThumb] = useState<string | undefined>();
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [foodProfile, setFoodProfile] = useState<FoodProfileForm>(emptyFoodProfile);
  const [sections, setSections] = useState<FoodSection[]>([]);

  const loadLookups = useCallback(async () => {
    try {
      const [catRes, brandRes, sectionRes] = await Promise.all([
        categoryService.getAll(),
        brandService.getAll(),
        isFood ? foodService.getSections() : Promise.resolve(null),
      ]);
      setCategories(asArray<Category>(unwrapPayload(catRes.data)));
      setBrands(asArray<Brand>(unwrapPayload(brandRes.data)));
      if (sectionRes) {
        setSections(asArray<FoodSection>(unwrapPayload(sectionRes.data)));
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load catalog lookups'), 'error');
    }
  }, [isFood, showToast]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (!isEdit || !productId) {
      return;
    }
    (async () => {
      try {
        const res = await productService.getById(productId);
        const product = unwrapPayload(res.data) as Product;
        setName(String(product.name || ''));
        setCategoryId(String(product.categoryId ?? (product.category as Category)?.id ?? ''));
        setBrandId(String(product.brandId ?? (product.brand as Brand)?.id ?? ''));
        setDescription(String(product.description || ''));
        setKeywords(asText(product.keywords));
        setTags(asText(product.tags));
        setMetaTitle(String(product.meta_title ?? product.metaTitle ?? ''));
        setMetaDescription(String(product.meta_description ?? product.metaDescription ?? ''));
        setMetaRobots(String(product.meta_robots ?? product.metaRobots ?? 'index, follow'));
        setCanonicalUrl(String(product.canonical_url ?? product.canonicalUrl ?? ''));
        setMinQty(String(product.minimum_order_quantity ?? product.minimumOrderQuantity ?? 1));
        setMaxQty(String(product.maximum_order_quantity ?? product.maximumOrderQuantity ?? 10));
        setOptions(mapOptions(product));
        setSpecs(mapSpecs(product));
        const nextVariants = mapVariants(product);
        setVariants(nextVariants);
        setExpandedVariantId(nextVariants[0]?.id ?? null);
        setIsActive(product.is_active !== false);
        setExistingThumb(
          typeof product.thumbnail_img === 'string' ? product.thumbnail_img : product.images?.[0],
        );
        if (product.foodProfile) {
          setFoodProfile(readFoodProfile(product.foodProfile));
        }
      } catch (error) {
        showToast(getErrorMessage(error, 'Could not load product'), 'error');
      } finally {
        setBooting(false);
      }
    })();
  }, [isEdit, productId, showToast]);

  const pickThumbnail = async () => {
    const result = await pickImageAsset(1);
    const picked = mapPicked(result.assets?.[0]);
    if (picked) {
      setThumbnail(picked);
    }
  };

  const pickVariantImage = useCallback(async (variantId: string) => {
    const result = await pickImageAsset(1);
    const picked = mapPicked(result.assets?.[0]);
    if (!picked) {
      return;
    }
    setVariants(rows => rows.map(row => (row.id === variantId ? { ...row, image: picked } : row)));
  }, []);

  const updateVariant = useCallback((variantId: string, patch: Partial<VariantRow>) => {
    setVariants(rows => rows.map(row => (row.id === variantId ? { ...row, ...patch } : row)));
  }, []);

  const updateAttribute = useCallback((variantId: string, attributeId: string, patch: Partial<AttributeRow>) => {
    setVariants(rows =>
      rows.map(row =>
        row.id === variantId
          ? {
              ...row,
              attributes: row.attributes.map(attr => (attr.id === attributeId ? { ...attr, ...patch } : attr)),
            }
          : row,
      ),
    );
  }, []);

  const toggleVariant = useCallback((id: string) => {
    setExpandedVariantId(current => (current === id ? null : id));
  }, []);

  const removeVariant = useCallback((id: string) => {
    setVariants(rows => rows.filter(item => item.id !== id));
    setExpandedVariantId(current => (current === id ? null : current));
  }, []);

  const addVariant = useCallback(() => {
    const next = emptyVariant();
    setVariants(rows => [...rows, next]);
    setExpandedVariantId(next.id);
  }, []);

  const addAttribute = useCallback((variantId: string) => {
    setVariants(rows =>
      rows.map(row =>
        row.id === variantId ? { ...row, attributes: [...row.attributes, emptyAttribute()] } : row,
      ),
    );
  }, []);

  const updateOptionName = useCallback((id: string, text: string) => {
    setOptions(rows => rows.map(item => (item.id === id ? { ...item, name: text } : item)));
  }, []);

  const updateOptionValues = useCallback((id: string, text: string) => {
    setOptions(rows => rows.map(item => (item.id === id ? { ...item, values: text } : item)));
  }, []);

  const removeOption = useCallback((id: string) => {
    setOptions(rows => rows.filter(item => item.id !== id));
  }, []);

  const updateSpecKey = useCallback((id: string, text: string) => {
    setSpecs(rows => rows.map(item => (item.id === id ? { ...item, key: text } : item)));
  }, []);

  const updateSpecValue = useCallback((id: string, text: string) => {
    setSpecs(rows => rows.map(item => (item.id === id ? { ...item, value: text } : item)));
  }, []);

  const removeSpec = useCallback((id: string) => {
    setSpecs(rows => rows.filter(item => item.id !== id));
  }, []);

  const onSubmit = async () => {
    const firstVariant = variants[0];
    const nextErrors = {
      name: required(name, isFood ? 'Dish name' : 'Product name') || undefined,
      categoryId: required(categoryId, 'Category') || undefined,
      sku: isFood ? undefined : required(firstVariant?.sku || '', 'Variant SKU') || undefined,
      sellingprice: required(firstVariant?.sellingprice || '', 'Selling price') || undefined,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    const payload: ProductPayload = {
      name: name.trim(),
      categoryId,
      brandId: brandId || undefined,
      description: description.trim(),
      keywords: keywords.trim(),
      tags: tags.trim(),
      meta_title: metaTitle.trim(),
      meta_description: metaDescription.trim(),
      meta_robots: metaRobots.trim(),
      canonical_url: canonicalUrl.trim(),
      minimum_order_quantity: asNumber(minQty || '1'),
      maximum_order_quantity: asNumber(maxQty || '10'),
      productOptions: options
        .filter(row => row.name.trim())
        .map(row => ({ name: row.name.trim(), values: splitCsv(row.values) })),
      productSpecs: specs
        .filter(row => row.key.trim())
        .map(row => ({ key: row.key.trim(), value: row.value.trim() })),
      variants: variants.map((row, index) => ({
        sku: row.sku.trim() || (isFood ? `${name.trim().replace(/\s+/g, '-').toUpperCase()}-${index + 1}` : ''),
        variantName: isFood ? row.sku.trim() || (index === 0 ? 'Regular' : `Portion ${index + 1}`) : undefined,
        barcode: row.barcode.trim() || undefined,
        stock: asNumber(row.stock),
        lowStockAt: asNumber(row.lowStockAt),
        continueSellingWhenOos: row.continueSellingWhenOos,
        sellingprice: asNumber(row.sellingprice),
        originalPrice: optionalNumber(row.originalPrice),
        costPrice: optionalNumber(row.costPrice),
        weight: optionalText(row.weight),
        weightUnit: row.weightUnit,
        length: optionalText(row.length),
        breadth: optionalText(row.breadth),
        height: optionalText(row.height),
        dimensionUnit: row.dimensionUnit,
        attributes: row.attributes
          .filter(attr => attr.key.trim() && attr.value.trim())
          .map(attr => ({ key: attr.key.trim(), value: attr.value.trim() })),
      })),
    };

    if (isFood && !payload.variants[0]?.sku) {
      payload.variants[0] = {
        ...payload.variants[0],
        sku: `FOOD-${Date.now()}`,
      };
    }

    const syncFoodProfile = async (savedId: string | number) => {
      if (!isFood) {
        return;
      }
      await foodService.saveItemProfile(savedId, toFoodProfilePayload(foodProfile));
    };

    setSaving(true);
    try {
      const variantImages = variants.map(row => row.image);
      if (isEdit && productId) {
        await productService.update(productId, payload, thumbnail, variantImages);
        await syncFoodProfile(productId);
        if (isActive === false) {
          await productService.updateStatus(productId, false);
        }
        showToast(isFood ? 'Dish updated' : 'Product updated', 'success');
      } else {
        const created = await productService.add(payload, thumbnail, variantImages);
        const createdProduct = unwrapPayload(created.data) as Product;
        const createdId = getEntityId(createdProduct) ?? (createdProduct as { id?: string | number })?.id;
        if (createdId != null) {
          await syncFoodProfile(createdId);
          if (isActive === false) {
            await productService.updateStatus(createdId, false);
          }
        }
        showToast(isFood ? 'Dish added' : 'Product added', 'success');
      }
      navigation.goBack();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not save product'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (booting) {
    return (
      <Screen>
        <AppLoader label="Loading product" />
      </Screen>
    );
  }

  const previewUri = thumbnail?.uri || resolveMediaUrl(existingThumb);

  return (
    <Screen scroll>
      <AppHeader
        title={isEdit ? (isFood ? 'Edit dish' : 'Edit product') : isFood ? 'Add dish' : 'Add product'}
        subtitle={isFood ? 'Menu item for food delivery' : isEdit ? 'Update catalog details' : 'Create a new listing for your catalog'}
        showBack
      />

      <FormSection title="Basic details">
        <AppInput
          label={isFood ? 'Dish name' : 'Product name'}
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder={isFood ? 'Butter Chicken' : 'Wireless Headphones X1'}
        />
        <AppSelect
          label="Category"
          placeholder="Select a category"
          value={categoryId}
          options={toSelectOptions(categories)}
          onChange={id => {
            setCategoryId(id);
            setErrors(current => ({ ...current, categoryId: undefined }));
          }}
          error={errors.categoryId}
          emptyText="No categories found"
        />
        <AppSelect
          label="Brand"
          placeholder="Select a brand"
          value={brandId}
          options={toSelectOptions(brands)}
          onChange={setBrandId}
          optional
          allowClear
          emptyText="No brands found"
        />
        <AppInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          optional
          placeholder="High quality over-ear wireless headphones"
        />
        <AppInput
          label="Keywords"
          value={keywords}
          onChangeText={setKeywords}
          optional
          placeholder="wireless, headphones, audio, bluetooth"
        />
        <AppInput
          label="Tags"
          value={tags}
          onChangeText={setTags}
          optional
          placeholder="electronics, accessories"
        />
      </FormSection>

      {isFood ? (
        <FormSection title="Food details">
          <Text style={styles.label}>Dietary type</Text>
          <View style={styles.chips}>
            {FOOD_DIET_TYPES.map(option => (
              <Chip
                key={option.value}
                label={option.label}
                selected={foodProfile.dietaryType === option.value}
                onPress={() => setFoodProfile(current => ({ ...current, dietaryType: option.value }))}
              />
            ))}
          </View>
          <AppSelect
            label="Menu section"
            placeholder="Starters, mains..."
            value={foodProfile.sectionId}
            options={toSelectOptions(sections)}
            onChange={id => setFoodProfile(current => ({ ...current, sectionId: id }))}
            optional
            allowClear
            emptyText="No sections yet — add them from Profile"
          />
          <AppInput
            label="Cuisine"
            value={foodProfile.cuisine}
            onChangeText={text => setFoodProfile(current => ({ ...current, cuisine: text }))}
            optional
            placeholder="North Indian"
          />
          <Text style={styles.label}>Spice level</Text>
          <View style={styles.chips}>
            {FOOD_SPICE_LEVELS.map(level => (
              <Chip
                key={level}
                label={level}
                selected={foodProfile.spiceLevel === level}
                onPress={() => setFoodProfile(current => ({ ...current, spiceLevel: level }))}
              />
            ))}
          </View>
          <View style={styles.row2}>
            <View style={styles.col}>
              <AppInput
                label="Prep time (mins)"
                keyboardType="number-pad"
                value={foodProfile.prepTimeMins}
                onChangeText={text => setFoodProfile(current => ({ ...current, prepTimeMins: text }))}
                placeholder="20"
              />
            </View>
            <View style={styles.col}>
              <AppInput
                label="Serves"
                keyboardType="number-pad"
                value={foodProfile.serves}
                onChangeText={text => setFoodProfile(current => ({ ...current, serves: text }))}
                placeholder="1"
              />
            </View>
          </View>
          <Text style={styles.label}>Tags</Text>
          <View style={styles.chips}>
            {FOOD_TAG_OPTIONS.map(tag => (
              <Chip
                key={tag}
                label={tag}
                selected={foodProfile.foodTags.includes(tag)}
                onPress={() =>
                  setFoodProfile(current => ({ ...current, foodTags: toggleChip(current.foodTags, tag) }))
                }
              />
            ))}
          </View>
          <AppInput
            label="Ingredients"
            value={foodProfile.ingredientsDescription}
            onChangeText={text => setFoodProfile(current => ({ ...current, ingredientsDescription: text }))}
            optional
            multiline
            placeholder="Chicken, butter, tomato, cream"
          />
          <AppInput
            label="Allergens"
            value={foodProfile.allergens}
            onChangeText={text => setFoodProfile(current => ({ ...current, allergens: text }))}
            optional
            placeholder="Milk, Nuts"
          />
          <AppSwitchRow
            label="Available"
            value={foodProfile.isAvailable}
            onValueChange={value => setFoodProfile(current => ({ ...current, isAvailable: value }))}
          />
          <AppSwitchRow
            label="Sold out"
            value={foodProfile.isSoldOut}
            onValueChange={value => setFoodProfile(current => ({ ...current, isSoldOut: value }))}
          />
        </FormSection>
      ) : null}

      {!isFood ? (
        <>
      <FormSection title="SEO">
        <AppInput
        label="Meta title"
        value={metaTitle}
        onChangeText={setMetaTitle}
        optional
        placeholder="Wireless Headphones X1 | Buy Online"
      />
      <AppInput
        label="Meta description"
        value={metaDescription}
        onChangeText={setMetaDescription}
        optional
        multiline
        placeholder="Shop the best wireless headphones with noise cancellation."
      />
      <Text style={styles.label}>Meta robots</Text>
      <View style={styles.chips}>
        {META_ROBOTS_OPTIONS.map(option => (
          <Chip
            key={option}
            label={option}
            selected={metaRobots === option}
            onPress={() => setMetaRobots(option)}
          />
        ))}
      </View>
      <AppInput
        label="Canonical URL"
        value={canonicalUrl}
        onChangeText={setCanonicalUrl}
        optional
        autoCapitalize="none"
        placeholder="https://yourstore.com/wireless-headphones-x1"
        />
      </FormSection>

      <FormSection title="Order limits">
        <View style={styles.row2}>
        <View style={styles.col}>
          <AppInput
            label="Min order qty"
            keyboardType="number-pad"
            value={minQty}
            onChangeText={setMinQty}
            placeholder="1"
          />
        </View>
        <View style={styles.col}>
          <AppInput
            label="Max order qty"
            keyboardType="number-pad"
            value={maxQty}
            onChangeText={setMaxQty}
            placeholder="10"
          />
        </View>
      </View>
      </FormSection>

      <FormSection
        title="Product options"
        action={
          <Pressable onPress={() => setOptions(rows => [...rows, emptyOption()])} style={styles.addLink}>
            <Plus size={14} color={colors.brand[700]} />
            <Text style={styles.addLinkText}>Add</Text>
          </Pressable>
        }>
        <View style={styles.stack}>
          {options.map((row, index) => (
            <OptionCard
              key={row.id}
              row={row}
              index={index}
              canRemove={options.length > 1}
              onChangeName={updateOptionName}
              onChangeValues={updateOptionValues}
              onRemove={removeOption}
            />
          ))}
        </View>
      </FormSection>

      <FormSection
        title="Product specs"
        action={
          <Pressable onPress={() => setSpecs(rows => [...rows, emptySpec()])} style={styles.addLink}>
            <Plus size={14} color={colors.brand[700]} />
            <Text style={styles.addLinkText}>Add</Text>
          </Pressable>
        }>
        <View style={styles.stack}>
          {specs.map((row, index) => (
            <SpecCard
              key={row.id}
              row={row}
              index={index}
              canRemove={specs.length > 1}
              onChangeKey={updateSpecKey}
              onChangeValue={updateSpecValue}
              onRemove={removeSpec}
            />
          ))}
        </View>
      </FormSection>
        </>
      ) : null}

      <FormSection
        title={isFood ? 'Portions & price' : 'Variants'}
        action={
          <Pressable onPress={addVariant} style={styles.addLink}>
            <Plus size={14} color={colors.brand[700]} />
            <Text style={styles.addLinkText}>Add</Text>
          </Pressable>
        }>
        {errors.sku ? <Text style={styles.error}>{errors.sku}</Text> : null}
        {errors.sellingprice ? <Text style={styles.error}>{errors.sellingprice}</Text> : null}
        <View style={styles.stack}>
          {variants.map((row, index) => (
            <VariantCard
              key={row.id}
              row={row}
              index={index}
              canRemove={variants.length > 1}
              expanded={expandedVariantId === row.id}
              onToggle={toggleVariant}
              onRemove={removeVariant}
              onChange={updateVariant}
              onAttributeChange={updateAttribute}
              onAddAttribute={addAttribute}
              onPickImage={pickVariantImage}
            />
          ))}
        </View>
      </FormSection>

      <FormSection title="Media & status">
        <Text style={styles.label}>Thumbnail</Text>
        <Pressable onPress={pickThumbnail} style={styles.imagePick}>
          {previewUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
              <View style={styles.previewOverlay}>
                <ImagePlus size={16} color={colors.white} />
                <Text style={styles.previewOverlayText}>Change photo</Text>
              </View>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <ImagePlus size={22} color={colors.brand[700]} />
              <Text style={styles.imageText}>Upload thumbnail</Text>
              <Text style={styles.imageHint}>JPG or PNG · used as the main product photo</Text>
            </View>
          )}
        </Pressable>
        <AppSwitchRow label="Active" value={isActive} onValueChange={setIsActive} />
      </FormSection>

      <AppButton
        title={isEdit ? (isFood ? 'Update dish' : 'Update product') : isFood ? 'Publish dish' : 'Publish product'}
        onPress={onSubmit}
        loading={saving}
        style={styles.submit}
      />
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
  stack: { gap: 10 },
  label: { color: colors.textSecondary, fontWeight: '600', marginBottom: 6, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  error: { color: colors.danger, marginBottom: 8, fontSize: 12 },
  row2: { flexDirection: 'row', gap: 10 },
  row3: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 12,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  cardHeadText: { flex: 1, minWidth: 0 },
  cardHeadCollapsed: { marginBottom: 0 },
  cardHeadActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontWeight: '700', color: colors.text },
  collapsedMeta: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  addLinkText: { color: colors.brand[800], fontWeight: '700', fontSize: 13 },
  imagePick: { marginTop: 4, marginBottom: 8 },
  previewWrap: { position: 'relative', overflow: 'hidden', borderRadius: radius.md },
  preview: { height: 168, borderRadius: radius.md, width: '100%' },
  previewOverlay: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  previewOverlayText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  previewSmall: { height: 110, borderRadius: radius.md, width: '100%' },
  imagePlaceholder: {
    height: 128,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    gap: 6,
    paddingHorizontal: 16,
  },
  imagePlaceholderSmall: {
    height: 86,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    gap: 6,
  },
  imageText: { color: colors.brand[800], fontWeight: '700' },
  imageHint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  submit: { marginTop: 8, marginBottom: 8 },
});
