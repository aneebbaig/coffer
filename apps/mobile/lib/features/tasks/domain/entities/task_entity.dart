class TaskEntity {
  const TaskEntity({
    required this.id,
    required this.title,
    required this.type,
    required this.priority,
    required this.status,
    required this.order,
    required this.items,
    this.description,
    this.dueDate,
    this.dueTime,
    this.category,
  });

  final String id;
  final String title;
  final String? description;
  final String type; // DAILY | ONE_TIME | MILESTONE
  final String priority; // LOW | MEDIUM | HIGH | URGENT
  final String status; // PENDING | IN_PROGRESS | DONE | SKIPPED
  final DateTime? dueDate;
  final String? dueTime;
  final String? category;
  final int order;
  final List<TaskMilestoneItem> items;

  bool get isDone => status == 'DONE';
  bool get isDaily => type == 'DAILY';
  bool get isMilestone => type == 'MILESTONE';
  bool get isOneTime => type == 'ONE_TIME';

  int get milestoneProgress => items.isEmpty ? 0 : items.where((i) => i.done).length;

  TaskEntity copyWith({
    String? status,
    List<TaskMilestoneItem>? items,
  }) => TaskEntity(
        id: id,
        title: title,
        description: description,
        type: type,
        priority: priority,
        status: status ?? this.status,
        dueDate: dueDate,
        dueTime: dueTime,
        category: category,
        order: order,
        items: items ?? this.items,
      );
}

class TaskMilestoneItem {
  const TaskMilestoneItem({required this.text, required this.done});
  final String text;
  final bool done;
}
