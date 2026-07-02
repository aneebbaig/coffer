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
import '../../data/datasources/projects_datasource.dart';
import '../../domain/entities/project_entity.dart';
import '../providers/projects_provider.dart';
import '../widgets/kanban_board.dart';
import '../widgets/project_card.dart';

const _statusOrder = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
const _statusLabels = {
  'TODO': 'To Do',
  'IN_PROGRESS': 'In Progress',
  'REVIEW': 'Review',
  'DONE': 'Done',
};

Map<String, List<ProjectTaskEntity>> _bucket(List<ProjectTaskEntity> tasks) {
  final cols = {for (final s in _statusOrder) s: <ProjectTaskEntity>[]};
  for (final t in tasks) {
    (cols[t.status] ?? cols['TODO']!).add(t);
  }
  return cols;
}

class ProjectDetailPage extends ConsumerStatefulWidget {
  const ProjectDetailPage({super.key, required this.projectId});
  final String projectId;

  @override
  ConsumerState<ProjectDetailPage> createState() => _ProjectDetailPageState();
}

class _ProjectDetailPageState extends ConsumerState<ProjectDetailPage> {
  final _addCtrl = TextEditingController();
  bool _adding = false;
  Map<String, List<ProjectTaskEntity>> _columns = _bucket(const []);
  String? _syncedSignature;

  @override
  void dispose() {
    _addCtrl.dispose();
    super.dispose();
  }

  void _syncColumns(ProjectEntity project) {
    final signature =
        '${project.updatedAt.toIso8601String()}|${project.tasks.map((t) => '${t.id}:${t.status}:${t.order}').join(',')}';
    if (signature == _syncedSignature) return;
    _syncedSignature = signature;
    _columns = _bucket(project.tasks);
  }

  void _refresh() {
    ref.invalidate(projectProvider(widget.projectId));
    ref.invalidate(projectsProvider);
  }

  Future<void> _persistColumn(String status) async {
    final list = _columns[status] ?? const [];
    final updates = [
      for (var i = 0; i < list.length; i++) {'id': list[i].id, 'order': i + 1, 'status': status},
    ];
    if (updates.isEmpty) return;
    try {
      await ref.read(projectsDatasourceProvider).reorderTasks(widget.projectId, updates);
      if (!mounted) return;
      _refresh();
    } catch (e) {
      if (!mounted) return;
      ref.read(toastServiceProvider).error(
          context, e is AppException ? e.message : 'Failed to move task');
      _refresh();
    }
  }

  void _reorderWithinColumn(ProjectTaskEntity dragged, int newIndex) {
    HapticFeedback.lightImpact();
    final list = _columns[dragged.status];
    if (list == null) return;
    final oldIndex = list.indexWhere((t) => t.id == dragged.id);
    if (oldIndex == -1 || oldIndex == newIndex) return;
    setState(() {
      final item = list.removeAt(oldIndex);
      final insertAt = (newIndex > oldIndex ? newIndex - 1 : newIndex).clamp(0, list.length);
      list.insert(insertAt, item);
    });
    _persistColumn(dragged.status);
  }

  void _moveAcrossColumn(ProjectTaskEntity dragged, String destStatus, int destIndex) {
    HapticFeedback.mediumImpact();
    final source = _columns[dragged.status];
    final dest = _columns[destStatus];
    if (source == null || dest == null) return;
    setState(() {
      source.removeWhere((t) => t.id == dragged.id);
      final moved = dragged.copyWith(status: destStatus);
      dest.insert(destIndex.clamp(0, dest.length), moved);
    });
    _persistColumn(dragged.status);
    _persistColumn(destStatus);
  }

  Future<void> _cycleStatus(ProjectTaskEntity task) async {
    final currentIndex = _statusOrder.indexOf(task.status);
    final next = _statusOrder[(currentIndex + 1) % _statusOrder.length];
    _moveAcrossColumn(task, next, (_columns[next] ?? const []).length);
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
          _syncColumns(project);
          final accent = projectColor(project.color);
          final (statusLabel, statusColor) = projectStatusMeta(project.status);

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: AppCard(
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
              ),
              Expanded(
                child: KanbanBoard(
                  columns: _columns,
                  statusOrder: _statusOrder,
                  statusLabels: _statusLabels,
                  onCycle: _cycleStatus,
                  onDelete: _deleteTask,
                  onReorderWithinColumn: _reorderWithinColumn,
                  onMoveAcrossColumn: _moveAcrossColumn,
                  firstColumnHeader: Padding(
                    padding: const EdgeInsets.only(bottom: 4),
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
                                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
                        const SizedBox(width: 6),
                        IconButton(
                          onPressed: _adding ? null : _addTask,
                          icon: _adding
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: AppColors.primary))
                              : const Icon(Icons.add, color: AppColors.primary),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
          );
        },
      ),
    );
  }
}
