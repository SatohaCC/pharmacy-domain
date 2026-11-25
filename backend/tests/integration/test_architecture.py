"""オニオンアーキテクチャ層境界の統合チェック。"""

import ast
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


def test_error_modules_respect_onion_layer_boundaries() -> None:
    def imported_modules(rel_path: str) -> set[str]:
        tree = ast.parse((_BACKEND_ROOT / rel_path).read_text(encoding="utf-8"))
        modules: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                modules.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module is not None:
                modules.add(node.module)
        return modules

    domain_imports = imported_modules("app/domain/foundation/exceptions.py")
    assert all(
        not mod.startswith(("app.", "fastapi", "pydantic", "sqlalchemy")) for mod in domain_imports
    )

    app_error_imports = imported_modules("app/application/foundation/errors.py")
    assert all(not mod.startswith("app.domain") for mod in app_error_imports)

    for presentation_file in (
        "app/presentation/dto/error.py",
        "app/presentation/error_presenter.py",
        "app/presentation/error_handlers.py",
    ):
        imports = imported_modules(presentation_file)
        assert all(not mod.startswith("app.domain") for mod in imports), presentation_file
