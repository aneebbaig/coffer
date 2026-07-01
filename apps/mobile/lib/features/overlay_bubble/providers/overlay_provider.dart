import 'package:flutter_overlay_window/flutter_overlay_window.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/constants/storage_keys.dart';

part 'overlay_provider.g.dart';

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
      await FlutterOverlayWindow.showOverlay(
        height: 90,
        width: 90,
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
