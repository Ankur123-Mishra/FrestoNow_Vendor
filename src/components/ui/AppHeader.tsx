import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { colors } from '@/theme';
import { moderateScale } from '@/utils/responsive';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function AppHeader({ title, subtitle, showBack, onBack, right }: Props) {
  const navigation = useNavigation();

  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable
            onPress={() => (onBack ? onBack() : navigation.goBack())}
            style={styles.back}
            hitSlop={10}>
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    gap: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 },
  back: { paddingRight: 4, paddingVertical: 4 },
  titles: { flex: 1 },
  title: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: moderateScale(13),
  },
});
