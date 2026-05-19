// ===== Music Player Engine =====

class MusicPlayer {
  constructor() {
    this.audio = new Audio();
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 'none'; // none, all, one
    
    // Load saved volume or default to 0.7
    const savedVol = localStorage.getItem('bekofy_volume');
    this.volume = savedVol !== null ? parseFloat(savedVol) : 0.7;
    this.audio.volume = this.volume;

    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('loadedmetadata', () => this.onLoaded());
    this.audio.addEventListener('error', (e) => this.onError(e));
    
    // Visualizer variables
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.canvas = null;
    this.canvasCtx = null;
    this.animationId = null;
    this.isFullscreen = false;

    // ===== DJ Crossfade Engine =====
    this._crossfadeAudio = new Audio(); // Secondary audio element for crossfade
    this._crossfadeAudio.crossOrigin = 'anonymous';
    this._crossfadeInterval = null;
    this._isCrossfading = false;
    this._crossfadeTriggered = false; // Prevents double-trigger per song

    // Web Audio nodes for DJ filter effects
    this._cfAudioCtx = null;
    this._cfSourceA = null; // source for outgoing (primary) audio during crossfade
    this._cfSourceB = null; // source for incoming (secondary) audio during crossfade
    this._cfFilterA = null; // low-pass filter on outgoing track
    this._cfFilterB = null; // high-pass filter on incoming track
    this._cfGainA = null;   // gain node for outgoing
    this._cfGainB = null;   // gain node for incoming
    this._cfConnectedElements = new WeakSet(); // track which Audio elements already have sources

    // Load crossfade settings from localStorage
    const savedCF = localStorage.getItem('bekofy_crossfade');
    const cfSettings = savedCF ? JSON.parse(savedCF) : {};
    this.crossfadeEnabled = cfSettings.enabled || false;
    this.crossfadeDuration = cfSettings.duration || 6; // seconds
    // Modes: 'classic' | 'eq' | 'echo' | 'power-cut'
    this.crossfadeMode = cfSettings.mode || 'eq';
  }

  saveState(song) {
    if (song) {
      localStorage.setItem('bekofy_last_song', JSON.stringify({
        song: song,
        queue: this.queue,
        currentIndex: this.currentIndex
      }));
    }
  }

  loadState() {
    this.updateVolumeUI(); // Ensure volume bar matches saved volume on load
    const saved = localStorage.getItem('bekofy_last_song');
    if (saved) {
      try {
        const { song, queue, currentIndex } = JSON.parse(saved);
        if (song) {
          this.queue = queue || [song];
          this.currentIndex = currentIndex || 0;
          this.updateUI(song);
          // Just prepare UI, don't auto play
        }
      } catch (e) {
        console.error('State load error:', e);
      }
    }
  }

  async playSong(song, songList) {
    if (songList) {
      this.queue = [...songList];
      this.currentIndex = this.queue.findIndex(s => s.id === song.id);
    }

    try {
      // If crossfading into this song, the audio is already set up on _crossfadeAudio
      if (this._isCrossfading) {
        // Crossfade completed — swap handled in _performCrossfade
        this._isCrossfading = false;
      } else {
        // Normal play (no crossfade in progress)
        this._abortCrossfade();
        this.initVisualizer();
        const url = await getSongUrl(song.file_path);
        this.audio.src = url;
        this.audio.volume = this.volume;
        // Because audio context needs user interaction to resume
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        this.audio.play();
      }

      this._crossfadeTriggered = false; // Reset for new song
      this.isPlaying = true;
      this.updateUI(song);
      this.updatePlayButton();
      this.highlightCurrentSong(song.id);
      this.saveState(song);

      // Discord Rich Presence
      this.updateDiscordRPC(song, true);

      // Mini Player sync
      this.syncMiniPlayer(song);

      // Jam broadcast
      this.broadcastJamAction('play_song');
    } catch (err) {
      console.error('Error playing song:', err);
      showToast('Şarkı oynatılamadı', 'error');
    }
  }

