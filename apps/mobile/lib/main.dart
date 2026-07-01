import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_overlay_window/flutter_overlay_window.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:home_widget/home_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/constants/app_constants.dart';
import 'core/constants/storage_keys.dart';
import 'features/overlay_bubble/overlay_bubble_widget.dart';

@pragma('vm:entry-point')
void backgroundCallback(Uri? uri) {
  // Widget tap deeplink handled by GoRouter via URI scheme
}

// Entry point for the floating overlay bubble. It runs in its own Flutter engine.
@pragma('vm:entry-point')
void overlayMain() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      // Transparent theme so nothing opaque shows behind the bubble
      theme: ThemeData(
        scaffoldBackgroundColor: Colors.transparent,
        canvasColor: Colors.transparent,
        colorScheme: const ColorScheme.dark(),
      ),
      home: const Material(
        color: Colors.transparent,
        child: OverlayBubbleWidget(),
      ),
    ),
  );
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  HomeWidget.registerInteractivityCallback(backgroundCallback);

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarBrightness: Brightness.dark,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Color(0xFF040201),
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  // Bring the overlay bubble back if it was on before this launch
  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(StorageKeys.overlayEnabled) == true) {
    final granted = await FlutterOverlayWindow.isPermissionGranted();
    if (granted) {
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
    } else {
      // permission was revoked while we were away
      await prefs.setBool(StorageKeys.overlayEnabled, false);
    }
  }

  runApp(const ProviderScope(child: CofferApp()));
}
