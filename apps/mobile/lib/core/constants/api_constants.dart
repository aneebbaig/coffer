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
  static const String expenseFundingContext = '/expenses/funding-context';
  static const String income = '/income';
  static const String budget = '/budget';
  static const String savings = '/savings';
  static const String loans = '/loans';
  static const String dashboard = '/dashboard';

  static const String tasks = '/tasks';
  static const String projects = '/projects';
  static const String tags = '/tags';
  static const String recurringIncome = '/recurring-income';
  static const String plannedExpenses = '/planned-expenses';
  static const String cashflow = '/cashflow';
  static const String investments = '/investments';
  static const String investmentPlan = '/investment-plan';

  static String investmentById(String id) => '/investments/$id';
  static String investmentContributions(String id) => '/investments/$id/contributions';
  static String investmentContributionById(String id, String cid) =>
      '/investments/$id/contributions/$cid';

  static String loanPayments(String loanId) => '/loans/$loanId/payments';
  static String loanPaymentById(String loanId, String paymentId) =>
      '/loans/$loanId/payments/$paymentId';
  static String loanSchedules(String loanId) => '/loans/$loanId/schedules';
  static String loanScheduleById(String loanId, String scheduleId) =>
      '/loans/$loanId/schedules/$scheduleId';
  static String expenseById(String id) => '/expenses/$id';
  static String incomeById(String id) => '/income/$id';
  static String taskById(String id) => '/tasks/$id';
  static String projectById(String id) => '/projects/$id';
  static String projectTasks(String projectId) => '/projects/$projectId/tasks';
  static String projectTaskById(String projectId, String taskId) =>
      '/projects/$projectId/tasks/$taskId';
  static String tagById(String id) => '/tags/$id';
  static String recurringIncomeById(String id) => '/recurring-income/$id';
  static String plannedExpenseById(String id) => '/planned-expenses/$id';
  static String plannedExpenseRecord(String id) => '/planned-expenses/$id/record';
  static String recurringIncomeRecord(String id) => '/recurring-income/$id/record';
}
