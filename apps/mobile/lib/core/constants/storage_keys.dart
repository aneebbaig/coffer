class StorageKeys {
  StorageKeys._();

  // Secure storage (flutter_secure_storage)
  static const String accessToken = 'access_token';
  static const String refreshToken = 'refresh_token';

  // Shared preferences (non-sensitive)
  static const String recentCategories = 'recent_categories';
  static const String selectedTheme = 'selected_theme';
  static const String overlayEnabled = 'overlay_enabled';
  static const String overlayPromptShown = 'overlay_prompt_shown';
}
