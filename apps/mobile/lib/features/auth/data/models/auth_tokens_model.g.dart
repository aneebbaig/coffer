// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_tokens_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AuthTokensModel _$AuthTokensModelFromJson(Map<String, dynamic> json) =>
    _AuthTokensModel(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
    );

Map<String, dynamic> _$AuthTokensModelToJson(_AuthTokensModel instance) =>
    <String, dynamic>{
      'accessToken': instance.accessToken,
      'refreshToken': instance.refreshToken,
    };
