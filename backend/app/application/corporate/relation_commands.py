"""法人間関係の登録・訂正・終了ユースケース。"""

from collections.abc import Callable
from datetime import UTC, date, timedelta

from app.application.corporate.contracts import (
    CorporateRelationItem,
    CorrectCorporateRelationInput,
    RegisterCorporateRelationInput,
)
from app.application.corporate.ports import CorporateRelationUnitOfWorkFactory
from app.application.corporate.relation_mappers import to_relation_item
from app.application.foundation.error_mappers import from_domain_error
from app.application.foundation.ports import Clock, IdGenerator
from app.domain.corporate import (
    CorporateRelation,
    CorporateRelationId,
    CorporateRelationNotFoundError,
    CorporateRelationRevision,
    CorporateRelationType,
    CorporationEvidence,
    CorporationId,
    CorporationNotFoundError,
    validate_corporate_relation,
)
from app.domain.foundation import (
    AwareDatetime,
    DomainError,
    DomainValidationError,
    EffectiveDateRange,
)


def _parse_relation_type(value: str) -> CorporateRelationType:
    try:
        return CorporateRelationType(value)
    except ValueError as exc:
        raise DomainValidationError(
            "法人間関係の入力が不正です。", details={"field": "relation_type"}
        ) from exc


class CorporateRelationCommandService:
    """法人間関係を検証し、改訂を原子的に確定する。"""

    def __init__(
        self,
        *,
        uow_factory: CorporateRelationUnitOfWorkFactory,
        clock: Clock,
        id_generator: IdGenerator,
    ) -> None:
        self._uow_factory = uow_factory
        self._clock = clock
        self._id_generator = id_generator

    def register_relation(self, data: RegisterCorporateRelationInput) -> CorporateRelationItem:
        """両端の存在と関係制約を確認して登録する。"""
        try:
            source = CorporationId.parse(data.source_corporation_id)
            target = CorporationId.parse(data.target_corporation_id)
            period = EffectiveDateRange(data.valid_from, data.valid_to)
            kind = _parse_relation_type(data.relation_type)
            evidence = CorporationEvidence.parse(data.evidence)
            with self._uow_factory() as uow:
                relation = CorporateRelation(
                    CorporateRelationId(self._id_generator.new_id()),
                    source,
                    target,
                    kind,
                    (
                        CorporateRelationRevision(
                            period,
                            evidence,
                            AwareDatetime(self._clock.now()),
                            recorded_by=data.recorded_by,
                        ),
                    ),
                )
                if uow.corporations.get(source) is None or uow.corporations.get(target) is None:
                    raise CorporationNotFoundError()
                validate_corporate_relation(relation, uow.relations.list_overlapping(period))
                uow.relations.add(relation)
                uow.commit()
        except DomainError as exc:
            raise from_domain_error(exc) from exc
        return to_relation_item(relation, relation.current)

    def correct_relation(
        self, relation_id: str, data: CorrectCorporateRelationInput
    ) -> CorporateRelationItem:
        """訂正した期間で関係制約を検証する。"""

        def correct(relation: CorporateRelation, now: AwareDatetime) -> CorporateRelation:
            old = relation.current
            values = {
                "valid_from": data.valid_from,
                "valid_to": data.valid_to,
                "evidence": data.evidence,
            }
            fields = (
                data.provided_fields
                if data.provided_fields is not None
                else frozenset(field for field, value in values.items() if value is not None)
            )
            if not fields:
                raise DomainValidationError("訂正する項目を指定してください。", code="EMPTY_UPDATE")
            for field in fields - {"valid_to"}:
                if values.get(field) is None:
                    raise DomainValidationError(
                        "訂正項目に null は指定できません。", details={"field": field}
                    )
            period = EffectiveDateRange(
                data.valid_from
                if "valid_from" in fields and data.valid_from is not None
                else old.period.valid_from,
                data.valid_to if "valid_to" in fields else old.period.valid_to,
            )
            evidence = (
                CorporationEvidence.parse(data.evidence)
                if "evidence" in fields and data.evidence is not None
                else old.evidence
            )
            return relation.correct(
                CorporateRelationRevision(
                    period,
                    evidence,
                    now,
                    recorded_by=data.recorded_by,
                )
            )

        return self._update(relation_id, correct)

    def end_relation(
        self,
        relation_id: str,
        end_date: date,
        *,
        recorded_by: str | None = None,
    ) -> CorporateRelationItem:
        """最新の関係を切替日で終了する。"""
        return self._update(
            relation_id,
            lambda relation, now: relation.end(
                end_date=end_date, recorded_at=now, recorded_by=recorded_by
            ),
        )

    def _update(
        self,
        relation_id: str,
        edit: Callable[[CorporateRelation, AwareDatetime], CorporateRelation],
    ) -> CorporateRelationItem:
        try:
            parsed_id = CorporateRelationId.parse(relation_id)
            with self._uow_factory() as uow:
                relation = uow.relations.get(parsed_id)
                if relation is None:
                    raise CorporateRelationNotFoundError()
                now = AwareDatetime(self._clock.now()).value.astimezone(UTC)
                previous = relation.current.recorded_at.value.astimezone(UTC)
                # 同じ時刻に続いた操作も保存順に並べられる時刻を設定する。
                if now <= previous:
                    now = previous + timedelta(microseconds=1)
                updated = edit(relation, AwareDatetime(now))
                period = updated.current.period
                validate_corporate_relation(updated, uow.relations.list_overlapping(period))
                uow.relations.save(updated)
                uow.commit()
        except DomainError as exc:
            raise from_domain_error(exc) from exc
        return to_relation_item(updated, updated.current)
