import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ImageOff, Pencil } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { productService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, shadows } from '@/theme';
import { getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickNumber, pickString, toDisplayString } from '@/utils/format';
import { resolveMediaUrl } from '@/utils/media';
import { moderateScale } from '@/utils/responsive';
import type {
  AppNavigation,
  Brand,
  Category,
  Product,
  ProductAttributeInput,
  ProductDetailRoute,
  ProductOptionInput,
  ProductSpecInput,
  ProductVariantInput,
} from '@/types';

function asChipList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(item => toDisplayString(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
  const text = toDisplayString(value).trim();
  return text ? [text] : [];
}

function collectImages(product: Product) {
  const urls: string[] = [];
  const push = (raw: unknown) => {
    const path =
      typeof raw === 'string'
        ? raw
        : pickString(
            (raw as { url?: string } | undefined)?.url,
            (raw as { path?: string } | undefined)?.path,
            (raw as { image?: string } | undefined)?.image,
          );
    const uri = resolveMediaUrl(path);
    if (uri && !urls.includes(uri)) {
      urls.push(uri);
    }
  };

  push(product.thumbnail_img);
  if (Array.isArray(product.images)) {
    product.images.forEach(push);
  }

  const variants = (product.variants ?? product.productVariants ?? []) as ProductVariantInput[];
  variants.forEach(variant => {
    push((variant as { image?: string }).image);
    const extra = (variant as { images?: unknown[] }).images;
    if (Array.isArray(extra)) {
      extra.forEach(push);
    }
  });

  return urls;
}

function stockTone(stock: number, lowAt?: number) {
  if (stock <= 0) {
    return { color: colors.danger, label: 'Out of stock' };
  }
  if (lowAt != null && lowAt > 0 && stock <= lowAt) {
    return { color: colors.warning, label: `${stock} left` };
  }
  return { color: colors.success, label: `${stock} in stock` };
}

function variantSummary(variant: ProductVariantInput) {
  const attributes = (variant.attributes ?? []) as ProductAttributeInput[];
  const attrLine = attributes
    .map(attr => {
      const key = toDisplayString(attr.key);
      const value = toDisplayString(attr.value);
      if (key && value) {
        return `${key}: ${value}`;
      }
      return value || key;
    })
    .filter(Boolean)
    .join(' · ');
  const weight = [variant.weight, variant.weightUnit].filter(Boolean).join(' ');
  const dims = [variant.length, variant.breadth, variant.height]
    .filter(value => value != null && value !== '')
    .join(' × ');
  const dimLine = dims ? `${dims} ${variant.dimensionUnit || ''}`.trim() : '';
  return [attrLine, weight, dimLine].filter(Boolean).join(' · ');
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function SpecRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.specRow, !last && styles.specDivider]}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export function ProductDetailScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { params } = useRoute<ProductDetailRoute>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await productService.getById(params.productId);
      setProduct(unwrapPayload(res.data) as Product);
      setActiveImage(0);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load product'), 'error');
    } finally {
      setLoading(false);
    }
  }, [params.productId, showToast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleStatus = async () => {
    if (!product) {
      return;
    }
    setBusy(true);
    try {
      const next = product.is_active === false;
      await productService.updateStatus(params.productId, next);
      showToast(`Product marked ${next ? 'active' : 'inactive'}`, 'success');
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update status'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const images = useMemo(() => (product ? collectImages(product) : []), [product]);
  const currentImage = images[Math.min(activeImage, Math.max(images.length - 1, 0))];

  if (loading || !product) {
    return (
      <Screen>
        <AppLoader />
      </Screen>
    );
  }

  const name = pickString(product.name, 'Product');
  const isActive = product.is_active !== false;
  const categoryName =
    typeof product.category === 'string'
      ? product.category
      : pickString((product.category as Category | undefined)?.name);
  const brandName =
    typeof product.brand === 'string'
      ? product.brand
      : pickString((product.brand as Brand | undefined)?.name);
  const options = ((product.productOptions ?? product.options) || []) as ProductOptionInput[];
  const specs = ((product.productSpecs ?? product.specs) || []) as ProductSpecInput[];
  const variants = ((product.variants ?? product.productVariants) || []) as ProductVariantInput[];
  const tags = Array.from(new Set([...asChipList(product.keywords), ...asChipList(product.tags)]));
  const firstVariant = variants[0];
  const selling = pickNumber(
    product.sellingPrice,
    firstVariant?.sellingprice,
    (firstVariant as { sellingPrice?: number } | undefined)?.sellingPrice,
    product.price,
  );
  const mrp = pickNumber(firstVariant?.originalPrice, product.price, selling);
  const totalStock = variants.length
    ? variants.reduce((sum, variant) => sum + pickNumber(variant.stock), 0)
    : pickNumber(product.stock);
  const lowestLowAt = variants.reduce((min, variant) => {
    const at = pickNumber(variant.lowStockAt);
    if (at <= 0) {
      return min;
    }
    return min == null ? at : Math.min(min, at);
  }, undefined as number | undefined);
  const stock = stockTone(totalStock, lowestLowAt);
  const hasDiscount = mrp > 0 && selling > 0 && selling < mrp;
  const discountPct = hasDiscount ? Math.round(((mrp - selling) / mrp) * 100) : 0;
  const description = pickString(product.description);
  const metaLine = [categoryName, brandName].filter(Boolean).join('  ·  ');
  const minQty = product.minimum_order_quantity ?? 1;
  const maxQty = product.maximum_order_quantity;
  const seoTitle = pickString(product.meta_title);
  const seoDesc = pickString(product.meta_description);
  const hasAbout = Boolean(description);
  const hasOptions = options.length > 0;
  const hasSpecs = specs.length > 0;
  const hasVariants = variants.length > 0;
  const hasSeo = Boolean(seoTitle || seoDesc);
  const lastSection = hasSeo
    ? 'seo'
    : hasVariants
      ? 'variants'
      : hasSpecs
        ? 'specs'
        : hasOptions
          ? 'options'
          : 'details';

  return (
    <Screen>
      <AppHeader
        title="Product"
        showBack
        right={
          <Pressable
            onPress={() => navigation.navigate('ProductForm', { productId: params.productId })}
            style={styles.editBtn}>
            <Pencil size={14} color={colors.white} />
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.gallery}>
          {currentImage ? (
            <Image source={{ uri: currentImage }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <ImageOff size={32} color={colors.brand[600]} />
              <Text style={styles.placeholderText}>No image</Text>
            </View>
          )}
          {images.length > 1 ? (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {activeImage + 1} / {images.length}
              </Text>
            </View>
          ) : null}
        </View>
        {images.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbs}>
            {images.map((uri, index) => (
              <Pressable
                key={uri}
                onPress={() => setActiveImage(index)}
                style={[styles.thumb, activeImage === index && styles.thumbOn]}>
                <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.identity}>
          <View style={styles.badgeRow}>
            <AppBadge label={isActive ? 'Active' : 'Inactive'} tone={isActive ? 'success' : 'danger'} />
            {hasDiscount ? <AppBadge label={`${discountPct}% off`} tone="success" /> : null}
          </View>
          <Text style={styles.name}>{name}</Text>
          {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}

          <View style={styles.priceBlock}>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{selling ? formatCurrency(selling) : '—'}</Text>
              {hasDiscount ? <Text style={styles.mrp}>{formatCurrency(mrp)}</Text> : null}
            </View>
            <Text style={[styles.stock, { color: stock.color }]}>{stock.label}</Text>
          </View>
        </View>

        <View style={styles.sheet}>
          {hasAbout ? (
            <View style={styles.block}>
              <SectionLabel title="About" />
              <Text style={styles.desc}>{description}</Text>
            </View>
          ) : null}

          <View style={[styles.block, lastSection === 'details' && styles.blockLast]}>
            <SectionLabel title="Details" />
            <View style={styles.facts}>
              <Fact label="Category" value={categoryName || '—'} />
              <Fact label="Brand" value={brandName || '—'} />
              <Fact label="Min. order" value={String(minQty)} />
              <Fact label="Max. order" value={maxQty != null ? String(maxQty) : 'No limit'} />
            </View>
            {tags.length ? (
              <View style={styles.pillWrap}>
                {tags.map(item => (
                  <Pill key={item} label={item} />
                ))}
              </View>
            ) : null}
          </View>

          {hasOptions ? (
            <View style={[styles.block, lastSection === 'options' && styles.blockLast]}>
              <SectionLabel title="Options" />
              {options.map((option, index) => {
                const optionName = toDisplayString(option.name) || 'Option';
                const values = asChipList(option.values);
                return (
                  <View
                    key={`${optionName}-${index}`}
                    style={[styles.option, index === options.length - 1 && styles.optionLast]}>
                    <Text style={styles.optionName}>{optionName}</Text>
                    <View style={styles.pillWrapTight}>
                      {values.length ? (
                        values.map((value, valueIndex) => (
                          <Pill key={`${value}-${valueIndex}`} label={value} />
                        ))
                      ) : (
                        <Text style={styles.muted}>No values</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {hasSpecs ? (
            <View style={[styles.block, lastSection === 'specs' && styles.blockLast]}>
              <SectionLabel title="Specifications" />
              {specs.map((spec, index) => (
                <SpecRow
                  key={`${toDisplayString(spec.key)}-${index}`}
                  label={toDisplayString(spec.key) || 'Spec'}
                  value={toDisplayString(spec.value) || '—'}
                  last={index === specs.length - 1}
                />
              ))}
            </View>
          ) : null}

          {hasVariants ? (
            <View style={[styles.block, lastSection === 'variants' && styles.blockLast]}>
              <SectionLabel title={`Variants · ${variants.length}`} />
              {variants.map((variant, index) => {
                const sellPrice = pickNumber(
                  variant.sellingprice,
                  (variant as { sellingPrice?: number }).sellingPrice,
                );
                const original = pickNumber(variant.originalPrice);
                const qty = pickNumber(variant.stock);
                const sku = pickString(variant.sku, `Variant ${index + 1}`);
                const summary = variantSummary(variant);
                const tone = stockTone(qty, pickNumber(variant.lowStockAt));
                return (
                  <View
                    key={variant.sku || String(index)}
                    style={[styles.variant, index === variants.length - 1 && styles.variantLast]}>
                    <View style={styles.variantTop}>
                      <Text style={styles.variantSku} numberOfLines={1}>
                        {sku}
                      </Text>
                      <Text style={styles.variantPrice}>
                        {sellPrice ? formatCurrency(sellPrice) : '—'}
                      </Text>
                    </View>
                    <View style={styles.variantBottom}>
                      <Text style={styles.variantMeta} numberOfLines={2}>
                        {summary || (variant.barcode ? `Barcode ${variant.barcode}` : 'No attributes')}
                      </Text>
                      <Text style={[styles.variantStock, { color: tone.color }]}>{tone.label}</Text>
                    </View>
                    {original > 0 && original !== sellPrice ? (
                      <Text style={styles.variantMrp}>MRP {formatCurrency(original)}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {hasSeo ? (
            <View style={[styles.block, styles.blockLast]}>
              <SectionLabel title="SEO" />
              {seoTitle ? <Text style={styles.seoTitle}>{seoTitle}</Text> : null}
              {seoDesc ? <Text style={styles.seoDesc}>{seoDesc}</Text> : null}
            </View>
          ) : null}
        </View>

        <AppButton
          title={isActive ? 'Deactivate product' : 'Activate product'}
          variant="outline"
          loading={busy}
          onPress={toggleStatus}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 28 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand[600],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  editText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  gallery: {
    height: 260,
    borderRadius: radius.xl,
    backgroundColor: colors.brand[50],
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  heroImage: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', gap: 8 },
  placeholderText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  counter: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  thumbs: { paddingTop: 10, paddingBottom: 4, gap: 8 },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  thumbOn: { borderColor: colors.brand[600] },
  thumbImage: { width: '100%', height: '100%' },
  identity: { paddingTop: 16, paddingBottom: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  name: {
    fontWeight: '800',
    color: colors.text,
    fontSize: moderateScale(22),
    lineHeight: 28,
  },
  meta: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  priceBlock: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flex: 1 },
  price: { color: colors.brand[800], fontSize: moderateScale(24), fontWeight: '800' },
  mrp: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  stock: { fontSize: 13, fontWeight: '700' },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
    marginBottom: 16,
  },
  block: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  blockLast: { borderBottomWidth: 0 },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  desc: { color: colors.textSecondary, lineHeight: 22, fontSize: 14, fontWeight: '500' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  factLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  factValue: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 3 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pillWrapTight: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pill: {
    backgroundColor: colors.brand[50],
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: { color: colors.brand[800], fontSize: 12, fontWeight: '700' },
  muted: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  option: { marginBottom: 12 },
  optionLast: { marginBottom: 0 },
  optionName: { color: colors.text, fontWeight: '700', fontSize: 13 },
  specRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 9,
  },
  specDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  specLabel: { color: colors.muted, fontSize: 13, fontWeight: '600', flex: 1 },
  specValue: { color: colors.text, fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' },
  variant: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  variantLast: { borderBottomWidth: 0, paddingBottom: 2 },
  variantTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  variantSku: { flex: 1, fontWeight: '700', color: colors.text, fontSize: 14 },
  variantPrice: { fontWeight: '800', color: colors.brand[800], fontSize: 14 },
  variantBottom: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  variantMeta: { flex: 1, color: colors.muted, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  variantStock: { fontSize: 12, fontWeight: '700' },
  variantMrp: { marginTop: 2, color: colors.muted, fontSize: 11, fontWeight: '600' },
  seoTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  seoDesc: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 18 },
});
