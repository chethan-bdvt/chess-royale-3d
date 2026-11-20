import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';

export function Button({ label, onPress, variant = 'primary', disabled, icon, style }:{
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, disabled && styles.disabled, style]}>
    {icon}<Text style={[styles.label, variant === 'primary' && styles.primaryLabel]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, flexDirection: 'row', gap: 10 },
  primary: { backgroundColor: colors.gold },
  secondary: { backgroundColor: colors.panelRaised, borderWidth: 1, borderColor: '#2A3850' },
  danger: { backgroundColor: '#401B28', borderWidth: 1, borderColor: colors.red },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.4 },
  label: { color: colors.text, fontWeight: '800', fontSize: 16 },
  primaryLabel: { color: '#241B08' },
});
