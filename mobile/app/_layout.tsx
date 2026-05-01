import { Stack } from 'expo-router';
import { HistoryProvider } from '../hooks/useHistory';
import { Platform, View } from 'react-native';

export default function RootLayout() {
  return (
    <HistoryProvider>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;600;800&display=swap');
          body, input, button, textarea { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; }
          h1, h2, h3, .logo-text, [data-testid="logo"] { font-family: 'Outfit', sans-serif !important; }
        `}} />
      )}
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </HistoryProvider>
  );
}
