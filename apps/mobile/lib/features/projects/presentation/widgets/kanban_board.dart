import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/entities/project_entity.dart';
import 'kanban_card.dart';

class KanbanBoard extends StatelessWidget {
  const KanbanBoard({
    super.key,
    required this.columns,
    required this.statusOrder,
    required this.statusLabels,
    required this.onCycle,
    required this.onDelete,
    required this.onReorderWithinColumn,
    required this.onMoveAcrossColumn,
    this.firstColumnHeader,
  });

  final Map<String, List<ProjectTaskEntity>> columns;
  final List<String> statusOrder;
  final Map<String, String> statusLabels;
  final void Function(ProjectTaskEntity task) onCycle;
  final void Function(ProjectTaskEntity task) onDelete;
  final void Function(ProjectTaskEntity dragged, int newIndex) onReorderWithinColumn;
  final void Function(ProjectTaskEntity dragged, String destStatus, int destIndex) onMoveAcrossColumn;
  final Widget? firstColumnHeader;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final status in statusOrder)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: SizedBox(
                width: 260,
                child: _KanbanColumn(
                  status: status,
                  label: statusLabels[status] ?? status,
                  tasks: columns[status] ?? const [],
                  header: status == statusOrder.first ? firstColumnHeader : null,
                  onCycle: onCycle,
                  onDelete: onDelete,
                  onReorderWithinColumn: onReorderWithinColumn,
                  onMoveAcrossColumn: onMoveAcrossColumn,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _KanbanColumn extends StatelessWidget {
  const _KanbanColumn({
    required this.status,
    required this.label,
    required this.tasks,
    required this.onCycle,
    required this.onDelete,
    required this.onReorderWithinColumn,
    required this.onMoveAcrossColumn,
    this.header,
  });

  final String status;
  final String label;
  final List<ProjectTaskEntity> tasks;
  final Widget? header;
  final void Function(ProjectTaskEntity task) onCycle;
  final void Function(ProjectTaskEntity task) onDelete;
  final void Function(ProjectTaskEntity dragged, int newIndex) onReorderWithinColumn;
  final void Function(ProjectTaskEntity dragged, String destStatus, int destIndex) onMoveAcrossColumn;

  void _handleDrop(ProjectTaskEntity dragged, int destIndex) {
    if (dragged.status == status) {
      onReorderWithinColumn(dragged, destIndex);
    } else {
      onMoveAcrossColumn(dragged, status, destIndex);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DragTarget<ProjectTaskEntity>(
      onAcceptWithDetails: (details) => _handleDrop(details.data, tasks.length),
      builder: (context, candidateData, rejectedData) => Container(
        constraints: const BoxConstraints(minHeight: 140),
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: candidateData.isNotEmpty
              ? AppColors.primary.withValues(alpha: 0.06)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              child: Row(
                children: [
                  Text(
                    label.toUpperCase(),
                    style: AppTextStyles.labelSmall
                        .copyWith(color: AppColors.mutedForeground, letterSpacing: 0.8),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${tasks.length}',
                    style: AppTextStyles.labelSmall
                        .copyWith(color: AppColors.mutedForeground.withValues(alpha: 0.6)),
                  ),
                ],
              ),
            ),
            if (header != null) ...[header!, const SizedBox(height: 8)],
            for (var i = 0; i < tasks.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _DraggableCardSlot(
                  task: tasks[i],
                  index: i,
                  columnStatus: status,
                  onCycle: () => onCycle(tasks[i]),
                  onDelete: () => onDelete(tasks[i]),
                  onDrop: _handleDrop,
                ),
              ),
            if (tasks.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                child: Text(
                  'Nothing here.',
                  style: AppTextStyles.labelSmall
                      .copyWith(color: AppColors.mutedForeground.withValues(alpha: 0.6)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DraggableCardSlot extends StatelessWidget {
  const _DraggableCardSlot({
    required this.task,
    required this.index,
    required this.columnStatus,
    required this.onCycle,
    required this.onDelete,
    required this.onDrop,
  });

  final ProjectTaskEntity task;
  final int index;
  final String columnStatus;
  final VoidCallback onCycle;
  final VoidCallback onDelete;
  final void Function(ProjectTaskEntity dragged, int destIndex) onDrop;

  @override
  Widget build(BuildContext context) {
    return DragTarget<ProjectTaskEntity>(
      onWillAcceptWithDetails: (details) => details.data.id != task.id,
      onAcceptWithDetails: (details) => onDrop(details.data, index),
      builder: (context, candidateData, rejectedData) => Column(
        children: [
          if (candidateData.isNotEmpty)
            Container(
              height: 3,
              margin: const EdgeInsets.only(bottom: 4),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          LongPressDraggable<ProjectTaskEntity>(
            data: task,
            delay: const Duration(milliseconds: 250),
            feedback: Material(
              color: Colors.transparent,
              child: SizedBox(width: 236, child: KanbanCard(task: task, dragging: true)),
            ),
            childWhenDragging: Opacity(opacity: 0.3, child: KanbanCard(task: task)),
            onDragStarted: () => HapticFeedback.mediumImpact(),
            child: KanbanCard(task: task, onCycle: onCycle, onDelete: onDelete),
          ),
        ],
      ),
    );
  }
}
