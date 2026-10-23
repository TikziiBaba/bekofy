// Supabase istemcisi: oturum AsyncStorage'da. Uygulama öne gelince oturum yenilemesi açılır, arka plandayken durur
// (Supabase'in React Native önerisi).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBekofyClient } from '@bekofy/core';
import { AppState } from 'react-native';

export const sb = createBekofyClient({ storage: AsyncStorage, detectSessionInUrl: false });

AppState.addEventListener('change', (state) => {
  if (state === 'active') void sb.auth.startAutoRefresh();
  else void sb.auth.stopAutoRefresh();
});
