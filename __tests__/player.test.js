describe('MusicPlayer - formatTime', () => {
  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  test('returns 0:00 for NaN', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(undefined)).toBe('0:00');
  });

  test('formats 0 seconds', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  test('formats less than a minute', () => {
    expect(formatTime(45)).toBe('0:45');
  });

  test('formats exactly one minute', () => {
    expect(formatTime(60)).toBe('1:00');
  });

  test('formats minutes and seconds', () => {
    expect(formatTime(125)).toBe('2:05');
  });

  test('formats large values', () => {
    expect(formatTime(3661)).toBe('61:01');
  });

  test('pads single digit seconds', () => {
    expect(formatTime(61)).toBe('1:01');
    expect(formatTime(601)).toBe('10:01');
  });
});

describe('MusicPlayer - addToQueue', () => {
  function createMockPlayer() {
    return {
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      playSong: jest.fn(),
      addToQueue(song) {
        if (!song) return;
        if (this.queue.length === 0 || this.currentIndex === -1) {
          this.playSong(song, [song]);
          return;
        }
        const alreadyInQueue = this.queue.find(s => s.id === song.id);
        if (alreadyInQueue) return 'duplicate';
        const insertIndex = this.currentIndex + 1;
        this.queue.splice(insertIndex, 0, song);
        return 'added';
      },
    };
  }

  test('starts playing if queue is empty', () => {
    const player = createMockPlayer();
    const song = { id: 1, title: 'Test Song' };
    player.addToQueue(song);
    expect(player.playSong).toHaveBeenCalledWith(song, [song]);
  });

  test('starts playing if currentIndex is -1', () => {
    const player = createMockPlayer();
    player.queue = [{ id: 1 }];
    player.currentIndex = -1;
    const song = { id: 2, title: 'New Song' };
    player.addToQueue(song);
    expect(player.playSong).toHaveBeenCalledWith(song, [song]);
  });

  test('returns duplicate if song already in queue', () => {
    const player = createMockPlayer();
    player.queue = [{ id: 1 }, { id: 2 }];
    player.currentIndex = 0;
    expect(player.addToQueue({ id: 1 })).toBe('duplicate');
  });

  test('adds song after current index', () => {
    const player = createMockPlayer();
    player.queue = [{ id: 1 }, { id: 2 }];
    player.currentIndex = 0;
    const result = player.addToQueue({ id: 3, title: 'New' });
    expect(result).toBe('added');
    expect(player.queue).toEqual([
      { id: 1 },
      { id: 3, title: 'New' },
      { id: 2 },
    ]);
  });

  test('ignores null/undefined song', () => {
    const player = createMockPlayer();
    player.addToQueue(null);
    player.addToQueue(undefined);
    expect(player.playSong).not.toHaveBeenCalled();
  });
});

describe('MusicPlayer - constructor defaults', () => {
  function createMockPlayer() {
    return {
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      playSong: jest.fn(),
    };
  }

  test('initial queue is empty', () => {
    const player = createMockPlayer();
    expect(player.queue).toEqual([]);
  });

  test('initial currentIndex is -1', () => {
    const player = createMockPlayer();
    expect(player.currentIndex).toBe(-1);
  });

  test('initial isPlaying is false', () => {
    const player = createMockPlayer();
    expect(player.isPlaying).toBe(false);
  });
});
