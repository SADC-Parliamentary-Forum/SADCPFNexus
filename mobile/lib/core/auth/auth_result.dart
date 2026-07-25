class AuthResult {
  const AuthResult._({this.user, this.error, this.mfaRequired = false});
  final dynamic user;
  final String? error;
  final bool mfaRequired;

  factory AuthResult.success({dynamic user}) => AuthResult._(user: user);
  factory AuthResult.mfaPending({dynamic user}) =>
      AuthResult._(user: user, mfaRequired: true);
  factory AuthResult.failure(String message) => AuthResult._(error: message);

  bool get isSuccess => error == null && !mfaRequired;
}

class AuthBootstrapResult {
  const AuthBootstrapResult._({
    required this.isAuthenticated,
    this.user,
    this.isStale = false,
  });

  final bool isAuthenticated;
  final Map<String, dynamic>? user;
  final bool isStale;

  const AuthBootstrapResult.unauthenticated()
      : this._(isAuthenticated: false);

  factory AuthBootstrapResult.authenticated({
    Map<String, dynamic>? user,
    bool isStale = false,
  }) {
    return AuthBootstrapResult._(
      isAuthenticated: true,
      user: user,
      isStale: isStale,
    );
  }
}
