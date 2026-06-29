import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../constants/storage_keys.dart';

part 'storage_service.g.dart';

@Riverpod(keepAlive: true)
StorageService storageService(Ref ref) => StorageService();

class StorageService {
  StorageService()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(),
        );

  final FlutterSecureStorage _storage;

  Future<void> saveTokens({
    required String access,
    required String refresh,
  }) async {
    await Future.wait([
      _storage.write(key: StorageKeys.accessToken, value: access),
      _storage.write(key: StorageKeys.refreshToken, value: refresh),
    ]);
  }

  Future<String?> getAccessToken() =>
      _storage.read(key: StorageKeys.accessToken);

  Future<String?> getRefreshToken() =>
      _storage.read(key: StorageKeys.refreshToken);

  Future<void> clearTokens() async {
    await Future.wait([
      _storage.delete(key: StorageKeys.accessToken),
      _storage.delete(key: StorageKeys.refreshToken),
    ]);
  }

  Future<bool> hasTokens() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }
}
