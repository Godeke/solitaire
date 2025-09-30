import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserPreferencesManager, UserPreferences } from '../utils/UserPreferences';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('UserPreferencesManager', () => {
  let preferencesManager: UserPreferencesManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton instance completely
    (UserPreferencesManager as any).instance = null;
    
    // Reset localStorage mocks to default behavior
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockImplementation(() => {});
    mockLocalStorage.removeItem.mockImplementation(() => {});
    mockLocalStorage.clear.mockImplementation(() => {});
    
    // Create fresh instance
    preferencesManager = UserPreferencesManager.getInstance();
    
    // Ensure it starts with defaults
    preferencesManager.resetToDefaults();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = UserPreferencesManager.getInstance();
      const instance2 = UserPreferencesManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should load default preferences when no stored preferences exist', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const manager = UserPreferencesManager.getInstance();
      const preferences = manager.getPreferences();

      expect(preferences.audio.enabled).toBe(true);
      expect(preferences.audio.volume).toBe(0.7);
      expect(preferences.ui.theme).toBe('auto');
      expect(preferences.ui.animations).toBe(true);
      expect(preferences.game.autoComplete).toBe(true);
      expect(preferences.game.showHints).toBe(false);
    });

    it('should load stored preferences when available', () => {
      const storedPreferences = {
        audio: { enabled: false, volume: 0.5 },
        ui: { theme: 'dark', animations: false },
        game: { autoComplete: false, showHints: true }
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedPreferences));

      // Reset singleton to force reload
      (UserPreferencesManager as any).instance = null;
      const manager = UserPreferencesManager.getInstance();
      const preferences = manager.getPreferences();

      expect(preferences.audio.enabled).toBe(false);
      expect(preferences.audio.volume).toBe(0.5);
      expect(preferences.ui.theme).toBe('dark');
      expect(preferences.ui.animations).toBe(false);
      expect(preferences.game.autoComplete).toBe(false);
      expect(preferences.game.showHints).toBe(true);
    });

    it('should merge with defaults when stored preferences are incomplete', () => {
      const partialPreferences = {
        audio: { enabled: false }
        // Missing volume, ui, and game preferences
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(partialPreferences));

      // Reset singleton to force reload
      (UserPreferencesManager as any).instance = null;
      const manager = UserPreferencesManager.getInstance();
      const preferences = manager.getPreferences();

      expect(preferences.audio.enabled).toBe(false);
      expect(preferences.audio.volume).toBe(0.7); // Default value
      expect(preferences.ui.theme).toBe('auto'); // Default value
      expect(preferences.game.autoComplete).toBe(true); // Default value
    });

    it('should handle JSON parse errors gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      // Reset singleton to force reload
      (UserPreferencesManager as any).instance = null;
      const manager = UserPreferencesManager.getInstance();
      const preferences = manager.getPreferences();

      // Should use default preferences
      expect(preferences.audio.enabled).toBe(true);
      expect(preferences.audio.volume).toBe(0.7);
    });
  });

  describe('Audio Preferences', () => {
    it('should get audio preferences', () => {
      const audioPrefs = preferencesManager.getAudioPreferences();

      expect(audioPrefs).toEqual({
        enabled: true,
        volume: 0.7
      });
    });

    it('should set audio enabled state', () => {
      preferencesManager.setAudioEnabled(false);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(preferencesManager.getAudioPreferences().enabled).toBe(false);
    });

    it('should set audio volume', () => {
      preferencesManager.setAudioVolume(0.5);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(preferencesManager.getAudioPreferences().volume).toBe(0.5);
    });

    it('should clamp audio volume to valid range', () => {
      preferencesManager.setAudioVolume(-0.5);
      expect(preferencesManager.getAudioPreferences().volume).toBe(0);

      preferencesManager.setAudioVolume(1.5);
      expect(preferencesManager.getAudioPreferences().volume).toBe(1);
    });

    it('should toggle audio state', () => {
      const initialState = preferencesManager.getAudioPreferences().enabled;
      const newState = preferencesManager.toggleAudio();

      expect(newState).toBe(!initialState);
      expect(preferencesManager.getAudioPreferences().enabled).toBe(newState);
    });
  });

  describe('UI Preferences', () => {
    it('should get UI preferences', () => {
      const uiPrefs = preferencesManager.getUIPreferences();

      expect(uiPrefs).toEqual({
        theme: 'auto',
        animations: true
      });
    });

    it('should set theme', () => {
      preferencesManager.setTheme('dark');

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(preferencesManager.getUIPreferences().theme).toBe('dark');
    });

    it('should set animations enabled state', () => {
      preferencesManager.setAnimationsEnabled(false);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(preferencesManager.getUIPreferences().animations).toBe(false);
    });
  });

  describe('Game Preferences', () => {
    it('should get game preferences', () => {
      const gamePrefs = preferencesManager.getGamePreferences();

      expect(gamePrefs).toEqual({
        autoComplete: true,
        showHints: false
      });
    });

    it('should set auto-complete enabled state', () => {
      preferencesManager.setAutoCompleteEnabled(false);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(preferencesManager.getGamePreferences().autoComplete).toBe(false);
    });

    it('should set hints enabled state', () => {
      preferencesManager.setHintsEnabled(true);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(preferencesManager.getGamePreferences().showHints).toBe(true);
    });
  });

  describe('Persistence', () => {
    it('should save preferences to localStorage', () => {
      preferencesManager.setAudioEnabled(false);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'solitaire_user_preferences',
        expect.stringContaining('"enabled":false')
      );
    });

    it('should handle localStorage save errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => preferencesManager.setAudioEnabled(false)).not.toThrow();
    });

    it('should load preferences from localStorage on initialization', () => {
      const storedPrefs = {
        audio: { enabled: false, volume: 0.3 },
        ui: { theme: 'light', animations: false },
        game: { autoComplete: false, showHints: true }
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedPrefs));

      // Reset singleton to force reload
      (UserPreferencesManager as any).instance = null;
      const manager = UserPreferencesManager.getInstance();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('solitaire_user_preferences');
      expect(manager.getAudioPreferences().enabled).toBe(false);
      expect(manager.getAudioPreferences().volume).toBe(0.3);
    });
  });

  describe('Reset and Import/Export', () => {
    it('should reset preferences to defaults', () => {
      // Change some preferences first
      preferencesManager.setAudioEnabled(false);
      preferencesManager.setTheme('dark');

      preferencesManager.resetToDefaults();

      const preferences = preferencesManager.getPreferences();
      expect(preferences.audio.enabled).toBe(true);
      expect(preferences.ui.theme).toBe('auto');
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should export preferences as JSON string', () => {
      const exported = preferencesManager.exportPreferences();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('audio');
      expect(parsed).toHaveProperty('ui');
      expect(parsed).toHaveProperty('game');
    });

    it('should import preferences from JSON string', () => {
      const importData = {
        audio: { enabled: false, volume: 0.2 },
        ui: { theme: 'dark', animations: false },
        game: { autoComplete: false, showHints: true }
      };

      const success = preferencesManager.importPreferences(JSON.stringify(importData));

      expect(success).toBe(true);
      expect(preferencesManager.getAudioPreferences().enabled).toBe(false);
      expect(preferencesManager.getAudioPreferences().volume).toBe(0.2);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should handle invalid JSON during import', () => {
      // First set a known state
      preferencesManager.setAudioEnabled(true);
      
      const success = preferencesManager.importPreferences('invalid json');

      expect(success).toBe(false);
      // Preferences should remain unchanged
      expect(preferencesManager.getAudioPreferences().enabled).toBe(true);
    });

    it('should merge imported preferences with defaults', () => {
      // Reset to defaults first to ensure clean state
      preferencesManager.resetToDefaults();
      
      const partialImport = {
        audio: { enabled: false }
        // Missing other preferences
      };

      const success = preferencesManager.importPreferences(JSON.stringify(partialImport));

      expect(success).toBe(true);
      expect(preferencesManager.getAudioPreferences().enabled).toBe(false);
      expect(preferencesManager.getAudioPreferences().volume).toBe(0.7); // Default
      expect(preferencesManager.getUIPreferences().theme).toBe('auto'); // Default
    });
  });

  describe('Immutability', () => {
    it('should return copies of preferences objects', () => {
      const prefs1 = preferencesManager.getPreferences();
      const prefs2 = preferencesManager.getPreferences();

      expect(prefs1).not.toBe(prefs2);
      expect(prefs1).toEqual(prefs2);
    });

    it('should return copies of audio preferences', () => {
      const audio1 = preferencesManager.getAudioPreferences();
      const audio2 = preferencesManager.getAudioPreferences();

      expect(audio1).not.toBe(audio2);
      expect(audio1).toEqual(audio2);
    });

    it('should not allow external modification of preferences', () => {
      // Ensure we start with a known state
      preferencesManager.setAudioEnabled(true);
      
      const prefs = preferencesManager.getPreferences();
      prefs.audio.enabled = false;

      // Original preferences should be unchanged
      expect(preferencesManager.getAudioPreferences().enabled).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('should enforce valid theme values', () => {
      preferencesManager.setTheme('light');
      expect(preferencesManager.getUIPreferences().theme).toBe('light');

      preferencesManager.setTheme('dark');
      expect(preferencesManager.getUIPreferences().theme).toBe('dark');

      preferencesManager.setTheme('auto');
      expect(preferencesManager.getUIPreferences().theme).toBe('auto');
    });

    it('should handle boolean preferences correctly', () => {
      preferencesManager.setAudioEnabled(true);
      expect(preferencesManager.getAudioPreferences().enabled).toBe(true);

      preferencesManager.setAudioEnabled(false);
      expect(preferencesManager.getAudioPreferences().enabled).toBe(false);
    });

    it('should handle numeric preferences correctly', () => {
      preferencesManager.setAudioVolume(0.5);
      expect(preferencesManager.getAudioPreferences().volume).toBe(0.5);

      preferencesManager.setAudioVolume(0);
      expect(preferencesManager.getAudioPreferences().volume).toBe(0);

      preferencesManager.setAudioVolume(1);
      expect(preferencesManager.getAudioPreferences().volume).toBe(1);
    });
  });
});