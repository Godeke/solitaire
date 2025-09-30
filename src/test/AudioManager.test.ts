import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { AudioManager, getAudioManager, initializeAudioManager, SoundEffect } from '../utils/AudioManager';

// Mock Web Audio API
const mockAudioContext = {
  createBuffer: vi.fn(),
  createBufferSource: vi.fn(),
  createGain: vi.fn(),
  decodeAudioData: vi.fn(),
  resume: vi.fn(),
  close: vi.fn(),
  state: 'running',
  sampleRate: 44100,
  destination: {}
};

const mockBufferSource = {
  buffer: null,
  connect: vi.fn(),
  start: vi.fn()
};

const mockGainNode = {
  gain: { value: 1 },
  connect: vi.fn()
};

const mockAudioBuffer = {
  getChannelData: vi.fn(() => new Float32Array(1024)),
  length: 1024,
  sampleRate: 44100,
  numberOfChannels: 1
};

// Mock global AudioContext
global.AudioContext = vi.fn(() => mockAudioContext) as any;
global.webkitAudioContext = vi.fn(() => mockAudioContext) as any;

// Mock fetch for audio file loading
global.fetch = vi.fn();

describe('AudioManager', () => {
  let audioManager: AudioManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockAudioContext.createBuffer.mockReturnValue(mockAudioBuffer);
    mockAudioContext.createBufferSource.mockReturnValue(mockBufferSource);
    mockAudioContext.createGain.mockReturnValue(mockGainNode);
    mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer);
    mockAudioContext.resume.mockResolvedValue(undefined);
    mockAudioContext.close.mockResolvedValue(undefined);
    mockAudioContext.state = 'running';

    // Mock fetch to simulate file not found (will use generated sounds)
    (global.fetch as Mock).mockRejectedValue(new Error('File not found'));

    audioManager = new AudioManager();
  });

  afterEach(() => {
    audioManager.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const config = audioManager.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.volume).toBe(0.7);
      expect(config.useGeneratedSounds).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customAudioManager = new AudioManager({
        enabled: false,
        volume: 0.5,
        useGeneratedSounds: false
      });

      const config = customAudioManager.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.volume).toBe(0.5);
      expect(config.useGeneratedSounds).toBe(false);

      customAudioManager.dispose();
    });

    it('should create AudioContext on initialization', () => {
      expect(global.AudioContext).toHaveBeenCalled();
    });

    it('should handle AudioContext creation failure', () => {
      global.AudioContext = vi.fn(() => {
        throw new Error('AudioContext not supported');
      }) as any;

      const failingAudioManager = new AudioManager();
      expect(failingAudioManager.isEnabled()).toBe(false);
      
      failingAudioManager.dispose();
    });
  });

  describe('Sound Generation', () => {
    it('should generate sound effects when files are not available', async () => {
      // Wait for sound loading to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAudioContext.createBuffer).toHaveBeenCalled();
    });

    it('should generate different sounds for different effects', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have called createBuffer for each sound effect
      expect(mockAudioContext.createBuffer).toHaveBeenCalledTimes(3); // card-move, card-invalid, game-win
    });
  });

  describe('Sound Playback', () => {
    beforeEach(async () => {
      // Wait for sound loading to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should play sound when enabled', async () => {
      await audioManager.playSound('card-move');

      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(mockBufferSource.start).toHaveBeenCalled();
    });

    it('should not play sound when disabled', async () => {
      audioManager.setEnabled(false);
      await audioManager.playSound('card-move');

      expect(mockBufferSource.start).not.toHaveBeenCalled();
    });

    it('should resume audio context if suspended', async () => {
      mockAudioContext.state = 'suspended';
      await audioManager.playSound('card-move');

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should handle audio context resume failure', async () => {
      mockAudioContext.state = 'suspended';
      mockAudioContext.resume.mockRejectedValue(new Error('Resume failed'));

      await audioManager.playSound('card-move');

      expect(mockAudioContext.resume).toHaveBeenCalled();
      expect(mockBufferSource.start).not.toHaveBeenCalled();
    });

    it('should handle playback errors gracefully', async () => {
      mockBufferSource.start.mockImplementation(() => {
        throw new Error('Playback failed');
      });

      // Should not throw
      await expect(audioManager.playSound('card-move')).resolves.toBeUndefined();
    });

    it('should play all sound effect types', async () => {
      const soundEffects: SoundEffect[] = ['card-move', 'card-invalid', 'game-win'];

      for (const effect of soundEffects) {
        vi.clearAllMocks();
        await audioManager.playSound(effect);
        expect(mockBufferSource.start).toHaveBeenCalled();
      }
    });
  });

  describe('Volume Control', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should set volume correctly', () => {
      audioManager.setVolume(0.5);
      expect(audioManager.getVolume()).toBe(0.5);
    });

    it('should clamp volume to valid range', () => {
      audioManager.setVolume(-0.5);
      expect(audioManager.getVolume()).toBe(0);

      audioManager.setVolume(1.5);
      expect(audioManager.getVolume()).toBe(1);
    });

    it('should apply volume to gain node during playback', async () => {
      audioManager.setVolume(0.3);
      await audioManager.playSound('card-move');

      expect(mockGainNode.gain.value).toBe(0.3);
    });
  });

  describe('Enable/Disable Control', () => {
    it('should enable and disable audio', () => {
      audioManager.setEnabled(false);
      expect(audioManager.isEnabled()).toBe(false);

      audioManager.setEnabled(true);
      expect(audioManager.isEnabled()).toBe(true);
    });

    it('should toggle audio state', () => {
      const initialState = audioManager.isEnabled();
      const newState = audioManager.toggleAudio();

      expect(newState).toBe(!initialState);
      expect(audioManager.isEnabled()).toBe(newState);
    });
  });

  describe('Resource Management', () => {
    it('should dispose resources properly', () => {
      audioManager.dispose();
      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it('should handle disposal when context is already closed', () => {
      mockAudioContext.state = 'closed';
      
      // Should not throw
      expect(() => audioManager.dispose()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing sound effects gracefully', async () => {
      const emptyAudioManager = new AudioManager({ useGeneratedSounds: false });
      
      // Should not throw
      await expect(emptyAudioManager.playSound('card-move')).resolves.toBeUndefined();
      
      emptyAudioManager.dispose();
    });

    it('should handle invalid sound effect names', async () => {
      // Should not throw
      await expect(audioManager.playSound('invalid-sound' as SoundEffect)).resolves.toBeUndefined();
    });
  });

  describe('File Loading', () => {
    it('should attempt to load audio files first', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      });

      const fileLoadingManager = new AudioManager();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledWith('./assets/sounds/card-move.mp3');
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();

      fileLoadingManager.dispose();
    });

    it('should fall back to generated sounds when file loading fails', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

      const fallbackManager = new AudioManager();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAudioContext.createBuffer).toHaveBeenCalled();

      fallbackManager.dispose();
    });

    it('should handle decode errors gracefully', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      });
      mockAudioContext.decodeAudioData.mockRejectedValue(new Error('Decode failed'));

      const decodeErrorManager = new AudioManager();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should fall back to generated sounds
      expect(mockAudioContext.createBuffer).toHaveBeenCalled();

      decodeErrorManager.dispose();
    });
  });
});

