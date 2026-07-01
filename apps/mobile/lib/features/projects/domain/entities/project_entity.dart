class ProjectEntity {
  const ProjectEntity({
    required this.id,
    required this.name,
    required this.color,
    required this.status,
    required this.taskCount,
    required this.doneCount,
    this.description,
    this.client,
    this.dueDate,
    this.tasks = const [],
  });

  final String id;
  final String name;
  final String? description;
  final String? client;
  final String color; // hex string e.g. "#6366F1"
  final String status; // ACTIVE | ON_HOLD | COMPLETED | CANCELLED
  final DateTime? dueDate;
  final int taskCount;
  final int doneCount;
  final List<ProjectTaskEntity> tasks;

  bool get isActive => status == 'ACTIVE';
  double get progress => taskCount == 0 ? 0 : doneCount / taskCount;

  /// List payload - task counts come from the API summary; [tasks] stays empty.
  factory ProjectEntity.fromSummaryJson(Map<String, dynamic> m) => ProjectEntity(
        id: m['id'] as String,
        name: m['name'] as String,
        description: m['description'] as String?,
        client: m['client'] as String?,
        color: m['color'] as String? ?? '#6366F1',
        status: m['status'] as String,
        dueDate: m['dueDate'] != null ? DateTime.parse(m['dueDate'] as String) : null,
        taskCount: m['taskCount'] as int? ?? 0,
        doneCount: m['doneCount'] as int? ?? 0,
      );

  /// Detail payload - includes the full task list.
  factory ProjectEntity.fromDetailJson(Map<String, dynamic> m) {
    final tasks = (m['tasks'] as List<dynamic>? ?? [])
        .map((t) => ProjectTaskEntity.fromJson(t as Map<String, dynamic>))
        .toList();
    return ProjectEntity(
      id: m['id'] as String,
      name: m['name'] as String,
      description: m['description'] as String?,
      client: m['client'] as String?,
      color: m['color'] as String? ?? '#6366F1',
      status: m['status'] as String,
      dueDate: m['dueDate'] != null ? DateTime.parse(m['dueDate'] as String) : null,
      taskCount: tasks.length,
      doneCount: tasks.where((t) => t.isDone).length,
      tasks: tasks,
    );
  }
}

class ProjectTaskEntity {
  const ProjectTaskEntity({
    required this.id,
    required this.title,
    required this.status,
    required this.priority,
    required this.order,
    this.description,
    this.dueDate,
  });

  final String id;
  final String title;
  final String? description;
  final String status; // TODO | IN_PROGRESS | REVIEW | DONE
  final String priority; // LOW | MEDIUM | HIGH | URGENT
  final DateTime? dueDate;
  final int order;

  bool get isDone => status == 'DONE';

  factory ProjectTaskEntity.fromJson(Map<String, dynamic> m) => ProjectTaskEntity(
        id: m['id'] as String,
        title: m['title'] as String,
        description: m['description'] as String?,
        status: m['status'] as String,
        priority: m['priority'] as String,
        dueDate: m['dueDate'] != null ? DateTime.parse(m['dueDate'] as String) : null,
        order: m['order'] as int? ?? 0,
      );
}
