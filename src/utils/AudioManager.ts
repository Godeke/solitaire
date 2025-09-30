import { RendererLogger } from '@utils/RendererLogger';

/**
 * Sound effect types available in the audio system
 */
export type SoundEffect = 'card-move' | 'card-invalid' | 'game-win';

/**
 * Audio manager configuration options
 */
export interface AudioManagerConfig {
  /** Whether audio is enabled by default */
  enabled: boolean;
  /** Master volume level (0.0 to 1.0) */
  volume: number;
  /** Whether to use Web Audio API for generated sounds as fallback */
  useGeneratedSounds: boolean;
}

/**
 * AudioManager handles all sound effects and audio preferences for the game.
 * Supports both file-based audio and Web Audio API generated sounds as fallback.
 */
export class AudioManager {
  private audioContext: AudioContext | null = null;
  private audioBuffers: Map<SoundEffect, AudioBuffer> = new Map();
  private config: AudioManagerConfig;
  private logger = RendererLogger.getInstance();

  constructor(config: Partial<AudioManagerConfig> = {}) {
    this.config = {
      enabled: true,
      volume: 0.7,
      useGeneratedSounds: true,
      ...config
    };

    this.initializeAudioContext();
    this.loadSoundEffects();
  }

  /**
   * Initialize the Web Audio API context
   */
  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.logger.info('AUDIO', 'Audio context initialized successfully');
    } catch (error) {
      this.logger.error('AUDIO', 'Failed to initialize audio context', { error });
      this.config.enabled = false;
    }
  }

  /**
   * Load all sound effect files or generate fallback sounds
   */
  private async loadSoundEffects(): Promise<void> {
    if (!this.audioContext || !this.config.enabled) {
      return;
    }

    const soundEffects: SoundEffect[] = ['card-move', 'card-invalid', 'game-win'];

    for (const effect of soundEffects) {
      try {
        // Try to load from file first
        const buffer = await this.loadAudioFile(effect);
        if (buffer) {
          this.audioBuffers.set(effect, buffer);
          this.logger.debug('AUDIO', `Loaded sound effect: ${effect}`);
        } else if (this.config.useGeneratedSounds) {
          // Generate fallback sound using Web Audio API
          const generatedBuffer = this.generateSoundEffect(effect);
          if (generatedBuffer) {
            this.audioBuffers.set(effect, generatedBuffer);
            this.logger.debug('AUDIO', `Generated fallback sound for: ${effect}`);
          }
        }
      } catch (error) {
        this.logger.warn('AUDIO', `Failed to load sound effect: ${effect}`, { error });
      }
    }
  }

  /**
   * Load audio file and decode it to AudioBuffer
   */
  private async loadAudioFile(effect: SoundEffect): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;

    try {
      const response = await fetch(`./assets/sounds/${effect}.mp3`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      this.logger.debug('AUDIO', `Could not load audio file for ${effect}, will use generated sound`, { error });
      return null;
    }
  }

  /**
   * Generate simple sound effects using Web Audio API
   */
  private generateSoundEffect(effect: SoundEffect): AudioBuffer | null {
    if (!this.audioContext) return null;

    const sampleRate = this.audioContext.sampleRate;
    let duration: number;
    let frequencies: number[];

    switch (effect) {
      case 'card-move':
        duration = 0.1;
        frequencies = [800, 600]; // Quick descending tone
        break;
      case 'card-invalid':
        duration = 0.2;
        frequencies = [300, 250, 200]; // Lower error tone
        break;
      case 'game-win':
        duration = 0.8;
        frequencies = [523, 659, 784, 1047]; // C major arpeggio
        break;
      default:
        return null;
    }

    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < channelData.length; i++) {
      const time = i / sampleRate;
      let sample = 0;

      // Generate tones based on the effect type
      for (let j = 0; j < frequencies.length; j++) {
        const freq = frequencies[j];
        const segmentDuration = duration / frequencies.length;
        const segmentStart = j * segmentDuration;
        const segmentEnd = (j + 1) * segmentDuration;

        if (time >= segmentStart && time < segmentEnd) {
          const segmentTime = time - segmentStart;
          const envelope = Math.exp(-segmentTime * 5); // Exponential decay
          sample += Math.sin(2 * Math.PI * freq * segmentTime) * envelope * 0.3;
        }
      }

      channelData[i] = sample;
    }

    return buffer;
  }

  /**
   * Play a sound effect
   */
  public async playSound(effect: SoundEffect): Promise<void> {
    if (!this.config.enabled || !this.audioContext) {
      this.logger.debug('AUDIO', `Audio disabled, skipping sound: ${effect}`);
      return;
    }

    // Resume audio context if it's suspended (required by browser policies)
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        this.logger.debug('AUDIO', 'Audio context resumed');
      } catch (error) {
        this.logger.error('AUDIO', 'Failed to resume audio context', { error });
        return;
      }
    }

    const buffer = this.audioBuffers.get(effect);
    if (!buffer) {
      this.logger.warn('AUDIO', `Sound effect not loaded: ${effect}`);
      return;
    }

    try {
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = buffer;
      gainNode.gain.value = this.config.volume;

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start();
      this.logger.debug('AUDIO', `Playing sound effect: ${effect}`);
    } catch (error) {
      this.logger.error('AUDIO', `Failed to play sound effect: ${effect}`, { error });
    }
  }

  /**
   * Enable or disable audio
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.logger.info('AUDIO', `Audio ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if audio is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));
    this.logger.debug('AUDIO', `Volume set to: ${this.config.volume}`);
  }

  /**
   * Get current volume level
   */
  public getVolume(): number {
    return this.config.volume;
  }

  /**
   * Toggle audio on/off
   */
  public toggleAudio(): boolean {
    this.setEnabled(!this.config.enabled);
    return this.config.enabled;
  }

  /**
   * Stop all currently playing sounds (if needed for cleanup)
   */
  public stopAllSounds(): void {
    // Note: Individual AudioBufferSourceNodes can't be stopped once started,
    // but they're short-lived for our sound effects. This method is here
    // for potential future use with longer sounds.
    this.logger.debug('AUDIO', 'Stop all sounds requested');
  }

  /**
   * Get audio manager configuration
   */
  public getConfig(): AudioManagerConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.logger.info('AUDIO', 'Audio context closed');
    }
    this.audioBuffers.clear();
  }
}

// Singleton instance for global access
let audioManagerInstance: AudioManager | null = null;

/**
 * Get the global AudioManager instance
 */
export function getAudioManager(): AudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
}

/**
 * Initialize audio manager with custom configuration
 */
export function initializeAudioManager(config?: Partial<AudioManagerConfig>): AudioManager {
  if (audioManagerInstance) {
    audioManagerInstance.dispose();
  }
  audioManagerInstance = new AudioManager(config);
  return audioManagerInstance;
}