describe('Global AudioManager Functions', () => {
  afterEach(() => {
    // Clean up any global instances
    const manager = getAudioManager();
    manager.dispose();
  });

  describe('getAudioManager', () => {
    it('should return singleton instance', () => {
      const manager1 = getAudioManager();
      const manager2 = getAudioManager();

      expect(manager1).toBe(manager2);
    });

    it('should create instance with default config', () => {
      const manager = getAudioManager();
      const config = manager.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.volume).toBe(0.7);
    });
  });

  describe('initializeAudioManager', () => {
    it('should create new instance with custom config', () => {
      const manager = initializeAudioManager({
        enabled: false,
        volume: 0.5
      });

      const config = manager.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.volume).toBe(0.5);
    });

    it('should dispose previous instance before creating new one', () => {
      const manager1 = initializeAudioManager();
      const disposeSpy = vi.spyOn(manager1, 'dispose');

      const manager2 = initializeAudioManager();

      expect(disposeSpy).toHaveBeenCalled();
      expect(manager1).not.toBe(manager2);
    });
  });
});

describe('Sound Effect Generation', () => {
  let audioManager: AudioManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioContext.createBuffer.mockReturnValue(mockAudioBuffer);
    mockAudioBuffer.getChannelData.mockReturnValue(new Float32Array(1024));
    
    audioManager = new AudioManager();
  });

  afterEach(() => {
    audioManager.dispose();
  });

  it('should generate card-move sound with correct parameters', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should create buffer for card-move sound
    expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(
      1, // mono
      expect.any(Number), // duration * sampleRate
      44100 // sample rate
    );
  });

  it('should generate different durations for different sound effects', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));

    const calls = mockAudioContext.createBuffer.mock.calls;
    
    // Should have different durations for different sounds
    const durations = calls.map(call => call[1] / call[2]); // samples / sampleRate = duration
    
    // card-move should be shortest, game-win should be longest
    expect(durations).toHaveLength(3);
    expect(Math.max(...durations)).toBeGreaterThan(Math.min(...durations));
  });

  it('should fill audio buffer with generated waveform data', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockAudioBuffer.getChannelData).toHaveBeenCalledWith(0);
  });
});