import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/errors/app_exception.dart';
import '../../../../core/errors/error_handler.dart';
import '../../../../core/network/api_client.dart';
import '../models/auth_tokens_model.dart';
import '../models/user_model.dart';

part 'auth_remote_datasource.g.dart';

@riverpod
AuthRemoteDatasource authRemoteDatasource(Ref ref) =>
    AuthRemoteDatasource(ref.watch(apiClientProvider));

class AuthRemoteDatasource {
  const AuthRemoteDatasource(this._dio);
  final Dio _dio;

  Future<({AuthTokensModel tokens, UserModel user})> login({
    required String email,
    required String password,
    String? totp,
  }) async {
    try {
      final res = await _dio.post(
        ApiConstants.login,
        data: {
          'email': email,
          'password': password,
          if (totp != null && totp.isNotEmpty) 'totp': totp,
        },
      );
      // Password ok but 2FA enabled: server returns 200 { totpRequired: true }
      // and no tokens. Signal the UI to collect the code and resubmit.
      if (res.data is Map && res.data['totpRequired'] == true) {
        throw const TotpRequiredException();
      }
      final data = res.data['data'] as Map<String, dynamic>;
      return (
        tokens: AuthTokensModel.fromJson(data),
        user: UserModel.fromJson(data['user'] as Map<String, dynamic>),
      );
    } catch (e) {
      throw ErrorHandler.handle(e);
    }
  }

  Future<UserModel> getMe() async {
    try {
      final res = await _dio.get(ApiConstants.me);
      return UserModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } catch (e) {
      throw ErrorHandler.handle(e);
    }
  }
}
