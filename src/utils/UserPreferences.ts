import { RendererLogger } from '@utils/RendererLogger';

/**
 * User preferences interface
 */
export interface UserPreferences {
  /** Audio settings */
  audio: {
    enabled: boolean;
    volume: number;
  };
  /** UI preferences */
  ui: {
    theme: 'light' | 'dark' | 'auto';
    animations: boolean;
  };
  /** Game preferences */
  game: {
    autoComplete: boolean;
    showHints: boolean;
  };
}

/**
 * Default user preferences
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  audio: {
    enabled: true,
    volume: 0.7
  },
  ui: {
    theme: 'auto',
    animations: true
  },
  game: {
    autoComplete: true,
    showHints: false
  }
};

/**
 * Manager for user preferences and settings persistence
 */
export class UserPreferencesManager {
  private static readonly STORAGE_KEY = 'solitaire_user_preferences';
  private static instance: UserPreferencesManager | null = null;
  private preferences: UserPreferences;
  private logger = RendererLogger.getInstance();

  private constructor() {
    this.preferences = this.loadPreferences();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): UserPreferencesManager {
    if (!UserPreferencesManager.instance) {
      UserPreferencesManager.instance = new UserPreferencesManager();
    }
    return UserPreferencesManager.instance;
  }

  /**
   * Load preferences from local storage
   */
  private loadPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(UserPreferencesManager.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new preference fields
        const preferences = this.mergeWithDefaults(parsed);
        this.logger.debug('PREFERENCES', 'User preferences loaded', preferences);
        return preferences;
      }
    } catch (error) {
      this.logger.error('PREFERENCES', 'Failed to load user preferences', { error });
    }

    this.logger.info('PREFERENCES', 'Using default preferences');
    return {
      audio: { ...DEFAULT_PREFERENCES.audio },
      ui: { ...DEFAULT_PREFERENCES.ui },
      game: { ...DEFAULT_PREFERENCES.game }
    };
  }

  /**
   * Merge stored preferences with defaults to handle missing fields
   */
  private mergeWithDefaults(stored: any): UserPreferences {
    return {
      audio: {
        enabled: stored.audio?.enabled ?? DEFAULT_PREFERENCES.audio.enabled,
        volume: stored.audio?.volume ?? DEFAULT_PREFERENCES.audio.volume
      },
      ui: {
        theme: stored.ui?.theme ?? DEFAULT_PREFERENCES.ui.theme,
        animations: stored.ui?.animations ?? DEFAULT_PREFERENCES.ui.animations
      },
      game: {
        autoComplete: stored.game?.autoComplete ?? DEFAULT_PREFERENCES.game.autoComplete,
        showHints: stored.game?.showHints ?? DEFAULT_PREFERENCES.game.showHints
      }
    };
  }

  /**
   * Save preferences to local storage
   */
  private savePreferences(): void {
    try {
      const serialized = JSON.stringify(this.preferences);
      localStorage.setItem(UserPreferencesManager.STORAGE_KEY, serialized);
      this.logger.debug('PREFERENCES', 'User preferences saved');
    } catch (error) {
      this.logger.error('PREFERENCES', 'Failed to save user preferences', { error });
    }
  }

  /**
   * Get all preferences
   */
  public getPreferences(): UserPreferences {
    return {
      audio: { ...this.preferences.audio },
      ui: { ...this.preferences.ui },
      game: { ...this.preferences.game }
    };
  }

  /**
   * Get audio preferences
   */
  public getAudioPreferences(): UserPreferences['audio'] {
    return { ...this.preferences.audio };
  }

  /**
   * Set audio enabled state
   */
  public setAudioEnabled(enabled: boolean): void {
    this.preferences.audio.enabled = enabled;
    this.savePreferences();
    this.logger.info('PREFERENCES', `Audio ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set audio volume (0.0 to 1.0)
   */
  public setAudioVolume(volume: number): void {
    this.preferences.audio.volume = Math.max(0, Math.min(1, volume));
    this.savePreferences();
    this.logger.debug('PREFERENCES', `Audio volume set to ${this.preferences.audio.volume}`);
  }

  /**
   * Toggle audio on/off
   */
  public toggleAudio(): boolean {
    this.setAudioEnabled(!this.preferences.audio.enabled);
    return this.preferences.audio.enabled;
  }

  /**
   * Get UI preferences
   */
  public getUIPreferences(): UserPreferences['ui'] {
    return { ...this.preferences.ui };
  }

  /**
   * Set UI theme
   */
  public setTheme(theme: UserPreferences['ui']['theme']): void {
    this.preferences.ui.theme = theme;
    this.savePreferences();
    this.logger.info('PREFERENCES', `Theme set to ${theme}`);
  }

  /**
   * Set animations enabled state
   */
  public setAnimationsEnabled(enabled: boolean): void {
    this.preferences.ui.animations = enabled;
    this.savePreferences();
    this.logger.info('PREFERENCES', `Animations ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get game preferences
   */
  public getGamePreferences(): UserPreferences['game'] {
    return { ...this.preferences.game };
  }

  /**
   * Set auto-complete enabled state
   */
  public setAutoCompleteEnabled(enabled: boolean): void {
    this.preferences.game.autoComplete = enabled;
    this.savePreferences();
    this.logger.info('PREFERENCES', `Auto-complete ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set hints enabled state
   */
  public setHintsEnabled(enabled: boolean): void {
    this.preferences.game.showHints = enabled;
    this.savePreferences();
    this.logger.info('PREFERENCES', `Hints ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Reset all preferences to defaults
   */
  public resetToDefaults(): void {
    this.preferences = {
      audio: { ...DEFAULT_PREFERENCES.audio },
      ui: { ...DEFAULT_PREFERENCES.ui },
      game: { ...DEFAULT_PREFERENCES.game }
    };
    this.savePreferences();
    this.logger.info('PREFERENCES', 'Preferences reset to defaults');
  }

  /**
   * Export preferences as JSON string
   */
  public exportPreferences(): string {
    return JSON.stringify(this.preferences, null, 2);
  }

  /**
   * Import preferences from JSON string
   */
  public importPreferences(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString);
      this.preferences = this.mergeWithDefaults(imported);
      this.savePreferences();
      this.logger.info('PREFERENCES', 'Preferences imported successfully');
      return true;
    } catch (error) {
      this.logger.error('PREFERENCES', 'Failed to import preferences', { error });
      return false;
    }
  }
}