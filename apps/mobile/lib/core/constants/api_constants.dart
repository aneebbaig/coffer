class ApiConstants {
  ApiConstants._();

  /// Base for the app's REST data API (.../api/v1).
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );

  /// better-auth lives at {origin}/api/auth. Derive it from [baseUrl] by
  /// stripping a trailing /api/vN so one API_BASE_URL configures both.
  static String get authBaseUrl =>
      '${baseUrl.replaceFirst(RegExp(r'/api/v\d+/?$'), '')}/api/auth';

  // better-auth endpoints (used with authBaseUrl)
  static const String signIn = '/sign-in/email';
  static const String signOut = '/sign-out';
  static const String getSession = '/get-session';
  static const String verifyTotp = '/two-factor/verify-totp';

  // REST data endpoints (used with baseUrl)
  static const String categories = '/categories';
  static const String expenses = '/expenses';
  static const String income = '/income';
  static const String budget = '/budget';
  static const String savings = '/savings';
  static const String loans = '/loans';
  static const String dashboard = '/dashboard';

  static const String tasks = '/tasks';
  static const String projects = '/projects';
  static const String tags = '/tags';

  static String loanPayments(String loanId) => '/loans/$loanId/payments';
  static String expenseById(String id) => '/expenses/$id';
  static String incomeById(String id) => '/income/$id';
  static String taskById(String id) => '/tasks/$id';
  static String projectById(String id) => '/projects/$id';
  static String projectTasks(String projectId) => '/projects/$projectId/tasks';
  static String projectTaskById(String projectId, String taskId) =>
      '/projects/$projectId/tasks/$taskId';
  static String tagById(String id) => '/tags/$id';
}
