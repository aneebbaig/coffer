import 'dart:ui' as ui;

import 'package:flutter_overlay_window/flutter_overlay_window.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/constants/storage_keys.dart';

part 'overlay_provider.g.dart';

// showOverlay's height/width are raw device pixels, not logical/dp pixels
// (unlike resizeOverlay, which does convert). The bubble widget is laid out
// at 90 logical px, so the native window must be sized in physical px or it
// clips the content and most of the visible bubble ends up outside the
// actual touchable window.
int _overlayBubblePx() {
  final dpr = ui.PlatformDispatcher.instance.views.first.devicePixelRatio;
  return (90 * dpr).round();
}

@Riverpod(keepAlive: true)
class OverlayBubble extends _$OverlayBubble {
  @override
  Future<bool> build() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(StorageKeys.overlayEnabled) ?? false;
  }

  Future<void> enable() async {
    final granted = await FlutterOverlayWindow.isPermissionGranted();
    if (!granted) {
      final result = await FlutterOverlayWindow.requestPermission();
      if (result != true) return;
    }
    final isActive = await FlutterOverlayWindow.isActive();
    if (!isActive) {
      final size = _overlayBubblePx();
      await FlutterOverlayWindow.showOverlay(
        height: size,
        width: size,
        alignment: OverlayAlignment.centerRight,
        flag: OverlayFlag.defaultFlag,
        enableDrag: true,
        positionGravity: PositionGravity.auto,
        overlayTitle: AppConstants.appName,
        overlayContent: 'Tap to add expense',
      );
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(StorageKeys.overlayEnabled, true);
    state = const AsyncData(true);
  }

  Future<void> disable() async {
    final isActive = await FlutterOverlayWindow.isActive();
    if (isActive) await FlutterOverlayWindow.closeOverlay();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(StorageKeys.overlayEnabled, false);
    state = const AsyncData(false);
  }
}
