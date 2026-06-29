import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/extensions/currency_ext.dart';
import '../../../../core/services/toast_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../data/datasources/loans_datasource.dart';
import '../../domain/entities/loan_entity.dart';
import '../providers/loans_provider.dart';

class RecordPaymentPage extends ConsumerStatefulWidget {
  const RecordPaymentPage({required this.loan, super.key});
  final LoanEntity loan;

  @override
  ConsumerState<RecordPaymentPage> createState() => _RecordPaymentPageState();
}

class _RecordPaymentPageState extends ConsumerState<RecordPaymentPage> {
  late final TextEditingController _amountCtrl;
  final _notesCtrl = TextEditingController();
  final _amountFocus = FocusNode();
  DateTime _date = DateTime.now();
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    // Pre-fill with remaining balance
    final remaining = widget.loan.remainingPaisas / 100;
    _amountCtrl = TextEditingController(
      text: remaining == remaining.truncateToDouble()
          ? remaining.toInt().toString()
          : remaining.toStringAsFixed(2),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _amountFocus.requestFocus();
      _amountCtrl.selection = TextSelection(
        baseOffset: 0,
        extentOffset: _amountCtrl.text.length,
      );
    });
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _notesCtrl.dispose();
    _amountFocus.dispose();
    super.dispose();
  }

  int? get _amountPaisas {
    final v = double.tryParse(_amountCtrl.text.trim());
    if (v == null || v <= 0) return null;
    return (v * 100).round();
  }

  bool get _canSubmit {
    final p = _amountPaisas;
    return p != null && p <= widget.loan.remainingPaisas;
  }

  Future<void> _pickDate() async {
    _amountFocus.unfocus();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
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
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    final paisas = _amountPaisas;
    if (paisas == null) return;
    HapticFeedback.mediumImpact();

    setState(() => _loading = true);
    try {
      await ref.read(loansDatasourceProvider).recordPayment(
            loanId: widget.loan.id,
            amountPaisas: paisas,
            date: _date,
            notes: _notesCtrl.text.trim().isNotEmpty ? _notesCtrl.text.trim() : null,
          );

      if (!mounted) return;
      ref.invalidate(loansProvider);
      ref.read(toastServiceProvider).success(context, 'Payment recorded');
      HapticFeedback.lightImpact();
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      final msg = e is AppException ? e.message : 'Failed to record payment';
      ref.read(toastServiceProvider).error(context, msg);
    }
  }

  @override
  Widget build(BuildContext context) {
    final submitting = _loading;
    final dateLabel = DateFormat('EEE, d MMM y').format(_date);
    final isToday = _date.year == DateTime.now().year &&
        _date.month == DateTime.now().month &&
        _date.day == DateTime.now().day;

    return Scaffold(
      backgroundColor: AppColors.background,
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: Text(
          'Pay — ${widget.loan.personName}',
          style: AppTextStyles.headlineSmall,
        ),
        leading: IconButton(
          icon: const Icon(Icons.close, color: AppColors.foreground),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: TextButton(
              onPressed: _canSubmit && !submitting ? _submit : null,
              child: submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    )
                  : Text(
                      'Record',
                      style: AppTextStyles.labelLarge.copyWith(
                        color: _canSubmit
                            ? AppColors.primary
                            : AppColors.mutedForeground,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Remaining balance hint
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Remaining balance',
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.mutedForeground,
                    ),
                  ),
                  Text(
                    widget.loan.remainingPaisas.formatPKR(),
                    style: AppTextStyles.labelMedium.copyWith(
                      color: widget.loan.type == 'RECEIVED'
                          ? AppColors.destructive
                          : const Color(0xFFE67E22),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            TextField(
              controller: _amountCtrl,
              focusNode: _amountFocus,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [_DecimalFormatter()],
              style: AppTextStyles.displayLarge.copyWith(
                color: AppColors.primary,
                letterSpacing: -1,
              ),
              decoration: InputDecoration(
                prefixText: 'Rs ',
                prefixStyle: AppTextStyles.headlineMedium.copyWith(
                  color: AppColors.mutedForeground,
                ),
                hintText: '0',
                hintStyle: AppTextStyles.displayLarge.copyWith(
                  color: AppColors.mutedForeground.withValues(alpha: 0.4),
                  letterSpacing: -1,
                ),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 8),
              ),
              onChanged: (_) => setState(() {}),
            ),

            const SizedBox(height: 12),
            Divider(color: AppColors.border.withValues(alpha: 0.4), height: 1),
            const SizedBox(height: 16),

            TextField(
              controller: _notesCtrl,
              style: AppTextStyles.bodyMedium,
              maxLines: 1,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: 'Notes (optional)',
                hintStyle: AppTextStyles.bodyMedium.copyWith(color: AppColors.mutedForeground),
                filled: true,
                fillColor: AppColors.card,
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
                  borderSide: BorderSide(color: AppColors.primary.withValues(alpha: 0.6)),
                ),
              ),
            ),

            const SizedBox(height: 12),

            GestureDetector(
              onTap: _pickDate,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined,
                        size: 16, color: AppColors.mutedForeground),
                    const SizedBox(width: 10),
                    Text(
                      isToday ? 'Today' : dateLabel,
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: isToday ? AppColors.mutedForeground : AppColors.foreground,
                      ),
                    ),
                    const Spacer(),
                    const Icon(Icons.keyboard_arrow_down,
                        size: 16, color: AppColors.mutedForeground),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DecimalFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue old, TextEditingValue val) {
    final text = val.text;
    if (text.isEmpty) return val;
    if (!RegExp(r'^\d{0,9}(\.\d{0,2})?$').hasMatch(text)) return old;
    return val;
  }
}
