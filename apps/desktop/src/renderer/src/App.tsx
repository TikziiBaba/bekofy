import { BekofyMark } from '@bekofy/ui';
import { useEffect } from 'react';
import { player } from './lib/player';
import { SessionProvider, useSession } from './lib/session';
import { AuthScreen } from './screens/auth';
import { Shell } from './shell/shell';

export function App() {
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  );
}

function Gate() {
  const { state } = useSession();

  // Oynatıcı, dinleme geçmişini ve "şimdi ne dinliyor"u etkin hesaba yazar.
  useEffect(() => {
    player.setAccount(state.status === 'signed-in' ? { sb: state.sb, userId: state.user.id } : null);
  }, [state]);

  if (state.status === 'loading') {
    return (
      <div className="grid h-full place-items-center bg-page" role="status" aria-label="Bekofy açılıyor">
        <BekofyMark className="size-(--size-control-xl) motion-safe:animate-pulse" />
      </div>
    );
  }
  if (state.status === 'signed-out') return <AuthScreen />;
  return <Shell />;
}
