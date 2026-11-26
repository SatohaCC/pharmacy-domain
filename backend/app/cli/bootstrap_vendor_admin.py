"""最初のシステムベンダー管理アカウントを発行するコンソール CLI。"""

import argparse
import getpass
import sys
from collections.abc import Sequence

from sqlalchemy.exc import OperationalError

from app.application.auth.commands import AuthCommandService
from app.application.auth.contracts import BootstrapVendorAdminInput
from app.application.foundation.errors import ApplicationError
from app.infrastructure.clock import SystemClock, Uuid4Generator
from app.infrastructure.config import load_settings
from app.infrastructure.persistence.auth_unit_of_work import SqlAlchemyAuthUnitOfWorkFactory
from app.infrastructure.persistence.database import create_app_engine
from app.infrastructure.security.jwt_codec import Hs256JwtTokenIssuer, Sha256TokenHasher
from app.infrastructure.security.password_hasher import ScryptPasswordHasher


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -B -m app.cli.bootstrap_vendor_admin",
        description="最初のシステムベンダー管理アカウント（vendor_admin）をコンソールから発行します。",
    )
    parser.add_argument(
        "--email",
        required=True,
        help="管理アカウントのメールアドレス（ログイン識別子）",
    )
    parser.add_argument(
        "--name",
        required=True,
        help="管理アカウントの表示名",
    )
    parser.add_argument(
        "--password-stdin",
        action="store_true",
        help="標準入力の 1 行目からパスワードを読み取ります（CI / スクリプト用）。",
    )
    return parser


def _read_password(from_stdin: bool) -> str:
    if from_stdin:
        raw = sys.stdin.readline()
        return raw.rstrip("\r\n")

    password = getpass.getpass("初期パスワード（13文字以上・3種類以上混在）: ")
    confirm = getpass.getpass("初期パスワード（確認入力）: ")
    if password != confirm:
        raise ValueError("確認用パスワードが一致しません。")
    return password


def main(argv: Sequence[str] | None = None) -> int:
    """初期ベンダー管理者アカウントを発行して終了コードを返す。"""
    parser = _build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        password = _read_password(bool(args.password_stdin))
        settings = load_settings()
    except (ValueError, EOFError) as exc:
        print(f"エラー: {exc}", file=sys.stderr)
        return 1

    engine = create_app_engine(settings.database_path)
    try:
        service = AuthCommandService(
            uow_factory=SqlAlchemyAuthUnitOfWorkFactory(engine),
            clock=SystemClock(),
            id_generator=Uuid4Generator(),
            password_hasher=ScryptPasswordHasher(),
            token_hasher=Sha256TokenHasher(),
            jwt_issuer=Hs256JwtTokenIssuer(
                secret_key=settings.jwt_secret_key,
                issuer=settings.jwt_issuer,
            ),
        )
        created = service.bootstrap_initial_vendor_admin(
            BootstrapVendorAdminInput(
                email=args.email,
                display_name=args.name,
                password=password,
            )
        )
    except ApplicationError as exc:
        print(f"エラー [{exc.code}]: {exc.message}", file=sys.stderr)
        return 1
    except OperationalError:
        print(
            "エラー: データベースのテーブルが見つかりません。"
            "先に alembic upgrade head を実行してください。",
            file=sys.stderr,
        )
        return 1
    finally:
        engine.dispose()

    print(
        f"初期ベンダー管理アカウントを発行しました: id={created.id}, "
        f"email={created.email}, display_name={created.display_name}, "
        f"roles={','.join(created.roles)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
