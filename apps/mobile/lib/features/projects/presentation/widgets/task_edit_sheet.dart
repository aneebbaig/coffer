import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/entities/project_entity.dart';
import 'kanban_card.dart';

const _statuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
const _statusLabels = {'TODO': 'To Do', 'IN_PROGRESS': 'In Progress', 'REVIEW': 'Review', 'DONE': 'Done'};
const _priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

/// Shows the task editor. Returns nothing; persistence happens through the
/// callbacks so the page owns the datasource + refresh.
Future<void> showTaskEditSheet(
  BuildContext context, {
  required ProjectTaskEntity task,
  required Future<void> Function(Map<String, dynamic> changes) onSave,
  required Future<void> Function() onDelete,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
      child: _TaskEditSheet(task: task, onSave: onSave, onDelete: onDelete),
    ),
  );
}

class _TaskEditSheet extends StatefulWidget {
  const _TaskEditSheet({required this.task, required this.onSave, required this.onDelete});

  final ProjectTaskEntity task;
  final Future<void> Function(Map<String, dynamic> changes) onSave;
  final Future<void> Function() onDelete;

  @override
  State<_TaskEditSheet> createState() => _TaskEditSheetState();
}

class _TaskEditSheetState extends State<_TaskEditSheet> {
  late final TextEditingController _title;
  late final TextEditingController _description;
  late String _status;
  late String _priority;
  DateTime? _dueDate;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: widget.task.title);
    _description = TextEditingController(text: widget.task.description ?? '');
    _status = widget.task.status;
    _priority = widget.task.priority;
    _dueDate = widget.task.dueDate;
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    if (title.isEmpty) return;
    setState(() => _saving = true);
    await widget.onSave({
      'title': title,
      'description': _description.text.trim().isEmpty ? null : _description.text.trim(),
      'status': _status,
      'priority': _priority,
      'dueDate': _dueDate?.toIso8601String(),
    });
    if (mounted) Navigator.pop(context);
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            _label('Title'),
            TextField(
              controller: _title,
              style: AppTextStyles.bodyMedium,
              textCapitalization: TextCapitalization.sentences,
              decoration: _fieldDecoration('Task title'),
            ),
            const SizedBox(height: 16),
            _label('Details'),
            TextField(
              controller: _description,
              style: AppTextStyles.bodyMedium,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: _fieldDecoration('Notes, links, acceptance criteria…'),
            ),
            const SizedBox(height: 16),
            _label('Status'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final s in _statuses)
                  _chip(
                    label: _statusLabels[s]!,
                    selected: _status == s,
                    onTap: () => setState(() => _status = s),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            _label('Priority'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final p in _priorities)
                  _chip(
                    label: p[0] + p.substring(1).toLowerCase(),
                    selected: _priority == p,
                    dotColor: kanbanPriorityColor(p),
                    onTap: () => setState(() => _priority = p),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            _label('Due date'),
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: _pickDate,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.event_outlined, size: 16, color: AppColors.mutedForeground),
                          const SizedBox(width: 8),
                          Text(
                            _dueDate == null ? 'No due date' : DateFormat('d MMM y').format(_dueDate!),
                            style: AppTextStyles.bodyMedium.copyWith(
                              color: _dueDate == null ? AppColors.mutedForeground : AppColors.foreground,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                if (_dueDate != null)
                  IconButton(
                    onPressed: () => setState(() => _dueDate = null),
                    icon: const Icon(Icons.close, size: 18, color: AppColors.mutedForeground),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _saving
                    ? const SizedBox(
                        width: 18, height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                    : const Text('Save'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: TextButton.icon(
                onPressed: () async {
                  Navigator.pop(context);
                  await widget.onDelete();
                },
                icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.destructive),
                label: Text('Delete task',
                    style: AppTextStyles.bodyMedium.copyWith(color: AppColors.destructive)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text,
            style: AppTextStyles.labelMedium
                .copyWith(color: AppColors.mutedForeground, fontWeight: FontWeight.w600)),
      );

  InputDecoration _fieldDecoration(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: AppTextStyles.bodyMedium.copyWith(color: AppColors.mutedForeground),
        isDense: true,
        filled: true,
        fillColor: AppColors.background,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary),
        ),
      );

  Widget _chip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
    Color? dotColor,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withValues(alpha: 0.15) : AppColors.background,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border.withValues(alpha: 0.5),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (dotColor != null) ...[
              Container(width: 7, height: 7, decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: AppTextStyles.labelMedium.copyWith(
                color: selected ? AppColors.primary : AppColors.foreground,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
