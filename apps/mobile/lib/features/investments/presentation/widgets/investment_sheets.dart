import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/extensions/currency_ext.dart';
import '../../../../core/services/toast_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../data/datasources/investments_datasource.dart';
import '../../domain/entities/investment_entity.dart';
import '../pages/investments_page.dart' show shortDate, typeIcon;
import '../providers/investments_provider.dart';

const _typeOptions = [
  ('MUTUAL_FUND', 'Mutual Fund'),
  ('STOCKS', 'Stocks'),
  ('GOLD', 'Gold'),
  ('CRYPTO', 'Crypto'),
  ('FIXED_DEPOSIT', 'Fixed Deposit'),
  ('OTHER', 'Other'),
];

int? _toPaisas(String s) {
  final v = double.tryParse(s.trim());
  if (v == null || v <= 0) return null;
  return (v * 100).round();
}

Future<void> _sheet(BuildContext context, Widget child) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.popover,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: child,
      ),
    );

void showLogContributionSheet(BuildContext context, WidgetRef ref, InvestmentEntity inv) =>
    _sheet(context, _ContributionSheet(inv: inv));

void showUpdateValueSheet(BuildContext context, WidgetRef ref, InvestmentEntity inv) =>
    _sheet(context, _UpdateValueSheet(inv: inv));

void showNewSipSheet(BuildContext context, WidgetRef ref, InvestmentPlanEntity? plan) =>
    _sheet(context, _NewSipSheet(plan: plan));

void showHistorySheet(BuildContext context, WidgetRef ref, InvestmentEntity inv) =>
    _sheet(context, _HistorySheet(inv: inv));

// ── shared field ─────────────────────────────────────────────────────────────

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.hint,
    this.keyboardType,
    this.prefix,
    this.autofocus = false,
    this.onChanged,
  });
  final TextEditingController controller;
  final String hint;
  final TextInputType? keyboardType;
  final String? prefix;
  final bool autofocus;
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        autofocus: autofocus,
        keyboardType: keyboardType,
        style: AppTextStyles.bodyMedium,
        onChanged: onChanged != null ? (_) => onChanged!() : null,
        decoration: InputDecoration(
          hintText: hint,
          prefixText: prefix,
          prefixStyle: AppTextStyles.bodyMedium.copyWith(color: AppColors.mutedForeground),
          hintStyle: AppTextStyles.bodyMedium.copyWith(color: AppColors.mutedForeground),
          filled: true,
          fillColor: AppColors.card,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          border: _border(0.5),
          enabledBorder: _border(0.5),
          focusedBorder: _border(0.6, AppColors.primary),
        ),
      );

  OutlineInputBorder _border(double a, [Color? c]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: (c ?? AppColors.border).withValues(alpha: a)),
      );
}

class _SheetHeader extends StatelessWidget {
  const _SheetHeader({required this.title, required this.onSubmit, required this.canSubmit, required this.loading, this.submitLabel = 'Save'});
  final String title;
  final VoidCallback onSubmit;
  final bool canSubmit;
  final bool loading;
  final String submitLabel;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Expanded(child: Text(title, style: AppTextStyles.bodyLarge.copyWith(fontWeight: FontWeight.w600))),
          TextButton(
            onPressed: canSubmit && !loading ? onSubmit : null,
            child: loading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                : Text(submitLabel, style: AppTextStyles.labelLarge.copyWith(
                    color: canSubmit ? AppColors.primary : AppColors.mutedForeground,
                    fontWeight: FontWeight.w600,
                  )),
          ),
        ],
      );
}

Future<DateTime?> _pickDate(BuildContext context, DateTime initial) => showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
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

Widget _dateButton(BuildContext context, DateTime date, VoidCallback onTap) => GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
        ),
        child: Text(shortDate(date), style: AppTextStyles.bodyMedium),
      ),
    );

// ── Log contribution ─────────────────────────────────────────────────────────

class _ContributionSheet extends ConsumerStatefulWidget {
  const _ContributionSheet({required this.inv});
  final InvestmentEntity inv;
  @override
  ConsumerState<_ContributionSheet> createState() => _ContributionSheetState();
}

