import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_text_styles.dart';
import '../../../../../core/widgets/app_card.dart';
import '../../domain/entities/task_entity.dart';

class TaskListItem extends StatefulWidget {
  const TaskListItem({
    required this.task,
    required this.onToggle,
    required this.onDelete,
    this.onToggleItem,
    this.onAddItem,
    super.key,
  });

  final TaskEntity task;
  final VoidCallback onToggle;
  final VoidCallback onDelete;
  final void Function(int index)? onToggleItem;
  final VoidCallback? onAddItem;

  @override
  State<TaskListItem> createState() => _TaskListItemState();
}

class _TaskListItemState extends State<TaskListItem>
    with SingleTickerProviderStateMixin {
  late final AnimationController _checkCtrl;
  late final Animation<double> _checkScale;
  bool _wasDone = false;

  @override
  void initState() {
    super.initState();
    _wasDone = widget.task.isDone;
    _checkCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
    _checkScale = TweenSequence([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.35), weight: 40),
      TweenSequenceItem(tween: Tween(begin: 1.35, end: 1.0), weight: 60),
    ]).animate(CurvedAnimation(parent: _checkCtrl, curve: Curves.easeOut));
  }

  @override
  void didUpdateWidget(TaskListItem old) {
    super.didUpdateWidget(old);
    if (widget.task.isDone != _wasDone) {
      _wasDone = widget.task.isDone;
      if (widget.task.isDone) {
        _checkCtrl.forward(from: 0);
      }
    }
  }

  @override
  void dispose() {
    _checkCtrl.dispose();
    super.dispose();
  }

  TaskEntity get task => widget.task;

  Color get _priorityColor => switch (task.priority) {
        'URGENT' => const Color(0xFFEF4444),
        'HIGH' => const Color(0xFFF97316),
        'MEDIUM' => AppColors.primary,
        _ => AppColors.mutedForeground,
      };

  @override
  Widget build(BuildContext context) => AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GestureDetector(
              onTap: widget.onToggle,
              child: ScaleTransition(
                scale: _checkScale,
                child: Container(
                  width: 22,
                  height: 22,
                  margin: const EdgeInsets.only(top: 1),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: task.isDone ? AppColors.primary : AppColors.border,
                      width: 1.5,
                    ),
                    color: task.isDone
                        ? AppColors.primary.withValues(alpha: 0.15)
                        : Colors.transparent,
                  ),
                  child: task.isDone
                      ? const Icon(Icons.check, size: 13, color: AppColors.primary)
                      : null,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          task.title,
                          style: AppTextStyles.bodyMedium.copyWith(
                            decoration: task.isDone ? TextDecoration.lineThrough : null,
                            color: task.isDone ? AppColors.mutedForeground : AppColors.foreground,
                          ),
                        ),
                      ),
                      Container(
                        width: 6,
                        height: 6,
                        margin: const EdgeInsets.only(left: 8, top: 6),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _priorityColor,
                        ),
                      ),
                    ],
                  ),
                  if (task.description != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      task.description!,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppColors.mutedForeground,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (task.dueDate != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          Icons.schedule,
                          size: 11,
                          color: _dueDateColor(task.dueDate!),
                        ),
                        const SizedBox(width: 3),
                        Text(
                          _formatDue(task.dueDate!, task.dueTime),
                          style: AppTextStyles.labelSmall.copyWith(
                            color: _dueDateColor(task.dueDate!),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (task.isMilestone) ...[
                    const SizedBox(height: 8),
                    if (task.items.isNotEmpty) ...[
                      Row(
                        children: [
                          Text(
                            '${task.milestoneProgress}/${task.items.length}',
                            style: AppTextStyles.labelSmall.copyWith(
                              color: AppColors.mutedForeground,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(2),
                              child: LinearProgressIndicator(
                                value: task.milestoneProgress / task.items.length,
                                backgroundColor: AppColors.border,
                                valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                                minHeight: 3,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ...task.items.asMap().entries.map(
                        (e) => GestureDetector(
                          onTap: widget.onToggleItem != null ? () => widget.onToggleItem!(e.key) : null,
                          behavior: HitTestBehavior.opaque,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Row(
                              children: [
                                Container(
                                  width: 16,
                                  height: 16,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: e.value.done ? AppColors.primary : AppColors.border,
                                      width: 1.5,
                                    ),
                                    color: e.value.done
                                        ? AppColors.primary.withValues(alpha: 0.15)
                                        : Colors.transparent,
                                  ),
                                  child: e.value.done
                                      ? const Icon(Icons.check, size: 9, color: AppColors.primary)
                                      : null,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    e.value.text,
                                    style: AppTextStyles.bodySmall.copyWith(
                                      color: e.value.done
                                          ? AppColors.mutedForeground
                                          : AppColors.foreground,
                                      decoration: e.value.done ? TextDecoration.lineThrough : null,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                    if (widget.onAddItem != null)
                      GestureDetector(
                        onTap: widget.onAddItem,
                        behavior: HitTestBehavior.opaque,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Row(
                            children: [
                              const Icon(Icons.add, size: 14, color: AppColors.primary),
                              const SizedBox(width: 6),
                              Text(
                                'Add step',
                                style: AppTextStyles.labelSmall.copyWith(
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                  if (task.category != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      task.category!,
                      style: AppTextStyles.labelSmall.copyWith(
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: widget.onDelete,
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Icon(
                  Icons.delete_outline,
                  size: 16,
                  color: AppColors.destructive.withValues(alpha: 0.7),
                ),
              ),
            ),
          ],
        ),
      );

  Color _dueDateColor(DateTime due) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dueDay = DateTime(due.year, due.month, due.day);
    if (dueDay.isBefore(today)) return AppColors.destructive;
    if (dueDay == today) return AppColors.primary;
    return AppColors.mutedForeground;
  }

  String _formatDue(DateTime due, String? time) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dueDay = DateTime(due.year, due.month, due.day);

    String label;
    if (dueDay == today) {
      label = 'Today';
    } else if (dueDay == today.add(const Duration(days: 1))) {
      label = 'Tomorrow';
    } else if (dueDay.isBefore(today)) {
      label = 'Overdue · ${DateFormat('d MMM').format(due)}';
    } else {
      label = DateFormat('d MMM').format(due);
    }

    if (time != null && time.isNotEmpty) label += ' · $time';
    return label;
  }
}
