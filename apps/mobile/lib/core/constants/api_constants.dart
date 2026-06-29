class ApiConstants {
  ApiConstants._();

  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );

  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String me = '/auth/me';
  static const String categories = '/categories';
  static const String expenses = '/expenses';
  static const String income = '/income';
  static const String budget = '/budget';
  static const String savings = '/savings';
  static const String loans = '/loans';
  static const String dashboard = '/dashboard';

  static const String tasks = '/tasks';
  static const String projects = '/projects';

  static String loanPayments(String loanId) => '/loans/$loanId/payments';
  static String expenseById(String id) => '/expenses/$id';
  static String incomeById(String id) => '/income/$id';
  static String taskById(String id) => '/tasks/$id';
  static String projectById(String id) => '/projects/$id';
  static String projectTasks(String projectId) => '/projects/$projectId/tasks';
  static String projectTaskById(String projectId, String taskId) =>
      '/projects/$projectId/tasks/$taskId';
}
