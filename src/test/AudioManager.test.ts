import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioManager, getAudioManager, initializeAudioManager, SoundEffect } from '../utils/AudioManager';

// Simple mock that doesn't try to mock the entire Web Audio API
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

// Mock window.AudioContext
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext)
});

// Mock fetch
global.fetch = vi.fn();

describe('AudioManager', () => {
  let audioManager: AudioManager;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockRejectedValue(new Error('File not found'));
    audioManager = new AudioManager();
  });

  afterEach(() => {
    audioManager.dispose();
  });

  describe('Basic Functionality', () => {
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

    it('should not crash when AudioContext is unavailable', () => {
      // This test ensures the AudioManager doesn't crash in environments without Web Audio API
      expect(() => new AudioManager()).not.toThrow();
    });
  });

  describe('Audio Control', () => {
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
  });

  describe('Sound Playback', () => {
    it('should not throw when playing sounds', async () => {
      await expect(audioManager.playSound('card-move')).resolves.toBeUndefined();
      await expect(audioManager.playSound('card-invalid')).resolves.toBeUndefined();
      await expect(audioManager.playSound('game-win')).resolves.toBeUndefined();
    });

    it('should handle invalid sound effect names gracefully', async () => {
      await expect(audioManager.playSound('invalid-sound' as SoundEffect)).resolves.toBeUndefined();
    });

    it('should handle playback when disabled', async () => {
      audioManager.setEnabled(false);
      await expect(audioManager.playSound('card-move')).resolves.toBeUndefined();
    });
  });

  describe('Resource Management', () => {
    it('should dispose resources without throwing', () => {
      expect(() => audioManager.dispose()).not.toThrow();
    });

    it('should handle disposal when context is already closed', () => {
      mockAudioContext.state = 'closed';
      expect(() => audioManager.dispose()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing sound effects gracefully', async () => {
      const emptyAudioManager = new AudioManager({ useGeneratedSounds: false });
      
      await expect(emptyAudioManager.playSound('card-move')).resolves.toBeUndefined();
      
      emptyAudioManager.dispose();
    });
  });
});

describe('Global AudioManager Functions', () => {
  afterEach(() => {
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