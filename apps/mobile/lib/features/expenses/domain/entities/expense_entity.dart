import 'category_entity.dart';

class ExpenseEntity {
  const ExpenseEntity({
    required this.id,
    required this.amountPaisas,
    required this.description,
    required this.date,
    required this.category,
    this.notes,
  });

  final String id;
  final int amountPaisas;
  final String description;
  final String? notes;
  final DateTime date;
  final CategoryEntity category;
}

class ExpenseListPage {
  const ExpenseListPage({
    required this.items,
    required this.total,
    required this.page,
    required this.hasMore,
  });

  final List<ExpenseEntity> items;
  final int total;
  final int page;
  final bool hasMore;
}
