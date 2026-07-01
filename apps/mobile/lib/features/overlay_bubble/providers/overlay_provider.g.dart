// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'overlay_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(OverlayBubble)
final overlayBubbleProvider = OverlayBubbleProvider._();

final class OverlayBubbleProvider
    extends $AsyncNotifierProvider<OverlayBubble, bool> {
  OverlayBubbleProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'overlayBubbleProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$overlayBubbleHash();

  @$internal
  @override
  OverlayBubble create() => OverlayBubble();
}

String _$overlayBubbleHash() => r'c2b3e3def65d7a1e5d1b56d7417ceec8835382c0';

abstract class _$OverlayBubble extends $AsyncNotifier<bool> {
  FutureOr<bool> build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<AsyncValue<bool>, bool>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<bool>, bool>,
              AsyncValue<bool>,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
