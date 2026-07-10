import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/extensions/currency_ext.dart';
import '../../../../core/services/toast_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_card.dart';
import '../../data/datasources/plans_datasource.dart';
import '../../domain/entities/plan_entity.dart';
import '../providers/plans_provider.dart';

class PlanDetailPage extends ConsumerWidget {
  const PlanDetailPage({super.key, required this.planId});
  final String planId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(planDetailProvider(planId));
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: Text(async.asData?.value.name ?? 'Plan', style: AppTextStyles.headlineSmall),
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        backgroundColor: AppColors.card,
        onRefresh: () => ref.refresh(planDetailProvider(planId).future),
        child: async.when(
          data: (plan) => _Content(plan: plan),
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (_, __) => const Center(child: Text('Could not load plan', style: AppTextStyles.bodyMedium)),
        ),
      ),
    );
  }
}

class _Content extends ConsumerWidget {
  const _Content({required this.plan});
  final PlanDetailEntity plan;

  Future<void> _buy(BuildContext context, WidgetRef ref, PlanItemEntity item) async {
    try {
      HapticFeedback.mediumImpact();
      await ref.read(plansDatasourceProvider).buyItem(planId: plan.id, itemId: item.id);
      ref.invalidate(planDetailProvider(plan.id));
      ref.invalidate(plansProvider);
      if (context.mounted) ref.read(toastServiceProvider).success(context, 'Bought — expense logged');
    } catch (e) {
      if (context.mounted) {
        ref.read(toastServiceProvider).error(context, e is AppException ? e.message : 'Failed');
      }
    }
  }

  Future<void> _undo(BuildContext context, WidgetRef ref, PlanItemEntity item) async {
    try {
      await ref.read(plansDatasourceProvider).setItemStatus(planId: plan.id, itemId: item.id, status: 'PENDING');
      ref.invalidate(planDetailProvider(plan.id));
      ref.invalidate(plansProvider);
    } catch (e) {
      if (context.mounted) {
        ref.read(toastServiceProvider).error(context, e is AppException ? e.message : 'Failed');
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paidCount = plan.items.where((i) => i.isBought).length;
    final pct = plan.items.isEmpty ? 0 : ((paidCount / plan.items.length) * 100).round();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: [
        // Stat row — three single-value cards, all the same natural height.
        Row(
          children: [
            Expanded(child: _Stat(label: 'Estimated', value: plan.totalEstimatedPaisas.formatPKR())),
            const SizedBox(width: 8),
            Expanded(child: _Stat(label: 'Bought', value: plan.totalPaidPaisas.formatPKR(), color: AppColors.success)),
            const SizedBox(width: 8),
            Expanded(child: _Stat(label: 'Progress', value: '$pct%')),
          ],
        ),
        const SizedBox(height: 12),
        _Affordability(plan: plan),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Items & Checklist', style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
            Text('$paidCount/${plan.items.length} done', style: AppTextStyles.bodySmall),
          ],
        ),
        const SizedBox(height: 8),
        ...plan.items.map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _ItemRow(
                item: item,
                onBuy: () => _buy(context, ref, item),
                onUndo: () => _undo(context, ref, item),
              ),
            )),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.color});
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) => AppCard(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTextStyles.labelSmall),
            const SizedBox(height: 4),
            Text(value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.bodyLarge.copyWith(fontWeight: FontWeight.w700, color: color ?? AppColors.foreground)),
          ],
        ),
      );
}

class _Affordability extends StatelessWidget {
  const _Affordability({required this.plan});
  final PlanDetailEntity plan;

  @override
  Widget build(BuildContext context) {
    final a = plan.affordability;
    final ok = a.canAfford;
    final warn = a.coveragePct >= 50;
    final color = ok ? AppColors.success : warn ? AppColors.warning : AppColors.destructive;
    final shortfall = plan.remainingPaisas - a.liquidAvailablePaisas;
    return AppCard(
      color: color.withValues(alpha: 0.08),
      borderColor: color.withValues(alpha: 0.4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(ok ? Icons.check_circle_outline : Icons.warning_amber_rounded, size: 16, color: color),
            const SizedBox(width: 8),
            Text(ok ? 'You can cover this plan' : '${a.coveragePct}% of remaining cost is covered',
                style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _Mini(label: 'Still to pay', value: plan.remainingPaisas.formatPKR()),
              _Mini(label: 'Available (liquid)', value: a.liquidAvailablePaisas.formatPKR()),
            ],
          ),
          if (!ok && shortfall > 0) ...[
            const SizedBox(height: 8),
            Text('Shortfall: ${shortfall.formatPKR()}. Build your savings before committing.',
                style: AppTextStyles.bodySmall.copyWith(color: AppColors.mutedForeground)),
          ],
        ],
      ),
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTextStyles.labelSmall),
          Text(value, style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
        ],
      );
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.item, required this.onBuy, required this.onUndo});
  final PlanItemEntity item;
  final VoidCallback onBuy;
  final VoidCallback onUndo;

  @override
  Widget build(BuildContext context) => AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.name, style: AppTextStyles.bodyMedium),
                  const SizedBox(height: 2),
                  Text('Est ${item.estimatedPaisas.formatPKR()}'
                      '${item.actualPaisas != null ? ' · Paid ${item.actualPaisas!.formatPKR()}' : ''}',
                      style: AppTextStyles.bodySmall),
                ],
              ),
            ),
            const SizedBox(width: 10),
            if (item.isBought)
              TextButton.icon(
                onPressed: onUndo,
                icon: const Icon(Icons.check_circle, size: 16, color: AppColors.success),
                label: const Text('Bought', style: TextStyle(color: AppColors.success)),
                style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8)),
              )
            else
              OutlinedButton(
                onPressed: onBuy,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: BorderSide(color: AppColors.primary.withValues(alpha: 0.4)),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                ),
                child: const Text('Buy & log'),
              ),
          ],
        ),
      );
}
