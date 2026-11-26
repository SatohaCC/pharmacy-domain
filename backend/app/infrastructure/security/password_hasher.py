"""Python 標準ライブラリ hashlib.scrypt を用いたパスワードハッシュ実装。"""

import base64
import hashlib
import hmac
import secrets

from app.domain.auth.primitives import PasswordHash, PlainPassword

_SCRYPT_N = 16384
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 32
_SALT_BYTES = 16
_SCHEME_PREFIX = "scrypt"


class ScryptPasswordHasher:
    """scrypt によるパスワードハッシュ化と定数時間検証を行う実装。"""

    def __init__(self) -> None:
        self._dummy_hash = self.hash(PlainPassword("DummyPassword123!"))

    def hash(self, password: PlainPassword) -> PasswordHash:
        """平文パスワードをソルト付き scrypt ハッシュへ変換する。"""
        salt = secrets.token_bytes(_SALT_BYTES)
        digest = hashlib.scrypt(
            password.value.encode("utf-8"),
            salt=salt,
            n=_SCRYPT_N,
            r=_SCRYPT_R,
            p=_SCRYPT_P,
            dklen=_SCRYPT_DKLEN,
        )
        encoded_salt = base64.urlsafe_b64encode(salt).decode("ascii")
        encoded_digest = base64.urlsafe_b64encode(digest).decode("ascii")
        return PasswordHash(
            f"{_SCHEME_PREFIX}${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${encoded_salt}${encoded_digest}"
        )

    def verify(self, password: PlainPassword | str, password_hash: PasswordHash) -> bool:
        """平文パスワードと保存済みハッシュを定数時間で照合する。"""
        raw_password = password.value if isinstance(password, PlainPassword) else password
        parts = password_hash.value.split("$")
        if len(parts) != 6 or parts[0] != _SCHEME_PREFIX:
            return False
        try:
            n = int(parts[1])
            r = int(parts[2])
            p = int(parts[3])
            salt = base64.urlsafe_b64decode(parts[4].encode("ascii"))
            expected_digest = base64.urlsafe_b64decode(parts[5].encode("ascii"))
        except ValueError:
            return False

        actual_digest = hashlib.scrypt(
            raw_password.encode("utf-8"),
            salt=salt,
            n=n,
            r=r,
            p=p,
            dklen=len(expected_digest),
        )
        return hmac.compare_digest(actual_digest, expected_digest)

    def dummy_verify(self) -> None:
        """ユーザー不在時のタイミング差を抑えるためダミー照合を実行する。"""
        self.verify("DummyMismatchPassword123!", self._dummy_hash)