class _ContributionSheetState extends ConsumerState<_ContributionSheet> {
  final _amount = TextEditingController();
  final _notes = TextEditingController();
  DateTime _date = DateTime.now();
  bool _loading = false;

  @override
  void dispose() {
    _amount.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final paisas = _toPaisas(_amount.text);
    if (paisas == null) return;
    setState(() => _loading = true);
    try {
      HapticFeedback.mediumImpact();
      await ref.read(investmentsDatasourceProvider).logContribution(
            investmentId: widget.inv.id,
            amountPaisas: paisas,
            date: _date,
            notes: _notes.text.trim(),
          );
      ref.invalidate(investmentsProvider);
      if (mounted) {
        ref.read(toastServiceProvider).success(context, 'Contribution logged');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ref.read(toastServiceProvider).error(context, e is AppException ? e.message : 'Failed');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SheetHeader(
            title: 'Log — ${widget.inv.name}',
            onSubmit: _submit,
            canSubmit: _toPaisas(_amount.text) != null,
            loading: _loading,
            submitLabel: 'Log',
          ),
          const SizedBox(height: 16),
          _Field(controller: _amount, hint: '0', prefix: 'Rs ', autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: () => setState(() {})),
          const SizedBox(height: 12),
          _dateButton(context, _date, () async {
            final p = await _pickDate(context, _date);
            if (p != null) setState(() => _date = p);
          }),
          const SizedBox(height: 12),
          _Field(controller: _notes, hint: 'Notes (optional)'),
        ],
      ),
    );
  }
}

// ── Update value ─────────────────────────────────────────────────────────────

class _UpdateValueSheet extends ConsumerStatefulWidget {
  const _UpdateValueSheet({required this.inv});
  final InvestmentEntity inv;
  @override
  ConsumerState<_UpdateValueSheet> createState() => _UpdateValueSheetState();
}

class _UpdateValueSheetState extends ConsumerState<_UpdateValueSheet> {
  late final _value = TextEditingController(text: (widget.inv.currentValuePaisas / 100).toStringAsFixed(0));
  bool _loading = false;

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final paisas = _toPaisas(_value.text);
    if (paisas == null) return;
    setState(() => _loading = true);
    try {
      HapticFeedback.mediumImpact();
      await ref.read(investmentsDatasourceProvider).updateValue(id: widget.inv.id, currentValuePaisas: paisas);
      ref.invalidate(investmentsProvider);
      if (mounted) {
        ref.read(toastServiceProvider).success(context, 'Updated');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ref.read(toastServiceProvider).error(context, e is AppException ? e.message : 'Failed');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SheetHeader(
            title: 'Update value — ${widget.inv.name}',
            onSubmit: _submit,
            canSubmit: _toPaisas(_value.text) != null,
            loading: _loading,
          ),
          const SizedBox(height: 8),
          const Text('What it is worth now (mark-to-market)', style: AppTextStyles.bodySmall),
          const SizedBox(height: 12),
          _Field(controller: _value, hint: '0', prefix: 'Rs ', autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: () => setState(() {})),
        ],
      ),
    );
  }
}

// ── New SIP ──────────────────────────────────────────────────────────────────

class _NewSipSheet extends ConsumerStatefulWidget {
  const _NewSipSheet({required this.plan});
  final InvestmentPlanEntity? plan;
  @override
  ConsumerState<_NewSipSheet> createState() => _NewSipSheetState();
}

class _NewSipSheetState extends ConsumerState<_NewSipSheet> {
  final _name = TextEditingController();
  final _platform = TextEditingController();
  final _amount = TextEditingController();
  String _type = 'MUTUAL_FUND';
  String? _categoryId;
  DateTime _date = DateTime.now();
  bool _loading = false;

  @override
  void dispose() {
    _name.dispose();
    _platform.dispose();
    _amount.dispose();
    super.dispose();
  }

  bool get _canSubmit => _name.text.trim().isNotEmpty && _toPaisas(_amount.text) != null;

