class RecurringIncomeEntity {
  const RecurringIncomeEntity({
    required this.id,
    required this.label,
    required this.kind,
    required this.amountPaisas,
    required this.variable,
    required this.countsTowardFloor,
    required this.startDate,
    required this.active,
    this.dayOfMonth,
    this.endDate,
  });

  final String id;
  final String label;
  final String kind; // SALARY | FREELANCE | OTHER
  final int amountPaisas;
  final bool variable;
  final bool countsTowardFloor;
  final int? dayOfMonth;
  final DateTime startDate;
  final DateTime? endDate;
  final bool active;
}
