"""ScryptPasswordHasher の単体テスト。"""

from app.domain.auth.primitives import PlainPassword
from app.infrastructure.security.password_hasher import ScryptPasswordHasher


def test_scrypt_hash_and_verify() -> None:
    hasher = ScryptPasswordHasher()
    password = PlainPassword("VendorSecret123!")
    hashed = hasher.hash(password)

    assert hashed.value.startswith("scrypt$16384$8$1$")
    assert hasher.verify(password, hashed) is True
    assert hasher.verify("WrongPassword123!", hashed) is False
    hasher.dummy_verify()