  Future<void> _submit() async {
    final paisas = _toPaisas(_amount.text);
    if (paisas == null || _name.text.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      HapticFeedback.mediumImpact();
      await ref.read(investmentsDatasourceProvider).createSip(
            name: _name.text.trim(),
            type: _type,
            platform: _platform.text.trim(),
            investedPaisas: paisas,
            purchaseDate: _date,
            planCategoryId: _categoryId,
          );
      ref.invalidate(investmentsProvider);
      if (mounted) {
        ref.read(toastServiceProvider).success(context, 'SIP created');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ref.read(toastServiceProvider).error(context, e is AppException ? e.message : 'Failed');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cats = widget.plan?.categories ?? [];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SheetHeader(title: 'New SIP', onSubmit: _submit, canSubmit: _canSubmit, loading: _loading, submitLabel: 'Create'),
            const SizedBox(height: 16),
            _Field(controller: _name, hint: 'Name (e.g. MZNPETF)', autofocus: true, onChanged: () => setState(() {})),
            const SizedBox(height: 12),
            _TypeDropdown(value: _type, onChanged: (v) => setState(() => _type = v)),
            const SizedBox(height: 12),
            _Field(controller: _platform, hint: 'Platform / broker (e.g. KTrade)'),
            if (cats.isNotEmpty) ...[
              const SizedBox(height: 12),
              _CategoryDropdown(
                categories: cats,
                value: _categoryId,
                onChanged: (v) => setState(() => _categoryId = v),
              ),
            ],
            const SizedBox(height: 12),
            _Field(controller: _amount, hint: '0', prefix: 'Rs ',
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                onChanged: () => setState(() {})),
            const SizedBox(height: 12),
            _dateButton(context, _date, () async {
              final p = await _pickDate(context, _date);
              if (p != null) setState(() => _date = p);
            }),
          ],
        ),
      ),
    );
  }
}

class _TypeDropdown extends StatelessWidget {
  const _TypeDropdown({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: value,
            isExpanded: true,
            dropdownColor: AppColors.popover,
            style: AppTextStyles.bodyMedium,
            icon: const Icon(Icons.expand_more, color: AppColors.mutedForeground),
            items: _typeOptions
                .map((t) => DropdownMenuItem(
                      value: t.$1,
                      child: Row(children: [
                        Icon(typeIcon(t.$1), size: 16, color: AppColors.mutedForeground),
                        const SizedBox(width: 10),
                        Text(t.$2),
                      ]),
                    ))
                .toList(),
            onChanged: (v) => v != null ? onChanged(v) : null,
          ),
        ),
      );
}

class _CategoryDropdown extends StatelessWidget {
  const _CategoryDropdown({required this.categories, required this.value, required this.onChanged});
  final List<PlanCategoryEntity> categories;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String?>(
            value: value,
            isExpanded: true,
            dropdownColor: AppColors.popover,
            style: AppTextStyles.bodyMedium,
            hint: Text('Plan category (optional)', style: AppTextStyles.bodyMedium.copyWith(color: AppColors.mutedForeground)),
            icon: const Icon(Icons.expand_more, color: AppColors.mutedForeground),
            items: [
              DropdownMenuItem(value: null, child: Text('Unassigned', style: AppTextStyles.bodyMedium.copyWith(color: AppColors.mutedForeground))),
              ...categories.map((c) => DropdownMenuItem(
                    value: c.id,
                    child: Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                  )),
            ],
            onChanged: onChanged,
          ),
        ),
      );
}

// ── History ──────────────────────────────────────────────────────────────────

class _HistorySheet extends ConsumerWidget {
  const _HistorySheet({required this.inv});
  final InvestmentEntity inv;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('History — ${inv.name}', style: AppTextStyles.bodyLarge.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          ...inv.contributions.map((c) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.amountPaisas.formatPKR(),
                              style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
                          Text(shortDate(c.date) + (c.notes != null && c.notes!.isNotEmpty ? ' · ${c.notes}' : ''),
                              style: AppTextStyles.bodySmall),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.mutedForeground),
                      onPressed: () async {
                        try {
                          await ref.read(investmentsDatasourceProvider).deleteContribution(
                                investmentId: inv.id,
                                contributionId: c.id,
                              );
                          ref.invalidate(investmentsProvider);
                          if (context.mounted) Navigator.pop(context);
                        } catch (e) {
                          if (context.mounted) {
                            ref.read(toastServiceProvider).error(
                                context, e is AppException ? e.message : 'Failed');
                          }
                        }
                      },
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}
