import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';

class LoginUsecase {
  const LoginUsecase(this._repository);
  final AuthRepository _repository;

  Future<UserEntity> call({required String email, required String password, String? totp}) =>
      _repository.login(email: email, password: password, totp: totp);
}
