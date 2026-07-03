import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/services/storage_service.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';
import '../models/user_model.dart';

part 'auth_repository_impl.g.dart';

@Riverpod(keepAlive: true)
AuthRepository authRepository(Ref ref) => AuthRepositoryImpl(
      datasource: ref.watch(authRemoteDatasourceProvider),
      storage: ref.watch(storageServiceProvider),
    );

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl({
    required AuthRemoteDatasource datasource,
    required StorageService storage,
  })  : _datasource = datasource,
        _storage = storage;

  final AuthRemoteDatasource _datasource;
  final StorageService _storage;

  @override
  Future<UserEntity> login({
    required String email,
    required String password,
    String? totp,
  }) async {
    final result = await _datasource.login(email: email, password: password, totp: totp);
    await _storage.saveTokens(
      access: result.tokens.accessToken,
      refresh: result.tokens.refreshToken,
    );
    return result.user.toEntity();
  }

  @override
  Future<UserEntity> getMe() async {
    final model = await _datasource.getMe();
    return model.toEntity();
  }

  @override
  Future<void> logout() => _storage.clearTokens();
}
