import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/services/toast_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_divider.dart';
import '../../data/datasources/projects_datasource.dart';
import '../../domain/entities/project_entity.dart';
import '../providers/projects_provider.dart';
import '../widgets/project_card.dart';

const _statusOrder = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
const _statusLabels = {
  'TODO': 'To Do',
  'IN_PROGRESS': 'In Progress',
  'REVIEW': 'Review',
  'DONE': 'Done',
};

String _nextStatus(String s) {
  final i = _statusOrder.indexOf(s);
  return _statusOrder[(i + 1) % _statusOrder.length];
}

Color _priorityColor(String p) => switch (p) {
      'URGENT' => AppColors.destructive,
      'HIGH' => AppColors.warning,
      'MEDIUM' => AppColors.primary,
      _ => AppColors.mutedForeground,
    };

class ProjectDetailPage extends ConsumerStatefulWidget {
  const ProjectDetailPage({super.key, required this.projectId});
  final String projectId;

  @override
  ConsumerState<ProjectDetailPage> createState() => _ProjectDetailPageState();
}

class _ProjectDetailPageState extends ConsumerState<ProjectDetailPage> {
  final _addCtrl = TextEditingController();
  bool _adding = false;

  @override
  void dispose() {
    _addCtrl.dispose();
    super.dispose();
  }

  void _refresh() {
    ref.invalidate(projectProvider(widget.projectId));
    ref.invalidate(projectsProvider);
  }

  Future<void> _cycleStatus(ProjectTaskEntity task) async {
    HapticFeedback.lightImpact();
    try {
      await ref.read(projectsDatasourceProvider).updateTask(
        widget.projectId,
        task.id,
        {'status': _nextStatus(task.status)},
      );
      if (!mounted) return;
      _refresh();
    } catch (e) {
      if (!mounted) return;
      ref.read(toastServiceProvider).error(
          context, e is AppException ? e.message : 'Failed to update task');
    }
  }

  Future<void> _deleteTask(ProjectTaskEntity task) async {
    HapticFeedback.mediumImpact();
    try {
      await ref.read(projectsDatasourceProvider).deleteTask(widget.projectId, task.id);
      if (!mounted) return;
      _refresh();
      ref.read(toastServiceProvider).success(context, 'Task deleted');
    } catch (e) {
      if (!mounted) return;
      ref.read(toastServiceProvider).error(
          context, e is AppException ? e.message : 'Failed to delete task');
    }
  }

