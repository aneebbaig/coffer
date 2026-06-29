import 'package:dio/dio.dart';

import '../../constants/api_constants.dart';
import '../../errors/app_exception.dart';
import '../../services/storage_service.dart';

const _kSkipAuth = 'skip_auth';

/// Injects Bearer token on every request.
/// On 401: refreshes token once, retries original request.
/// On refresh failure: clears tokens (RouterNotifier auto-redirects to login).
/// Uses [QueuedInterceptorsWrapper] to serialise concurrent 401s —
/// prevents multiple parallel refresh calls on concurrent expired requests.
class AuthInterceptor extends QueuedInterceptorsWrapper {
  AuthInterceptor({required StorageService storage, required Dio dio})
      : _storage = storage,
        _dio = dio;

  final StorageService _storage;
  final Dio _dio;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.extra[_kSkipAuth] == true) {
      handler.next(options);
      return;
    }
    final token = await _storage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken == null) throw const NoRefreshTokenException();

      final response = await _dio.post(
        ApiConstants.refresh,
        data: {'refreshToken': refreshToken},
        options: Options(extra: {_kSkipAuth: true}),
      );

      final newAccess = (response.data['data'] as Map)['accessToken'] as String;
      await _storage.saveTokens(access: newAccess, refresh: refreshToken);

      final retryOptions = err.requestOptions
        ..headers['Authorization'] = 'Bearer $newAccess';
      final retryResponse = await _dio.fetch(retryOptions);
      handler.resolve(retryResponse);
    } on NoRefreshTokenException catch (_) {
      await _storage.clearTokens();
      handler.next(err);
    } on DioException catch (e) {
      await _storage.clearTokens();
      handler.next(e);
    } catch (_) {
      await _storage.clearTokens();
      handler.next(err);
    }
  }
}
