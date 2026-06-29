import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../constants/api_constants.dart';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/log_interceptor.dart';

part 'api_client.g.dart';

@Riverpod(keepAlive: true)
Dio apiClient(Ref ref) {
  final storage = ref.watch(storageServiceProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: AppConstants.connectTimeout,
      receiveTimeout: AppConstants.receiveTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  // Order matters: log first (sees raw request), auth second (injects token)
  dio.interceptors.addAll([
    AppLogInterceptor(),
    AuthInterceptor(storage: storage, dio: dio),
  ]);

  return dio;
}
