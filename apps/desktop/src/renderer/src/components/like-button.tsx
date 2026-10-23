import { IconButton } from '@bekofy/ui';
import { Heart } from 'lucide-react';
import { useLikedIds, useToggleLike } from '../lib/data';

export function LikeButton({ songId, title, size = 'sm' }: { songId: string; title: string; size?: 'sm' | 'md' }) {
  const liked = useLikedIds().data?.has(songId) ?? false;
  const toggle = useToggleLike();
  return (
    <IconButton size={size} label={`Beğen: ${title}`} aria-pressed={liked} onClick={() => toggle.mutate({ songId, liked, title })}>
      <Heart aria-hidden="true" className={liked ? 'fill-current' : undefined} />
    </IconButton>
  );
}
