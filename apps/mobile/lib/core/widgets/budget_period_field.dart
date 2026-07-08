import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';

/// Optional budget-month override, mirroring the web app's BudgetPeriodOverride.
/// When [month]/[year] are null, the transaction is filed under the server's
/// current open budget period (the default, no override sent).
class BudgetPeriodField extends StatelessWidget {
  const BudgetPeriodField({
    required this.month,
    required this.year,
    required this.onChanged,
    super.key,
  });

  final int? month;
  final int? year;
  final void Function(int? month, int? year) onChanged;

  bool get _enabled => month != null && year != null;

  Future<void> _pick(BuildContext context) async {
    final initial = _enabled ? DateTime(year!, month!) : DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      initialDatePickerMode: DatePickerMode.year,
      helpText: 'Pick any day in the target budget month',
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.primary,
            surface: AppColors.card,
            onSurface: AppColors.foreground,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) onChanged(picked.month, picked.year);
  }

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Different budget month', style: AppTextStyles.bodyMedium),
                    Text(
                      'File this under a month other than the current one',
                      style: AppTextStyles.bodySmall.copyWith(color: AppColors.mutedForeground),
                    ),
                  ],
                ),
              ),
              Switch(
                value: _enabled,
                activeTrackColor: AppColors.primary,
                onChanged: (v) => onChanged(v ? DateTime.now().month : null, v ? DateTime.now().year : null),
              ),
            ],
          ),
          if (_enabled) ...[
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () => _pick(context),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.event_note_outlined, size: 16, color: AppColors.mutedForeground),
                    const SizedBox(width: 10),
                    Text(DateFormat('MMMM y').format(DateTime(year!, month!)), style: AppTextStyles.bodyMedium),
                    const Spacer(),
                    const Icon(Icons.keyboard_arrow_down, size: 16, color: AppColors.mutedForeground),
                  ],
                ),
              ),
            ),
          ],
        ],
      );
}