  Future<void> _addTask() async {
    final title = _addCtrl.text.trim();
    if (title.isEmpty) return;
    setState(() => _adding = true);
    try {
      await ref.read(projectsDatasourceProvider).createTask(widget.projectId, title: title);
      if (!mounted) return;
      _addCtrl.clear();
      _refresh();
    } catch (e) {
      if (!mounted) return;
      ref.read(toastServiceProvider).error(
          context, e is AppException ? e.message : 'Failed to add task');
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  Future<void> _changeStatus(ProjectEntity project) async {
    final next = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final s in ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
              ListTile(
                title: Text(projectStatusMeta(s).$1, style: AppTextStyles.bodyMedium),
                trailing: project.status == s
                    ? const Icon(Icons.check, color: AppColors.primary, size: 18)
                    : null,
                onTap: () => Navigator.pop(ctx, s),
              ),
          ],
        ),
      ),
    );
    if (next == null || next == project.status) return;
    try {
      await ref.read(projectsDatasourceProvider).updateProject(widget.projectId, {'status': next});
      if (!mounted) return;
      _refresh();
    } catch (e) {
      if (!mounted) return;
      ref.read(toastServiceProvider).error(
          context, e is AppException ? e.message : 'Failed to update status');
    }
  }

  Future<void> _deleteProject() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text('Delete project?',
            style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
        content: Text('This deletes the project and all its tasks. This cannot be undone.',
            style: AppTextStyles.bodySmall.copyWith(color: AppColors.mutedForeground)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel',
                style: AppTextStyles.bodySmall.copyWith(color: AppColors.mutedForeground)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Delete',
                style: AppTextStyles.bodySmall
                    .copyWith(color: AppColors.destructive, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ref.read(projectsDatasourceProvider).deleteProject(widget.projectId);
      if (!mounted) return;
      ref.invalidate(projectsProvider);
      ref.read(toastServiceProvider).success(context, 'Project deleted');
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ref.read(toastServiceProvider).error(
          context, e is AppException ? e.message : 'Failed to delete project');
    }
  }

  @override
  Widget build(BuildContext context) {
    final projectAsync = ref.watch(projectProvider(widget.projectId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text('Project', style: AppTextStyles.headlineSmall),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline, color: AppColors.mutedForeground),
            onPressed: projectAsync.hasValue ? _deleteProject : null,
          ),
        ],
      ),
      body: projectAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2),
        ),
        error: (e, _) => Center(
          child: Text(
            e is AppException ? e.message : 'Failed to load project',
            style: AppTextStyles.bodyMedium.copyWith(color: AppColors.mutedForeground),
          ),
        ),
        data: (project) {
          final accent = projectColor(project.color);
          final (statusLabel, statusColor) = projectStatusMeta(project.status);

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            children: [
              // Header card
              AppCard(
                padding: EdgeInsets.zero,
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(width: 4, color: accent),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(project.name,
                                  style: AppTextStyles.headlineSmall.copyWith(fontWeight: FontWeight.w700)),
                              if (project.client != null) ...[
                                const SizedBox(height: 3),
                                Text(project.client!,
                                    style: AppTextStyles.bodySmall
                                        .copyWith(color: AppColors.mutedForeground)),
                              ],
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  GestureDetector(
                                    onTap: () => _changeStatus(project),
                                    child: Container(
                                      padding:
                                          const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                      decoration: BoxDecoration(
                                        color: statusColor.withValues(alpha: 0.14),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(statusLabel,
                                              style: AppTextStyles.labelSmall.copyWith(
                                                  color: statusColor, fontWeight: FontWeight.w600)),
                                          const SizedBox(width: 4),
                                          Icon(Icons.expand_more, size: 14, color: statusColor),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const Spacer(),
                                  if (project.dueDate != null)
                                    Text(
                                      'Due ${DateFormat('d MMM y').format(project.dueDate!)}',
                                      style: AppTextStyles.labelSmall
                                          .copyWith(color: AppColors.mutedForeground),
                                    ),
                                ],
                              ),
                              if (project.description != null) ...[
                                const SizedBox(height: 12),
                                Text(project.description!,
                                    style: AppTextStyles.bodySmall
                                        .copyWith(color: AppColors.mutedForeground, height: 1.4)),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Task groups
              for (final groupStatus in _statusOrder) ...[
                _TaskGroup(
                  label: _statusLabels[groupStatus]!,
                  tasks: project.tasks.where((t) => t.status == groupStatus).toList(),
                  onCycle: _cycleStatus,
                  onDelete: _deleteTask,
                ),
                if (groupStatus == 'TODO')
                  Padding(
                    padding: const EdgeInsets.only(top: 4, bottom: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _addCtrl,
                            style: AppTextStyles.bodyMedium,
                            textCapitalization: TextCapitalization.sentences,
                            onSubmitted: (_) => _addTask(),
                            decoration: InputDecoration(
                              hintText: 'Add a task...',
                              hintStyle: AppTextStyles.bodyMedium
                                  .copyWith(color: AppColors.mutedForeground),
                              isDense: true,
                              filled: true,
                              fillColor: AppColors.card,
                              contentPadding:
                                  const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide:
                                    BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide:
                                    BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: AppColors.primary),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: _adding ? null : _addTask,
                          icon: _adding
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: AppColors.primary))
                              : const Icon(Icons.add, color: AppColors.primary),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 16),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _TaskGroup extends StatelessWidget {
  const _TaskGroup({
    required this.label,
    required this.tasks,
    required this.onCycle,
    required this.onDelete,
  });

  final String label;
  final List<ProjectTaskEntity> tasks;
  final Future<void> Function(ProjectTaskEntity) onCycle;
  final Future<void> Function(ProjectTaskEntity) onDelete;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 2, bottom: 6),
          child: Row(
            children: [
              Text(label.toUpperCase(),
                  style: AppTextStyles.labelSmall
                      .copyWith(color: AppColors.mutedForeground, letterSpacing: 0.8)),
              const SizedBox(width: 6),
              Text('${tasks.length}',
                  style: AppTextStyles.labelSmall
                      .copyWith(color: AppColors.mutedForeground.withValues(alpha: 0.6))),
            ],
          ),
        ),
        if (tasks.isNotEmpty)
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Column(
              children: [
                for (var i = 0; i < tasks.length; i++) ...[
                  _TaskRow(task: tasks[i], onCycle: onCycle, onDelete: onDelete),
                  if (i < tasks.length - 1) const AppDivider(),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _TaskRow extends StatelessWidget {
  const _TaskRow({required this.task, required this.onCycle, required this.onDelete});

  final ProjectTaskEntity task;
  final Future<void> Function(ProjectTaskEntity) onCycle;
  final Future<void> Function(ProjectTaskEntity) onDelete;

  IconData get _statusIcon => switch (task.status) {
        'IN_PROGRESS' => Icons.timelapse,
        'REVIEW' => Icons.visibility_outlined,
        'DONE' => Icons.check_circle,
        _ => Icons.circle_outlined,
      };

  Color get _statusColor => switch (task.status) {
        'IN_PROGRESS' => AppColors.info,
        'REVIEW' => AppColors.warning,
        'DONE' => AppColors.success,
        _ => AppColors.mutedForeground,
      };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => onCycle(task),
            child: Icon(_statusIcon, size: 20, color: _statusColor),
          ),
          const SizedBox(width: 10),
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: _priorityColor(task.priority), shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.title,
                  style: AppTextStyles.bodyMedium.copyWith(
                    decoration: task.isDone ? TextDecoration.lineThrough : null,
                    color: task.isDone ? AppColors.mutedForeground : AppColors.foreground,
                  ),
                ),
                if (task.dueDate != null)
                  Text(
                    DateFormat('d MMM').format(task.dueDate!),
                    style: AppTextStyles.labelSmall.copyWith(color: AppColors.mutedForeground),
                  ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => onDelete(task),
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.delete_outline, size: 17, color: AppColors.mutedForeground),
            ),
          ),
        ],
      ),
    );
  }
}
