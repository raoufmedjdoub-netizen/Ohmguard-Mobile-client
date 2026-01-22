import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  // This screen is just a loading placeholder
  // Navigation is handled by _layout.tsx AuthGuard
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#DC2626" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
  },
});
