"""法人コンテキストが所有する識別子。"""

from dataclasses import dataclass

from app.domain.foundation.exceptions import DomainValidationError
from app.domain.foundation.identifiers import EntityId

_MAX_ID_LENGTH = 128


@dataclass(frozen=True, slots=True)
class CorporationId(EntityId):
    """法人（個人開設者を含む）を一意に識別する ID。"""

    def validate(self) -> None:
        super().validate()
        if len(self.value) > _MAX_ID_LENGTH:
            raise DomainValidationError(
                f"法人 ID は {_MAX_ID_LENGTH} 文字以内で指定してください。",
                details={"field": "corporation_id"},
            )
