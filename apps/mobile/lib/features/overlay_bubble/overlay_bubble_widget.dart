import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_overlay_window/flutter_overlay_window.dart';

import '../../core/theme/app_colors.dart';

class OverlayBubbleWidget extends StatefulWidget {
  const OverlayBubbleWidget({super.key});

  @override
  State<OverlayBubbleWidget> createState() => _OverlayBubbleWidgetState();
}

class _OverlayBubbleWidgetState extends State<OverlayBubbleWidget>
    with TickerProviderStateMixin {
  // How far down the bubble has to be dragged before release triggers dismiss.
  static const _dismissDragThreshold = 90.0;

  late final AnimationController _pulseCtrl;
  late final AnimationController _pressCtrl;

  late final Animation<double> _glowOpacity;
  late final Animation<double> _pressScale;

  bool _dismissMode = false;
  double _dragDy = 0;

  @override
  void initState() {
    super.initState();

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);

    _glowOpacity = Tween<double>(
      begin: 0.10,
      end: 0.30,
    ).animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));

    _pressCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _pressScale = Tween<double>(
      begin: 1.0,
      end: 0.88,
    ).animate(CurvedAnimation(parent: _pressCtrl, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _pressCtrl.dispose();
    super.dispose();
  }

  Future<void> _onTap() async {
    HapticFeedback.mediumImpact();
    await FlutterOverlayWindow.shareData({'action': 'quick_add'});
  }

  void _onPanStart(DragStartDetails _) {
    _dragDy = 0;
  }

  void _onPanUpdate(DragUpdateDetails details) {
    _dragDy += details.delta.dy;
    final shouldDismiss = _dragDy > _dismissDragThreshold;
    if (shouldDismiss != _dismissMode) {
      HapticFeedback.selectionClick();
      setState(() => _dismissMode = shouldDismiss);
    }
  }

  Future<void> _onPanEnd(DragEndDetails _) async {
    if (_dismissMode) {
      HapticFeedback.heavyImpact();
      await FlutterOverlayWindow.shareData({'action': 'overlay_dismissed'});
      await FlutterOverlayWindow.closeOverlay();
      return;
    }
    _dragDy = 0;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _onTap,
      onPanStart: _onPanStart,
      onPanUpdate: _onPanUpdate,
      onPanEnd: _onPanEnd,
      onTapDown: (_) => _pressCtrl.forward(),
      onTapUp: (_) => _pressCtrl.reverse(),
      onTapCancel: () => _pressCtrl.reverse(),
      child: SizedBox(
        width: 90,
        height: 90,
        child: AnimatedBuilder(
          animation: Listenable.merge([_glowOpacity, _pressScale]),
          builder: (_, __) {
            final color = _dismissMode
                ? AppColors.destructive
                : AppColors.primary;

            return Stack(
              alignment: Alignment.center,
              children: [
                if (!_dismissMode)
                  Container(
                    width: 90,
                    height: 90,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.primary.withValues(
                        alpha: _glowOpacity.value,
                      ),
                    ),
                  ),
                Transform.scale(
                  scale: _pressScale.value,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    curve: Curves.easeOut,
                    width: _dismissMode ? 74 : 64,
                    height: _dismissMode ? 74 : 64,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.20),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.40),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                        BoxShadow(
                          color: color.withValues(alpha: 0.40),
                          blurRadius: 18,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 160),
                      transitionBuilder: (child, anim) =>
                          ScaleTransition(scale: anim, child: child),
                      child: _dismissMode
                          ? const Icon(
                              Icons.delete_rounded,
                              color: Colors.white,
                              size: 28,
                              key: ValueKey('trash'),
                            )
                          : const Icon(
                              Icons.add_rounded,
                              color: AppColors.background,
                              size: 30,
                              key: ValueKey('add'),
                            ),
                    ),
                  ),
                ),
                if (_dismissMode)
                  Positioned(
                    bottom: -2,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Release to remove',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
