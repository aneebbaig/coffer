import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_overlay_window/flutter_overlay_window.dart';

class OverlayBubbleWidget extends StatefulWidget {
  const OverlayBubbleWidget({super.key});

  @override
  State<OverlayBubbleWidget> createState() => _OverlayBubbleWidgetState();
}

class _OverlayBubbleWidgetState extends State<OverlayBubbleWidget>
    with TickerProviderStateMixin {
  static const _amber = Color(0xFFF59E0B);
  static const _red = Color(0xFFEF4444);

  late final AnimationController _pulseCtrl;
  late final AnimationController _pressCtrl;
  late final AnimationController _dismissCtrl;

  late final Animation<double> _glowOpacity;
  late final Animation<double> _pressScale;
  late final Animation<double> _dismissScale;

  bool _dismissMode = false;

  @override
  void initState() {
    super.initState();

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _glowOpacity = Tween<double>(begin: 0.15, end: 0.45).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    _pressCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _pressScale = Tween<double>(begin: 1.0, end: 0.87).animate(
      CurvedAnimation(parent: _pressCtrl, curve: Curves.easeOut),
    );

    _dismissCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 180),
    );
    _dismissScale = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _dismissCtrl, curve: Curves.elasticOut),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _pressCtrl.dispose();
    _dismissCtrl.dispose();
    super.dispose();
  }

  Future<void> _onTap() async {
    if (_dismissMode) {
      // Tap while in dismiss mode = close overlay
      HapticFeedback.heavyImpact();
      await FlutterOverlayWindow.shareData({'action': 'overlay_dismissed'});
      await FlutterOverlayWindow.closeOverlay();
      return;
    }
    HapticFeedback.mediumImpact();
    await FlutterOverlayWindow.shareData({'action': 'quick_add'});
  }

  void _onLongPress() {
    HapticFeedback.heavyImpact();
    setState(() => _dismissMode = true);
    _dismissCtrl.forward(from: 0);
    // Auto-cancel dismiss mode after 3 seconds
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted && _dismissMode) {
        setState(() => _dismissMode = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _onTap,
      onLongPress: _dismissMode ? null : _onLongPress,
      onTapDown: (_) {
        if (!_dismissMode) _pressCtrl.forward();
      },
      onTapUp: (_) => _pressCtrl.reverse(),
      onTapCancel: () => _pressCtrl.reverse(),
      child: SizedBox(
        width: 90,
        height: 90,
        child: AnimatedBuilder(
          animation: Listenable.merge([_glowOpacity, _pressScale, _dismissScale]),
          builder: (_, __) {
            final color = _dismissMode ? _red : _amber;
            final scale = _dismissMode ? _dismissScale.value : _pressScale.value;

            return Stack(
              alignment: Alignment.center,
              children: [
                if (!_dismissMode)
                  Container(
                    width: 90,
                    height: 90,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _amber.withValues(alpha: _glowOpacity.value),
                    ),
                  ),
                Transform.scale(
                  scale: scale,
                  child: Container(
                    width: 66,
                    height: 66,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: color.withValues(alpha: 0.45),
                          blurRadius: 14,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 180),
                      transitionBuilder: (child, anim) => ScaleTransition(
                        scale: anim,
                        child: child,
                      ),
                      child: _dismissMode
                          ? const Icon(
                              Icons.close_rounded,
                              color: Colors.white,
                              size: 32,
                              key: ValueKey('x'),
                            )
                          : const Icon(
                              Icons.add_rounded,
                              color: Colors.black,
                              size: 32,
                              key: ValueKey('add'),
                            ),
                    ),
                  ),
                ),
                if (_dismissMode)
                  Positioned(
                    bottom: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Tap to close',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 9,
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
