import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_card.dart';
import '../../domain/entities/project_entity.dart';
import 'project_card.dart';

Color kanbanPriorityColor(String p) => switch (p) {
      'URGENT' => AppColors.destructive,
      'HIGH' => AppColors.warning,
      'MEDIUM' => AppColors.primary,
      _ => AppColors.mutedForeground,
    };

class KanbanCard extends StatelessWidget {
  const KanbanCard({
    super.key,
    required this.task,
    this.onCycle,
    this.onDelete,
    this.dragging = false,
  });

  final ProjectTaskEntity task;
  final VoidCallback? onCycle;
  final VoidCallback? onDelete;
  final bool dragging;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(10),
      child: Opacity(
        opacity: dragging ? 0.85 : 1,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GestureDetector(
              onTap: onCycle,
              child: Icon(
                projectTaskStatusIcon(task.status),
                size: 18,
                color: projectTaskStatusColor(task.status),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.title,
                    style: AppTextStyles.bodySmall.copyWith(
                      decoration: task.isDone ? TextDecoration.lineThrough : null,
                      color: task.isDone ? AppColors.mutedForeground : AppColors.foreground,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: kanbanPriorityColor(task.priority),
                          shape: BoxShape.circle,
                        ),
                      ),
                      if (task.dueDate != null) ...[
                        const SizedBox(width: 6),
                        Text(
                          DateFormat('d MMM').format(task.dueDate!),
                          style: AppTextStyles.labelSmall.copyWith(color: AppColors.mutedForeground),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            if (!dragging && onDelete != null)
              GestureDetector(
                onTap: onDelete,
                child: const Padding(
                  padding: EdgeInsets.all(2),
                  child: Icon(Icons.close, size: 15, color: AppColors.mutedForeground),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
