import { describe, expect, it } from "vitest";
import type { Corporation } from "@/features/corporations/schemas";
import { getRelationPeriodStatus, hierarchyRoleLabel } from "./relationPresentation";
import { buildCorporateRelationGraph } from "./relationTree";
import type { CorporateRelation } from "./schemas";

function makeCorp(id: string, name: string): Corporation {
  return {
    id,
    category: "corporation",
    name,
    representative_name: "代表 太郎",
    corporate_number: "1111111111111",
    address: "東京都千代田区",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeRelation(
  overrides: Partial<CorporateRelation> &
    Pick<
      CorporateRelation,
      "id" | "source_corporation_id" | "target_corporation_id" | "relation_type"
    >,
): CorporateRelation {
  return {
    valid_from: "2026-01-01",
    valid_to: null,
    evidence: "登記簿確認",
    recorded_at: "2026-01-01T00:00:00Z",
    recorded_by: "vendor-1",
    ...overrides,
  };
}

describe("relationPresentation", () => {
  it("半開区間 [valid_from, valid_to) に従って期間状態を判定する", () => {
    expect(
      getRelationPeriodStatus({ valid_from: "2026-01-01", valid_to: "2026-06-01" }, "2026-05-31"),
    ).toBe("active");
    expect(
      getRelationPeriodStatus({ valid_from: "2026-01-01", valid_to: "2026-06-01" }, "2026-06-01"),
    ).toBe("ended");
    expect(
      getRelationPeriodStatus({ valid_from: "2026-07-01", valid_to: null }, "2026-06-01"),
    ).toBe("upcoming");
    expect(
      getRelationPeriodStatus({ valid_from: "2026-06-01", valid_to: null }, "2026-06-01"),
    ).toBe("active");
  });

  it("深さに応じた階層役割ラベルを返す", () => {
    expect(hierarchyRoleLabel(0)).toBe("親法人");
    expect(hierarchyRoleLabel(1)).toBe("子法人");
    expect(hierarchyRoleLabel(2)).toBe("孫法人");
    expect(hierarchyRoleLabel(3)).toBe("第4階層");
  });
});

describe("buildCorporateRelationGraph", () => {
  it("親→子→孫の多段階層と複数ルートを構築し、対象法人を強調する", () => {
    const corps = [
      makeCorp("h1", "株式会社ホールディングス"),
      makeCorp("c1", "株式会社子薬局"),
      makeCorp("g1", "株式会社孫薬局"),
      makeCorp("h2", "株式会社別グループ親"),
      makeCorp("c2", "株式会社別グループ子"),
    ];
    const relations = [
      makeRelation({
        id: "r1",
        source_corporation_id: "h1",
        target_corporation_id: "c1",
        relation_type: "parent_child",
      }),
      makeRelation({
        id: "r2",
        source_corporation_id: "c1",
        target_corporation_id: "g1",
        relation_type: "parent_child",
      }),
      makeRelation({
        id: "r3",
        source_corporation_id: "h2",
        target_corporation_id: "c2",
        relation_type: "parent_child",
      }),
    ];

    const graph = buildCorporateRelationGraph({
      corporations: corps,
      relations,
      referenceDate: "2026-06-01",
      focusCorporationId: "c1",
    });

    expect(graph.parentChildCount).toBe(3);
    expect(graph.otherRelationCount).toBe(0);
    expect(graph.hierarchyRoots).toHaveLength(2);
    expect(graph.hierarchyRoots.map((root) => root.corporationId)).toEqual(["h1", "h2"]);

    const firstRoot = graph.hierarchyRoots[0];
    expect(firstRoot).toBeDefined();
    expect(firstRoot?.descendantCount).toBe(2);
    expect(firstRoot?.children[0]?.corporationId).toBe("c1");
    expect(firstRoot?.children[0]?.isFocusCorporation).toBe(true);
    expect(firstRoot?.children[0]?.children[0]?.corporationId).toBe("g1");
    expect(firstRoot?.children[0]?.children[0]?.depth).toBe(2);
    expect(graph.collapsibleNodeKeys).toEqual(
      expect.arrayContaining(["root:h1", "edge:r1", "root:h2"]),
    );
  });

  it("買収等で終了済み親と現行親が並存する場合、終了済み親側では孫の重複展開を抑止する", () => {
    const corps = [
      makeCorp("old-p", "旧親法人"),
      makeCorp("new-p", "新親法人"),
      makeCorp("child", "子法人"),
      makeCorp("grand", "孫法人"),
    ];
    const relations = [
      makeRelation({
        id: "r-old",
        source_corporation_id: "old-p",
        target_corporation_id: "child",
        relation_type: "parent_child",
        valid_from: "2024-01-01",
        valid_to: "2026-04-01",
      }),
      makeRelation({
        id: "r-new",
        source_corporation_id: "new-p",
        target_corporation_id: "child",
        relation_type: "parent_child",
        valid_from: "2026-04-01",
        valid_to: null,
      }),
      makeRelation({
        id: "r-grand",
        source_corporation_id: "child",
        target_corporation_id: "grand",
        relation_type: "parent_child",
        valid_from: "2024-01-01",
        valid_to: null,
      }),
    ];

    const graph = buildCorporateRelationGraph({
      corporations: corps,
      relations,
      referenceDate: "2026-06-01",
    });

    const oldRoot = graph.hierarchyRoots.find((r) => r.corporationId === "old-p");
    const newRoot = graph.hierarchyRoots.find((r) => r.corporationId === "new-p");
    expect(oldRoot?.children[0]?.incomingPeriodStatus).toBe("ended");
    expect(oldRoot?.children[0]?.children).toHaveLength(0);
    expect(newRoot?.children[0]?.incomingPeriodStatus).toBe("active");
    expect(newRoot?.children[0]?.children[0]?.corporationId).toBe("grand");
  });

  it.each([false, true])(
    "開始予定の親と有効な親が並存しても有効な親の下で孫を展開する（期間をまたぐ閉路: %s）",
    (hasTemporalCycle) => {
      const corporations = [
        makeCorp("future", "法人A"),
        makeCorp("current", "法人Z"),
        makeCorp("child", "法人B"),
        makeCorp("grand", "孫法人"),
      ];
      const relations = [
        makeRelation({
          id: "future-child",
          source_corporation_id: "future",
          target_corporation_id: "child",
          relation_type: "parent_child",
          valid_from: "2026-07-01",
        }),
        makeRelation({
          id: "current-child",
          source_corporation_id: "current",
          target_corporation_id: "child",
          relation_type: "parent_child",
          valid_to: "2026-07-01",
        }),
        makeRelation({
          id: "child-grand",
          source_corporation_id: "child",
          target_corporation_id: "grand",
          relation_type: "parent_child",
        }),
      ];
      if (hasTemporalCycle) {
        relations.push(
          makeRelation({
            id: "child-current",
            source_corporation_id: "child",
            target_corporation_id: "current",
            relation_type: "parent_child",
            valid_from: "2026-07-01",
          }),
        );
      }

      const graph = buildCorporateRelationGraph({
        corporations,
        relations,
        referenceDate: "2026-06-01",
      });

      expect(graph.hierarchyRoots.map((root) => root.corporationId)).toEqual(["future", "current"]);
      const [futureRoot, currentRoot] = graph.hierarchyRoots;
      expect(futureRoot?.children[0]?.incomingPeriodStatus).toBe("upcoming");
      expect(futureRoot?.children[0]?.children).toHaveLength(0);
      expect(currentRoot?.children[0]?.incomingPeriodStatus).toBe("active");
      expect(currentRoot?.children[0]?.children.map((node) => node.corporationId)).toContain(
        "grand",
      );
      expect(
        currentRoot?.children[0]?.children.some(
          (node) => node.corporationId === "current" && node.hasCycleReference,
        ),
      ).toBe(hasTemporalCycle);
    },
  );

  it("複数の終了済み親が並存する場合でも孫ノードは重複展開されない", () => {
    const corps = [
      makeCorp("old-p1", "旧親法人A"),
      makeCorp("old-p2", "旧親法人B"),
      makeCorp("child", "子法人"),
      makeCorp("grand", "孫法人"),
    ];
    const relations = [
      makeRelation({
        id: "r-old-1",
        source_corporation_id: "old-p1",
        target_corporation_id: "child",
        relation_type: "parent_child",
        valid_from: "2023-01-01",
        valid_to: "2024-01-01",
      }),
      makeRelation({
        id: "r-old-2",
        source_corporation_id: "old-p2",
        target_corporation_id: "child",
        relation_type: "parent_child",
        valid_from: "2024-01-01",
        valid_to: "2025-01-01",
      }),
      makeRelation({
        id: "r-grand",
        source_corporation_id: "child",
        target_corporation_id: "grand",
        relation_type: "parent_child",
        valid_from: "2023-01-01",
        valid_to: null,
      }),
    ];

    const graph = buildCorporateRelationGraph({
      corporations: corps,
      relations,
      referenceDate: "2026-06-01",
    });

    const firstRoot = graph.hierarchyRoots[0];
    const secondRoot = graph.hierarchyRoots[1];
    expect(firstRoot?.children[0]?.children.map((n) => n.corporationId)).toEqual(["grand"]);
    expect(secondRoot?.children[0]?.children).toHaveLength(0);
  });

  it("時間軸をまたぐ閉路があっても無限ループせずフォールバックルートから安全に打ち切る", () => {
    const corps = [makeCorp("a", "法人A"), makeCorp("b", "法人B")];
    const relations = [
      makeRelation({
        id: "r-ab",
        source_corporation_id: "a",
        target_corporation_id: "b",
        relation_type: "parent_child",
        valid_from: "2024-01-01",
        valid_to: "2025-01-01",
      }),
      makeRelation({
        id: "r-ba",
        source_corporation_id: "b",
        target_corporation_id: "a",
        relation_type: "parent_child",
        valid_from: "2025-01-01",
        valid_to: null,
      }),
    ];

    const graph = buildCorporateRelationGraph({
      corporations: corps,
      relations,
      referenceDate: "2026-06-01",
    });

    expect(graph.hierarchyRoots).toHaveLength(1);
    expect(graph.hierarchyRoots[0]?.corporationId).toBe("b");
    expect(graph.hierarchyRoots[0]?.children[0]?.corporationId).toBe("a");
    expect(graph.hierarchyRoots[0]?.children[0]?.children[0]?.hasCycleReference).toBe(true);
    expect(graph.hierarchyRoots[0]?.children[0]?.children[0]?.children).toHaveLength(0);
  });

  it("関連会社・FC/VC 契約を両端ノードの sideLinks と otherRelations に格納する", () => {
    const corps = [
      makeCorp("p", "親法人"),
      makeCorp("c", "子法人"),
      makeCorp("fc", "加盟薬局"),
      makeCorp("af", "関連企業"),
    ];
    const relations = [
      makeRelation({
        id: "r-pc",
        source_corporation_id: "p",
        target_corporation_id: "c",
        relation_type: "parent_child",
      }),
      makeRelation({
        id: "r-fc",
        source_corporation_id: "c",
        target_corporation_id: "fc",
        relation_type: "fc_vc",
      }),
      makeRelation({
        id: "r-af",
        source_corporation_id: "af",
        target_corporation_id: "p",
        relation_type: "affiliate",
      }),
    ];

    const graph = buildCorporateRelationGraph({
      corporations: corps,
      relations,
      referenceDate: "2026-06-01",
    });

    const parentNode = graph.hierarchyRoots[0];
    const childNode = parentNode?.children[0];
    expect(parentNode?.sideLinks[0]?.selfRoleLabel).toBe("関連先");
    expect(parentNode?.sideLinks[0]?.partnerRoleLabel).toBe("関連元");
    expect(parentNode?.sideLinks[0]?.partnerCorporationName).toBe("関連企業");
    expect(childNode?.sideLinks[0]?.selfRoleLabel).toBe("本部");
    expect(childNode?.sideLinks[0]?.partnerRoleLabel).toBe("加盟店");
    expect(childNode?.sideLinks[0]?.partnerCorporationName).toBe("加盟薬局");
    expect(graph.otherRelationCount).toBe(2);
    expect(graph.otherRelations.map((item) => item.relation.id)).toEqual(["r-fc", "r-af"]);
  });

  it("親子関係が 0 件で FC/VC 契約のみの場合も otherRelations を返す", () => {
    const corps = [makeCorp("hq", "本部法人"), makeCorp("fr", "加盟店法人")];
    const relations = [
      makeRelation({
        id: "r-fc",
        source_corporation_id: "hq",
        target_corporation_id: "fr",
        relation_type: "fc_vc",
      }),
    ];

    const graph = buildCorporateRelationGraph({
      corporations: corps,
      relations,
      referenceDate: "2026-06-01",
    });

    expect(graph.hierarchyRoots).toHaveLength(0);
    expect(graph.parentChildCount).toBe(0);
    expect(graph.otherRelationCount).toBe(1);
    expect(graph.otherRelations[0]?.sourceName).toBe("本部法人");
    expect(graph.otherRelations[0]?.targetName).toBe("加盟店法人");
  });
});
