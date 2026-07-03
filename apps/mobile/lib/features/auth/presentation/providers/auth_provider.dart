import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/user_entity.dart';

part 'auth_provider.g.dart';

@Riverpod(keepAlive: true)
class AuthNotifier extends _$AuthNotifier {
  @override
  Future<UserEntity?> build() async {
    final repo = ref.watch(authRepositoryProvider);
    try {
      return await repo.getMe();
    } catch (_) {
      // No valid session - return null, router redirects to login
      return null;
    }
  }

  Future<void> login({required String email, required String password, String? totp}) async {
    state = const AsyncLoading();
    try {
      final user = await ref.read(authRepositoryProvider).login(
            email: email,
            password: password,
            totp: totp,
          );
      state = AsyncData(user);
    } catch (e, st) {
      state = AsyncError(e, st);
      rethrow; // let LoginForm's catch handle 2FA prompt / show error toast
    }
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(null);
  }
}