  togglePlay() {
    if (!this.audio.src) {
      const song = this.getCurrentSong();
      if (song) {
        this.playSong(song);
      }
      return;
    }
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play();
    }
    this.isPlaying = !this.isPlaying;
    this.updatePlayButton();

    // Discord RPC & Mini Player sync
    const song = this.getCurrentSong();
    if (song) {
      if (this.isPlaying) {
        this.updateDiscordRPC(song, true);
      } else {
        // Duraklatıldığında Discord RPC'yi tamamen kaldır (sayaç başlamasın)
        if (window.electronAPI && window.electronAPI.clearDiscordRPC) {
          window.electronAPI.clearDiscordRPC();
        }
      }
      this.syncMiniPlayer(song);
    }

    // Jam broadcast
    this.broadcastJamAction(this.isPlaying ? 'resume' : 'pause');
  }

  next(fromCrossfade = false) {
    if (this.queue.length === 0) return;
    if (this.isShuffle) {
      this.currentIndex = Math.floor(Math.random() * this.queue.length);
    } else {
      this.currentIndex = (this.currentIndex + 1) % this.queue.length;
    }
    if (fromCrossfade) {
      // When called from crossfade, the audio swap is already done
      this._isCrossfading = true;
    }
    this.playSong(this.queue[this.currentIndex]);
  }

  previous() {
    if (this.queue.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    if (this.isShuffle) {
      this.currentIndex = Math.floor(Math.random() * this.queue.length);
    } else {
      this.currentIndex = (this.currentIndex - 1 + this.queue.length) % this.queue.length;
    }
    this.playSong(this.queue[this.currentIndex]);
  }

  seek(percent) {
    if (!this.audio.duration) return;
    this.audio.currentTime = (percent / 100) * this.audio.duration;
    
    // Discord RPC zamanı güncelle (kullanıcı ileri/geri sardığında)
    const song = this.getCurrentSong();
    if (song && this.isPlaying) {
      this.updateDiscordRPC(song, true);
    }

    // Jam broadcast
    this.broadcastJamAction('seek');
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.audio.volume = this.volume;
    if (this._cfAudioCtx && this._cfGainA && !this._isCrossfading && !this._crossfadeTriggered) {
        this._cfGainA.gain.setValueAtTime(this.volume, this._cfAudioCtx.currentTime);
    }
    localStorage.setItem('bekofy_volume', this.volume.toString());
    this.updateVolumeUI();
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    const btn = document.getElementById('btn-shuffle');
    btn.classList.toggle('active', this.isShuffle);
  }

  toggleRepeat() {
    const modes = ['none', 'all', 'one'];
    const idx = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(idx + 1) % 3];
    const btn = document.getElementById('btn-repeat');
    btn.classList.toggle('active', this.repeatMode !== 'none');
  }

  // Event Handlers
  onTimeUpdate() {
    const { currentTime, duration } = this.audio;
    if (!duration) return;
    const percent = (currentTime / duration) * 100;
    document.getElementById('progress-bar-fill').style.width = percent + '%';
    document.getElementById('progress-bar-knob').style.left = percent + '%';
    document.getElementById('time-current').textContent = this.formatTime(currentTime);

    // Fullscreen progress sync
    const fsFill = document.getElementById('fs-progress-bar-fill');
    const fsKnob = document.getElementById('fs-progress-bar-knob');
    const fsTime = document.getElementById('fs-time-current');
    if (fsFill) fsFill.style.width = percent + '%';
    if (fsKnob) fsKnob.style.left = percent + '%';
    if (fsTime) fsTime.textContent = this.formatTime(currentTime);

    // Mini Player progress sync
    if (window.electronAPI && window.electronAPI.updateMiniPlayerProgress) {
      window.electronAPI.updateMiniPlayerProgress({ percent });
    }

    // ===== Crossfade trigger check =====
    if (
      this.crossfadeEnabled &&
      !this._crossfadeTriggered &&
      !this._isCrossfading &&
      this.repeatMode !== 'one' &&
      duration > 0 &&
      (duration - currentTime) <= this.crossfadeDuration &&
      (duration - currentTime) > 0.3 // Don't trigger at very end
    ) {
      // Check if there's a next song to crossfade to
      const hasNext = this.repeatMode === 'all' || this.currentIndex < this.queue.length - 1;
      if (hasNext && this.queue.length > 1) {
        this._crossfadeTriggered = true;
        this._performCrossfade();
      }
    }
  }

  onLoaded() {
    document.getElementById('time-total').textContent = this.formatTime(this.audio.duration);
    
    // Fullscreen total time sync
    const fsTimeTotal = document.getElementById('fs-time-total');
    if (fsTimeTotal) fsTimeTotal.textContent = this.formatTime(this.audio.duration);
    
    // Şarkının tam süresi yüklendiğinde Discord RPC'ye gönder
    const song = this.getCurrentSong();
    if (song && this.isPlaying) {
      this.updateDiscordRPC(song, true);
    }
  }

  onEnded() {
    // If crossfade already transitioned to next song, skip
    if (this._crossfadeTriggered && this.crossfadeEnabled) {
      return;
    }
    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.audio.play();
    } else if (this.repeatMode === 'all' || this.currentIndex < this.queue.length - 1) {
      this.next();
    } else {
      this.isPlaying = false;
      this.updatePlayButton();
      // Clear Discord RPC when playback ends
      if (window.electronAPI && window.electronAPI.clearDiscordRPC) {
        window.electronAPI.clearDiscordRPC();
      }
    }
  }

  onError(e) {
    // Suppress errors during crossfade transitions (old audio src cleared)
    if (this._isCrossfading || this._crossfadeTriggered) return;
    console.error('Audio error:', e);
    showToast('Şarkı yüklenirken hata oluştu', 'error');
  }

  initVisualizer() {
    if (this.audioCtx) return; // Zaten yüklüyse tekrar oluşturma
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      
      // Çapraz köken koruması için
      this.audio.crossOrigin = "anonymous";
      
      this.source = this.audioCtx.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      
      this.analyser.fftSize = 256;
      
      this.canvas = document.getElementById('fs-visualizer');
      if (this.canvas) {
        this.canvasCtx = this.canvas.getContext('2d');
      }
    } catch (e) {
      console.warn('Web Audio API desteklenmiyor veya engellendi:', e);
    }
  }

  // ===== DJ Crossfade Engine Setup =====
  _initCFAudioCtx() {
    if (this._cfAudioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this._cfAudioCtx = new AudioContext();

      // Gain nodes for volume control
      this._cfGainA = this._cfAudioCtx.createGain();
      this._cfGainB = this._cfAudioCtx.createGain();
      
      // Filter nodes for EQ sweep (DJ style)
      this._cfFilterA = this._cfAudioCtx.createBiquadFilter();
      this._cfFilterB = this._cfAudioCtx.createBiquadFilter();

      // Default states
      this._cfFilterA.type = 'lowpass'; // Outgoing track gets lowpass (muffled)
      this._cfFilterA.frequency.value = 20000; // start open
      this._cfFilterA.Q.value = 1.0;

      this._cfFilterB.type = 'highpass'; // Incoming track gets highpass (thin)
      this._cfFilterB.frequency.value = 20; // start open
      this._cfFilterB.Q.value = 1.0;

      // Connect nodes: Source -> Filter -> Gain -> Destination
      this._cfFilterA.connect(this._cfGainA);
      this._cfGainA.connect(this._cfAudioCtx.destination);

      this._cfFilterB.connect(this._cfGainB);
      this._cfGainB.connect(this._cfAudioCtx.destination);
    } catch (e) {
      console.warn('[Crossfade] Web Audio API not supported for DJ effects', e);
    }
  }

  async _performCrossfade() {
    try {
      // Determine next song index
      let nextIndex;
      if (this.isShuffle) {
        nextIndex = Math.floor(Math.random() * this.queue.length);
      } else {
        nextIndex = (this.currentIndex + 1) % this.queue.length;
      }
      const nextSong = this.queue[nextIndex];
      if (!nextSong) return;

      // Pre-load next song into secondary audio
      const url = await getSongUrl(nextSong.file_path);
      this._crossfadeAudio.src = url;
      this._crossfadeAudio.volume = 0; // We'll handle volume via Web Audio if available, else fallback
      this._crossfadeAudio.currentTime = 0;

      await new Promise((resolve, reject) => {
        this._crossfadeAudio.addEventListener('canplaythrough', resolve, { once: true });
        this._crossfadeAudio.addEventListener('error', reject, { once: true });
        this._crossfadeAudio.load();
      });

      // Start playing secondary audio
      this._crossfadeAudio.play();

      // Setup DJ Effects
      this._initCFAudioCtx();
      let useWebAudio = !!this._cfAudioCtx;

      if (useWebAudio) {
        if (this._cfAudioCtx.state === 'suspended') this._cfAudioCtx.resume();
        
        // Connect media elements to Web Audio context (only once per element)
        if (!this._cfConnectedElements.has(this.audio)) {
          this._cfSourceA = this._cfAudioCtx.createMediaElementSource(this.audio);
          this._cfConnectedElements.add(this.audio);
        }
        if (!this._cfConnectedElements.has(this._crossfadeAudio)) {
          this._cfSourceB = this._cfAudioCtx.createMediaElementSource(this._crossfadeAudio);
          this._cfConnectedElements.add(this._crossfadeAudio);
        }

        // Connect sources to filters
        if (this._cfSourceA) {
            this._cfSourceA.disconnect();
            this._cfSourceA.connect(this._cfFilterA);
        }
        if (this._cfSourceB) {
            this._cfSourceB.disconnect();
            this._cfSourceB.connect(this._cfFilterB);
        }

        // Reset parameters for new transition
        const t0 = this._cfAudioCtx.currentTime;
        const dur = this.crossfadeDuration;

        // Reset Gains
        this._cfGainA.gain.cancelScheduledValues(t0);
        this._cfGainA.gain.setValueAtTime(this.volume, t0);
        
        this._cfGainB.gain.cancelScheduledValues(t0);
        this._cfGainB.gain.setValueAtTime(0.01, t0); // avoid 0 for exponentialRamp

        // Reset Filters based on mode
        this._cfFilterA.frequency.cancelScheduledValues(t0);
        this._cfFilterB.frequency.cancelScheduledValues(t0);
        
        if (this.crossfadeMode === 'eq') {
            // DJ Filter Sweep: 
            // Outgoing track: Lowpass filter frequency drops from 20kHz to 100Hz (bass only)
            this._cfFilterA.type = 'lowpass';
            this._cfFilterA.frequency.setValueAtTime(20000, t0);
            this._cfFilterA.frequency.exponentialRampToValueAtTime(100, t0 + dur);
            
            // Incoming track: Highpass filter frequency drops from 10kHz to 20Hz (comes in thin, gets full)
            this._cfFilterB.type = 'highpass';
            this._cfFilterB.frequency.setValueAtTime(10000, t0);
            this._cfFilterB.frequency.exponentialRampToValueAtTime(20, t0 + dur);

            // Equal power volume crossfade
            this._cfGainA.gain.setValueCurveAtTime(this._createCosFade(1, 0), t0, dur);
            this._cfGainB.gain.setValueCurveAtTime(this._createCosFade(0, 1), t0, dur);
        } 
        else if (this.crossfadeMode === 'power-cut') {
            // Power cut: Outgoing tracks slows down and drops pitch (simulate turntable stop), incoming drops in instantly
            // Wait, we can't easily do playbackRate envelope in web audio without a buffer source, so we'll do a quick fade and lowpass
            this._cfFilterA.type = 'lowpass';
            this._cfFilterA.frequency.setValueAtTime(20000, t0);
            this._cfFilterA.frequency.exponentialRampToValueAtTime(100, t0 + dur * 0.3); // very fast muffle
            
            this._cfGainA.gain.linearRampToValueAtTime(0.01, t0 + dur * 0.3);
            
            this._cfFilterB.type = 'highpass';
            this._cfFilterB.frequency.setValueAtTime(20, t0); // fully open
            this._cfGainB.gain.setValueAtTime(this.volume, t0); // instant in
        }
        else {
            // Classic equal power crossfade without filters
            this._cfFilterA.type = 'lowpass';
            this._cfFilterA.frequency.setValueAtTime(20000, t0);
            this._cfFilterB.type = 'highpass';
            this._cfFilterB.frequency.setValueAtTime(20, t0);

            this._cfGainA.gain.setValueCurveAtTime(this._createCosFade(1, 0), t0, dur);
            this._cfGainB.gain.setValueCurveAtTime(this._createCosFade(0, 1), t0, dur);
        }

        // Need to make sure HTML Audio elements are at max volume since Web Audio Gain nodes handle the mix
        this.audio.volume = 1;
        this._crossfadeAudio.volume = 1;
      }

      const fadeDuration = Math.min(this.crossfadeDuration, 12) * 1000; // ms
      const stepInterval = 50; // ms
      const steps = fadeDuration / stepInterval;
      let step = 0;

      // Clear any previous interval
      if (this._crossfadeInterval) clearInterval(this._crossfadeInterval);

      this._crossfadeInterval = setInterval(() => {
        step++;
        const progress = Math.min(step / steps, 1);

        // Fallback for non-Web Audio
        if (!useWebAudio) {
            // Equal power crossfade math
            const fadeOut = Math.cos(progress * 0.5 * Math.PI);
            const fadeIn = Math.cos((1.0 - progress) * 0.5 * Math.PI);
            
            this.audio.volume = fadeOut * this.volume;
            this._crossfadeAudio.volume = fadeIn * this.volume;
        }

        // Update crossfade indicator glow intensity
        const indicator = document.getElementById('crossfade-active-indicator');
        if (indicator) {
          // Add pulse and color shift based on mode
          indicator.style.opacity = Math.sin(progress * Math.PI);
          if (this.crossfadeMode === 'eq') indicator.style.filter = `hue-rotate(${progress * 90}deg)`;
          else indicator.style.filter = 'none';
        }

        if (progress >= 1) {
          clearInterval(this._crossfadeInterval);
          this._crossfadeInterval = null;

          // Swap audio: stop old, new becomes primary
          const oldAudio = this.audio;
          oldAudio.onended = null;
          oldAudio.onerror = null;
          oldAudio.ontimeupdate = null;
          oldAudio.onloadedmetadata = null;
          oldAudio.pause();
          oldAudio.removeAttribute('src');
          oldAudio.load();

          // Swap references
          this.audio = this._crossfadeAudio;
          this._crossfadeAudio = oldAudio;
          
          if (useWebAudio) {
              // Swap sources
              const oldSource = this._cfSourceA;
              this._cfSourceA = this._cfSourceB;
              this._cfSourceB = oldSource;
              
              // Disconnect from CF filters and connect directly to analyser/destination for normal playback
              this._cfSourceA.disconnect();
              
              // Normal playback volume
              this._cfGainA.gain.setValueAtTime(this.volume, this._cfAudioCtx.currentTime);
          }

          // Re-attach event listeners to new primary audio
          this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
          this.audio.addEventListener('ended', () => this.onEnded());
          this.audio.addEventListener('loadedmetadata', () => this.onLoaded());
          this.audio.addEventListener('error', (e) => this.onError(e));

          if (!useWebAudio) {
              this.audio.volume = this.volume;
          }

          // Update index and UI
          this.currentIndex = nextIndex;
          this._isCrossfading = true;
          this._crossfadeTriggered = false;
          this.playSong(nextSong);

          // Restore normal visualizer routing if Web Audio Contexts aren't clashing
          if (this.audioCtx && this.source && !useWebAudio) {
            try {
              this.source.disconnect();
              this.source = this.audioCtx.createMediaElementSource(this.audio);
              this.source.connect(this.analyser);
              this.analyser.connect(this.audioCtx.destination);
            } catch (e) {
              // MediaElementSource might already be connected
            }
          }

          // Hide indicator
          if (indicator) {
              indicator.style.opacity = '0';
              indicator.style.filter = 'none';
          }
        }
      }, stepInterval);
    } catch (err) {
      console.warn('[Crossfade] Error:', err);
      this._crossfadeTriggered = false;
    }
  }

  // Create equal power curve array
  _createCosFade(start, end) {
      const length = 100;
      const curve = new Float32Array(length);
      for (let i = 0; i < length; ++i) {
          const progress = i / (length - 1);
          if (start === 1 && end === 0) {
              // Fade out
              curve[i] = Math.cos(progress * 0.5 * Math.PI) * this.volume;
          } else {
              // Fade in
              curve[i] = Math.cos((1.0 - progress) * 0.5 * Math.PI) * this.volume;
          }
      }
      return curve;
  }

  _abortCrossfade() {
    if (this._crossfadeInterval) {
      clearInterval(this._crossfadeInterval);
      this._crossfadeInterval = null;
    }
    this._crossfadeAudio.pause();
    this._crossfadeAudio.src = '';
    this._isCrossfading = false;
    this._crossfadeTriggered = false;
    
    // Reset gains if using web audio
    if (this._cfAudioCtx) {
        this._cfGainA.gain.cancelScheduledValues(this._cfAudioCtx.currentTime);
        this._cfGainB.gain.cancelScheduledValues(this._cfAudioCtx.currentTime);
        this._cfGainA.gain.setValueAtTime(this.volume, this._cfAudioCtx.currentTime);
        this._cfFilterA.frequency.setValueAtTime(20000, this._cfAudioCtx.currentTime);
        this.audio.volume = 1; // web audio controls volume
    } else {
        this.audio.volume = this.volume;
    }

    const indicator = document.getElementById('crossfade-active-indicator');
    if (indicator) indicator.style.opacity = '0';
  }

  setCrossfade(enabled, duration, mode) {
    this.crossfadeEnabled = enabled;
    if (duration !== undefined) this.crossfadeDuration = duration;
    if (mode !== undefined) this.crossfadeMode = mode;
    localStorage.setItem('bekofy_crossfade', JSON.stringify({
      enabled: this.crossfadeEnabled,
      duration: this.crossfadeDuration,
      mode: this.crossfadeMode
    }));
    // Update UI button state
    const btn = document.getElementById('btn-crossfade');
    if (btn) btn.classList.toggle('active', this.crossfadeEnabled);
  }

  drawVisualizer() {
    if (!this.isFullscreen || !this.analyser || !this.canvas || !this.canvasCtx) return;
    
    this.animationId = requestAnimationFrame(() => this.drawVisualizer());
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    this.canvasCtx.clearRect(0, 0, width, height);
    
    const barWidth = (width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i];
      
      // Yeşil ve beyaz geçişli frekans çubukları
      const r = 29;
      const g = 185;
      const b = 84;
      const alpha = barHeight / 255;
      
      this.canvasCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      this.canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
      
      x += barWidth + 2;
    }
  }

  toggleFullscreen() {
    const fsPlayer = document.getElementById('fs-player');
    if (!fsPlayer) return;
    
    this.isFullscreen = !this.isFullscreen;
    
    if (this.isFullscreen) {
      fsPlayer.classList.add('active');
      document.body.style.overflow = 'hidden';
      
      // Set canvas size
      if (this.canvas) {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight * 0.4;
      }
      
      // Ensure audio context is running
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      
      this.drawVisualizer();
    } else {
      fsPlayer.classList.remove('active');
      document.body.style.overflow = '';
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
    }
  }

  // UI Updates
  updateUI(song) {
    document.getElementById('now-playing-title').textContent = song.title;
    document.getElementById('now-playing-artist').innerHTML = typeof formatArtistLinks === 'function' ? formatArtistLinks(song.artist) : (song.artist || '');
    
    const cover = document.getElementById('now-playing-cover');
    if (song.cover_url) {
      cover.innerHTML = `<img src="${song.cover_url}" alt="${song.title}" id="now-playing-img" crossorigin="anonymous">`;
      
      // Update fullscreen UI
      const fsImg = document.getElementById('fs-vinyl-img');
      if (fsImg) fsImg.src = song.cover_url;
    } else {
      cover.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.3" width="40" height="40"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      
      const fsImg = document.getElementById('fs-vinyl-img');
      if (fsImg) fsImg.src = '';
    }
    
    // Update fullscreen text
    const fsTitle = document.getElementById('fs-title');
    const fsArtist = document.getElementById('fs-artist');
    if (fsTitle) fsTitle.textContent = song.title;
    if (fsArtist) fsArtist.textContent = song.artist || '';
    
    // Update queue panel if function exists
    if (typeof renderQueuePanel === 'function') {
      renderQueuePanel();
    }
  }



  updatePlayButton() {
    const playIcon = document.getElementById('icon-play');
    const pauseIcon = document.getElementById('icon-pause');
    const fsPlayIcon = document.getElementById('fs-icon-play');
    const fsPauseIcon = document.getElementById('fs-icon-pause');
    const fsVinyl = document.getElementById('fs-vinyl');
    
    if (this.isPlaying) {
      if (playIcon) playIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'block';
      if (fsPlayIcon) fsPlayIcon.style.display = 'none';
      if (fsPauseIcon) fsPauseIcon.style.display = 'block';
      if (fsVinyl) fsVinyl.classList.add('playing');
    } else {
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
      if (fsPlayIcon) fsPlayIcon.style.display = 'block';
      if (fsPauseIcon) fsPauseIcon.style.display = 'none';
      if (fsVinyl) fsVinyl.classList.remove('playing');
    }
  }

  updateVolumeUI() {
    const percent = this.volume * 100;
    document.getElementById('volume-slider-fill').style.width = percent + '%';
    document.getElementById('volume-slider-knob').style.left = percent + '%';
  }

  highlightCurrentSong(songId) {
    document.querySelectorAll('.song-list-item').forEach(el => {
      el.classList.toggle('playing', el.dataset.songId === songId);
    });
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  addToQueue(song) {
    if (!song) return;
    
    // Eğer hiç şarkı çalmıyorsa direkt başlat
    if (this.queue.length === 0 || this.currentIndex === -1) {
      this.playSong(song, [song]);
      return;
    }
    
    // Zaten sırada mı kontrol et
    const alreadyInQueue = this.queue.find(s => s.id === song.id);
    if (alreadyInQueue) {
      return 'duplicate';
    }
    
    // Mevcut şarkıdan sonraya ekle
    const insertIndex = this.currentIndex + 1;
    this.queue.splice(insertIndex, 0, song);
    return 'added';
  }

  playShuffled(songs) {
    if (!songs || songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    this.isShuffle = true;
    const btn = document.getElementById('btn-shuffle');
    if (btn) btn.classList.add('active');
    this.playSong(shuffled[0], shuffled);
  }

  getCurrentSong() {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  // ===== Discord Rich Presence =====
  updateDiscordRPC(song, isPlaying) {
    if (!window.electronAPI || !window.electronAPI.updateDiscordRPC) return;
    try {
      window.electronAPI.updateDiscordRPC({
        title: song.title,
        artist: song.artist,
        album: song.album || '',
        cover_url: song.cover_url || '',
        duration: this.audio.duration || song.duration || 0,
        currentTime: this.audio.currentTime || 0,
        isPlaying: isPlaying
      });
    } catch (e) {
      // Silent fail
    }
  }

  // ===== Mini Player Sync =====
  syncMiniPlayer(song) {
    if (!window.electronAPI || !window.electronAPI.updateMiniPlayer) return;
    try {
      window.electronAPI.updateMiniPlayer({
        title: song.title,
        artist: song.artist,
        cover_url: song.cover_url || '',
        isPlaying: this.isPlaying
      });
    } catch (e) {
      // Silent fail
    }
  }

  // ===== Jam (Birlikte Dinleme) =====
  jamSessionId = null;
  isJamHost = false;
  _jamSyncInterval = null;

  setJamSession(sessionId, isHost) {
    this.jamSessionId = sessionId;
    this.isJamHost = isHost;
    // Host broadcasts position every 5 seconds for drift correction
    if (isHost) {
      this._jamSyncInterval = setInterval(() => {
        if (this.jamSessionId && this.isJamHost && this.isPlaying) {
          const song = this.getCurrentSong();
          if (song) {
            broadcastJamEvent({
              type: 'position_sync',
              songId: song.id,
              position: this.audio.currentTime,
              isPlaying: this.isPlaying,
              timestamp: Date.now()
            });
          }
        }
      }, 5000);
    }
  }

  clearJamSession() {
    this.jamSessionId = null;
    this.isJamHost = false;
    if (this._jamSyncInterval) {
      clearInterval(this._jamSyncInterval);
      this._jamSyncInterval = null;
    }
  }

  // Called when host changes song/plays/pauses/seeks
  broadcastJamAction(action, extra = {}) {
    if (!this.jamSessionId || !this.isJamHost) return;
    const song = this.getCurrentSong();
    const eventData = {
      type: action,
      songId: song?.id || null,
      position: this.audio.currentTime || 0,
      isPlaying: this.isPlaying,
      timestamp: Date.now(),
      ...extra
    };
    broadcastJamEvent(eventData);

    // Persist state to database so late-joining guests can fetch it
    if (typeof updateJamState === 'function') {
      updateJamState(this.jamSessionId, song?.id || null, this.isPlaying, this.audio.currentTime || 0)
        .catch(err => console.warn('[Jam] DB state update error:', err));
    }
  }

  // Called when a Jam event comes in from the host (for guests)
  async handleJamEvent(event) {
    if (this.isJamHost) return; // Host doesn't listen to own events
    if (!event || !event.type) return;

    switch (event.type) {
      case 'play_song': {
        // Find the song in allSongs (global) and play it
        const song = (typeof allSongs !== 'undefined' ? allSongs : []).find(s => s.id === event.songId);
        if (song) {
          await this.playSong(song, typeof allSongs !== 'undefined' ? allSongs : [song]);
          if (event.position > 0) {
            this.audio.currentTime = event.position;
          }
        }
        break;
      }
      case 'pause': {
        if (this.isPlaying) {
          this.audio.pause();
          this.isPlaying = false;
          this.updatePlayButton();
        }
        break;
      }
      case 'resume': {
        if (!this.isPlaying && this.audio.src) {
          this.audio.play();
          this.isPlaying = true;
          this.updatePlayButton();
        }
        break;
      }
      case 'seek': {
        if (this.audio.src && event.position !== undefined) {
          this.audio.currentTime = event.position;
        }
        break;
      }
      case 'position_sync': {
        // Drift correction: if off by more than 3 seconds, resync
        if (this.audio.src && event.songId === this.getCurrentSong()?.id) {
          const drift = Math.abs(this.audio.currentTime - event.position);
          if (drift > 3) {
            this.audio.currentTime = event.position;
          }
          // Sync play/pause state
          if (event.isPlaying && !this.isPlaying) {
            this.audio.play();
            this.isPlaying = true;
            this.updatePlayButton();
          } else if (!event.isPlaying && this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
            this.updatePlayButton();
          }
        } else if (event.songId && event.songId !== this.getCurrentSong()?.id) {
          // Different song, switch
          const song = (typeof allSongs !== 'undefined' ? allSongs : []).find(s => s.id === event.songId);
          if (song) {
            await this.playSong(song, typeof allSongs !== 'undefined' ? allSongs : [song]);
            if (event.position > 0) this.audio.currentTime = event.position;
          }
        }
        break;
      }
      case 'end_session': {
        this.clearJamSession();
        if (typeof showToast === 'function') showToast('Jam oturumu sona erdi', 'info');
        if (typeof onJamEnded === 'function') onJamEnded();
        break;
      }
    }
  }
}

// Global player instance
const player = new MusicPlayer();

// Listen for mini player commands
if (window.electronAPI && window.electronAPI.onMiniCommand) {
  window.electronAPI.onMiniCommand((command, data) => {
    switch (command) {
      case 'toggle-play':
        player.togglePlay();
        break;
      case 'next':
        player.next();
        break;
      case 'prev':
        player.previous();
        break;
      case 'seek':
        if (data !== undefined) player.seek(data);
        break;
      case 'request-current-song':
        // Mini player just loaded, send current song data
        const currentSong = player.getCurrentSong();
        if (currentSong) {
          player.syncMiniPlayer(currentSong);
        }
        break;
    }
  });
}
