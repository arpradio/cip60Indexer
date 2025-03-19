type AudioHandler = {
    play: () => void;
    pause: () => void;
    stop: () => void;
};

class AudioManager {
    private currentAudio: HTMLAudioElement | null = null;
    private currentHandler: AudioHandler | null = null;
    private handlers: Set<AudioHandler> = new Set();
    private playbackTimer: number | null = null;
    private fadeInterval: number | null = null;

    private readonly FADE_DURATION = 2300;
    private readonly INITIAL_VOLUME = 0.1;
    private readonly PEAK_VOLUME = 0.8;

    register(handler: AudioHandler): () => void {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    private fadeIn(audio: HTMLAudioElement) {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
        }

        audio.volume = this.INITIAL_VOLUME;

        let currentVolume = this.INITIAL_VOLUME;
        const volumeStep = (this.PEAK_VOLUME - this.INITIAL_VOLUME) / (this.FADE_DURATION / 50);

        this.fadeInterval = setInterval(() => {
            currentVolume += volumeStep;
            if (currentVolume >= this.PEAK_VOLUME) {
                audio.volume = this.PEAK_VOLUME;
                clearInterval(this.fadeInterval!);
                this.fadeInterval = null;
            } else {
                audio.volume = currentVolume;
            }
        }, 50) as unknown as number;
    }

    private fadeOut(audio: HTMLAudioElement, onComplete?: () => void) {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
        }

        let currentVolume = audio.volume;
        const volumeStep = currentVolume / (this.FADE_DURATION / 50);

        this.fadeInterval = setInterval(() => {
            currentVolume -= volumeStep;
            if (currentVolume <= this.INITIAL_VOLUME) {
                audio.volume = 0;
                clearInterval(this.fadeInterval!);
                this.fadeInterval = null;
                onComplete?.();
            } else {
                audio.volume = currentVolume;
            }
        }, 50) as unknown as number;
    }

    play(audio: HTMLAudioElement, handler: AudioHandler, options: {
        startTime?: number;
        duration?: number;
    } = {}) {
        const { startTime = 18, duration = 18 } = options;

        if (this.currentAudio) {
            this.pause();
        }

        if (this.playbackTimer) {
            clearTimeout(this.playbackTimer);
        }

        audio.currentTime = startTime;

        this.currentAudio = audio;
        this.currentHandler = handler;
        
        this.fadeIn(audio);
        audio.play();
        handler.play();

        this.playbackTimer = setTimeout(() => {
            this.pause();
        }, duration * 1000) as unknown as number;

        this.handlers.forEach(h => {
            if (h !== handler) {
                h.stop();
            }
        });

        const endHandler = () => {
            if (this.playbackTimer) {
                clearTimeout(this.playbackTimer);
            }
            this.pause();
            audio.removeEventListener('ended', endHandler);
        };
        audio.addEventListener('ended', endHandler);
    }

    pause() {
        if (this.currentAudio) {
            if (this.playbackTimer) {
                clearTimeout(this.playbackTimer);
                this.playbackTimer = null;
            }

            this.fadeOut(this.currentAudio, () => {
                this.currentAudio!.pause();
                this.currentAudio!.currentTime = 0;
                
                this.currentHandler?.pause();
                this.handlers.forEach(h => h.stop());
                
                this.currentAudio = null;
                this.currentHandler = null;
            });
        }
    }

    getCurrentAudio(): HTMLAudioElement | null {
        return this.currentAudio;
    }

    isPlaying(audio: HTMLAudioElement): boolean {
        return this.currentAudio === audio && !audio.paused;
    }
}

export const audioManager = new AudioManager();