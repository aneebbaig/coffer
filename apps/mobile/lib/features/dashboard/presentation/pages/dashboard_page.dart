import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_empty_state.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/budget_bar.dart';
import '../widgets/recent_transactions_list.dart';
import '../widgets/summary_cards.dart';
import '../../../overlay_bubble/providers/overlay_provider.dart';
import '../../../../core/constants/storage_keys.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  bool _promptChecked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowOverlayPrompt());
  }

  Future<void> _maybeShowOverlayPrompt() async {
    if (_promptChecked || !mounted) return;
    _promptChecked = true;

    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(StorageKeys.overlayPromptShown) == true) return;
    await prefs.setBool(StorageKeys.overlayPromptShown, true);

    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _OverlayPromptSheet(
        onEnable: () async {
          Navigator.pop(context);
          await ref.read(overlayBubbleProvider.notifier).enable();
        },
        onSkip: () => Navigator.pop(context),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(dashboardProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        color: AppColors.primary,
        backgroundColor: AppColors.card,
        onRefresh: () => ref.refresh(dashboardProvider.future),
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              backgroundColor: AppColors.background,
              floating: true,
              snap: true,
              elevation: 0,
              title: async.when(
                data: (d) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(d.periodLabel, style: AppTextStyles.headlineSmall),
                    const Text('Budget period', style: AppTextStyles.bodySmall),
                  ],
                ),
                loading: () =>
                    const Text('Dashboard', style: AppTextStyles.headlineSmall),
                error: (_, __) =>
                    const Text('Dashboard', style: AppTextStyles.headlineSmall),
              ),
            ),
            async.when(
              data: (d) => SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    SummaryCards(
                      totalIncomePaisas: d.totalIncomePaisas,
                      totalExpensesPaisas: d.totalExpensesPaisas,
                      netSavingsPaisas: d.netSavingsPaisas,
                    ),
                    if (d.budget != null) ...[
                      const SizedBox(height: 16),
                      BudgetBar(budget: d.budget!),
                    ],
                    const SizedBox(height: 20),
                    RecentTransactionsList(items: d.recentTransactions),
                  ]),
                ),
              ),
              loading: () => const SliverFillRemaining(
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              ),
              error: (_, __) => SliverFillRemaining(
                child: AppEmptyState(
                  title: 'Could not load dashboard',
                  icon: Icons.wifi_off_outlined,
                  onRetry: () => ref.refresh(dashboardProvider.future),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OverlayPromptSheet extends StatelessWidget {
  const _OverlayPromptSheet({
    required this.onEnable,
    required this.onSkip,
  });

  final VoidCallback onEnable;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.add_rounded, color: Colors.black, size: 32),
            ),
            const SizedBox(height: 20),
            const Text(
              'Quick-add bubble',
              style: AppTextStyles.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'A floating button stays visible over every app.\nTap it once to log an expense - no unlocking, no hunting.',
              style: AppTextStyles.bodySmall.copyWith(
                color: AppColors.mutedForeground,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onEnable,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  'Enable bubble',
                  style: AppTextStyles.bodyMedium.copyWith(
                    fontWeight: FontWeight.w600,
                    color: Colors.black,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: onSkip,
              child: Text(
                'Maybe later',
                style: AppTextStyles.bodySmall.copyWith(
                  color: AppColors.mutedForeground,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
