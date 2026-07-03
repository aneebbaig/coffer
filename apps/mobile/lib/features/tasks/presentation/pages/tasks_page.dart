import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/services/toast_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_empty_state.dart';
import '../../data/datasources/tasks_datasource.dart';
import '../../domain/entities/task_entity.dart';
import '../providers/tasks_provider.dart';
import '../widgets/edit_task_sheet.dart';
import '../widgets/task_list_item.dart';

class TasksPage extends ConsumerStatefulWidget {
  const TasksPage({super.key});

  @override
  ConsumerState<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends ConsumerState<TasksPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  final Map<String, TaskEntity> _optimistic = {};

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this, initialIndex: 1);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  TaskEntity _resolve(TaskEntity task) => _optimistic[task.id] ?? task;

  Future<void> _toggleDone(TaskEntity task) async {
    HapticFeedback.lightImpact();
    final resolved = _resolve(task);
    final newStatus = resolved.isDone ? 'PENDING' : 'DONE';
    final optimistic = resolved.copyWith(status: newStatus);
    setState(() => _optimistic[task.id] = optimistic);
    try {
      await ref.read(tasksDatasourceProvider).updateTaskStatus(task.id, newStatus);
      if (!mounted) return;
      ref.invalidate(tasksProvider);
      // optimistic entry cleaned up in data() when real status matches
    } catch (e) {
      if (!mounted) return;
      setState(() => _optimistic.remove(task.id));
      final msg = e is AppException ? e.message : 'Failed to update task';
      ref.read(toastServiceProvider).error(context, msg);
    }
  }

  Future<void> _delete(TaskEntity task) async {
    HapticFeedback.mediumImpact();
    try {
      await ref.read(tasksDatasourceProvider).deleteTask(task.id);
      if (!mounted) return;
      ref.invalidate(tasksProvider);
      ref.read(toastServiceProvider).success(context, 'Task deleted');
    } catch (e) {
      if (!mounted) return;
      final msg = e is AppException ? e.message : 'Failed to delete task';
      ref.read(toastServiceProvider).error(context, msg);
    }
  }

  Future<void> _edit(TaskEntity task) async {
    await showEditTaskSheet(
      context,
      task: task,
      onSave: (changes) async {
        try {
          await ref.read(tasksDatasourceProvider).updateTask(task.id, changes);
          if (!mounted) return;
          ref.invalidate(tasksProvider);
        } catch (e) {
          if (!mounted) return;
          final msg = e is AppException ? e.message : 'Failed to save task';
          ref.read(toastServiceProvider).error(context, msg);
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(tasksProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text('Tasks', style: AppTextStyles.headlineSmall),
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.mutedForeground,
          indicatorColor: AppColors.primary,
          indicatorSize: TabBarIndicatorSize.label,
          labelStyle: AppTextStyles.labelMedium.copyWith(fontWeight: FontWeight.w600),
          unselectedLabelStyle: AppTextStyles.labelMedium,
          tabs: const [
            Tab(text: 'Daily'),
            Tab(text: 'One-Time'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.black,
        onPressed: () => context.push('/quick-add-task'),
        child: const Icon(Icons.add),
      ),
      body: tasksAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2),
        ),
        error: (e, _) => Center(
          child: Text(
            e is AppException ? e.message : 'Failed to load tasks',
            style: AppTextStyles.bodyMedium.copyWith(color: AppColors.mutedForeground),
          ),
        ),
        data: (all) {
          // Clean up stale optimistic entries when real data matches
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            var dirty = false;
            for (final t in all) {
              final opt = _optimistic[t.id];
              if (opt != null && opt.status == t.status) {
                _optimistic.remove(t.id);
                dirty = true;
              }
            }
            if (dirty && mounted) setState(() {});
          });
          final resolved = all.map(_resolve).toList();
          final daily = resolved.where((t) => t.isDaily).toList();
          final oneTime = resolved.where((t) => t.isOneTime).toList();

          return TabBarView(
            controller: _tabs,
            children: [
              _TaskTab(
                tasks: daily,
                emptyTitle: 'No daily tasks',
                emptySubtitle: 'Daily tasks repeat every day - habits, reviews, routines.',
                onToggle: _toggleDone,
                onDelete: _delete,
                onEdit: _edit,
              ),
              _TaskTab(
                tasks: oneTime,
                emptyTitle: 'Nothing to do',
                emptySubtitle: 'Tap + to add a task.',
                onToggle: _toggleDone,
                onDelete: _delete,
                onEdit: _edit,
                groupDone: true,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _TaskTab extends StatelessWidget {
  const _TaskTab({
    required this.tasks,
    required this.emptyTitle,
    required this.emptySubtitle,
    required this.onToggle,
    required this.onDelete,
    required this.onEdit,
    this.groupDone = false,
  });

  final List<TaskEntity> tasks;
  final String emptyTitle;
  final String emptySubtitle;
  final Future<void> Function(TaskEntity) onToggle;
  final Future<void> Function(TaskEntity) onDelete;
  final Future<void> Function(TaskEntity) onEdit;
  final bool groupDone;

  @override
  Widget build(BuildContext context) {
    if (tasks.isEmpty) {
      return Center(
        child: AppEmptyState(
          icon: Icons.checklist_rounded,
          title: emptyTitle,
          subtitle: emptySubtitle,
        ),
      );
    }

    if (!groupDone) {
      return RefreshIndicator(
        color: AppColors.primary,
        backgroundColor: AppColors.card,
        onRefresh: () async {},
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
          itemCount: tasks.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) => TaskListItem(
            task: tasks[i],
            onToggle: () => onToggle(tasks[i]),
            onDelete: () => onDelete(tasks[i]),
            onEdit: () => onEdit(tasks[i]),
          ),
        ),
      );
    }

    final pending = tasks.where((t) => !t.isDone).toList();
    final done = tasks.where((t) => t.isDone).toList();

    return RefreshIndicator(
      color: AppColors.primary,
      backgroundColor: AppColors.card,
      onRefresh: () async {},
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
        children: [
          if (pending.isNotEmpty) ...[
            ...pending.map((t) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: TaskListItem(
                    task: t,
                    onToggle: () => onToggle(t),
                    onDelete: () => onDelete(t),
                    onEdit: () => onEdit(t),
                  ),
                )),
          ],
          if (done.isNotEmpty) ...[
            if (pending.isNotEmpty) const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
              child: Text(
                'Completed',
                style: AppTextStyles.labelSmall.copyWith(
                  color: AppColors.mutedForeground,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            ...done.map((t) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Opacity(
                    opacity: 0.5,
                    child: TaskListItem(
                      task: t,
                      onToggle: () => onToggle(t),
                      onDelete: () => onDelete(t),
                      onEdit: () => onEdit(t),
                    ),
                  ),
                )),
          ],
        ],
      ),
    );
  }
}
