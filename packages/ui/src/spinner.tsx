import { LoaderCircle } from 'lucide-react';
import { cn } from './cn';

/** Dönen yükleme simgesi. Hareket azaltılmışsa durur; anlamı yanındaki metin ya da aria-busy taşır. */
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden="true" className={cn('motion-safe:animate-spin', className)} />;
}
